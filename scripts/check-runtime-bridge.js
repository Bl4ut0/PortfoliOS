/**
 * PortfoliOS: Runtime Bridge & Binary Dispatcher Unit Tests
 * Validates session lifecycle, root / VFS mounting, ANSI decoding,
 * shebang execution, WebAssembly module dispatch, installed CLI wrappers,
 * PTY stream forwarding, and signal handling (\x03 SIGINT, \x04 EOF).
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const bridgeSource = fs.readFileSync(path.join(root, 'core', 'runtime-bridge.js'), 'utf8');

const files = new Map();
const mockSystemFS = {
  async ensureReady() {},
  normalizePath: (p) => p,
  async readFile(filePath) {
    if (files.has(filePath)) {
      return files.get(filePath);
    }
    return null;
  },
  async writeFile(filePath, name, parent, data, size, type, isDirectory=false, options={}) {
    const old=files.get(filePath);
    if(options.expectedAbsent&&old||options.expectedRecord&&options.expectedRecord.revision!==old?.revision)throw new Error('Concurrent change');
    const record={path:filePath,name,parent,data,size:size||data.length,isDirectory,revision:crypto.randomUUID()};
    files.set(filePath,record);return record;
  },
  async readDir(dirPath) {
    const list = [];
    for (const [k, v] of files.entries()) {
      if (v.parent === dirPath) list.push(v);
    }
    return list;
  },
  async deleteFile(filePath) {
    files.delete(filePath);
  },
  async unlink(filePath) {
    files.delete(filePath);
  },
  async ensureDirectory(dir) {}
};

const sandbox = {
  globalThis: null,
  window: null,
  document: {
    addEventListener: () => {},
    querySelectorAll: () => [], querySelector:()=>null,getElementById:()=>null
  },
  WebAssembly: globalThis.WebAssembly,
  TextEncoder: globalThis.TextEncoder,
  TextDecoder: globalThis.TextDecoder,
  AbortController: globalThis.AbortController,
  crypto: globalThis.crypto,
  Buffer: globalThis.Buffer,
  btoa: globalThis.btoa,
  atob: globalThis.atob,
  SystemFS: mockSystemFS,
  state: { currentUserId: 'private_fixture' },
  isPrivateUser: (user) => /^private_/.test(user||''),
  console
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const context = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'core/credential-vault.js'),'utf8'),context);
vm.runInContext(bridgeSource, context);

const Bridge = sandbox.window.PortfoliOSRuntimeBridge;
assert(Bridge, 'PortfoliOSRuntimeBridge must be defined on window');

(async () => {
  console.log('Running Runtime Bridge & Binary Dispatcher Tests...');

  // 1. Availability check
  assert.equal(Bridge.isAvailable(), true, 'Bridge must report available when WebAssembly and SystemFS exist');

  // 2. Profile security check
  await assert.rejects(
    async () => await Bridge.getOrCreateSession('public_guest_bad'),
    /A valid PortfoliOS profile is required/,
    'Public or invalid profiles must be rejected'
  );

  // 3. Create private session with root / mount
  const session = await Bridge.getOrCreateSession('private_fixture');
  assert.equal(session.active, true);
  assert.equal(session.mountRoot, '/');
  assert.equal(session.vfsRoot, '/');
  assert(session.allowedPaths.includes('/'));
  assert(session.allowedPaths.includes('/usr/local/bin'));
  assert(session.allowedPaths.includes('/documents'));

  // 4. Output stream ANSI decoding and PTY delivery
  const outputChunks = [];
  const testListener = (chunk) => outputChunks.push(chunk);
  session.ptyOutputListeners.add(testListener);
  session.emitOutput('\x1b[32mContainer ready\x1b[0m\n');
  assert(outputChunks.some(c => c.includes('Container ready')));
  session.ptyOutputListeners.delete(testListener);

  // 5. Auth detection via PTY stream
  let detectedAuth = null;
  sandbox.window.showTerminalAuthBanner = (meta) => { detectedAuth = meta; };
  session.emitOutput('To authenticate, visit https://auth0.openai.com/activate and enter code ABCD-EFGH');
  assert(detectedAuth, 'Device auth banner must be triggered on OAuth code output');
  assert.equal(detectedAuth.code, 'ABCD-EFGH');

  // 6. Shebang execution dispatch
  let shellScriptInvoked = false;
  sandbox.window.runShellScript = async (args, scriptText) => {
    shellScriptInvoked = true;
    return 'hello from shebang script';
  };
  await mockSystemFS.writeFile('/usr/local/bin/test-script.sh', 'test-script.sh', '/usr/local/bin', '#!/bin/sh\necho "hello"', 18, 'text/x-shellscript');
  
  const shebangOutput = [];
  const shebangRes = await Bridge.runProcess({
    profileId: 'private_fixture',
    cmd: 'test-script.sh',
    args: ['arg1'],
    onOutput: (c) => shebangOutput.push(c)
  });
  assert.equal(shebangRes.exitCode, 0);
  assert.equal(shellScriptInvoked, true, 'Shebang script must dispatch to runShellScript');

  // 7. Installed CLI wrapper metadata dispatch
  const binMeta = {
    bin: 'agy',
    name: 'Antigravity CLI',
    version: '1.5.5',
    provider: 'google'
  };
  const binWrapperContent = `#!/bin/sh\n#PORTFOLIOS_BIN:${JSON.stringify(binMeta)}\nexec portfolios-runtime-run agy "$@"`;
  await mockSystemFS.writeFile('/usr/local/bin/agy', 'agy', '/usr/local/bin', binWrapperContent, binWrapperContent.length, 'application/x-executable');

  // 7a. Version check
  const versionOutput = [];
  const verRes = await Bridge.runProcess({
    profileId: 'private_fixture',
    cmd: 'agy',
    args: ['--version'],
    onOutput: (c) => versionOutput.push(c)
  });
  assert.equal(verRes.exitCode, 0);
  assert(versionOutput.some(c => c.includes('Antigravity CLI v1.5.5')));

  // 7b. Doctor check
  const doctorOutput = [];
  const docRes = await Bridge.runProcess({
    profileId: 'private_fixture',
    cmd: 'agy',
    args: ['doctor'],
    onOutput: (c) => doctorOutput.push(c)
  });
  assert.equal(docRes.exitCode, 0);
  assert(doctorOutput.some(c => c.includes('[Doctor] CLI: agy v1.5.5')));
  assert(doctorOutput.some(c => c.includes('[Doctor] VFS Mount: /')));

  // 8. Signal handling (\x03 SIGINT Ctrl+C and \x04 EOF Ctrl+D)
  sandbox.window.PortfoliOSRuntime = {
    async execute() {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (session.activeProcess?.cancelled) {
            clearInterval(check);
            resolve({ exitCode: 130 });
          }
        }, 10);
      });
    }
  };

  const cancelPromise = Bridge.runProcess({
    profileId: 'private_fixture',
    cmd: 'interactive-tool',
    args: [],
    onOutput: () => {}
  });

  // Wait a tick then send Ctrl+C
  await new Promise(r => setTimeout(r, 25));
  Bridge.sendInput('\x03', 'private_fixture');
  const cancelRes = await cancelPromise;
  assert.equal(cancelRes.exitCode, 130, 'Cancelled process must return SIGINT exit code 130');

  // 9. Git Credential Helper and Vault Integration
  const vaultSession = await Bridge.getOrCreateSession('private_fixture');
  const vault = sandbox.window.PortfoliOSVault;
  const strongPassword = 'Master#SecureVaultKey987!';
  await vault.initWithPassphrase(strongPassword);
  await vaultSession.vault.saveToken('github', {
    accessToken: 'ghp_testsecret12345',
    account: 'octocat'
  });
  assert.equal(vaultSession.vaultTokens.has('github'), true);

  const gitHelperOutput = [];
  const gitRes = await Bridge.runProcess({
    profileId: 'private_fixture',
    cmd: 'git-credential-portfolios',
    args: ['get'],
    onOutput: (c) => gitHelperOutput.push(c)
  });
  assert.equal(gitRes.exitCode, 1);
  assert(!gitHelperOutput.some(c => c.includes('ghp_testsecret12345')));

  // Test window.PortfoliOSVault
  const vaultStatus = await vault.getStatus();
  assert(vaultStatus.providers.includes('github'));

  // 10. Vault password policy validation
  const weakCheck = vault.validatePassword('short');
  assert.equal(weakCheck.valid, false);
  const strongCheck = vault.validatePassword(strongPassword);
  assert.equal(strongCheck.valid, true);

  // 11. Vault init & export with AES-256-GCM + PBKDF2
  const initRes = await vault.checkpoint();
  assert.equal(initRes.success, true);
  const encFile = await mockSystemFS.readFile('/documents/vault.enc');
  assert(encFile, '/documents/vault.enc must exist after initWithPassphrase');
  const encParsed = JSON.parse(encFile.data);
  assert.equal(encParsed.format, 'portfolios-zk-vault');
  assert.equal(encParsed.cipher.algorithm, 'AES-256-GCM');

  // 12. Vault lock & unlock
  vault.lock();
  const lockedStatus = await vault.getStatus();
  assert.equal(lockedStatus.isLocked, true);
  assert.equal(lockedStatus.tokenCount, 0);

  const unlockRes = await vault.unlockWithPassphrase(strongPassword);
  assert.equal(unlockRes.success, true);
  assert(unlockRes.restored.includes('github'));
  const unlockedStatus = await vault.getStatus();
  assert.equal(unlockedStatus.isLocked, false);
  assert.equal(unlockedStatus.tokenCount, 1);

  // 13. Vault purge & reset (Recovery Option)
  const purgeRes = await vault.purgeAndReset();
  assert.equal(purgeRes.success, true);
  assert.equal(files.has('/documents/vault.enc'), false);
  assert.equal(files.has('/etc/portfolios/vault/github.json'), false);
  const purgedStatus = await vault.getStatus();
  assert.equal(purgedStatus.isLocked, true);
  assert.equal(purgedStatus.providers.length, 0);
  assert.equal(purgedStatus.hasEncryptedBackup, false);

  // 14. Session cleanup
  Bridge.closeAll();
  assert.equal(Bridge.getActiveSession(), null);

  console.log('PASS: Runtime Bridge & Binary Dispatcher test suite passed successfully.');
})().catch(err => {
  console.error('FAIL: Runtime Bridge test failure:', err);
  process.exit(1);
});
