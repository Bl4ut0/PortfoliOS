/**
 * PortfoliOS: Service Worker
 * Intercepts network requests and serves installed app binaries from SystemFS (IndexedDB).
 */

const DB_NAME = "PortfoliOS_FS";
const STORE_NAME = "files";

self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

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
    const volumeHook = '<script src="/volume-hook.js?v=1.0.90"></script>';
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
                }, "*");
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

    if (url.origin === self.location.origin) {
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
