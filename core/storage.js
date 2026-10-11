/**
 * PortfoliOS: Storage Utilities
 * Unified storage wrapper for localStorage and sessionStorage.
 */
window.Storage = {
    local: {
        /**
         * Get a value from localStorage, falling back to sessionStorage
         * @param {string} key
         * @returns {string|null}
         */
        get(key) {
            try {
                return window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
            } catch (e) {
                return null;
            }
        },
        /**
         * Set a value in localStorage, falling back to sessionStorage on failure
         * @param {string} key
         * @param {string} value
         * @returns {boolean} Success state
         */
        set(key, value) {
            try {
                window.localStorage.setItem(key, value);
                window.WorkspaceSessions?.markPreference(key);
                return true;
            } catch (e) {
                try {
                    window.sessionStorage.setItem(key, value);
                    return true;
                } catch (se) {
                    return false;
                }
            }
        },
        /**
         * Remove a value from both localStorage and sessionStorage
         * @param {string} key
         */
        remove(key) {
            try {
                window.localStorage.removeItem(key);
                window.sessionStorage.removeItem(key);
                window.WorkspaceSessions?.markPreference(key);
            } catch (e) {}
        }
    },
    session: {
        /**
         * Get a value from sessionStorage
         * @param {string} key
         * @returns {string|null}
         */
        get(key) {
            try {
                return window.sessionStorage.getItem(key);
            } catch (e) {
                return null;
            }
        },
        /**
         * Set a value in sessionStorage
         * @param {string} key
         * @param {string} value
         * @returns {boolean} Success state
         */
        set(key, value) {
            try {
                window.sessionStorage.setItem(key, value);
                return true;
            } catch (e) {
                return false;
            }
        },
        /**
         * Remove a value from sessionStorage
         * @param {string} key
         */
        remove(key) {
            try {
                window.sessionStorage.removeItem(key);
            } catch (e) {}
        }
    }
};

// Legacy compatibility aliases
window.storageRead = (key) => window.Storage.local.get(key);
window.storageWrite = (key, value) => window.Storage.local.set(key, value);
window.storageGet = (key) => window.Storage.session.get(key);
window.storageSet = (key, value) => window.Storage.session.set(key, value);

// Origin-wide coordination. Locks release automatically when a tab closes.
(() => {
    const revisionPrefix = 'portfolios:preference-revision:';
    const ownsKey = (key, owner) => {
        if(typeof key!=='string' || key==='bl4ut0_private_profiles')return false;
        const matches=id=>key.startsWith('bl4ut0_'+id+'_') || key==='bl4ut0_installed_apps_'+id || key.startsWith('desktop_pos_'+id+'_');
        if(!matches(owner))return false;
        return !Object.keys(window.getPrivateProfiles?.() || {}).some(id=>id!==owner && id.startsWith(owner+'_') && matches(id));
    };
    window.WorkspaceSessions = {
        ownsPreference: ownsKey,
        revision(key) { const value=Number(window.localStorage.getItem(revisionPrefix + key)); return Number.isFinite(value) && value>0?value:0; },
        markPreference(key) {
            const owner = window.state?.currentUserId;
            if (!window.isPrivateUser?.(owner) || !ownsKey(key, owner)) return;
            try { window.localStorage.setItem(revisionPrefix + key, String(Math.max(Date.now(), this.revision(key) + 1))); } catch {}
        },
        revisions(owner) {
            const revisions = Object.create(null);
            for (let i=0;i<window.localStorage.length;i++) {
                const stored=window.localStorage.key(i);
                if (!stored?.startsWith(revisionPrefix)) continue;
                const key=stored.slice(revisionPrefix.length);
                if (ownsKey(key,owner)) revisions[key]=this.revision(key);
            }
            return revisions;
        },
        adoptRevision(key, revision) { if (Number.isFinite(revision) && revision > 0) window.localStorage.setItem(revisionPrefix+key,String(revision)); },
        withLock(resource, owner, operation, {ifAvailable=false} = {}) {
            if (window.navigator?.locks) return window.navigator.locks.request('portfolios:'+resource+':'+owner, {mode:'exclusive',ifAvailable}, lock => {
                if (!lock) throw new Error('Another tab is backing up this account. Try again when it finishes.');
                if (owner !== window.state?.currentUserId) throw new Error('The profile changed while waiting for storage.');
                return operation();
            });
            // Non-browser contract harnesses have no navigator. Real browsers must
            // provide origin-wide locks rather than silently claiming protection.
            if (window.navigator && ifAvailable) return Promise.reject(new Error('This browser needs Web Locks support for safe multi-session backup.'));
            return Promise.resolve().then(operation);
        }
    };
    let refreshTimer;
    window.addEventListener?.('storage', event => {
        const owner=window.state?.currentUserId;
        const key=event.key?.startsWith(revisionPrefix)?event.key.slice(revisionPrefix.length):event.key;
        if (!window.isPrivateUser?.(owner) || !ownsKey(key,owner)) return;
        window.clearTimeout(refreshTimer);
        refreshTimer=window.setTimeout(()=>{
            if(owner!==window.state?.currentUserId)return;
            window.applyCurrentUserProfile?.();
            window.EventBus?.emit('preferences:external',{userId:owner});
            window.EventBus?.emit('theme:changed',{themeId:window.state.themeId,external:true});
        },30);
    });
})();
