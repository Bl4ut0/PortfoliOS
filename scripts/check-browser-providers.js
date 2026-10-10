/** Browser/provider smoke checks in disposable Chrome contexts. No live proxy or paid session is used. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
async function mockRelays(context) {
    for (const host of ['browser.puter.com', 'scramjet.mercurywork.shop']) await context.route('https://' + host + '/**', route => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><title>Relay fixture</title><input aria-label="Provider address bar"><main>Embedded relay fixture</main><script>localStorage.setItem("relay-fixture", localStorage.getItem("relay-fixture") || crypto.randomUUID())</script>'
    }));
}
(async () => {
    const portServer = http.createServer();
    await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
    const port = portServer.address().port;
    await new Promise(resolve => portServer.close(resolve));
    const php = spawn(process.env.PORTFOLIOS_PHP || 'php', ['-S', '127.0.0.1:' + port, '-t', root], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    process.once('exit', () => php.kill());
    let phpLog = ''; php.stderr.on('data', chunk => { phpLog += chunk; });
    php.on('error', error => { phpLog += error.message; });
    const origin = 'http://127.0.0.1:' + port;
    let browser;
    try {
        let ready = false;
        for (let i = 0; i < 60; i++) { try { if ((await fetch(origin + '/apps/browser/hyperbeam.php?action=status')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
        assert(ready, 'PHP test server did not start: ' + phpLog);
        const status = await (await fetch(origin + '/apps/browser/hyperbeam.php?action=status')).json();
        assert.equal(status.available, false, 'Unconfigured backend must stay disabled');
        assert.equal(typeof status.csrf, 'string');
        assert.equal((await fetch(origin + '/apps/browser/hyperbeam.php', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.test' }, body: JSON.stringify({ action: 'start', csrf: status.csrf, profile: 'bl4ut0' }) })).status, 403);
        const remote = await fetch(origin + '/apps/browser/remote.php');
        assert.equal(remote.headers.get('cross-origin-embedder-policy'), 'unsafe-none');
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        for (const mobile of [false, true]) {
            const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block', reducedMotion: 'reduce' });
            const errors = [], requests = [], stops = [];
            let enabled = false, failStart = false, failStatus = false, startGate = null, statusRequests = 0;
            await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
            await mockRelays(context);
            await context.route('**/hyperbeam.php*', async route => {
                const request = route.request();
                if (request.method() === 'GET') statusRequests++;
                if (request.method() === 'GET' && failStatus) return route.fulfill({ status: 503, json: { message: 'Usage unavailable' } });
                if (request.method() === 'GET') return route.fulfill({ json: { available: enabled, csrf: 'fixture-csrf', remainingSeconds: 3000, message: enabled ? 'Available' : 'Not configured · free proxy services are ready' } });
                const data = request.postDataJSON(); requests.push(data);
                assert.equal(data.csrf, 'fixture-csrf');
                if (data.action === 'stop') { stops.push(data); return route.fulfill({ json: { ended: true } }); }
                if (startGate) await startGate;
                if (failStart) return route.fulfill({ status: 503, json: { message: 'Shared allowance exhausted. Choose a free proxy service.' } });
                return route.fulfill({ json: { lease: 'fixture-lease', leaseToken: 'a'.repeat(64), embedUrl: 'https://fixture.hyperbeam.com/session', expiresAt: Math.floor(Date.now() / 1000) + 120 } });
            });
            await context.route('https://unpkg.com/@hyperbeam/web@0.0.38/dist/index.js', route => route.fulfill({ contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'export default async function(container,url,options){container.textContent="Remote browser fixture";return {destroy(){container.textContent=""}}}' }));
            const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
            await page.goto(origin + '/?view=' + (mobile ? 'mobile' : 'desktop'), { waitUntil: 'domcontentloaded' });
            await page.locator('[data-enter-view=' + (mobile ? 'mobile' : 'desktop') + ']').click();
            await page.locator('[data-session-public]').click();
            await page.waitForFunction(() => document.body.dataset.startupStage === 'workspace');
            assert.equal(await page.evaluate(() => !!window.BrowserWorkspace), false, 'Browser code loaded during startup');
            assert.equal(requests.length, 0);
            assert.equal(statusRequests, 0);
            assert.equal(page.frames().filter(frame => /browser.puter.com|scramjet.mercurywork.shop/.test(frame.url())).length, 0, 'Relay loaded during boot/login');
            const open = async () => {
                await page.evaluate(mobile => mobile ? window.MobileOS.openApp('browser') : window.openDesktopWindow('browser'), mobile);
                await page.locator('[data-web-browser]').waitFor();
            };
            await open();
            const relay = page.locator('.web-browser-relay-frame');
            await page.frameLocator('.web-browser-relay-frame').getByText('Embedded relay fixture').waitFor();
            assert.equal(statusRequests, 0, 'Opening the free browser contacted the remote-session backend');
            assert.equal(await relay.getAttribute('src'), 'https://browser.puter.com/');
            assert.equal(await relay.evaluate(frame => frame.credentialless), true);
            assert.equal(await relay.getAttribute('referrerpolicy'), 'no-referrer');
            assert.doesNotMatch(await relay.getAttribute('sandbox'), /allow-top-navigation|allow-popups-to-escape-sandbox|allow-storage-access/);
            const providerFrame = page.frames().find(frame => frame.url().startsWith('https://browser.puter.com/'));
            assert.equal(await providerFrame.evaluate(() => { try { return parent.localStorage.length; } catch { return 'blocked'; } }), 'blocked');
            assert.equal(await relay.evaluate(element => element.getBoundingClientRect().height > 220), true, 'Embedded viewport is too short');
            const partition = await providerFrame.evaluate(() => localStorage.getItem('relay-fixture'));
            await page.frameLocator('.web-browser-relay-frame').getByRole('textbox', { name: 'Provider address bar' }).fill('keep this tab');
            if (mobile) await page.locator('[data-mobile-home]').click();
            else await page.evaluate(() => window.minimizeDesktopWindow('browser'));
            await open();
            assert.equal(await page.frameLocator('.web-browser-relay-frame').getByRole('textbox', { name: 'Provider address bar' }).inputValue(), 'keep this tab', 'Home/minimize discarded the live browsing tab');
            assert.equal(await page.frames().find(frame => frame.url().startsWith('https://browser.puter.com/')).evaluate(() => localStorage.getItem('relay-fixture')), partition, 'Minimizing/Home recreated the free browser');
            await page.locator('[data-web-change]').click();
            await page.locator('[data-web-quota]').filter({ hasText: 'Not configured' }).waitFor();
            assert.equal(await page.evaluate(() => crossOriginIsolated), true, 'Main OS lost WASM isolation');
            assert.equal(await page.locator('[data-web-provider]').count(), 5);
            assert.equal(await page.locator('.web-provider[aria-pressed=true]').count(), 1);
            await page.locator('[data-web-provider=hyperbeam]').click();
            assert.equal(await page.locator('[data-web-start]').isDisabled(), true);
            await page.locator('[data-web-address]').fill('javascript:alert(1)');
            await page.locator('[data-web-address-form] button[type=submit]').click();
            assert.match(await page.locator('[data-web-message]').textContent(), /valid HTTP/);
            assert.equal(requests.length, 0, 'Invalid destination allocated a session');
            await page.locator('.web-browser-external').evaluate(element => { element.open = true; });
            await page.locator('[data-web-provider=proxysite]').click();
            assert.equal(await page.locator('[data-web-launch]').getAttribute('href'), 'https://www.proxysite.com/');
            assert.equal(await page.locator('[data-web-launch]').getAttribute('rel'), 'noopener noreferrer');
            await page.locator('[data-web-address]').fill('example.com');
            await page.locator('[data-web-address-form] button[type=submit]').click();
            assert.equal(await page.locator('[data-web-destination]').textContent(), 'https://example.com/');
            assert.equal(await page.locator('[data-web-reopen]').getAttribute('href'), 'https://www.proxysite.com/');
            await page.locator('[data-web-change]').click();
            await page.locator('[data-web-provider=hideme]').click();
            assert.equal(await page.locator('[data-web-remember]').isVisible(), false, 'External handoff became a default embedded provider');
            assert.equal(await page.locator('[data-web-launch]').getAttribute('href'), 'https://hide.me/en/proxy');
            assert.equal(await page.locator('[data-web-browser]').evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'Browser overflows on this device');
            for (const theme of ['light', 'dark']) {
                await page.evaluate(theme => window.setPortfolioTheme(theme), theme);
                const colors = await page.locator('[data-web-provider=hideme]').evaluate(element => ({ foreground: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
                assert.notEqual(colors.foreground, colors.background);
            }
            await page.locator('[data-web-provider=scramjet]').click();
            await page.locator('[data-web-remember]').check();
            assert.equal(await page.evaluate(() => localStorage.getItem('bl4ut0_bl4ut0_BrowserProvider')), 'scramjet');
            await page.locator('[data-web-address]').fill('https://www.google.com/');
            await page.locator('[data-web-embedded-start]').click();
            await page.frameLocator('.web-browser-relay-frame').getByText('Embedded relay fixture').waitFor();
            assert.equal(new URL(await page.locator('.web-browser-relay-frame').getAttribute('src')).searchParams.get('goto'), 'https://www.google.com/');
            if (process.env.PORTFOLIOS_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PORTFOLIOS_SCREENSHOT_DIR, 'browser-' + (mobile ? 'mobile' : 'desktop') + '.png') });
            // Restore an available provider, allocate exactly once, and exercise the real credentialless viewer with a mocked SDK.
            enabled = true;
            await page.locator('[data-web-change]').click();
            await page.locator('[data-web-quota]').filter({ hasText: 'min available' }).waitFor();
            await page.locator('[data-web-provider=hyperbeam]').click();
            await page.locator('[data-web-start]').click();
            await page.frameLocator('.web-browser-remote-frame').getByText('Remote browser fixture').waitFor({ timeout: 20000 });
            assert.equal(await page.evaluate(() => crossOriginIsolated), true);
            assert.equal(requests.filter(request => request.action === 'start').length, 1);
            assert.equal(await page.locator('[data-web-address]').getAttribute('readonly'), '');
            if (mobile) await page.locator('[data-mobile-home]').click();
            else await page.evaluate(() => window.minimizeDesktopWindow('browser'));
            await page.waitForTimeout(200);
            assert.equal(stops.length, 1, 'Pause did not terminate the remote session');
            await open();
            await page.locator('[data-web-change]').click();
            // Backgrounding during allocation must cancel the eventual lease, too.
            let releaseStart;
            startGate = new Promise(resolve => { releaseStart = resolve; });
            const pendingRequest = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/hyperbeam.php') && request.postDataJSON()?.action === 'start');
            const cancelledStop = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/hyperbeam.php') && response.request().postDataJSON()?.action === 'stop');
            await page.locator('[data-web-provider=hyperbeam]').click();
            await page.locator('[data-web-start]').click();
            await pendingRequest;
            await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden; });
            releaseStart(); startGate = null;
            await cancelledStop;
            await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
            await open();
            await page.locator('[data-web-start]').filter({ hasText: 'Start remote browser' }).waitFor();
            assert.equal(await page.locator('.web-browser-remote-frame').count(), 0, 'Backgrounded pending session mounted a viewer');
            assert.equal(stops.length, 2, 'Backgrounded pending allocation was not terminated');
            const stopsBeforeMonitor = stops.length;
            // Advance a live session beyond the monitor interval; failed accounting must end it.
            await page.locator('[data-web-provider=hyperbeam]').click();
            await page.locator('[data-web-start]').click();
            await page.frameLocator('.web-browser-remote-frame').getByText('Remote browser fixture').waitFor();
            await page.clock.install(); failStatus = true;
            await page.clock.fastForward(31000);
            await page.locator('[data-web-message]').filter({ hasText: 'Remote usage cannot be verified' }).waitFor();
            assert.equal(stops.length, stopsBeforeMonitor + 1, 'Failed active usage monitoring did not end the session');
            failStatus = false;
            await page.locator('[data-web-change]').click();
            await page.locator('[data-web-quota]').filter({ hasText: 'min available' }).waitFor();
            failStart = true;
            await page.locator('[data-web-provider=hyperbeam]').click();
            await page.locator('[data-web-start]').click();
            await page.locator('[data-web-message]').filter({ hasText: 'Shared allowance exhausted' }).waitFor();
            assert.equal(await page.locator('.web-browser-remote-frame').count(), 0);
            await page.locator('[data-web-provider=proxysite]').click();
            assert.equal(await page.locator('[data-web-launch]').isVisible(), true, 'Free fallback unavailable after failed remote allocation');
            const scope = await page.evaluate(() => {
                localStorage.setItem('bl4ut0_private_fixture_BrowserProvider', 'hideme');
                return { public: window.BrowserWorkspace.preferenceKey('bl4ut0'), private: window.BrowserWorkspace.preferenceKey('private_fixture') };
            });
            assert.notEqual(scope.public, scope.private);
            assert.deepEqual(errors, [], 'Browser raised page errors');
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.locator('[data-enter-view=' + (mobile ? 'mobile' : 'desktop') + ']').click();
            await page.locator('[data-session-public]').click();
            await page.waitForFunction(() => document.body.dataset.startupStage === 'workspace');
            assert.equal(await page.evaluate(() => localStorage.getItem('bl4ut0_bl4ut0_BrowserProvider')), null, 'Public provider choice survived the public reload reset');
            await context.close();
        }
        // A remembered private choice follows the same account between device experiences.
        const privateContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
        await privateContext.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
        await mockRelays(privateContext);
        await privateContext.addInitScript(() => {
            localStorage.setItem('bl4ut0_private_profiles', JSON.stringify({ private_browserchoice: { sub: 'browserchoice', name: 'Browser Choice', email: 'fixture@example.test', source: 'local' }, private_other: { sub: 'other', name: 'Other', email: 'other@example.test', source: 'local' } }));
            localStorage.setItem('bl4ut0_private_browserchoice_BrowserProvider', 'scramjet');
        });
        const pp = await privateContext.newPage();
        await pp.goto(origin, { waitUntil: 'domcontentloaded' });
        await pp.locator('[data-enter-view=desktop]').click();
        await pp.locator('[data-session-profile=private_browserchoice]').click();
        await pp.waitForFunction(() => document.body.dataset.startupStage === 'workspace');
        await pp.evaluate(() => window.openDesktopWindow('browser'));
        await pp.locator('.web-browser-relay-frame').waitFor();
        assert.equal(new URL(await pp.locator('.web-browser-relay-frame').getAttribute('src')).hostname, 'scramjet.mercurywork.shop');
        await pp.evaluate(() => window.switchView('mobile'));
        await pp.evaluate(() => window.MobileOS.openApp('browser'));
        const mobileRoot = pp.locator('[data-mobile-app=browser]');
        await mobileRoot.locator('.web-browser-relay-frame').waitFor();
        assert.equal(new URL(await mobileRoot.locator('.web-browser-relay-frame').getAttribute('src')).hostname, 'scramjet.mercurywork.shop');
        // Iframes share a credentialless partition for the document lifetime. A different
        // workspace must not silently inherit that provider's cookies/history.
        await pp.evaluate(async () => { await window.prepareProfileSwitch(); window.setCurrentUser('private_other'); });
        assert.equal(await pp.locator('.web-browser-relay-frame').count(), 0);
        await pp.evaluate(() => window.MobileOS.openApp('browser'));
        await mobileRoot.locator('[data-web-change]').click();
        await mobileRoot.locator('[data-web-provider=scramjet]').click();
        await mobileRoot.locator('[data-web-embedded-start]').click();
        await mobileRoot.locator('[data-web-fresh]').waitFor();
        assert.equal(await pp.locator('.web-browser-relay-frame').count(), 0, 'Another profile reused the previous provider partition');
        assert.match(await mobileRoot.locator('[data-web-message]').textContent(), /different profile/);
        await mobileRoot.locator('[data-web-provider=browserjs]').click();
        await mobileRoot.locator('[data-web-embedded-start]').click();
        assert.equal(new URL(await mobileRoot.locator('.web-browser-relay-frame').getAttribute('src')).hostname, 'browser.puter.com');
        await privateContext.close();
        const unsupported = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
        await unsupported.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
        await unsupported.addInitScript(() => { delete HTMLIFrameElement.prototype.credentialless; });
        const up = await unsupported.newPage();
        await up.goto(origin, { waitUntil: 'domcontentloaded' });
        await up.locator('[data-enter-view=desktop]').click(); await up.locator('[data-session-public]').click();
        await up.waitForFunction(() => document.body.dataset.startupStage === 'workspace');
        await up.evaluate(() => window.openDesktopWindow('browser'));
        await up.locator('[data-web-message]').filter({ hasText: 'credentialless iframe support' }).waitFor();
        assert.equal(await up.locator('.web-browser-relay-frame').count(), 0, 'Unsupported browser embedded an unisolated provider');
        assert.equal(await up.evaluate(() => crossOriginIsolated), true);
        await up.locator('.web-browser-external').evaluate(element => { element.open = true; });
        await up.locator('[data-web-provider=proxysite]').click();
        assert.equal(await up.locator('[data-web-launch]').isVisible(), true);
        await unsupported.close();
        console.log('Browser provider smoke passed: lazy desktop/mobile embedded relays, persistent tabs on Home/minimize, cross-origin isolation, profile partition guard, external handoffs, destination validation, scoped preferences, rendering, and bounded Hyperbeam lifecycle/quota fallback.');
    } finally { await browser?.close(); php.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
