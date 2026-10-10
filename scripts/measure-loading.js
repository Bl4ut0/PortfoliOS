/** Repeated cold selector resource/layout measurements in disposable Chrome profiles. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PORTFOLIOS_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.'))) return response.writeHead(403).end();
    fs.readFile(file, (error, data) => {
        if (error) return response.writeHead(404).end();
        response.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
        response.end(data);
    });
});
module.exports = (async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({channel:'chrome',headless:true});
    const results = [];
    try {
        for (const width of [1440,390]) for (let run = 0; run < 3; run++) {
            const context = await browser.newContext({viewport:{width,height:width === 390 ? 844 : 1000},serviceWorkers:'block'});
            await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
            const page = await context.newPage();
            await page.addInitScript(() => {
                window.loadingCLS = 0; window.loadingLongTasks = [];
                new PerformanceObserver(list => list.getEntries().forEach(entry => { if (!entry.hadRecentInput) window.loadingCLS += entry.value; })).observe({type:'layout-shift',buffered:true});
                new PerformanceObserver(list => window.loadingLongTasks.push(...list.getEntries().map(entry => entry.duration))).observe({type:'longtask',buffered:true});
            });
            await page.goto(origin, {waitUntil:'domcontentloaded'});
            await page.waitForFunction(() => !!document.querySelector('#boot-screen.is-ready'));
            const result = await page.evaluate(() => ({
                selector:performance.now(), cls:window.loadingCLS, longTasks:window.loadingLongTasks,
                resources:performance.getEntriesByType('resource').filter(entry => entry.name.startsWith(location.origin)).map(entry => ({path:new URL(entry.name).pathname,bytes:entry.decodedBodySize,type:entry.initiatorType})),
                marks:performance.getEntriesByType('mark').map(entry => ({name:entry.name,start:entry.startTime}))
            }));
            results.push({width,run,...result});
            await context.close();
        }
        const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
        if (output) fs.writeFileSync(path.resolve(root, output), JSON.stringify(results,null,2) + '\n');
        console.log(JSON.stringify(results.map(result => ({width:result.width,run:result.run,selector:Math.round(result.selector),cls:result.cls,requests:result.resources.length,decodedAssetBytes:result.resources.reduce((sum,entry) => sum + entry.bytes,0),scripts:result.resources.filter(entry => entry.type === 'script').length,longTasks:result.longTasks})),null,2));
        return results;
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
