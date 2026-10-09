(function () {
  const esc = (value) => window.PortfolioOSMobileFramework.escapeHtml(value);
  let query = "",
    category = "all";
  const alternatives = {
    office: "documents",
    musicmini: "music",
    webamp: "music",
    linux: "homelab",
    network: "homelab",
    cli: "local-ai",
  };
  function renderList(root) {
    const apps = (window.mobileAppCatalog || []).filter((app) =>
      window.isMobileAppAvailable(app),
    );
    const visible = apps.filter(
      (app) =>
        app.id !== "store" &&
        (category === "all" || app.category === category) &&
        (app.title + " " + (app.description || ""))
          .toLowerCase()
          .includes(query),
    );
    root.querySelector("[data-store-list]").innerHTML =
      visible
        .map((app) => {
          const installed = window.isMobileAppInstalled(app);
          return (
            '<article><div class="mobile-store-title"><i class="' +
            esc(app.icon) +
            '" aria-hidden="true"></i><div><h3>' +
            esc(app.title) +
            "</h3><small>" +
            esc(app.category) +
            " · " +
            (app.installable
              ? installed
                ? "Added to your profile"
                : "Available"
              : "Built in") +
            "</small></div></div><p>" +
            esc(
              app.description ||
                "Designed for the PortfoliOS phone experience.",
            ) +
            '</p><div class="mobile-store-actions"><button type="button" ' +
            (installed ? "data-store-open" : "data-store-add") +
            '="' +
            esc(app.id) +
            '">' +
            (installed ? "Open" : "Get") +
            "</button>" +
            (app.installable && installed
              ? '<button type="button" data-store-remove="' +
                esc(app.id) +
                '">Remove</button>'
              : "") +
            "</div></article>"
          );
        })
        .join("") || "<p>No matching apps.</p>";
    const desktop = (window.storeApps || []).filter(
      (app) => app.installable !== false,
    );
    root.querySelector("[data-store-desktop]").innerHTML = desktop
      .map((app) => {
        const target = apps.find(
          (mobile) => mobile.id === (alternatives[app.id] || app.id),
        );
        return (
          "<article><h3>" +
          esc(app.title) +
          "</h3><p>" +
          (target
            ? "Mobile: " + esc(target.title)
            : "Desktop only · Touch controls and runtime support still need adaptation.") +
          "</p>" +
          (target
            ? '<button type="button" data-store-focus="' +
              esc(target.id) +
              '">View mobile app</button>'
            : "") +
          "</article>"
        );
      })
      .join("");
  }
  window.mobileAppRegistry.store = {
    title: "Store",
    icon: "fa-solid fa-shop",
    viewClass: "mobile-store-app",
    render: () =>
      '<h2>App Store</h2><p>Made for your phone workspace. Your app library belongs to the active profile.</p><label>Search apps<input type="search" data-store-search placeholder="Find an app" autocomplete="off"></label><label>Category<select data-store-category><option value="all">All apps</option><option value="system">System</option><option value="productivity">Productivity</option><option value="media">Media</option><option value="games">Games</option><option value="portfolio">Portfolio</option></select></label><p role="status" data-store-status></p><section data-store-list></section><details><summary>Desktop game &amp; media library</summary><p>Available mobile versions and apps that still need adaptation.</p><div data-store-desktop></div></details>',
    onOpen: (root, { signal } = {}) => {
      renderList(root);
      root.addEventListener(
        "input",
        (event) => {
          if (event.target.matches("[data-store-search]")) {
            query = event.target.value.toLowerCase();
            renderList(root);
          }
        },
        { signal },
      );
      root.addEventListener(
        "change",
        (event) => {
          if (event.target.matches("[data-store-category]")) {
            category = event.target.value;
            renderList(root);
          }
        },
        { signal },
      );
      root.addEventListener(
        "click",
        async (event) => {
          const button = event.target.closest("button");
          if (!button) return;
          const id =
            button.dataset.storeOpen ||
            button.dataset.storeAdd ||
            button.dataset.storeRemove ||
            button.dataset.storeFocus;
          const app = (window.mobileAppCatalog || []).find(
            (item) => item.id === id && window.isMobileAppAvailable(item),
          );
          if (!app) return;
          if (button.hasAttribute("data-store-focus")) {
            query = app.title.toLowerCase();
            category = "all";
            root.querySelector("[data-store-search]").value = app.title;
            root.querySelector("[data-store-category]").value = "all";
            renderList(root);
            root
              .querySelector("[data-store-list]")
              ?.scrollIntoView({ block: "start" });
            return;
          }
          if (button.hasAttribute("data-store-open")) {
            await window.MobileOS.openApp(id);
            return;
          }
          if (!app.installable) return;
          button.disabled = true;
          const userId = window.state.currentUserId;
          try {
            if (button.hasAttribute("data-store-add")) {
              // Only download the launcher here. Emulator cores are loaded by Play.
              await window.ensureMobileAppLoaded(id);
              if (signal?.aborted || window.state.currentUserId !== userId)
                return;
              window.setInstalledStoreAppIds([
                ...window.getInstalledStoreAppIds(),
                id,
              ]);
              window.EventBus?.emit("app:installed", id);
            } else {
              window.setInstalledStoreAppIds(
                window.getInstalledStoreAppIds().filter((item) => item !== id),
              );
              window.EventBus?.emit("app:uninstalled", id);
            }
            root.querySelector("[data-store-status]").textContent =
              app.title +
              (button.hasAttribute("data-store-add")
                ? " added to your app library."
                : " removed. Your ROM files are kept.");
            renderList(root);
          } catch (error) {
            root.querySelector("[data-store-status]").textContent =
              error.message;
            button.disabled = false;
          }
        },
        { signal },
      );
    },
    onResume: renderList,
    serializeState: () => ({ query, category }),
    restoreState: (root, { state } = {}) => {
      query = typeof state?.query === "string" ? state.query.slice(0, 100) : "";
      category = [
        "all",
        "system",
        "productivity",
        "media",
        "games",
        "portfolio",
      ].includes(state?.category)
        ? state.category
        : "all";
      root.querySelector("[data-store-search]").value = query;
      root.querySelector("[data-store-category]").value = category;
      renderList(root);
    },
  };
})();
