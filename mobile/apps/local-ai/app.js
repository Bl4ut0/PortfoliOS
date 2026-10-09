(function () {
  let entries = [],
    pending = null;
  const esc = (value) => window.PortfolioOSMobileFramework.escapeHtml(value);
  function renderMessages(root) {
    root.querySelector("[data-lobe-messages]").innerHTML = entries
      .map(
        (entry) =>
          '<article class="' +
          entry.role +
          '"><strong>' +
          esc(entry.role === "user" ? "You" : "Lobe") +
          "</strong><p>" +
          esc(entry.text) +
          "</p></article>",
      )
      .join("");
  }
  function refresh(root) {
    root.querySelector("[data-lobe-session]").textContent =
      window.getAssistantSessionStatus?.() || "";
    const status = window.LocalAI?.getStatus?.();
    root.querySelector("[data-lobe-status]").textContent =
      status?.statusText ||
      "Basic assistant ready. Enable an AI model for longer conversations.";
    const select = root.querySelector("select");
    if (document.activeElement !== select) {
      select.innerHTML = (window.LocalAI?.getAvailableModels?.() || [])
        .map(
          (model) =>
            '<option value="' +
            esc(model.id) +
            '">' +
            esc(model.label) +
            "</option>",
        )
        .join("");
      select.value = window.LocalAI?.getSelectedModelId?.() || "";
    }
  }
  window.mobileAppRegistry["local-ai"] = {
    title: "Lobe",
    icon: "fa-solid fa-brain",
    viewClass: "mobile-local-ai-app",
    render: () =>
      '<h2>Lobe</h2><p data-lobe-session></p><details><summary>AI model</summary><p>Basic answers work immediately. Local models download on demand and need WebGPU. Cloud models use the provider configured in Desktop Settings.</p><label>Model<select aria-label="AI model"></select></label><button type="button" data-lobe-enable>Enable model</button><button type="button" data-lobe-disable>Turn model off</button><p data-lobe-status role="status"></p></details><section data-lobe-messages aria-live="polite"></section><form><label for="mobile-lobe-input">Message Lobe</label><textarea id="mobile-lobe-input" rows="3" maxlength="4000" placeholder="How can I help?"></textarea><div><button type="submit">Send</button><button type="button" data-lobe-stop>Stop</button><button type="button" data-lobe-clear>Clear</button></div></form>',
    onOpen: (root, { signal } = {}) => {
      refresh(root);
      renderMessages(root);
      root.addEventListener(
        "change",
        (event) => {
          if (event.target.matches("select")) {
            window.LocalAI?.setSelectedModelId(event.target.value);
            refresh(root);
          }
        },
        { signal },
      );
      root.addEventListener(
        "click",
        async (event) => {
          try {
            if (event.target.closest("[data-lobe-enable]"))
              await window.LocalAI?.enable("Mobile Lobe");
            if (event.target.closest("[data-lobe-disable]"))
              await window.LocalAI?.disable("mobile");
            if (event.target.closest("[data-lobe-stop]"))
              await window.LocalAI?.cancelGeneration("mobile-lobe");
            if (event.target.closest("[data-lobe-clear]")) {
              if (pending)
                await window.LocalAI?.cancelGeneration("mobile-lobe-clear");
              await pending?.catch(() => {});
              entries = [];
              renderMessages(root);
            }
            refresh(root);
          } catch (error) {
            root.querySelector("[data-lobe-status]").textContent =
              error.message;
          }
        },
        { signal },
      );
      root.querySelector("form").addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();
          if (pending) return;
          const input = root.querySelector("textarea");
          const prompt = input.value.trim();
          if (!prompt) return;
          input.value = "";
          entries.push({ role: "user", text: prompt });
          const answer = { role: "assistant", text: "Thinking…" };
          entries.push(answer);
          entries = entries.slice(-40);
          renderMessages(root);
          const button = root.querySelector('[type="submit"]');
          button.disabled = true;
          pending = (async () => {
            try {
              const immediate = window.getAssistantSessionAnswer?.(prompt);
              if (immediate) answer.text = immediate;
              else if (window.LocalAI?.isReady())
                answer.text = await window.LocalAI.chat(
                  prompt,
                  { mode: "mobile", user: window.state.currentUserId },
                  (text) => {
                    if (!signal?.aborted) {
                      answer.text = text;
                      renderMessages(root);
                    }
                  },
                );
              else
                answer.text =
                  window.SimpleBrain?.query(prompt) ||
                  "Enable an AI model for this request.";
            } catch (error) {
              answer.text = error.message;
            } finally {
              renderMessages(root);
              button.disabled = false;
              refresh(root);
            }
          })();
          try {
            await pending;
          } finally {
            pending = null;
          }
        },
        { signal },
      );
    },
    onResume: refresh,
    onPause: async () => {
      if (pending) {
        await window.LocalAI?.cancelGeneration("mobile-lobe-paused");
        await pending;
      }
    },
    serializeState: (root) => ({
      entries,
      draft: root.querySelector("textarea").value,
    }),
    restoreState: (root, { state } = {}) => {
      entries = Array.isArray(state?.entries)
        ? state.entries
            .filter(
              (entry) =>
                ["user", "assistant"].includes(entry?.role) &&
                typeof entry.text === "string",
            )
            .slice(-40)
            .map((entry) => ({
              role: entry.role,
              text: entry.text.slice(0, 20000),
            }))
        : [];
      root.querySelector("textarea").value =
        typeof state?.draft === "string" ? state.draft.slice(0, 4000) : "";
      renderMessages(root);
    },
    onClose: async () => {
      if (pending) {
        await window.LocalAI?.cancelGeneration("mobile-lobe-closed");
        await pending;
      }
      pending = null;
      entries = [];
    },
  };
})();
