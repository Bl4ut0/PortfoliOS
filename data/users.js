/**
 * PortfoliOS: User Account Definitions
 * Keeps account identity separate from shell rendering so future multi-user support can grow cleanly.
 */

window.userAccounts = [
    {
        id: "bl4ut0",
        displayName: "Alex Mammen",
        handle: "Bl4ut0",
        role: "Owner",
        accountType: "Local administrator",
        avatar: "identity-portrait.jpg",
        accent: "#22d3ee",
        status: "Active session",
        privateProfile: false
    },
    {
        id: "private",
        displayName: "Private User",
        handle: "Cloud Sync",
        role: "User",
        accountType: "Private synced profile",
        avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='26' fill='%23090d14'/%3E%3Ccircle cx='48' cy='37' r='16' fill='%2322d3ee'/%3E%3Cpath d='M22 78c4-18 18-28 26-28s22 10 26 28' fill='%232dd4bf'/%3E%3C/svg%3E",
        accent: "#2dd4bf",
        status: "Synced profile",
        privateProfile: true,
        hiddenIds: [
            "profile", "dossier", "network", "devhub", "linux",
            "addons", "guildcraft", "homelab", "survival-ai", "status",
            "wardenit", "automation", "media"
        ],
        desktopIconLayout: {
            store: { col: 0, row: 0 },
            files: { col: 0, row: 1 },
            cli: { col: 0, row: 2 },
            romplayer: { col: 1, row: 0 },
            doomsource: { col: 1, row: 1 },
            duke32: { col: 1, row: 2 },
            diablo: { col: 1, row: 3 },
            quake: { col: 1, row: 4 },
            webamp: { col: 1, row: 5 }
        }
];

// Initialize private profile credentials from localStorage if saved
(function() {
    try {
        const savedProfileRaw = localStorage.getItem("bl4ut0_private_user_profile");
        if (savedProfileRaw) {
            const savedProfile = JSON.parse(savedProfileRaw);
            const privateAccount = window.userAccounts.find(a => a.id === "private");
            if (privateAccount && savedProfile.email && savedProfile.avatar) {
                privateAccount.displayName = savedProfile.email;
                privateAccount.handle = savedProfile.email.split('@')[0];
                privateAccount.avatar = savedProfile.avatar;
            }
        }
    } catch (e) {
        console.error("Failed to load private user profile", e);
    }
})();

window.getUserAccounts = () => window.userAccounts || [];

window.getCurrentUser = () => {
    const users = window.getUserAccounts();
    return users.find((user) => user.id === window.state?.currentUserId) || users[0] || null;
};

window.getCurrentUserHiddenIds = () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    return new Set(user?.hiddenIds || []);
};

window.isVisibleForCurrentUser = (id) => {
    if (!id) return false;
    return !window.getCurrentUserHiddenIds().has(id);
};

window.getCurrentDesktopIconLayout = () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    return user?.desktopIconLayout || window.defaultDesktopIconLayout || {};
};

window.getVisibleSystems = () => {
    return (window.systems || []).filter((item) => window.isVisibleForCurrentUser(item.id));
};

window.getVisibleDesktopApps = () => {
    return (window.desktopApps || []).filter((item) => window.isVisibleForCurrentUser(item.id));
};

window.applyCurrentUserProfile = () => {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user || !window.state) return;

    const desktop = window.byId ? window.byId("desktop-experience") : document.getElementById("desktop-experience");
    if (desktop) desktop.dataset.user = user.id;

    Array.from(window.state.openApps || []).forEach((appId) => {
        if (window.isVisibleForCurrentUser(appId)) return;
        if (window.closeDesktopWindow && document.querySelector(`[data-window="${appId}"]`)) {
            window.closeDesktopWindow(appId);
            return;
        }
        window.state.openApps.delete(appId);
        window.state.minimizedApps.delete(appId);
    });

    const visibleSystems = window.getVisibleSystems();
    if (!window.isVisibleForCurrentUser(window.state.activeId)) {
        window.state.activeId = visibleSystems[0]?.id || "";
    }
    if (window.state.mobileActiveId && !window.isVisibleForCurrentUser(window.state.mobileActiveId)) {
        window.state.mobileActiveId = null;
    }
    if (window.state.quickActiveId !== "overview" && !window.isVisibleForCurrentUser(window.state.quickActiveId)) {
        window.state.quickActiveId = "overview";
    }

    if (window.renderDesktopIcons) window.renderDesktopIcons();
    if (window.renderStartMenu) window.renderStartMenu();
    if (window.renderDossier) window.renderDossier(window.state.activeId);
    if (window.renderNetworkMap) window.renderNetworkMap();
    if (window.renderMobileApps) window.renderMobileApps();
    if (window.renderQuick) window.renderQuick();
    if (window.renderTaskbar) window.renderTaskbar();
    if (window.renderStore) window.renderStore();
};

window.setCurrentUser = (userId) => {
    const user = window.getUserAccounts().find((account) => account.id === userId);
    if (!user || !window.state) return;

    window.state.currentUserId = user.id;
    if (window.Storage) {
        window.Storage.local.set("bl4ut0CurrentUser", user.id);
    }
    if (window.EventBus) {
        window.EventBus.emit("user:changed", user);
    }
    if (window.applyCurrentUserProfile) {
        window.applyCurrentUserProfile();
    }
};
