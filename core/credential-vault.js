/** Profile-bound encrypted credential broker. Secrets never persist outside the envelope. */
(function (root) {
  'use strict';
  const CONSUMERS = Object.freeze({
    'cli.codex': 'openai', 'app.codex': 'openai', 'cli.agy': 'google', 'cli.gemini': 'google',
    'cli.claude': 'anthropic', 'cli.xai': 'xai', 'cli.git': 'github', 'cli.gh': 'github'
  });
  const PROVIDERS = new Set(Object.values(CONSUMERS));
  const ITERATIONS = 600000, MAX_ENVELOPE = 2 * 1024 * 1024;
  const clone = value => JSON.parse(JSON.stringify(value));
  const bytes = text => new TextEncoder().encode(text);
  const encode = value => {
    let result = ''; for (const b of value) result += String.fromCharCode(b);
    return btoa(result);
  };
  const decode = value => {
    if (typeof value !== 'string' || value.length > MAX_ENVELOPE) throw new Error('Invalid vault encoding.');
    try { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); } catch { throw new Error('Invalid vault encoding.'); }
  };
  function validatePassword(password) {
    const valid = typeof password === 'string' && password.length >= 14 && password.length <= 1024;
    return {valid, errors: valid ? [] : ['Use a master passphrase between 14 and 1024 characters.']};
  }
  function validateSecret(secret) {
    if (!secret || typeof secret !== 'object' || Array.isArray(secret)) throw new Error('A real tool credential is required.');
    const value = secret.accessToken || secret.access_token || secret.apiKey || secret.OPENAI_API_KEY || secret.tokens?.access_token;
    if (typeof value !== 'string' || !value.trim() || /^oauth-[a-z]+-\d+$/i.test(value)) throw new Error('A placeholder login is not a provider credential. Import a real tool login.');
    if (bytes(JSON.stringify(secret)).length > 256 * 1024) throw new Error('Credential record exceeds the size limit.');
    return clone(secret);
  }
  function validateData(value) {
    if (!value || !Array.isArray(value.credentials) || value.credentials.length > 100 || !value.bindings || typeof value.bindings !== 'object' || Array.isArray(value.bindings)) throw new Error('Invalid vault records.');
    const seen = new Set();
    for (const entry of value.credentials) {
      if (!/^[a-f0-9-]{36}$/i.test(entry.id || '') || seen.has(entry.id) || !PROVIDERS.has(entry.provider) || typeof entry.accountId !== 'string' || !entry.accountId || entry.accountId.length > 256 || typeof entry.label !== 'string' || entry.label.length > 160) throw new Error('Invalid saved login.');
      validateSecret(entry.secret); seen.add(entry.id);
    }
    for (const [consumer, id] of Object.entries(value.bindings)) {
      const entry = value.credentials.find(c => c.id === id);
      if (!Object.hasOwn(CONSUMERS, consumer) || !entry || CONSUMERS[consumer] !== entry.provider) throw new Error('Invalid subsystem link.');
    }
    return clone({credentials:value.credentials,bindings:value.bindings});
  }
  function parseCodex(text) {
    if (typeof text !== 'string' || bytes(text).length > 256 * 1024) throw new Error('Codex login file exceeds the size limit.');
    let auth; try { auth = JSON.parse(text); } catch { throw new Error('Select a valid Codex login JSON file.'); }
    validateSecret(auth);
    if (!auth.tokens?.access_token && !auth.OPENAI_API_KEY) throw new Error('This file is not a supported Codex login record.');
    const accountId = String(auth.tokens?.account_id || auth.account_id || 'api-key-' + crypto.randomUUID());
    return {provider:'openai', accountId, label:auth.tokens?.account_id ? 'Codex · ' + accountId.slice(0,32) : 'Codex API key', secret:auth};
  }
  function create({profileId, isCurrent, readRecord, writeRecord, deleteRecord, onRevoke = () => {}}) {
    if (typeof profileId !== 'string' || !/^private(?:_[a-zA-Z0-9_-]+)?$/.test(profileId)) throw new Error('A private profile is required for the vault.');
    let active = true, key = null, salt = null, iterations = ITERATIONS, revision = 0, record = null;
    let data = {credentials:[], bindings:{}}, queue = Promise.resolve();
    const leases = new Set();
    const check = generation => {
      if (!active || !isCurrent() || (generation !== undefined && generation !== revision)) throw new Error('The vault session changed. Unlock it in the intended profile.');
    };
    const unlocked = () => { check(); if (!key) throw new Error('Vault locked. Unlock it before using saved logins.'); };
    const aad = () => bytes('PortfoliOSVault|2|' + profileId);
    async function derive(password, saltBytes, rounds) {
      if (typeof password !== 'string' || !password || password.length > 1024) throw new Error('A master passphrase is required.');
      const base = await crypto.subtle.importKey('raw', bytes(password), 'PBKDF2', false, ['deriveKey']);
      return crypto.subtle.deriveKey({name:'PBKDF2', hash:'SHA-512', salt:saltBytes, iterations:rounds}, base, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
    }
    function revoke(consumer) {
      for (const lease of [...leases]) if (!consumer || lease.consumer === consumer) { lease.active = false; leases.delete(lease); }
      onRevoke(consumer);
    }
    const metadata = entry => ({id:entry.id, provider:entry.provider, accountId:entry.accountId, label:entry.label, consumers:Object.keys(data.bindings).filter(c=>data.bindings[c]===entry.id), activeAccess:[...leases].filter(l=>l.id===entry.id&&l.active).length});
    async function seal(snapshot, selectedKey, selectedSalt, rounds) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plain=bytes(JSON.stringify({version:2,profileId,...snapshot}));
      if(plain.length>1024*1024)throw new Error('Vault exceeds the supported storage limit.');
      const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:aad()}, selectedKey, plain);
      return {version:2,format:'portfolios-zk-vault',kdf:{algorithm:'PBKDF2',hash:'SHA-512',iterations:rounds,salt:encode(selectedSalt)},cipher:{algorithm:'AES-256-GCM',tagLength:128,iv:encode(iv)},ciphertext:encode(new Uint8Array(ciphertext))};
    }
    function serial(task) { const requested=revision;const operation=queue.catch(()=>{}).then(()=>{check(requested);return task();});queue=operation.catch(()=>{});return operation; }
    async function mutate(change) {
      return serial(async()=>{
        unlocked(); const generation = revision, selectedKey=key, snapshot=clone(data);
        const result = change(snapshot); validateData(snapshot);
        const envelope = await seal(snapshot, selectedKey, salt, iterations); check(generation);
        const next = await writeRecord(JSON.stringify(envelope), record); check(generation);
        record=next; data=snapshot; return result;
      });
    }
    const api = {
      profileId,
      get isUnlocked() { return active && isCurrent() && !!key; },
      validatePassword,
      async status() {
        check(); const saved = await readRecord(); check();
        return {isLocked:!key, initialized:!!saved, hasEncryptedBackup:!!saved, providers:key?[...new Set(data.credentials.map(c=>c.provider))]:[], tokenCount:key?data.credentials.length:0, credentials:key?data.credentials.map(metadata):[], activeAccess:leases.size};
      },
      initialize(password) {
        return serial(async()=>{
          check(); const generation=revision;
          const valid=validatePassword(password); if(!valid.valid) throw new Error(valid.errors[0]);
          const saved=await readRecord(); check(generation);
          if(saved) throw new Error('An encrypted vault already exists. Unlock it instead of replacing it.');
          const nextSalt=crypto.getRandomValues(new Uint8Array(32)), nextKey=await derive(password,nextSalt,ITERATIONS); check(generation);
          const empty={credentials:[],bindings:{}}, envelope=await seal(empty,nextKey,nextSalt,ITERATIONS); check(generation);
          const stored=await writeRecord(JSON.stringify(envelope),null); check(generation);
          record=stored; key=nextKey; salt=nextSalt; iterations=ITERATIONS; data=empty;
          return {success:true};
        });
      },
      unlock(password) {
        return serial(async()=>{
          check(); const generation=revision; const saved=await readRecord(); check(generation);
          if(!saved) throw new Error('Set up your vault passphrase first.');
          let envelope; try { if(saved.text.length>MAX_ENVELOPE) throw 0; envelope=JSON.parse(saved.text); } catch { throw new Error('Invalid vault envelope.'); }
          const rounds=envelope.kdf?.iterations;
          if(envelope.format!=='portfolios-zk-vault'||![1,2].includes(envelope.version)||envelope.kdf?.algorithm!=='PBKDF2'||envelope.kdf?.hash!=='SHA-512'||!Number.isInteger(rounds)||rounds<100000||rounds>1000000||envelope.cipher?.algorithm!=='AES-256-GCM'||envelope.cipher.tagLength!==128) throw new Error('Unsupported vault encryption parameters.');
          const nextSalt=decode(envelope.kdf.salt),iv=decode(envelope.cipher.iv),ciphertext=decode(envelope.ciphertext);
          if(nextSalt.length!==32||iv.length!==12||ciphertext.length<16) throw new Error('Invalid vault encryption data.');
          const nextKey=await derive(password,nextSalt,rounds); check(generation);
          let plain;
          try { plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,...(envelope.version===2?{additionalData:aad()}:{})},nextKey,ciphertext); } catch { throw new Error('Incorrect passphrase or damaged vault.'); }
          check(generation); let payload; try {payload=JSON.parse(new TextDecoder().decode(plain));}catch{throw new Error('Invalid vault records.');}
          if(payload.profileId!==profileId) throw new Error('This vault belongs to another profile.');
          let restored;
          if(envelope.version===1) {
            restored={credentials:[],bindings:{}};
            for(const [provider,secret] of Object.entries(payload.tokens||{})) {
              if(!PROVIDERS.has(provider)) throw new Error('Legacy vault contains an unsupported provider.');
              validateSecret(secret);
              const id=crypto.randomUUID();restored.credentials.push({id,provider,accountId:String(secret.account||provider),label:String(secret.account||provider).slice(0,160),secret:clone(secret)});
              const consumer=Object.keys(CONSUMERS).find(c=>CONSUMERS[c]===provider);if(consumer)restored.bindings[consumer]=id;
            }
          } else restored=validateData(payload);
          validateData(restored); check(generation);
          revoke();record=saved;data=restored;key=nextKey;salt=nextSalt;iterations=rounds;
          return {success:true,restored:[...new Set(data.credentials.map(c=>c.provider))],legacy:envelope.version===1};
        });
      },
      lock() { revision++; key=null;salt=null;data={credentials:[],bindings:{}};revoke(); },
      close() { api.lock();active=false; },
      list() { unlocked();return data.credentials.map(metadata); },
      binding(consumer) { unlocked();const entry=data.credentials.find(c=>c.id===data.bindings[consumer]);return entry?metadata(entry):null; },
      save({provider,accountId,label,secret,consumers=[]}) {
        if(!PROVIDERS.has(provider)||typeof accountId!=='string'||!accountId||accountId.length>256) return Promise.reject(new Error('A provider and account identifier are required.'));
        const safeSecret=validateSecret(secret);
        for(const consumer of consumers) if(!Object.hasOwn(CONSUMERS,consumer)||CONSUMERS[consumer]!==provider) return Promise.reject(new Error('Subsystem cannot use this provider.'));
        return mutate(snapshot=>{
          let entry=snapshot.credentials.find(c=>c.provider===provider&&c.accountId===accountId);
          if(!entry){entry={id:crypto.randomUUID(),provider,accountId,label:String(label||accountId).slice(0,160),secret:safeSecret};snapshot.credentials.push(entry);}else{entry.secret=safeSecret;entry.label=String(label||entry.label).slice(0,160);}
          for(const consumer of consumers)snapshot.bindings[consumer]=entry.id;
          return entry.id;
        }).then(id=>{for(const consumer of consumers)revoke(consumer);return api.list().find(c=>c.id===id);});
      },
      link(id,consumer) {
        return mutate(snapshot=>{
          const entry=snapshot.credentials.find(c=>c.id===id);
          if(!entry||!Object.hasOwn(CONSUMERS,consumer)||entry.provider!==CONSUMERS[consumer])throw new Error('Subsystem cannot use this saved login.');
          snapshot.bindings[consumer]=id;
        }).then(()=>{revoke(consumer);return api.binding(consumer);});
      },
      unlink(consumer) { return mutate(snapshot=>{delete snapshot.bindings[consumer];}).then(()=>revoke(consumer)); },
      removeUnused(id) {
        return mutate(snapshot=>{
          if(Object.values(snapshot.bindings).includes(id))throw new Error('This login is still linked to a subsystem. Unlink it before removing it.');
          snapshot.credentials=snapshot.credentials.filter(c=>c.id!==id);
        });
      },
      acquire(consumer) {
        unlocked();const entry=data.credentials.find(c=>c.id===data.bindings[consumer]);
        if(!Object.hasOwn(CONSUMERS,consumer)||!entry)throw new Error('Choose a saved login for this subsystem.');
        const lease={id:entry.id,consumer,active:true};leases.add(lease);
        return Object.freeze({id:entry.id,consumer,read(){unlocked();if(!lease.active||data.bindings[consumer]!==lease.id)throw new Error('Credential access has been revoked.');return clone(data.credentials.find(c=>c.id===lease.id).secret);},release(){lease.active=false;leases.delete(lease);}});
      },
      async purge() {
        return serial(async()=>{check();const generation=revision,saved=await readRecord();check(generation);if(saved)await deleteRecord(saved);check(generation);api.lock();record=null;return {success:true};});
      },
      checkpoint() { return mutate(()=>{}).then(()=>({success:true})); }
    };
    return Object.freeze(api);
  }
  root.CredentialVault = Object.freeze({create,validatePassword,parseCodex,consumers:CONSUMERS});
})(typeof window !== 'undefined' ? window : globalThis);
