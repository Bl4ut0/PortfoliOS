/** Runs outside the isolated game/AI shell; credentials remain in memory. */
(function () {
    const params = new URLSearchParams(location.hash.slice(1));
    const nonce = params.get("nonce");
    const button = document.getElementById("signin");
    const error = document.getElementById("error");
    if (!nonce || !/^[a-zA-Z0-9-]{16,80}$/.test(nonce) || !params.get("clientId")) {
        error.textContent = "Open sign-in from the PortfoliOS account chooser.";
        button.hidden = true;
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
    script.onload = () => { button.disabled = false; button.textContent = "Continue with Google"; };
    script.onerror = () => { error.textContent = "Google sign-in could not load. Check your connection and reopen sign-in."; report({ error: { message: error.textContent } }); };
    document.head.appendChild(script);
    button.addEventListener("click", () => {
        button.disabled = true;
        error.textContent = "";
        try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: params.get("clientId"),
                scope: "openid email profile https://www.googleapis.com/auth/drive.file",
                include_granted_scopes: true,
                callback: response => {
                    if (response.error) { report({ error: response }); error.textContent = "Google sign-in was not completed. Return to PortfoliOS and try again."; return; }
                    report({ response: { access_token: response.access_token, expires_in: response.expires_in } });
                    document.getElementById("status").textContent = "Google connected. Return to PortfoliOS to continue.";
                    button.hidden = true;
                    setTimeout(() => window.close(), 700);
                },
                error_callback: reason => { report({ error: reason }); error.textContent = "Google sign-in was closed or blocked. Return to PortfoliOS and try again."; }
            });
            client.requestAccessToken({ prompt: params.get("prompt") === "select_account" ? "select_account" : "", hint: params.get("hint") || "" });
        } catch (reason) { report({ error: { message: reason.message } }); error.textContent = reason.message; }
    });
    window.addEventListener("pagehide", () => { if (!completed) report({ error: { type: "popup_closed" } }); channel.close(); });
})();
