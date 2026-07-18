(function() {
    const refresh = () => window.renderLinuxInfo?.();

    window.appRegistry.linux = {
        title: "lab@bl4ut0:~",
        icon: "fa-brands fa-linux",
        windowClass: "linux-window service-window",
        renderBody: () => window.renderAppTemplate("linux"),
        onOpen: refresh,
        onRestore: refresh,
        onFocus: refresh
    };
})();
