/** Real fork-built Browser.js UI checks; no live website traffic or paid sessions. */
"use strict";
const assert = require("node:assert/strict"),
  path = require("node:path"),
  http = require("node:http");
const { spawn } = require("node:child_process");
const { chromium } = require(process.env.PORTFOLIOS_PLAYWRIGHT || "playwright");
const root = path.resolve(__dirname, "..");
(async () => {
  const socket = http.createServer();
  await new Promise((r) => socket.listen(0, "127.0.0.1", r));
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  const php = spawn(
    process.env.PORTFOLIOS_PHP || "php",
    ["-S", "127.0.0.1:" + port, "-t", root],
    { windowsHide: true, stdio: "ignore" },
  );
  process.once("exit", () => php.kill());
  const origin = "http://127.0.0.1:" + port;
  let browser;
  try {
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(origin)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      await context.route("**/*", (route) =>
        route.request().url().startsWith(origin)
          ? route.continue()
          : route.abort(),
      );
      await context.route("https://sensible-ship-8305.puter.work/**", (route) =>
        route.fulfill({
          body: "wss://relay.fixture/wisp/",
          headers: { "Access-Control-Allow-Origin": "*" },
        }),
      );
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => requests.push(r.url()));
      await page.goto(origin);
      const view = mobile ? "mobile" : "desktop";
      await page.locator("[data-enter-view=" + view + "]").click();
      await page.locator("[data-session-public]").click();
      await page.waitForFunction(
        () => document.body.dataset.startupStage === "workspace",
      );
      assert(
        !requests.some((url) => url.includes("/browserjs/")),
        "Browser engine downloaded during entry",
      );
      await page.evaluate(
        (mobile) =>
          mobile
            ? window.MobileOS.openApp("browser")
            : window.openDesktopWindow("browser"),
        mobile,
      );
      const host = page.locator("[data-web-browser]"),
        frame = page.frameLocator(".web-browser-relay-frame");
      await frame
        .getByLabel("Search or enter address", { exact: true })
        .waitFor();
      assert.equal(
        await host
          .locator(".web-browser-service-bar,[data-web-change]")
          .count(),
        0,
        "Relay/Services toolbar remains",
      );
      await frame.getByTitle("More Options").click();
      await frame
        .getByRole("menuitem", { name: "Settings", exact: true })
        .click();
      await frame.getByRole("button", { name: "Proxy", exact: true }).click();
      await frame
        .getByRole("heading", { name: "Proxy connection", exact: true })
        .waitFor();
      assert.equal(
        await frame
          .locator(".settings-page")
          .evaluate(
            (e) =>
              e.querySelector(".search-container").getBoundingClientRect()
                .bottom <=
              e.querySelector(".settings-content").getBoundingClientRect().top +
                1,
          ),
        true,
        "Settings search overlaps scrolling content",
      );
      assert.equal(
        await frame
          .locator(".settings-page")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        true,
        "Native Settings overflows",
      );
      await frame
        .getByLabel("Proxy connection", { exact: true })
        .selectOption("custom");
      await frame.getByLabel("Wisp endpoint").fill("https://invalid.example/");
      await frame.getByRole("button", { name: "Apply connection" }).click();
      await frame
        .getByRole("status")
        .filter({ hasText: "Use a secure wss://" })
        .waitFor();
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem(window.BrowserWorkspace.connectionKey("bl4ut0")),
        ),
        null,
      );
      await frame
        .getByLabel("Wisp endpoint")
        .fill("wss://relay.fixture/custom");
      await frame
        .getByLabel("Remember this connection for my workspace profile")
        .check();
      await frame.getByRole("button", { name: "Apply connection" }).click();
      await frame
        .getByRole("status")
        .filter({ hasText: "Custom relay configured" })
        .waitFor();
      assert.deepEqual(
        await page.evaluate(() =>
          JSON.parse(
            localStorage.getItem(
              window.BrowserWorkspace.connectionKey("bl4ut0"),
            ),
          ),
        ),
        { mode: "custom", endpoint: "wss://relay.fixture/custom/" },
      );
      const browserFrame = page
        .frames()
        .find((f) => f.url().includes("/apps/browser/browserjs.php"));
      await browserFrame.evaluate(() => (window.__tabSentinel = "retained"));
      await frame
        .getByRole("button", { name: "Open connection options" })
        .click();
      await host.locator("[data-web-return]").click();
      assert.equal(
        await browserFrame.evaluate(() => window.__tabSentinel),
        "retained",
        "Closing connection options reloaded tabs",
      );
      await frame
        .getByRole("button", { name: "Open connection options" })
        .click();
      await host.locator("[data-web-return]").waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await frame
        .getByRole("heading", { name: "Proxy connection", exact: true })
        .waitFor();
      if (mobile) await page.locator("[data-mobile-home]").click();
      else await page.evaluate(() => window.minimizeDesktopWindow("browser"));
      await page.evaluate(
        (mobile) =>
          mobile
            ? window.MobileOS.openApp("browser")
            : window.openDesktopWindow("browser"),
        mobile,
      );
      assert.equal(
        await browserFrame.evaluate(() => window.__tabSentinel),
        "retained",
        "Home/minimize reloaded Browser.js",
      );
      // Parent settings only accept messages from the active browser frame.
      await page.evaluate(() =>
        window.postMessage(
          {
            source: "portfolios-browser",
            type: "configure",
            requestId: "spoof",
            config: {
              mode: "custom",
              endpoint: "wss://spoof.invalid/",
              remember: true,
            },
          },
          location.origin,
        ),
      );
      assert.match(
        await page.evaluate(() =>
          localStorage.getItem(window.BrowserWorkspace.connectionKey("bl4ut0")),
        ),
        /relay.fixture/,
      );
      assert.equal(await page.evaluate(() => crossOriginIsolated), true);
      if (process.env.PORTFOLIOS_SCREENSHOT_DIR)
        await page.screenshot({
          path: path.join(
            process.env.PORTFOLIOS_SCREENSHOT_DIR,
            "browserjs-" + view + ".png",
          ),
        });
      await page.reload();
      await page.locator("[data-enter-view=" + view + "]").click();
      await page.locator("[data-session-public]").click();
      await page.waitForFunction(
        () => document.body.dataset.startupStage === "workspace",
      );
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem(
            window.BrowserWorkspace?.connectionKey("bl4ut0") ||
              "bl4ut0_bl4ut0_BrowserProxy",
          ),
        ),
        null,
        "Public proxy settings survived reload",
      );
      assert.deepEqual(errors, []);
      await context.close();
    }

    const privateContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await privateContext.route("**/*", (route) =>
      route.request().url().startsWith(origin)
        ? route.continue()
        : route.abort(),
    );
    await privateContext.addInitScript(() => {
      localStorage.setItem(
        "bl4ut0_private_profiles",
        JSON.stringify({
          private_browserproxy: {
            sub: "browserproxy",
            name: "Browser Proxy",
            email: "fixture@example.test",
            source: "local",
          },
          private_otherproxy: {
            sub: "otherproxy",
            name: "Other Proxy",
            email: "other@example.test",
            source: "local",
          },
        }),
      );
      if (!localStorage.getItem("bl4ut0_private_browserproxy_BrowserProxy"))
        localStorage.setItem(
          "bl4ut0_private_browserproxy_BrowserProxy",
          JSON.stringify({
            mode: "custom",
            endpoint: "wss://one.fixture/wisp/",
          }),
        );
      localStorage.setItem(
        "bl4ut0_private_otherproxy_BrowserProxy",
        JSON.stringify({ mode: "custom", endpoint: "wss://two.fixture/wisp/" }),
      );
    });
    const pp = await privateContext.newPage();
    const openProxy = async (mobile = false) => {
      await pp.evaluate(
        (mobile) =>
          mobile
            ? window.MobileOS.openApp("browser")
            : window.openDesktopWindow("browser"),
        mobile,
      );
      const f = pp.frameLocator(
        (mobile ? "[data-mobile-app=browser] " : "") +
          ".web-browser-relay-frame",
      );
      await f.getByTitle("More Options").click();
      await f.getByRole("menuitem", { name: "Settings", exact: true }).click();
      await f.getByRole("button", { name: "Proxy", exact: true }).click();
      return f.locator("[role=tabpanel].active");
    };
    await pp.goto(origin);
    await pp.locator("[data-enter-view=desktop]").click();
    await pp.locator("[data-session-profile=private_browserproxy]").click();
    await pp.waitForFunction(
      () => document.body.dataset.startupStage === "workspace",
    );
    let pf = await openProxy();
    await pf
      .getByRole("status")
      .filter({ hasText: "Custom relay configured" })
      .waitFor();
    assert.equal(
      await pf.getByLabel("Wisp endpoint").inputValue(),
      "wss://one.fixture/wisp/",
    );
    assert.equal(
      await pf
        .getByLabel("Remember this connection for my workspace profile")
        .isChecked(),
      true,
    );
    await pf.getByLabel("Wisp endpoint").fill("wss://updated.fixture/wisp");
    await pf.getByRole("button", { name: "Apply connection" }).click();
    await pf
      .getByRole("status")
      .filter({ hasText: "Custom relay configured" })
      .waitFor();
    await pp.evaluate(() => window.switchView("mobile"));
    pf = await openProxy(true);
    assert.equal(
      await pf.getByLabel("Wisp endpoint").inputValue(),
      "wss://updated.fixture/wisp/",
    );
    await pp.evaluate(async () => {
      await window.prepareProfileSwitch();
      window.setCurrentUser("private_otherproxy");
    });
    assert.equal(
      await pp.locator(".web-browser-relay-frame").count(),
      0,
      "Profile switch retained browser frames",
    );
    assert.equal(
      await pp.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("bl4ut0_private_otherproxy_BrowserProxy"),
          ).endpoint,
      ),
      "wss://two.fixture/wisp/",
    );
    await pp.reload();
    await pp.locator("[data-enter-view=mobile]").click();
    await pp.locator("[data-session-profile=private_otherproxy]").click();
    await pp.waitForFunction(
      () => document.body.dataset.startupStage === "workspace",
    );
    pf = await openProxy(true);
    assert.equal(
      await pf.getByLabel("Wisp endpoint").inputValue(),
      "wss://two.fixture/wisp/",
      "Another account inherited the first account proxy",
    );
    await privateContext.close();

    const failedContext = await browser.newContext({
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await failedContext.route("**/*", (route) =>
      route.request().url().startsWith(origin)
        ? route.continue()
        : route.abort(),
    );
    await failedContext.route("https://browser.puter.com/**", (route) =>
      route.fulfill({
        body: "<p>Hosted browser fixture</p>",
        contentType: "text/html",
        headers: { "Cross-Origin-Embedder-Policy": "unsafe-none" },
      }),
    );
    await failedContext.route(
      "https://sensible-ship-8305.puter.work/**",
      (route) =>
        route.fulfill({
          body: "not authorized to use this endpoint null",
          headers: { "Access-Control-Allow-Origin": "*" },
        }),
    );
    const failedPage = await failedContext.newPage(),
      failureErrors = [];
    failedPage.on("pageerror", (e) => failureErrors.push(e.message));
    await failedPage.goto(origin);
    await failedPage.locator("[data-enter-view=desktop]").click();
    await failedPage.locator("[data-session-public]").click();
    await failedPage.waitForFunction(
      () => document.body.dataset.startupStage === "workspace",
    );
    await failedPage.evaluate(() => window.openDesktopWindow("browser"));
    const ff = failedPage.frameLocator(".web-browser-relay-frame");
    await ff
      .getByLabel("Search or enter address", { exact: true })
      .fill("https://example.com/");
    await ff
      .getByLabel("Search or enter address", { exact: true })
      .press("Enter");
    await ff
      .getByRole("heading", { name: "Proxy connection", exact: true })
      .waitFor();
    await ff
      .getByRole("status")
      .filter({ hasText: "automatic relay is unavailable" })
      .waitFor();
    await ff.getByRole("button", { name: "Open connection options" }).click();
    await failedPage.locator("[data-web-return]").click();
    await ff.getByRole("button", { name: "Open connection options" }).click();
    await failedPage.locator("[data-web-provider=browserjs-hosted]").click();
    await failedPage.locator("[data-web-embedded-start]").click();
    await failedPage
      .frameLocator(".web-browser-relay-frame")
      .getByText("Hosted browser fixture")
      .waitFor();
    const hostedUrl = new URL(
      await failedPage.locator(".web-browser-relay-frame").getAttribute("src"),
    );
    assert.equal(
      hostedUrl.search,
      "",
      "Explicit hosted fallback forwarded a browsing target",
    );
    assert.deepEqual(
      failureErrors,
      [],
      "Unavailable relay raised an unhandled navigation error",
    );
    await failedContext.close();

    console.log(
      "Native Browser.js passed: desktop/mobile Settings → Proxy, endpoint validation, scoped persistence/public reset, no outer toolbar, closable connection options, preserved tabs, origin/source validation, independent loading, and retained OS isolation.",
    );
  } finally {
    await browser?.close();
    php.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
