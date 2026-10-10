async function triggerGDriveSync({ silent = false } = {}) {
    const syncBtn = document.getElementById("settings-gdrive-sync-btn");
    const progressContainer = document.getElementById("settings-gdrive-progress-container");
    const progressBar = document.getElementById("settings-gdrive-progress-bar");
    const progressText = document.getElementById("settings-gdrive-progress-text");
    const disconnectBtn = document.getElementById("settings-gdrive-disconnect-btn");

    if (!window.GDriveSync) return;

    if (progressContainer) progressContainer.style.display = "flex";
    if (syncBtn) syncBtn.disabled = true;
    if (disconnectBtn) disconnectBtn.disabled = true;

    try {
        if (window.savePreferencesToFilesystem) {
            await window.savePreferencesToFilesystem();
        }
        await window.GDriveSync.sync((processed, total, path) => {
            if (total === 0) {
                if (progressText) progressText.textContent = "Syncing... (No files)";
                if (progressBar) progressBar.style.width = "100%";
            } else {
                const percent = Math.round((processed / total) * 100);
                if (progressText) progressText.textContent = `Syncing [${processed}/${total}]: ${path.split("/").pop()}`;
                if (progressBar) progressBar.style.width = `${percent}%`;
            }
        });
        if (window.loadPreferencesFromFilesystem) {
            await window.loadPreferencesFromFilesystem();
        }
        const folderLabel = window.GDriveSync?.getCurrentFolderLabel ? window.GDriveSync.getCurrentFolderLabel() : "Google Drive";
        if (!silent && window.showDesktopToast) window.showDesktopToast(`Synced ${folderLabel}`);
        if (progressText) progressText.textContent = "Sync complete!";
        if (progressBar) progressBar.style.width = "100%";
        window.updateGDriveUI?.();
    } catch (err) {
        console.error("GDrive Sync error:", err);
        if (/\b(401|403)\b/.test(String(err?.message || err))) {
            await window.GDriveSync.invalidateSession("Google Drive rejected the saved session.");
            window.GDriveSync.showReconnectPrompt("Google Drive needs you to sign in again.");
        }
        if (progressText) progressText.textContent = "Sync failed.";
        if (progressBar) progressBar.style.width = "0%";
        if (!silent && !/\b(401|403)\b/.test(String(err?.message || err))) {
            alert("Synchronization failed: " + err.message);
        }
    } finally {
        if (syncBtn) syncBtn.disabled = false;
        if (disconnectBtn) disconnectBtn.disabled = false;
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = "none";
        }, 3000);
    }
}
window.triggerGDriveSync = triggerGDriveSync;
