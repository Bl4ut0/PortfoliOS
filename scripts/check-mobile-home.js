const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const homeData = require("../data/mobile-home.js");

const ROOT = path.join(__dirname, "..");

function loadBrowserData(relativePath) {
    const window = {};
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, relativePath), "utf8"), { window }, { filename: relativePath });
    return window;
}

function ids(items) {
    return Array.from(items, (item) => item.id);
}

function duplicates(values) {
    const seen = new Set();
    return values.filter((value) => {
        if (seen.has(value)) return true;
        seen.add(value);
        return false;
    });
}

const catalogWindow = loadBrowserData("data/mobile-apps.js");
const systemsWindow = loadBrowserData("data/systems.js");
const catalog = catalogWindow.mobileAppCatalog;
const systems = systemsWindow.systems;
const privateCatalog = catalog.filter((app) => !(app.visibilitySourceId || app.sourceId));

assert.equal(catalog.length, 16);
assert.equal(catalog.find((app) => app.id === "media")?.sourceId, undefined);
assert.equal(catalog.find((app) => app.id === "media")?.visibilitySourceId, "media");
assert.deepEqual(homeData.config.dock, ["browser", "documents", "music", "settings"]);
assert.equal(homeData.searchApps(catalog).length, 16);
assert.equal(homeData.searchApps(privateCatalog).length, 7);
assert.equal(homeData.searchApps(catalog, "pdf")[0]?.id, "documents");
assert.equal(homeData.searchApps(catalog, "photos")[0]?.id, "media");
assert.equal(homeData.searchApps(privateCatalog, "photos").length, 0);
assert.equal(homeData.searchApps(catalog, "lua")[0]?.id, "addons");
assert.equal(homeData.searchApps(catalog, "discord")[0]?.id, "guildcraft");
assert.deepEqual(ids(homeData.searchApps(catalog, "n8n")).sort(), ["automation", "homelab"]);
assert.equal(homeData.searchApps(catalog, "sysadmin")[0]?.id, "wardenit");
assert.equal(homeData.searchApps(catalog, "doom").length, 0);
assert.equal(homeData.searchApps(catalog, "openrct2").length, 0);
assert.deepEqual(ids(homeData.searchApps(catalog, "  PDF  ")), ids(homeData.searchApps(catalog, "pdf")));
assert.equal(homeData.searchApps(catalog, "files")[0]?.id, "files");

const systemIds = new Set(systems.map((system) => system.id));
const catalogIds = new Set(catalog.map((app) => app.id));
assert.deepEqual(duplicates(Object.keys(homeData.config.folders)), []);
assert.deepEqual(duplicates(homeData.config.feed.map((entry) => entry.id)), []);
homeData.config.feed.forEach((entry) => {
    if (entry.sourceId) assert.ok(systemIds.has(entry.sourceId), `Unknown feed source ${entry.sourceId}`);
    if (entry.appId) assert.ok(catalogIds.has(entry.appId), `Unknown feed app ${entry.appId}`);
});
Object.values(homeData.config.folders).forEach((folder) => {
    assert.deepEqual(duplicates(folder.appIds), [], `Duplicate app in ${folder.id}`);
    folder.appIds.forEach((appId) => assert.ok(catalogIds.has(appId), `Unknown ${folder.id} app ${appId}`));
});

assert.equal(homeData.visibleFolder("build", catalog)?.apps.length, 4);
assert.equal(homeData.visibleFolder("build", privateCatalog), null);
assert.equal(homeData.visibleFeed(privateCatalog, systems).length, 1);

const layout = homeData.sanitizeLayout(null, catalog);
assert.equal(layout.pages.length, 2);
assert.deepEqual(duplicates(layout.pages.flatMap((page) => page.items.map(homeData.itemKey))), []);
layout.pages.forEach((page) => assert.ok(page.items.length <= 24));

const privateLayout = homeData.sanitizeLayout(null, privateCatalog);
privateLayout.pages.flatMap((page) => page.items).forEach((item) => {
    if (item.type === "app") assert.ok(privateCatalog.some((app) => app.id === item.appId));
    if (item.type === "folder") assert.ok(homeData.visibleFolder(item.folderId, privateCatalog));
});

const indexSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const shellSource = fs.readFileSync(path.join(ROOT, "mobile", "shell.js"), "utf8");
const homeSource = fs.readFileSync(path.join(ROOT, "mobile", "home.js"), "utf8");
assert.match(homeSource, /requestedReturnFocus\?\.closest\?\.\("#mobile-launcher-actions-body"\)[\s\S]*?querySelector\("\[data-mobile-customize\]"\)/);
const swSource = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
[
    "mobile-home-track",
    "mobile-portfolio-feed",
    "mobile-app-drawer",
    "mobile-folder-panel",
    "mobile-launcher-actions",
    "mobile-page-indicator"
].forEach((id) => assert.match(indexSource, new RegExp(`id=["']${id}["']`)));
assert.match(indexSource, /data\/mobile-home\.js/);
assert.match(indexSource, /mobile\/home\.js/);
assert.match(homeSource, /data-mobile-app-drawer-search/);
assert.match(homeSource, /data-mobile-drawer-category-select/);
assert.match(homeSource, /bl4ut0_\$\{userId\}_mobile_home_v/);
assert.match(homeSource, /const backgroundHidden = drawerOpen \|\| dialogOpen/);
assert.match(homeSource, /panel\.setAttribute\("aria-hidden", active && !backgroundHidden/);
assert.match(shellSource, /longPressTimer = setTimeout/);
assert.match(shellSource, /window\.MobileHome\?\.stepPage/);
assert.match(shellSource, /window\.MobileHome\?\.openDrawer/);
assert.match(swSource, /\/data\/mobile-home\.js/);
assert.match(swSource, /\/mobile\/home\.js/);

console.log("Mobile Home audit passed: two launcher pages, PortfoliOS feed, folders, widgets, searchable 16-app drawer, per-user layout, long press, and profile pruning checked.");
