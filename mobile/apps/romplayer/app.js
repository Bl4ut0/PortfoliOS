(function () {
  const systems = [
    ["nes", "NES", "NES", "nes,fds,unif,unf"],
    ["snes", "SNES", "SNES", "smc,sfc,swc,fig"],
    ["gb", "Game Boy", "Game Boy", "gb,gbc,dmg"],
    ["gba", "Game Boy Advance", "Game Boy Advance", "gba"],
    ["segaMD", "Sega Genesis", "Sega Genesis", "md,smd,gen,bin"],
    ["segaMS", "Master System", "Sega Master System", "sms,sg"],
    ["segaGG", "Game Gear", "Sega Game Gear", "gg"],
  ];
  let selected = "nes",
    generation = 0,
    paused = false,
    removeAudio = null,
    pendingImport = null;
  const esc = (value) => window.PortfolioOSMobileFramework.escapeHtml(value);
  const system = () =>
    systems.find((item) => item[0] === selected) || systems[0];
  const message = (root, type, detail = {}) =>
    root
      .querySelector("iframe")
      ?.contentWindow?.postMessage(
        { source: "romplayer", type, ...detail },
        window.location.origin,
      );
  async function refresh(root) {
    const token = ++generation;
    const entry = system();
    const path = "/ROMs/" + entry[2];
    root.querySelector("[data-rom-import]").accept = entry[3]
      .split(",")
      .map((ext) => "." + ext)
      .join(",");
    const records = await window.SystemFS.readDir(path).catch(() => []);
    if (token !== generation) return;
    root.querySelector("[data-rom-list]").innerHTML =
      records
        .filter(
          (record) =>
            !record.isDirectory &&
            entry[3]
              .split(",")
              .includes(record.name.split(".").pop().toLowerCase()),
        )
        .map(
          (record) =>
            '<button type="button" data-rom-play="' +
            esc(record.path) +
            '">Play ' +
            esc(record.name) +
            "</button>",
        )
        .join("") ||
      "<p>No ROMs for this system. Import a game file from your device.</p>";
  }
  function stop(root) {
    const frame = root.querySelector("iframe");
    frame.onload = null;
    frame.src = "about:blank";
    frame.hidden = true;
    root.querySelector("[data-rom-stop]").hidden = true;
    root.querySelector("[data-rom-status]").textContent =
      "Game stopped. Use the emulator save controls before stopping to keep progress.";
  }
  async function play(root, path, signal) {
    const userId = window.state.currentUserId;
    const record = await window.SystemFS.readFile(path);
    if (!record || signal?.aborted || userId !== window.state.currentUserId)
      return;
    const frame = root.querySelector("iframe");
    const payload = {
      core: system()[0],
      rom: record.data instanceof Blob ? record.data : new Blob([record.data]),
      name: record.name,
      touch: true,
      volume: (window.state.volume ?? 70) / 100,
    };
    root.querySelector("[data-rom-status]").textContent =
      "Loading " + record.name + "…";
    frame.hidden = false;
    root.querySelector("[data-rom-stop]").hidden = false;
    frame.onload = () => {
      message(root, "launch", { payload });
      message(root, paused ? "pause" : "resume");
    };
    frame.src = "apps/romplayer/runtime.html?v=2026.10.09.2";
  }
  window.mobileAppRegistry.romplayer = {
    title: "ROM Player",
    icon: "fa-solid fa-gamepad",
    viewClass: "mobile-romplayer-app",
    render: () =>
      "<h2>ROM Player</h2><p>Import a compatible game file you own. Touch controls appear in the emulator. Cores download when you play; ROM imports stay on this device and are excluded from Drive backup.</p><label>System<select data-rom-system>" +
      systems
        .map(
          (item) => '<option value="' + item[0] + '">' + item[1] + "</option>",
        )
        .join("") +
      '</select></label><label class="mobile-rom-import">Import ROM<input type="file" data-rom-import></label><p role="status" data-rom-status>Choose a game.</p><section data-rom-list></section><button type="button" data-rom-stop hidden>Stop game</button><iframe title="ROM emulator" hidden allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>',
    onOpen: async (root, { signal } = {}) => {
      paused = false;
      await refresh(root);
      removeAudio = window.registerAppAudioAdapter?.("mobile-romplayer", {
        setVolume: (value) => message(root, "volume", { value: value / 100 }),
      });
      window.addEventListener(
        "message",
        (event) => {
          const frame = root.querySelector("iframe");
          if (
            event.origin !== window.location.origin ||
            event.source !== frame.contentWindow ||
            event.data?.source !== "romplayer-runtime"
          )
            return;
          root.querySelector("[data-rom-status]").textContent =
            event.data.type === "error"
              ? String(event.data.detail)
              : "Emulator " +
                event.data.type +
                ". Use the on-screen controls to play.";
        },
        { signal },
      );
      root.addEventListener(
        "change",
        async (event) => {
          if (event.target.matches("[data-rom-system]")) {
            selected = event.target.value;
            await refresh(root);
            return;
          }
          if (!event.target.matches("[data-rom-import]")) return;
          const file = event.target.files[0];
          if (!file) return;
          if (pendingImport) return;
          event.target.disabled = true;
          pendingImport = (async () => {
            try {
              const entry = system();
              const name = file.name
                .replace(/[\\/:*?"<>|]/g, "-")
                .replace(/[\u0000-\u001f]/g, "")
                .slice(0, 120);
              if (
                !entry[3]
                  .split(",")
                  .includes(name.split(".").pop().toLowerCase())
              )
                throw Error("Choose a compatible ROM for " + entry[1] + ".");
              const parent = "/ROMs/" + entry[2];
              await window.SystemFS.ensureDirectory(parent, {
                silent: true,
                metadata: { sync: false, kind: "rom-system" },
              });
              if (signal?.aborted) return;
              const result = await window.SecurityKernel.importFile({
                path: parent + "/" + name,
                name,
                parent,
                data: file,
                size: file.size,
                type: file.type || "application/octet-stream",
                source: "mobile-romplayer",
                options: {
                  metadata: {
                    app: "romplayer",
                    kind: "rom",
                    system: entry[0],
                    sync: false,
                  },
                },
              });
              if (signal?.aborted) return;
              root.querySelector("[data-rom-status]").textContent =
                result.status === "accepted"
                  ? "ROM imported. Tap Play to begin."
                  : "File moved to quarantine by local policy.";
              await refresh(root);
            } catch (error) {
              root.querySelector("[data-rom-status]").textContent =
                error.message;
            } finally {
              event.target.disabled = false;
              event.target.value = "";
            }
          })();
          try {
            await pendingImport;
          } finally {
            pendingImport = null;
          }
        },
        { signal },
      );
      root.addEventListener(
        "click",
        async (event) => {
          const button = event.target.closest("[data-rom-play]");
          try {
            if (button) await play(root, button.dataset.romPlay, signal);
            if (event.target.closest("[data-rom-stop]")) stop(root);
          } catch (error) {
            root.querySelector("[data-rom-status]").textContent = error.message;
          }
        },
        { signal },
      );
    },
    onPause: (root) => {
      paused = true;
      message(root, "pause");
    },
    onResume: (root) => {
      paused = false;
      message(root, "resume");
    },
    serializeState: () => ({ selected }),
    restoreState: async (root, { state } = {}) => {
      selected = systems.some((item) => item[0] === state?.selected)
        ? state.selected
        : "nes";
      root.querySelector("select").value = selected;
      await refresh(root);
    },
    onClose: async (root) => {
      await pendingImport;
      generation++;
      stop(root);
      removeAudio?.();
      removeAudio = null;
    },
  };
})();
