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
        status: "Active session"
    }
];

window.getUserAccounts = () => window.userAccounts || [];

window.getCurrentUser = () => {
    const users = window.getUserAccounts();
    return users.find((user) => user.id === window.state?.currentUserId) || users[0] || null;
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
};
