(function () {
  const esc = (value) => window.PortfolioOSMobileFramework.escapeHtml(value);
  function refresh(root) {
    const tasks = window.MobileOS?.getTasks?.() || [];
    root.querySelector("[data-tasks]").innerHTML =
      tasks
        .map(
          (task) =>
            "<article><h3>" +
            esc(task.title) +
            "</h3><p>" +
            esc(
              task.status === "running" ? "Active" : "Paused · Ready to resume",
            ) +
            "</p>" +
            (task.id === "taskmgr"
              ? ""
              : '<button type="button" data-task-open="' +
                esc(task.id) +
                '">Resume</button><button type="button" data-task-close="' +
                esc(task.id) +
                '">Close app</button>') +
            "</article>",
        )
        .join("") || "<p>No running apps.</p>";
    const storage = root.querySelector("[data-task-storage]");
    navigator.storage
      ?.estimate?.()
      .then((info) => {
        storage.textContent =
          "Browser storage: " +
          Math.round((info.usage || 0) / 1048576) +
          " MB used of " +
          Math.round((info.quota || 0) / 1048576) +
          " MB available quota.";
      })
      .catch(() => {});
  }
  window.mobileAppRegistry.taskmgr = {
    title: "Task Manager",
    icon: "fa-solid fa-microchip",
    viewClass: "mobile-taskmgr-app",
    render: () =>
      '<h2>Running apps</h2><p>Apps pause in the background and resume from Recents. Closing an app releases its mobile task.</p><p data-task-storage></p><button type="button" data-task-refresh>Refresh</button><section data-tasks></section>',
    onOpen: (root, { signal } = {}) => {
      refresh(root);
      root.addEventListener(
        "click",
        async (event) => {
          const button = event.target.closest("button");
          if (!button) return;
          if (button.dataset.taskOpen)
            await window.MobileOS.openApp(button.dataset.taskOpen);
          else if (button.dataset.taskClose) {
            await window.MobileOS.closeTask(button.dataset.taskClose);
            refresh(root);
          } else refresh(root);
        },
        { signal },
      );
    },
    onResume: refresh,
  };
})();
