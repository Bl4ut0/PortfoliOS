/** Isolated Chromium smoke test. Uses a disposable browser context and local static server. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require(process.env.PORTFOLIOS_PLAYWRIGHT || "playwright");
const root = path.resolve(__dirname, "..");
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url, "http://local").pathname,
    );
  } catch {
    response.writeHead(400).end();
    return;
  }
  const target = path.resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (
    !target.startsWith(root + path.sep) ||
    pathname.split("/").some((part) => part.startsWith("."))
  ) {
    response.writeHead(403).end();
    return;
  }
  fs.readFile(target, (error, data) => {
    if (error) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": mime[path.extname(target)] || "application/octet-stream",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
    response.end(data);
  });
});
function diagnosticRom() {
  // Original tiny NROM program: initialize a solid-color screen. No commercial game data.
  const rom = Buffer.alloc(16 + 16384 + 8192);
  Buffer.from([0x4e, 0x45, 0x53, 0x1a, 1, 1]).copy(rom);
  const program = [
    0x78, 0xd8, 0xa2, 0xff, 0x9a, 0xa9, 0, 0x8d, 0, 0x20, 0x8d, 1, 0x20, 0x2c,
    2, 0x20, 0x10, 0xfb, 0xa9, 0x3f, 0x8d, 6, 0x20, 0xa9, 0, 0x8d, 6, 0x20,
    0xa9, 0x21, 0x8d, 7, 0x20, 0xa9, 8, 0x8d, 1, 0x20, 0x4c, 0x26, 0x80,
  ];
  Buffer.from(program).copy(rom, 16);
  for (let i = 0; i < 3; i++) rom.writeUInt16LE(0x8000, 16 + 0x3ffa + i * 2);
  return rom;
}
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page
      .locator('#boot-screen [data-enter-view="mobile"]')
      .click({ timeout: 15000 });
    await page.locator("[data-session-public]").click();
    await page
      .getByRole("button", { name: "Open Store", exact: true })
      .first()
      .click();
    await page.locator("[data-store-list]").waitFor();
    if (process.env.PORTFOLIOS_SCREENSHOT) {
      await page.screenshot({ path: process.env.PORTFOLIOS_SCREENSHOT, fullPage: true });
    }
    assert.equal(await page.locator('[data-store-open="local-ai"]').count(), 1);
    await page.locator('[data-store-add="romplayer"]').click();
    await page.locator('[data-store-open="romplayer"]').waitFor();
    await page.locator('[data-store-open="romplayer"]').click();
    await page.locator("[data-rom-import]").setInputFiles({
      name: "PortfoliOS-diagnostic.nes",
      mimeType: "application/octet-stream",
      buffer: diagnosticRom(),
    });
    await page
      .getByRole("button", {
        name: "Play PortfoliOS-diagnostic.nes",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", {
        name: "Play PortfoliOS-diagnostic.nes",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-rom-status]")
          ?.textContent.includes("started"),
      null,
      { timeout: 90000 },
    );
    await page.locator("[data-mobile-home]").click();
    const frame = page
      .frames()
      .find((frame) => frame.url().includes("/apps/romplayer/runtime.html"));
    assert.equal(
      await frame.evaluate(() => window.EJS_emulator.paused),
      true,
      "emulator must pause on Home",
    );
    await page
      .getByRole("button", { name: "Open all apps", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open ROM Player", exact: true })
      .click();
    assert.equal(
      await frame.evaluate(() => window.EJS_emulator.paused),
      false,
      "emulator must resume without restarting",
    );
    await page.locator("[data-rom-stop]").click();
    await page.locator("[data-mobile-home]").click();
    await page
      .getByRole("button", { name: "Open all apps", exact: true })
      .click();
    await page.getByRole("button", { name: "Open Lobe", exact: true }).click();
    assert.equal(await page.locator("[data-lobe-status]").textContent(), await page.evaluate(() => window.LocalAI.getStatus().statusText));
    await page.locator("#mobile-lobe-input").fill("am i signed in");
    await page.locator('.mobile-local-ai-app [type="submit"]').click();
    assert.match(
      await page.locator("[data-lobe-messages]").innerText(),
      /public profile/,
    );
    await page.locator("[data-mobile-home]").click();
    await page
      .getByRole("button", { name: "Open all apps", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Open Settings", exact: true })
      .click();
    assert.equal(await page.locator("[data-profile-choose]").count(), 1);
    await page.locator("[data-profile-choose]").click();
    assert.equal(
      await page.locator("#mobile-device #session-chooser").count(),
      1,
    );
    await page.locator("[data-session-cancel]").click();
    for (const id of ["taskmgr", "security-center", "profile", "dossier"]) {
      await page.locator("[data-mobile-home]").click();
      await page
        .getByRole("button", { name: "Open all apps", exact: true })
        .click();
      const title = {
        taskmgr: "Task Manager",
        "security-center": "Security Center",
        profile: "Identity",
        dossier: "Dossier",
      }[id];
      await page
        .getByRole("button", { name: "Open " + title, exact: true })
        .click();
      await page.locator('[data-mobile-app="' + id + '"]').waitFor();
    }
    assert.deepEqual(
      errors,
      [],
      "new mobile tools must load without page errors",
    );
    // Isolated fixture account: no Google login or production data is used.
    await page.evaluate(() => {
      const id = "private_browserfixture";
      localStorage.setItem(
        "bl4ut0_private_profiles",
        JSON.stringify({
          [id]: {
            sub: "browserfixture",
            email: "fixture@example.test",
            name: "Browser Fixture",
            source: "google",
          },
        }),
      );
      window.refreshPrivateAccounts();
      window.setCurrentUser(id);
    });
    await page.evaluate(() => window.MobileOS.openApp("settings"));
    await page.locator('[data-profile-public="local"]').waitFor();
    await page.locator('[data-profile-public="local"]').click();
    await page.waitForFunction(() => window.state.currentUserId === "bl4ut0");
    assert.equal(await page.evaluate(() => window.GDriveSync.getToken()), null);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .locator('#boot-screen [data-enter-view="mobile"]')
      .click({ timeout: 15000 });
    await page.locator("[data-session-public]").click();
    assert.equal(
      await page.evaluate(() =>
        window.getInstalledStoreAppIds().includes("romplayer"),
      ),
      false,
      "public app library must reset on reload",
    );
    assert.equal(
      await page.evaluate(async () =>
        Boolean(
          await window.SystemFS.readFile("/ROMs/NES/PortfoliOS-diagnostic.nes"),
        ),
      ),
      false,
      "public imported ROM must reset on reload",
    );
    console.log(
      "Mobile browser smoke passed: Store install, original diagnostic NES ROM, touch runtime, pause/resume, Lobe, Settings/profile chooser, native tools, offline private-to-public switch, and public reload reset.",
    );
    await context.close();
    const desktop = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      serviceWorkers: "block",
    });
    await desktop.addInitScript(() => {
      const id = "private_desktopfixture";
      localStorage.setItem(
        "bl4ut0_private_profiles",
        JSON.stringify({
          [id]: {
            sub: "desktopfixture",
            email: "fixture@example.test",
            name: "Desktop Fixture",
            source: "local",
          },
        }),
      );
      localStorage.setItem("bl4ut0CurrentUser", id);
    });
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(origin, { waitUntil: "domcontentloaded" });
    await desktopPage.locator('[data-enter-view="desktop"]').click();
    await desktopPage
      .locator('[data-session-profile="private_desktopfixture"]')
      .click();
    await desktopPage.locator("#start-toggle").click();
    await desktopPage.locator("#start-rail-avatar-owner").click();
    await desktopPage.locator("[data-session-public-local]").waitFor();
    assert.equal(await desktopPage.evaluate(() => window.state.currentUserId), "private_desktopfixture");
    await desktopPage.locator("[data-session-cancel]").click();
    await desktopPage.evaluate(() => window.openDesktopWindow("settings"));
    await desktopPage.locator('.settings-tab-btn[data-tab="accounts"]').click();
    await desktopPage.locator('[data-profile-public="local"]').click();
    await desktopPage.waitForFunction(
      () => window.state.currentUserId === "bl4ut0",
    );
    await desktop.close();
    console.log(
      "Desktop account settings smoke passed: remembered private workspace to public profile.",
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
