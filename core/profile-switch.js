/** Account controls shared by Desktop and Mobile. */
(function () {
  let switching = null;
  const esc = (value) => window.escapeHtml(value);
  window.switchToPublicProfile = ({ saveToDrive = false, onProgress } = {}) => {
    if (switching) return switching;
    if (!window.isPrivateUser?.(window.state?.currentUserId))
      return Promise.resolve(true);
    const sync = window.GDriveSync;
    if (sync?.syncInProgress || sync?.authInProgress)
      return Promise.reject(
        new Error(
          "Wait for Google sign-in or the current backup to finish before switching.",
        ),
      );
    if (
      saveToDrive &&
      (!sync?.getToken() || sync.tokenUserId !== window.state.currentUserId)
    )
      return Promise.reject(
        new Error(
          "Reconnect Google Drive before saving, or switch with your changes kept on this device.",
        ),
      );
    const userId = window.state.currentUserId;
    if (sync) {
      sync.profileSwitchInProgress = true;
      window.clearTimeout(sync.pendingSyncTimer);
      sync.pendingSyncTimer = null;
    }
    switching = (async () => {
      // Closing editors flushes their drafts while the private account is still active.
      await window.prepareProfileSwitch({ allowProfileSwitch: true });
      await window.savePreferencesToFilesystem?.({ strict: true });
      if (saveToDrive) {
        onProgress?.("Saving your private workspace to Google Drive…");
        await sync.sync(undefined, { allowProfileSwitch: true }); // Retain private identity on backup failure.
      }
      if (window.state.currentUserId !== userId)
        throw new Error("The active account changed. Please try again.");
      sync?.closeReconnectPrompt();
      if (sync?.syncInProgress || sync?.authInProgress)
        throw new Error(
          "Wait for Google sign-in or backup to finish before switching.",
        );
      window.setCurrentUser("bl4ut0", { allowProfileSwitch: true });
      if (window.state.currentUserId !== "bl4ut0")
        throw new Error(
          "The public profile could not be activated. Your private workspace is still active.",
        );
      await window.SystemFS?.ensureDefaultFiles?.();
      window.state.sessionChosen = true;
      window.closeSessionChooser?.();
      return true;
    })().finally(() => {
      switching = null;
      if (sync) sync.profileSwitchInProgress = false;
    });
    return switching;
  };
  window.renderProfileSwitchControls = () => {
    const privateProfile = window.isPrivateUser?.(window.state?.currentUserId);
    const connected = privateProfile && window.GDriveSync?.getToken();
    return (
      '<div class="profile-switch-controls">' +
      "<p>" +
      esc(window.getAssistantSessionStatus?.() || "Choose your workspace.") +
      "</p>" +
      '<button type="button" data-profile-choose>Switch account / Google sign-in</button>' +
      (privateProfile
        ? '<button type="button" data-profile-public="save" ' +
          (connected ? "" : "disabled") +
          ">Save to Drive &amp; switch to public</button>" +
          '<button type="button" data-profile-public="local">Switch to Bl4ut0 public profile</button>' +
          "<small>Your private files, apps, and settings stay on this device. " +
          (connected
            ? "Save to Drive first to back up your latest changes."
            : "Drive is paused. Reconnect to back up your latest changes.") +
          "</small>"
        : "<small>The public workspace resets on reload. Remembered private accounts are available in Switch account.</small>") +
      '<p data-profile-switch-status role="status" aria-live="polite"></p></div>'
    );
  };
  window.bindProfileSwitchControls = (root, { signal } = {}) => {
    root.addEventListener(
      "click",
      async (event) => {
        if (event.target.closest("[data-profile-choose]")) {
          window.openSessionChooser?.();
          return;
        }
        const button = event.target.closest("[data-profile-public]");
        if (!button || button.disabled) return;
        const controls = button.closest(".profile-switch-controls");
        const status = controls.querySelector("[data-profile-switch-status]");
        const buttons = [...controls.querySelectorAll("button")];
        const disabled = buttons.map((node) => node.disabled);
        buttons.forEach((node) => {
          node.disabled = true;
        });
        status.textContent = "Saving local changes…";
        try {
          await window.switchToPublicProfile({
            saveToDrive: button.dataset.profilePublic === "save",
            onProgress: (message) => {
              status.textContent = message;
            },
          });
        } catch (error) {
          status.textContent = error.message;
          if (document.body.dataset.view === "mobile")
            window.MobileOS?.notify?.({
              title: "Profile switch paused",
              body: error.message,
            });
          else window.showDesktopToast?.(error.message);
        } finally {
          buttons.forEach((node, index) => {
            node.disabled = disabled[index];
          });
        }
      },
      signal ? { signal } : {},
    );
  };
})();
