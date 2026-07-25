/**
 * PortfoliOS: Service Worker
 * Intercepts network requests and serves installed app binaries from SystemFS (IndexedDB).
 */

const DB_NAME = "PortfoliOS_FS";
const STORE_NAME = "files";
const MOBILE_SHELL_CACHE = "portfolio-mobile-shell-v1.2.3";
const MOBILE_SHELL_ASSETS = [
    "/",
    "/index.html",
    "/manifest.webmanifest",
    "/mobile/mobile-icon.svg",
    "/mobile/mobile-icon-192.png",
    "/mobile/mobile-icon-512.png",
    "/mobile/mobile-icon-maskable-512.png",
    "/mobile/apple-touch-icon.png",
    "/styles-v1.css",
    "/styles/tokens.css",
    "/styles/reset.css",
    "/styles/layout.css",
    "/styles/windows.css",
    "/styles/desktop.css",
    "/styles/mobile.css",
    "/styles/quick.css",
    "/styles/boot.css",
    "/styles/components.css",
    "/apps/_shared/iframe-game.js",
    "/core/event-bus.js",
    "/core/storage.js",
    "/core/state.js",
    "/core/utils.js",
    "/core/filesystem.js",
    "/core/security-service.js",
    "/core/file-intents.js",
    "/core/media-service.js",
    "/apps/musicmini/vendor/jsmediatags.min.js",
    "/core/app-framework.js",
    "/core/gdrive-sync.js",
    "/core/app-loader.js",
    "/core/local-ai.js",
    "/core/simple-brain.js",
    "/core/preferences.js",
    "/core/window-manager.js",
    "/data/systems.js",
    "/data/mobile-apps.js",
    "/data/mobile-home.js",
    "/data/apps.js",
    "/data/users.js",
    "/data/bookmarks.js",
    "/data/config.js",
    "/desktop/taskbar.js",
    "/desktop/start-menu.js",
    "/desktop/desktop-icons.js",
    "/desktop/context-menu.js",
    "/desktop/dossier.js",
    "/desktop/browser.js",
    "/desktop/terminal.js",
    "/desktop/network-map.js",
    "/desktop/store.js",
    "/desktop/settings.js",
    "/desktop/calendar.js",
    "/desktop/toast.js",
    "/desktop/canvas-bg.js",
    "/desktop/matrix-rain.js",
    "/desktop/boot.js",
    "/desktop/wad-inspector.js",
    "/desktop/brain-helper.js",
    "/desktop/shell.js",
    "/mobile/app-framework.js",
    "/mobile/viewport.js",
    "/mobile/app-loader.js",
    "/mobile/home.js",
    "/mobile/shell.js",
    "/mobile/apps/browser/app.js",
    "/mobile/apps/browser/app.css",
    "/mobile/apps/documents/app.js",
    "/mobile/apps/documents/app.css",
    "/mobile/apps/music/app.js",
    "/mobile/apps/music/app.css",
    "/mobile/apps/settings/app.js",
    "/mobile/apps/settings/app.css",
    "/mobile/apps/files/app.js",
    "/mobile/apps/files/app.css",
    "/mobile/apps/calculator/app.js",
    "/mobile/apps/calculator/app.css",
    "/mobile/apps/devhub/app.js",
    "/mobile/apps/devhub/app.css",
    "/mobile/apps/status/app.js",
    "/mobile/apps/status/app.css",
    "/mobile/apps/homelab/app.js",
    "/mobile/apps/homelab/app.css",
    "/mobile/apps/automation/app.js",
    "/mobile/apps/automation/app.css",
    "/mobile/apps/addons/app.js",
    "/mobile/apps/addons/app.css",
    "/mobile/apps/guildcraft/app.js",
    "/mobile/apps/guildcraft/app.css",
    "/mobile/apps/survival-ai/app.js",
    "/mobile/apps/survival-ai/app.css",
    "/mobile/apps/wardenit/app.js",
    "/mobile/apps/wardenit/app.css",
    "/mobile/apps/media/app.js",
    "/mobile/apps/media/app.css",
    "/mobile/apps/flappybird/app.js",
    "/mobile/apps/flappybird/app.css",
    "/quick/shell.js",
    "/main.js",
    "/flappy.js"
];
const OPTIONAL_EXTERNAL_ASSETS = [
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-solid-900.woff2",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-regular-400.woff2",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-brands-400.woff2"
];
const CACHEABLE_EXTERNAL_HOSTS = new Set(["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"]);

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        // Each release writes to a new cache. If any required asset fails, remove
        // that partial cache and reject installation so the active worker keeps
        // serving the last complete shell.
        await caches.delete(MOBILE_SHELL_CACHE);
        const cache = await caches.open(MOBILE_SHELL_CACHE);
        try {
            await Promise.all(MOBILE_SHELL_ASSETS.map(async (path) => {
                const response = await fetch(new Request(path, { cache: "reload" }));
                if (!response.ok) {
                    throw new Error(`Required shell asset ${path} returned ${response.status}.`);
                }
                await cache.put(path, response);
            }));
        } catch (error) {
            await caches.delete(MOBILE_SHELL_CACHE);
            throw error;
        }
        await Promise.allSettled(OPTIONAL_EXTERNAL_ASSETS.map(async (url) => {
            const request = new Request(url, { cache: "reload", mode: "cors" });
            const response = await fetch(request);
            if (response.ok) await cache.put(request, response);
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter((key) => key.startsWith("portfolio-mobile-shell-") && key !== MOBILE_SHELL_CACHE)
            .map((key) => caches.delete(key)));
        await self.clients.claim();
    })());
});

function isMobileShellAsset(pathname) {
    return MOBILE_SHELL_ASSETS.includes(pathname)
        || pathname.startsWith("/mobile/apps/");
}

async function serveMobileShellAsset(request) {
    const cache = await caches.open(MOBILE_SHELL_CACHE);
    const exactCached = await cache.match(request);
    const offlineFallback = exactCached || await cache.match(request, { ignoreSearch: true });
    const networkPromise = fetch(request.clone()).then(async (response) => {
        if (response.ok) await cache.put(request, response.clone());
        return response;
    });

    if (request.mode === "navigate") {
        try {
            return await networkPromise;
        } catch (error) {
            return offlineFallback || await cache.match("/") || new Response("PortfoliOS Mobile is unavailable offline.", { status: 503 });
        }
    }

    if (exactCached) {
        networkPromise.catch(() => {});
        return exactCached;
    }
    try {
        return await networkPromise;
    } catch (error) {
        if (offlineFallback) return offlineFallback;
        throw error;
    }
}

async function serveExternalAsset(request) {
    const cache = await caches.open(MOBILE_SHELL_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") await cache.put(request, response.clone());
    return response;
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getFileRecord(db, path) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(path);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

function serializeError(error) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack || null
        };
    }
    return {
        message: String(error || "Unknown error")
    };
}

async function broadcastSystemLog(level, message, detail = null) {
    try {
        const windows = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        });

        windows.forEach((client) => {
            client.postMessage({
                source: "portfolio-service-worker",
                type: "system-log",
                level,
                message,
                detail
            });
        });
    } catch (error) {}
}

async function fetchFromNetwork(relativePath, request) {
    try {
        return await fetch(request.clone());
    } catch (error) {
        const detail = serializeError(error);
        const message = detail.message || "";
        const isNavigation = request.mode === "navigate" || request.destination === "document";
        const isAbortLike = /abort|failed to fetch/i.test(message) || detail.name === "AbortError";

        if (isNavigation && isAbortLike) {
            return new Response(null, {
                status: 204,
                headers: {
                    "Cache-Control": "no-store"
                }
            });
        }

        console.warn(`[SW] Network fallback failed for ${relativePath}:`, error);
        await broadcastSystemLog("warning", `[Service Worker] Network fallback failed for ${relativePath}`, detail);

        if (isNavigation) {
            return new Response(
                "<!doctype html><meta charset=\"utf-8\"><title>PortfoliOS</title><body style=\"background:#05070b;color:#e5f6ff;font:16px system-ui;padding:2rem\"><h1>App runtime unavailable</h1><p>The local cache did not contain this file and the network fallback failed.</p></body>",
                {
                    status: 503,
                    headers: {
                        "Content-Type": "text/html; charset=UTF-8",
                        "Cache-Control": "no-store"
                    }
                }
            );
        }

        return new Response("", {
            status: 504,
            statusText: "Network fallback failed",
            headers: {
                "Cache-Control": "no-store"
            }
        });
    }
}

function prepareRuntimeHtml(html) {
    const base = '<base href="/apps/ut99/runtime/index.php/">';
    const favicon = '<link rel="icon" href="data:,">';
    const volumeHook = '<script src="/volume-hook.js?v=1.0.93"></script>';
    const errorBridge = `
<script>
(function() {
    function sendError(type, message, detail) {
        if (window.parent && window.parent !== window) {
            try {
                window.parent.postMessage({
                    source: "portfolio-ut99-runtime",
                    type: "ut99-log",
                    level: "error",
                    message: "[Iframe] " + type + ": " + message,
                    detail: detail || null
                }, window.location.origin);
            } catch (e) {}
        }
    }

    window.addEventListener("error", function(event) {
        sendError("Unhandled Error",
            (event.message || "Unknown") + " at " +
            (event.filename || "?") + ":" +
            (event.lineno || 0) + ":" +
            (event.colno || 0),
            event.error ? (event.error.stack || event.error.message) : null
        );
    });

    window.addEventListener("unhandledrejection", function(event) {
        var reason = event.reason;
        var msg = reason instanceof Error ? reason.message : String(reason || "");
        var stack = reason instanceof Error ? reason.stack : null;
        sendError("Unhandled Rejection", msg, stack);
    });

})();
</script>
`;

    const headInjection = base + "\n    " + favicon + "\n    " + volumeHook + "\n    " + errorBridge;
    if (html.includes("<head>")) {
        return html.replace("<head>", "<head>\n    " + headInjection);
    }
    return headInjection + html;
}

async function serveFromIndexedDB(relativePath, request) {
    try {
        const db = await openDB();
        const record = await getFileRecord(db, relativePath);
        if (record && record.data) {
            console.log(`[SW] Serving ${relativePath} from IndexedDB`);
            
            const headers = {
                "Content-Type": record.type || "application/octet-stream",
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp",
                "Cross-Origin-Resource-Policy": "same-origin",
                "X-Content-Type-Options": "nosniff"
            };

            let body = record.data;
            if (record.type && record.type.startsWith("text/html")) {
                const text = typeof body === "string" ? body : new TextDecoder().decode(body);
                if (relativePath.includes("/ut99/")) {
                    body = prepareRuntimeHtml(text);
                } else {
                    body = text;
                }
            }

            return new Response(body, { headers });
        }
    } catch (err) {
        console.error(`[SW] Error loading ${relativePath} from IndexedDB:`, err);
    }
    
    return fetchFromNetwork(relativePath, request);
}

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === "GET" && CACHEABLE_EXTERNAL_HOSTS.has(url.hostname)) {
        event.respondWith(serveExternalAsset(event.request));
        return;
    }

    if (url.origin === self.location.origin) {
        if (event.request.method === "GET" && isMobileShellAsset(url.pathname)) {
            event.respondWith(serveMobileShellAsset(event.request));
            return;
        }

        // --- 1. Unreal Tournament 99 Interceptor ---
        if (url.pathname.startsWith("/apps/ut99/runtime/index.php")) {
            let relativePath = url.pathname.replace("/apps/ut99/runtime/index.php", "/apps/ut99/runtime");
            if (relativePath === "/apps/ut99/runtime" || relativePath === "/apps/ut99/runtime/") {
                relativePath = "/apps/ut99/runtime/index.html";
            }
            if (relativePath.includes("/gamedata/")) return;
            
            event.respondWith(serveFromIndexedDB(relativePath, event.request));
            return;
        }

        // --- 2. Doom Interceptor ---
        if (url.pathname === "/doom.js" || url.pathname === "/doom.wasm" || url.pathname === "/DOOM.WAD") {
            const relativePath = `/apps/doomsource${url.pathname}`;
            event.respondWith(serveFromIndexedDB(relativePath, event.request));
            return;
        }

        // --- 3. Duke Nukem 3D Interceptor ---
        if (url.pathname === "/duke32/index.html" || url.pathname === "/duke32/duke3d.zip") {
            const relativePath = url.pathname.replace("/duke32/", "/apps/duke32/");
            event.respondWith(serveFromIndexedDB(relativePath, event.request));
            return;
        }

        // --- 4. Quake Interceptor ---
        if (url.pathname === "/quake/index.html" || url.pathname === "/quake/id1/pak0.pak" || url.pathname.startsWith("/quake/WebQuake/")) {
            const relativePath = url.pathname.replace("/quake/", "/apps/quake/");
            event.respondWith(serveFromIndexedDB(relativePath, event.request));
            return;
        }

        // --- 5. Diablo Interceptor ---
        if (url.pathname.startsWith("/diablo/")) {
            if (url.pathname.includes("/DIABDAT.MPQ")) return;
            const relativePath = url.pathname.replace("/diablo/", "/apps/diablo/");
            event.respondWith(serveFromIndexedDB(relativePath, event.request));
            return;
        }

        // --- 6. OpenRCT2 Interceptor ---
        if (url.pathname.startsWith("/apps/openrct2/runtime/")) {
            if (url.pathname.includes("/RCT.zip")) return;
            const relativePath = url.pathname;
            event.respondWith(serveFromIndexedDB(relativePath, event.request));
            return;
        }
    }
});
