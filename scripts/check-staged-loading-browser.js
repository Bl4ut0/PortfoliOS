/** Staged startup regression checks in disposable Chrome profiles. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const manifest = require('node:vm').runInNewContext(fs.readFileSync(path.join(root, 'core/loading-manifest.js'), 'utf8') + '; PortfolioLoadingManifest');
const failures = new Map();
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.'))) return res.writeHead(403).end();
    if (failures.get(pathname)) { failures.set(pathname, failures.get(pathname) - 1); return res.writeHead(503).end('test failure'); }
    fs.readFile(file, (error, data) => {
        if (error) return res.writeHead(404).end();
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy':'same-origin', 'Cross-Origin-Embedder-Policy':'require-corp' });
        res.end(data);
    });
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ channel:'chrome', headless:true });
    const errors = [];
    const metrics = [];
    async function context(options = {}) {
        const ctx = await browser.newContext({ viewport:{width:1440,height:1000}, serviceWorkers:'block', reducedMotion:'reduce', ...options });
        await ctx.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
        return ctx;
    }
    async function page(ctx) {
        const p = await ctx.newPage(); p.on('pageerror', error => errors.push(error.message)); return p;
    }
    async function ready(p) { await p.waitForFunction(() => document.body.dataset.startupStage === 'workspace'); }
    async function scripts(p) { return p.evaluate(() => [...document.scripts].filter(s => s.src).map(s => new URL(s.src).pathname)); }
    async function selector(p) {
        await p.goto(origin + '/?view=desktop', {waitUntil:'domcontentloaded'});
        await p.locator('#boot-screen.is-ready').waitFor();
        assert.equal(await p.locator('[data-view-panel], [data-window]').count(), 0);
        assert.equal(await p.evaluate(() => !!window.SystemFS || !!window.LocalAI || !!window.MobileOS), false);
        const bootScripts = await scripts(p);
        assert.equal(bootScripts.length, 5);
        assert(!bootScripts.some(s => s.startsWith('/desktop/') || s.startsWith('/quick/')));
    }
    async function enter(p, view) {
        await p.locator('[data-enter-view=' + view + ']').click();
        if (view !== 'quick') {
            await p.locator('#session-chooser').waitFor();
            assert.equal(await p.locator('[data-view-panel], [data-window]').count(), 0, 'workspace DOM must wait for profile selection');
            assert.equal(await p.evaluate(() => !!window.mountDesktop || !!window.MobileOS), false, 'shell code must not execute during login');
            await p.locator('[data-session-public]').click();
        }
        await ready(p);
        metrics.push({view, measures:await p.evaluate(() => performance.getEntriesByType('measure').map(e => ({name:e.name,ms:Math.round(e.duration)})))});
    }
    try {
        for (const view of ['mobile','desktop','quick']) {
            const ctx = await context(view === 'mobile' ? {viewport:{width:390,height:844},isMobile:true,hasTouch:true} : {});
            const p = await page(ctx); await selector(p); await enter(p, view);
            const loaded = await scripts(p);
            assert.equal(await p.locator('[data-view-panel]').count(), 1);
            assert(!loaded.includes('/core/local-ai.js') && !loaded.includes('/core/media-service.js'));
            if (view !== 'desktop') assert(!loaded.includes('/desktop/shell.js') && !loaded.includes('/core/window-manager.js'));
            if (view !== 'mobile') assert(!loaded.includes('/mobile/shell.js'));
            if (view === 'mobile') {
                await p.evaluate(() => window.MobileOS.openApp('settings'));
                await p.locator('[data-profile-choose]').waitFor();
                assert.equal(await p.evaluate(() => !!window.LocalAI), false);
                await p.evaluate(() => window.MobileOS.openApp('local-ai'));
                assert.equal(await p.evaluate(() => !!window.LocalAI), true);
                assert(!(await scripts(p)).includes('/desktop/brain-helper.js'));
                await p.evaluate(() => window.MobileOS.showHome());
                await p.evaluate(() => window.switchView('desktop')); await ready(p);
                await p.evaluate(() => window.minimizeDesktopWindow('profile'));
                await p.evaluate(() => window.switchView('mobile')); await ready(p);
                await p.evaluate(() => window.switchView('desktop')); await ready(p);
                assert.equal(await p.evaluate(() => window.state.minimizedApps.has('profile')), true, 'switching experiences must preserve window state');
                assert.equal(await p.locator('#desktop-experience').count(), 1);
            }
            if (view === 'desktop') {
                assert.equal(await p.locator('#start-grid img').count(), 0, 'hidden Start menu must not fetch game imagery');
                await p.locator('#start-toggle').click(); await p.locator('#start-pinned [data-open-app]').first().waitFor();
                await p.locator('#start-toggle').click();
                await p.evaluate(() => Promise.all([window.ensureAppLoaded('cli'), window.ensureAppLoaded('cli')]));
                await p.evaluate(() => window.openDesktopWindow('cli')); await p.locator('#terminal-input').waitFor();
                assert.equal((await scripts(p)).filter(s => s === '/desktop/terminal.js').length, 1);
                assert.equal((await scripts(p)).filter(s => s === '/core/local-ai.js').length, 1);
            }
            if (view === 'quick') {
                await p.locator('[data-quick-route]').nth(1).click();
                assert.notEqual(await p.evaluate(() => window.state.quickRoute), 'overview');
                await p.locator('#quick-search').fill('warden');
                assert.equal(await p.evaluate(() => window.state.quickSearch), 'warden');
            }
            await ctx.close();
        }
        // Recover a failed shared dependency without executing any loaded script twice.
        failures.set('/core/storage.js', 999);
        const retry = await context(); const rp = await page(retry); await selector(rp);
        await rp.locator('[data-enter-view=desktop]').click();
        await rp.locator('#startup-status.is-error').waitFor();
        assert.equal(await rp.locator('[data-view-panel]').count(), 0);
        failures.set('/core/storage.js', 0);
        await rp.locator('[data-enter-view=desktop]').click(); await rp.locator('[data-session-public]').click(); await ready(rp);
        assert.equal((await scripts(rp)).filter(s => s === '/core/event-bus.js').length, 1);
        await retry.close();
        // A shell failure leaves the native phone chooser visible and retries only the failed dependency.
        const mountRetry = await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
        let rejectShell = true;
        await mountRetry.route('**/mobile/shell.js?*', route => {
            if (rejectShell && route.request().resourceType() === 'script') { return route.fulfill({status:503,body:'test shell failure'}); }
            return route.continue();
        });
        const mp = await page(mountRetry); await selector(mp);
        await mp.locator('[data-enter-view=mobile]').click(); await mp.locator('[data-session-public]').click();
        await mp.locator('[data-session-error]').waitFor();
        assert.equal(await mp.locator('#session-chooser').isVisible(), true);
        assert.equal(await mp.evaluate(() => window.state.sessionChosen), false);
        rejectShell = false;
        await mp.locator('[data-session-public]').click(); await ready(mp);
        assert.equal(await mp.locator('#mobile-device').count(), 1);
        await mountRetry.close();

        // A remembered private workspace activates storage only after its account is selected.
        const privateContext = await context();
        await privateContext.addInitScript(() => {
            const id = 'private_loadingfixture';
            localStorage.setItem('bl4ut0_private_profiles', JSON.stringify({[id]:{sub:'loadingfixture',email:'fixture@example.test',name:'Loading Fixture',source:'local'}}));
            localStorage.setItem('bl4ut0CurrentUser', id);
            localStorage.setItem('bl4ut0_' + id + '_ThemeId', 'light');
        });
        const privatePage = await page(privateContext); await selector(privatePage);
        await privatePage.locator('[data-enter-view=desktop]').click();
        await privatePage.locator('[data-session-profile=private_loadingfixture]').click(); await ready(privatePage);
        assert.equal(await privatePage.evaluate(() => window.state.currentUserId), 'private_loadingfixture');
        assert.equal(await privatePage.evaluate(() => window.state.themeId), 'light');
        assert.equal(await privatePage.locator('.desktop-experience').getAttribute('data-user'), 'private_loadingfixture');
        await privateContext.close();

        // Offline boot, previously visited workspace, and exact-version cache reuse.
        const offline = await context({serviceWorkers:'allow'});
        const op = await page(offline); await selector(op);
        await op.evaluate(() => navigator.serviceWorker.ready);
        await op.waitForFunction(() => !!navigator.serviceWorker.controller);
        const bootCache = await op.evaluate(async () => {
            const cache = await caches.open('portfolio-shell-' + window.PortfolioLoadingManifest.release);
            return (await cache.keys()).map(request => new URL(request.url).pathname);
        });
        assert(bootCache.length <= 12 && !bootCache.some(p => p.startsWith('/apps/')), 'installation caches only the small boot graph');
        await enter(op, 'mobile');
        await op.evaluate(() => window.MobileOS.openApp('calculator'));
        await op.waitForFunction(() => !!document.querySelector('[data-mobile-app=calculator]'));
        await offline.setOffline(true);
        await op.reload({waitUntil:'domcontentloaded'});
        await op.locator('[data-enter-view=mobile]').click();
        await op.locator('[data-session-public]').click(); await ready(op);
        await op.evaluate(() => window.MobileOS.openApp('calculator'));
        assert.equal(await op.locator('[data-mobile-app=calculator]').count(), 1);
        await offline.setOffline(false);
        await op.evaluate(async () => {
            const url = window.PortfolioLoader.url('mobile/shell.js');
            const original = window.fetch;
            // The SW, rather than this page, decides whether a network revalidation is needed.
            await original(url); await original(url);
        });
        const cached = await op.evaluate(async () => !!(await caches.match(window.PortfolioLoader.url('mobile/shell.js'))));
        assert.equal(cached, true);
        await offline.close();
        assert.deepEqual(errors, [], 'staged flows must have no unhandled page errors');
        console.log(JSON.stringify({checks:'boot isolation, profile gate, each shell, lazy AI/media, app deduplication, Quick controls, experience switching, remembered private profile, retry, atomic boot cache and offline app reload',metrics},null,2));
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
