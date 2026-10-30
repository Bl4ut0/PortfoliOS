/** Runs outside the isolated game/AI shell; credentials remain in memory. */
(function () {
    const ALLOWED_CLIENT_ID = "271385155591-4g949illm5c7ke55rf9aupcko53iju53.apps.googleusercontent.com";
    const params = new URLSearchParams(location.hash.slice(1));
    const nonce = params.get("nonce");
    const clientId = params.get("clientId");
    const button = document.getElementById("signin");
    const error = document.getElementById("error");
    const status = document.getElementById("status");

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

    if (!nonce || !/^[a-zA-Z0-9-]{16,80}$/.test(nonce) || clientId !== ALLOWED_CLIENT_ID) {
        setError("Open sign-in from the PortfoliOS account chooser.");
        if (button) button.hidden = true;
        return;
    }
    const channel = new BroadcastChannel("portfolios-google-" + nonce);
    let completed = false;
    const report = result => {
        completed = true;
        channel.postMessage({ type: "google-auth-result", nonce, ...result });
    };
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => {
        if (button) button.disabled = false;
        setButtonText("Continue with Google");
    };
    script.onerror = () => {
        setError("Google sign-in could not load. Check your connection and reopen sign-in.");
        report({ error: { message: error.textContent } });
    };
    document.head.appendChild(script);
    button?.addEventListener("click", () => {
        button.disabled = true;
        setError("");
        setButtonText("Connecting to Google…");
        try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: params.get("clientId"),
                scope: "openid email profile https://www.googleapis.com/auth/drive.file",
                include_granted_scopes: true,
                callback: response => {
                    if (response.error) {
                        report({ error: response });
                        setError("Google sign-in was not completed. Return to PortfoliOS and try again.");
                        button.disabled = false;
                        setButtonText("Continue with Google");
                        return;
                    }
                    report({ response: { access_token: response.access_token, expires_in: response.expires_in } });
                    setStatus("Google connected. Return to PortfoliOS to continue.");
                    button.hidden = true;
                    setTimeout(() => window.close(), 700);
                },
                error_callback: reason => {
                    report({ error: reason });
                    setError("Google sign-in was closed or blocked. Return to PortfoliOS and try again.");
                    button.disabled = false;
                    setButtonText("Continue with Google");
                }
            });
            client.requestAccessToken({ prompt: params.get("prompt") === "select_account" ? "select_account" : "", hint: params.get("hint") || "" });
        } catch (reason) {
            report({ error: { message: reason.message } });
            setError(reason.message);
            button.disabled = false;
            setButtonText("Continue with Google");
        }
    });
    window.addEventListener("pagehide", () => { if (!completed) report({ error: { type: "popup_closed" } }); channel.close(); });
})();
