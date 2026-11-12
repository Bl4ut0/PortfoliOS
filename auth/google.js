/** Runs outside the isolated game/AI shell; credentials remain in memory. */
(function () {
    const ALLOWED_CLIENT_ID = "271385155591-4g949illm5c7ke55rf9aupcko53iju53.apps.googleusercontent.com";
    const params = new URLSearchParams(location.hash.slice(1));
    const service = (params.get("service") || "drive").toLowerCase();
    const isAgy = service === "agy" || service === "antigravity" || service === "gemini";
    let nonce = params.get("nonce");
    if (!nonce || !/^[a-zA-Z0-9-]{16,80}$/.test(nonce)) {
        nonce = (window.crypto?.randomUUID ? window.crypto.randomUUID() : "auth-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12));
    }
    const clientId = params.get("clientId") || ALLOWED_CLIENT_ID;
    const button = document.getElementById("signin");
    const error = document.getElementById("error");
    const status = document.getElementById("status");

    const defaultBtnText = isAgy ? "Authorize with Google" : "Authorize Google Drive";

    const setButtonText = (text) => {
        const span = button ? button.querySelector(".btn-text") : null;
        if (span) span.textContent = text;
        else if (button) button.textContent = text;
    };

    const setError = (text) => {
        if (!error) return;
        error.textContent = text;
        error.hidden = !text;
    };

    const setStatus = (text) => {
        if (!status) return;
        status.textContent = text;
        status.hidden = !text;
    };

    if (clientId !== ALLOWED_CLIENT_ID) {
        setError("Open sign-in from the PortfoliOS account chooser.");
        if (button) button.hidden = true;
        return;
    }
    const channel = new BroadcastChannel("portfolios-google-" + nonce);
    let completed = false;
    const report = result => {
        if (completed) return;
        completed = true;
        channel.postMessage({ type: "google-auth-result", nonce, service, ...result });
    };

    function requestGoogleAccessToken() {
        if (!button) return;
        button.disabled = true;
        setError("");
        setButtonText("Connecting to Google…");
        try {
            const scopes = isAgy
                ? "openid email profile"
                : "openid email profile https://www.googleapis.com/auth/drive.file";

            const client = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: scopes,
                include_granted_scopes: true,
                callback: async response => {
                    console.log("[Google Auth] Callback response:", response);
                    if (completed) return;
                    if (response.error) {
                        console.error("[Google Auth] Error in response:", response.error);
                        report({ error: response });
                        setError("Google sign-in was not completed. Return to PortfoliOS and try again.");
                        button.disabled = false;
                        setButtonText(defaultBtnText);
                        return;
                    }
                    if (response.access_token) {
                        let email = "";
                        let profile = null;
                        try {
                            const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
                                headers: { Authorization: "Bearer " + response.access_token }
                            });
                            if (res.ok) {
                                profile = await res.json();
                                email = profile.email || "";
                            }
                        } catch (_) {}

                        report({
                            response: {
                                access_token: response.access_token,
                                expires_in: response.expires_in,
                                email,
                                profile
                            }
                        });
                        setStatus(isAgy ? "✓ Google Antigravity connected! Returning to Terminal…" : "✓ Google Drive connected! Returning to PortfoliOS…");
                        button.hidden = true;
                        setTimeout(() => window.close(), 700);
                    }
                },
                error_callback: reason => {
                    console.warn("[Google Auth] Error callback:", reason);
                    if (completed) return;
                    if (reason?.type === "popup_closed") {
                        // GIS triggers error_callback when the Google popup closes,
                        // which often races with callback() delivering the access token!
                        // Allow a grace period before showing retry state, and DO NOT abort parent session.
                        setTimeout(() => {
                            if (!completed) {
                                setError("Sign-in popup was closed. Click " + defaultBtnText + " to try again.");
                                button.disabled = false;
                                setButtonText(defaultBtnText);
                            }
                        }, 1200);
                        return;
                    }
                    setError(reason?.message || "Sign-in window closed or blocked. Click " + defaultBtnText + " to try again.");
                    button.disabled = false;
                    setButtonText(defaultBtnText);
                }
            });
            client.requestAccessToken({ prompt: params.get("prompt") === "select_account" ? "select_account" : "", hint: params.get("hint") || "" });
        } catch (reason) {
            report({ error: { message: reason.message } });
            setError(reason.message);
            button.disabled = false;
            setButtonText(defaultBtnText);
        }
    }

    function initGsiClient() {
        if (button) {
            button.disabled = false;
            setButtonText(defaultBtnText);
            button.onclick = () => requestGoogleAccessToken();
        }
    }

    if (window.google?.accounts?.oauth2) {
        initGsiClient();
    } else {
        const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
        if (existingScript) {
            existingScript.addEventListener("load", initGsiClient);
            existingScript.addEventListener("error", () => {
                setError("Google sign-in could not load. Check your connection and reopen sign-in.");
                report({ error: { message: error.textContent } });
            });
        } else {
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.onload = initGsiClient;
            script.onerror = () => {
                setError("Google sign-in could not load. Check your connection and reopen sign-in.");
                report({ error: { message: error.textContent } });
            };
            document.head.appendChild(script);
        }
    }

    button?.addEventListener("click", requestGoogleAccessToken);
    window.addEventListener("pagehide", () => {
        if (!completed) report({ error: { type: "popup_closed" } });
        try { channel.close(); } catch (_) {}
    });
})();
