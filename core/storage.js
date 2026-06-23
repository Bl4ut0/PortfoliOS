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
