/**
 * PortfoliOS: Pluggable Cloud Authentication Architecture (CloudAuth)
 * Provides an extensible registry and standard interface for OAuth 2.0 PKCE / token identity providers.
 *
 * Supported Drivers:
 * - Google (Google Identity Services / OAuth 2.0)
 * - Microsoft OneDrive (Microsoft Entra ID / Microsoft Graph OAuth 2.0 PKCE)
 * - Dropbox (Dropbox OAuth 2.0 PKCE)
 * - Nextcloud (Homelab / WebDAV OAuth 2.0)
 */
(function (global) {
    'use strict';

    // Base PKCE and Cryptographic Helpers
    function base64UrlEncode(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async function sha256(plain) {
        if (!global.crypto?.subtle) {
            throw new Error('Web Cryptography API (crypto.subtle) is required for PKCE code challenges.');
        }
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        return await global.crypto.subtle.digest('SHA-256', data);
    }

    function generateRandomString(length = 64) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        if (global.crypto?.getRandomValues) {
            const values = new Uint8Array(length);
            global.crypto.getRandomValues(values);
            return Array.from(values).map(x => charset[x % charset.length]).join('');
        }
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    }

    /**
     * Abstract Auth Driver Base
     */
    class BaseAuthDriver {
        constructor(config = {}) {
            this.id = config.id || 'base';
            this.name = config.name || 'Base Auth';
            this.icon = config.icon || 'fa-solid fa-key';
            this.description = config.description || '';
            this.scopes = config.scopes || '';
            this.defaultClientId = config.defaultClientId || '';
            this.supportsPkce = Boolean(config.supportsPkce);
        }

        async createPkcePair() {
            const verifier = generateRandomString(64);
            const challengeBuffer = await sha256(verifier);
            const challenge = base64UrlEncode(challengeBuffer);
            return { verifier, challenge };
        }

        async fetchProfile(_token) {
            throw new Error(`fetchProfile() not implemented by ${this.name} driver.`);
        }

        async validateToken(_token) {
            throw new Error(`validateToken() not implemented by ${this.name} driver.`);
        }

        async revokeToken(_token) {
            // Optional revocation
            return true;
        }
    }

    /**
     * 1. Google Identity / OAuth 2.0 Auth Driver
     */
    class GoogleAuthDriver extends BaseAuthDriver {
        constructor() {
            super({
                id: 'google',
                name: 'Google',
                icon: 'fa-brands fa-google',
                description: 'Sign in with your Google account to connect Google Drive backup.',
                scopes: 'openid email profile https://www.googleapis.com/auth/drive.file',
                defaultClientId: '271385155591-4g949illm5c7ke55rf9aupcko53iju53.apps.googleusercontent.com',
                supportsPkce: false
            });
            this.userinfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';
            this.revocationEndpoint = 'https://oauth2.googleapis.com/revoke';
        }

        async fetchProfile(token) {
            if (!token) throw new Error('Token is required to fetch Google profile.');
            const response = await fetch(this.userinfoEndpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Google profile request failed (${response.status}): ${text}`);
            }
            const data = await response.json();
            return {
                id: data.sub || '',
                sub: data.sub || '',
                name: data.name || '',
                email: data.email || '',
                picture: data.picture || '',
                provider: 'google'
            };
        }

        async validateToken(token) {
            try {
                const profile = await this.fetchProfile(token);
                return { valid: true, profile };
            } catch (err) {
                const msg = String(err.message || err);
                const isAuthError = /\b(401|403)\b/.test(msg);
                return { valid: isAuthError ? false : null, error: msg };
            }
        }

        async revokeToken(token) {
            if (!token) return true;
            try {
                await fetch(`${this.revocationEndpoint}?token=${encodeURIComponent(token)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                return true;
            } catch (_) {
                return false;
            }
        }
    }

    /**
     * 2. Microsoft Entra ID / Graph Auth Driver (OneDrive)
     */
    class MicrosoftAuthDriver extends BaseAuthDriver {
        constructor() {
            super({
                id: 'microsoft',
                name: 'Microsoft OneDrive',
                icon: 'fa-brands fa-microsoft',
                description: 'Sign in with your Microsoft personal or work account to sync via OneDrive AppFolder.',
                scopes: 'openid profile email Files.ReadWrite.AppFolder offline_access',
                defaultClientId: '', // Configurable via Settings or deploy config
                supportsPkce: true
            });
            this.authorizeEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
            this.tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
            this.profileEndpoint = 'https://graph.microsoft.com/v1.0/me';
        }

        getAuthorizeUrl({ clientId, redirectUri, state, codeChallenge }) {
            const params = new URLSearchParams({
                client_id: clientId || this.defaultClientId,
                response_type: 'code',
                redirect_uri: redirectUri,
                response_mode: 'query',
                scope: this.scopes,
                state: state || generateRandomString(16),
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
                prompt: 'select_account'
            });
            return `${this.authorizeEndpoint}?${params.toString()}`;
        }

        async exchangeCodeForToken({ clientId, code, codeVerifier, redirectUri }) {
            const body = new URLSearchParams({
                client_id: clientId || this.defaultClientId,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier
            });

            const response = await fetch(this.tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Microsoft token exchange failed (${response.status}): ${text}`);
            }

            return await response.json();
        }

        async fetchProfile(token) {
            if (!token) throw new Error('Token is required to fetch Microsoft profile.');
            const response = await fetch(this.profileEndpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Microsoft profile request failed (${response.status}): ${text}`);
            }
            const data = await response.json();
            return {
                id: data.id || '',
                sub: data.id || '',
                name: data.displayName || data.givenName || '',
                email: data.userPrincipalName || data.mail || '',
                picture: '', // Graph requires binary photo fetch at /me/photo/$value
                provider: 'microsoft'
            };
        }

        async validateToken(token) {
            try {
                const profile = await this.fetchProfile(token);
                return { valid: true, profile };
            } catch (err) {
                const msg = String(err.message || err);
                const isAuthError = /\b(401|403)\b/.test(msg);
                return { valid: isAuthError ? false : null, error: msg };
            }
        }
    }

    /**
     * 3. Dropbox Auth Driver
     */
    class DropboxAuthDriver extends BaseAuthDriver {
        constructor() {
            super({
                id: 'dropbox',
                name: 'Dropbox',
                icon: 'fa-brands fa-dropbox',
                description: 'Sign in with your Dropbox account to sync via sandboxed App folder.',
                scopes: 'account_info.read files.content.read files.content.write',
                defaultClientId: '',
                supportsPkce: true
            });
            this.authorizeEndpoint = 'https://www.dropbox.com/oauth2/authorize';
            this.tokenEndpoint = 'https://api.dropboxapi.com/oauth2/token';
            this.profileEndpoint = 'https://api.dropboxapi.com/2/users/get_current_account';
        }

        getAuthorizeUrl({ clientId, redirectUri, state, codeChallenge }) {
            const params = new URLSearchParams({
                client_id: clientId || this.defaultClientId,
                response_type: 'code',
                token_access_type: 'online',
                redirect_uri: redirectUri,
                state: state || generateRandomString(16),
                code_challenge: codeChallenge,
                code_challenge_method: 'S256'
            });
            return `${this.authorizeEndpoint}?${params.toString()}`;
        }

        async exchangeCodeForToken({ clientId, code, codeVerifier, redirectUri }) {
            const body = new URLSearchParams({
                client_id: clientId || this.defaultClientId,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier
            });

            const response = await fetch(this.tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Dropbox token exchange failed (${response.status}): ${text}`);
            }

            return await response.json();
        }

        async fetchProfile(token) {
            if (!token) throw new Error('Token is required to fetch Dropbox profile.');
            const response = await fetch(this.profileEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Dropbox profile request failed (${response.status}): ${text}`);
            }
            const data = await response.json();
            return {
                id: data.account_id || '',
                sub: data.account_id || '',
                name: data.name?.display_name || '',
                email: data.email || '',
                picture: data.profile_photo_url || '',
                provider: 'dropbox'
            };
        }

        async validateToken(token) {
            try {
                const profile = await this.fetchProfile(token);
                return { valid: true, profile };
            } catch (err) {
                const msg = String(err.message || err);
                const isAuthError = /\b(401|403)\b/.test(msg);
                return { valid: isAuthError ? false : null, error: msg };
            }
        }
    }

    /**
     * 4. Nextcloud / Self-Hosted WebDAV Auth Driver
     */
    class NextcloudAuthDriver extends BaseAuthDriver {
        constructor() {
            super({
                id: 'nextcloud',
                name: 'Nextcloud (Homelab)',
                icon: 'fa-solid fa-server',
                description: 'Connect your self-hosted Nextcloud server for complete data sovereignty.',
                scopes: '',
                defaultClientId: '',
                supportsPkce: true
            });
        }

        sanitizeServerUrl(serverUrl) {
            const raw = String(serverUrl || '').trim();
            if (!raw) throw new Error('Nextcloud server URL is required.');
            let parsed;
            try {
                parsed = new URL(raw);
            } catch {
                throw new Error('Invalid Nextcloud server URL.');
            }
            const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
            if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
                throw new Error('Nextcloud server must use a secure HTTPS URL.');
            }
            return parsed.origin + parsed.pathname.replace(/\/+$/, '');
        }

        getAuthorizeUrl({ serverUrl, clientId, redirectUri, state, codeChallenge }) {
            const cleanUrl = this.sanitizeServerUrl(serverUrl);
            const params = new URLSearchParams({
                client_id: clientId || this.defaultClientId,
                response_type: 'code',
                redirect_uri: redirectUri,
                state: state || generateRandomString(16)
            });
            if (codeChallenge) {
                params.set('code_challenge', codeChallenge);
                params.set('code_challenge_method', 'S256');
            }
            return `${cleanUrl}/apps/oauth2/authorize?${params.toString()}`;
        }

        async fetchProfile(token, serverUrl = '') {
            if (!token) throw new Error('Token or app password is required.');
            const cleanUrl = this.sanitizeServerUrl(serverUrl);

            const endpoint = `${cleanUrl}/ocs/v2.php/cloud/user?format=json`;
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'OCS-APIRequest': 'true'
                }
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Nextcloud profile request failed (${response.status}): ${text}`);
            }
            const data = await response.json();
            const user = data?.ocs?.data;
            return {
                id: user?.id || 'nextcloud-user',
                sub: user?.id || 'nextcloud-user',
                name: user?.displayname || user?.id || 'Nextcloud User',
                email: user?.email || '',
                picture: '',
                provider: 'nextcloud',
                serverUrl: cleanUrl
            };
        }

        async validateToken(token, serverUrl = '') {
            try {
                const profile = await this.fetchProfile(token, serverUrl);
                return { valid: true, profile };
            } catch (err) {
                const msg = String(err.message || err);
                return { valid: false, error: msg };
            }
        }
    }

    // ==========================================
    // Central Registry: window.CloudAuth
    // ==========================================
    const drivers = new Map();
    let activeDriverId = 'google';

    const CloudAuth = {
        BaseAuthDriver,
        GoogleAuthDriver,
        MicrosoftAuthDriver,
        DropboxAuthDriver,
        NextcloudAuthDriver,

        register(driver) {
            if (!driver || !driver.id) {
                throw new Error('Driver must have a valid string "id".');
            }
            drivers.set(driver.id, driver);
            return driver;
        },

        get(id) {
            return drivers.get(id) || null;
        },

        list() {
            return Array.from(drivers.values()).map(d => ({
                id: d.id,
                name: d.name,
                icon: d.icon,
                description: d.description,
                scopes: d.scopes,
                supportsPkce: d.supportsPkce,
                isConfigured: Boolean(d.defaultClientId || d.id === 'nextcloud' || d.id === 'google')
            }));
        },

        getActiveDriver() {
            return this.get(activeDriverId) || this.get('google');
        },

        setActiveDriver(id) {
            if (!drivers.has(id)) {
                throw new Error(`Auth driver "${id}" is not registered.`);
            }
            activeDriverId = id;
            if (global.EventBus) {
                global.EventBus.emit('cloud-auth:driver-changed', { driverId: id });
            }
        },

        async loginWithDriver(driverId, options = {}) {
            const driver = this.get(driverId);
            if (!driver) throw new Error(`Auth driver "${driverId}" is not registered.`);

            if (driverId === 'google') {
                if (!global.GDriveSync) throw new Error('Google Drive sync module is not available.');
                const clientId = driver.defaultClientId || global.GDriveSync.defaultClientId;
                await global.GDriveSync.login(clientId, options);
                return {
                    provider: 'google',
                    token: global.GDriveSync.getToken(),
                    profile: global.GDriveSync.googleProfile || global.GDriveSync.getSavedGoogleProfile?.()
                };
            }

            if (!driver.supportsPkce && driverId !== 'nextcloud') {
                throw new Error(`Auth driver "${driverId}" does not support PKCE authorization.`);
            }

            const resolvedClientId = options.clientId || 
                (global.Storage ? global.Storage.local.get('portfolios_cloud_client_id_' + driverId) : null) || 
                (typeof localStorage !== 'undefined' ? localStorage.getItem('portfolios_cloud_client_id_' + driverId) : null) || 
                driver.defaultClientId;

            const redirectUri = (global.location?.origin || 'https://os.bl4ut0.dev') + '/auth/callback.php';

            if (!resolvedClientId && driverId !== 'nextcloud') {
                const appName = driverId === 'microsoft' ? 'Microsoft Entra (Azure) Portal' : 'Dropbox Developer Console';
                throw new Error(`${driver.name} is not configured with an OAuth Client ID yet. Enter your Application (client) ID registered in ${appName} (Redirect URI: ${redirectUri}).`);
            }

            const nonce = generateRandomString(32);
            const { verifier, challenge } = await driver.createPkcePair();

            const authUrl = driver.getAuthorizeUrl({
                clientId: resolvedClientId,
                redirectUri,
                state: nonce,
                codeChallenge: challenge,
                serverUrl: options.serverUrl || ''
            });

            return new Promise((resolve, reject) => {
                if (!global.BroadcastChannel) {
                    return reject(new Error('BroadcastChannel is required for OAuth isolation.'));
                }
                const channel = new global.BroadcastChannel('portfolios-oauth-' + nonce);
                let settled = false;

                const timeout = global.setTimeout(() => {
                    cleanup();
                    reject(new Error(`${driver.name} sign-in timed out. Please try again.`));
                }, options.timeoutMs || 120_000);

                function cleanup() {
                    if (settled) return;
                    settled = true;
                    global.clearTimeout(timeout);
                    channel.close();
                }

                channel.onmessage = async (event) => {
                    const data = event.data;
                    if (settled || data?.nonce !== nonce || data.type !== 'oauth-callback') return;

                    if (data.error) {
                        cleanup();
                        reject(new Error(data.error));
                        return;
                    }

                    if (!data.code) {
                        cleanup();
                        reject(new Error(`No authorization code received from ${driver.name}.`));
                        return;
                    }

                    try {
                        const tokenResponse = await driver.exchangeCodeForToken({
                            clientId: resolvedClientId,
                            code: data.code,
                            codeVerifier: verifier,
                            redirectUri
                        });

                        const accessToken = tokenResponse.access_token;
                        if (!accessToken) throw new Error(`${driver.name} did not return an access token.`);

                        const profile = await driver.fetchProfile(accessToken, options.serverUrl);
                        cleanup();
                        resolve({
                            provider: driverId,
                            token: accessToken,
                            profile,
                            expiresIn: tokenResponse.expires_in || 3600
                        });
                    } catch (err) {
                        cleanup();
                        reject(err);
                    }
                };

                const popup = global.open ? global.open(authUrl, 'portfolios-oauth', 'popup,width=520,height=650') : null;
                if (!popup && global.open) {
                    cleanup();
                    reject(new Error(`${driver.name} sign-in was blocked. Allow popups for this site, then try again.`));
                }
            });
        },

        // Helper utilities
        generateRandomString,
        base64UrlEncode,
        sha256
    };

    // Auto-register built-in drivers
    CloudAuth.register(new GoogleAuthDriver());
    CloudAuth.register(new MicrosoftAuthDriver());
    CloudAuth.register(new DropboxAuthDriver());
    CloudAuth.register(new NextcloudAuthDriver());

    global.CloudAuth = CloudAuth;
})(typeof window !== 'undefined' ? window : globalThis);
