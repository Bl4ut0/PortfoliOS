/**
 * PortfoliOS: IPTV Stream
 * Client-only M3U/Xtream live TV player with bounded XMLTV caching in SystemFS.
 */
(function() {
    "use strict";

    const APP_ID = "iptv";
    const STORAGE_ROOT = "/Apps/IPTV Stream";
    const PROFILE_PATH = `${STORAGE_ROOT}/profile.json`;
    const EPG_PATH = `${STORAGE_ROOT}/epg-cache.json`;
    const MAINTENANCE_PATH = `${STORAGE_ROOT}/maintenance.json`;
    const SESSION_KEY = "portfolios_iptv_session_v1";
    const SCHEMA_VERSION = 1;
    const EPG_REFRESH_MS = 6 * 60 * 60 * 1000;
    const EPG_HARD_EXPIRY_MS = 24 * 60 * 60 * 1000;
    const EPG_PAST_MS = 12 * 60 * 60 * 1000;
    const EPG_FUTURE_MS = 72 * 60 * 60 * 1000;
    const MAX_EPG_PROGRAMMES = 60000;
    const MAX_VISIBLE_CHANNELS = 500;
    const MAX_XMLTV_FRAGMENT_LENGTH = 2 * 1024 * 1024;
    const HLS_SCRIPT = "apps/iptv/vendor/hls.min.js?v=1.6.15";
    const MPEGTS_SCRIPT = "apps/iptv/vendor/mpegts.js?v=1.8.0";

    const appState = {
        sourceMode: "xtream",
        sourceType: "",
        sourceLabel: "No source",
        profile: null,
        secrets: {},
        channels: [],
        categories: [],
        selectedChannelId: "",
        categoryId: "all",
        search: "",
        guideDay: 0,
        mobileView: "channels",
        setupOpen: true,
        busy: false,
        status: "Choose an authorized IPTV source to begin.",
        statusKind: "idle",
        setupError: "",
        epg: null,
        maintenance: {
            schemaVersion: SCHEMA_VERSION,
            epgFailureCount: 0,
            lastEpgFailureAt: 0,
            lastEpgError: ""
        }
    };

    let rootEl = null;
    let videoEl = null;
    let playlistFile = null;
    let guideFile = null;
    let hlsPlayer = null;
    let mpegtsPlayer = null;
    let unregisterAudio = null;
    let mountGeneration = 0;
    let playbackGeneration = 0;
    let hlsNetworkRetries = 0;
    let hlsMediaRetries = 0;
    let playbackFallbackTried = false;
    let busyOperations = 0;
    const pendingControllers = new Set();
    const libraryPromises = new Map();

    function escapeHtml(value) {
        if (window.escapeHtml) return window.escapeHtml(value);
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function cleanText(value, fallback = "") {
        const text = String(value ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim();
        return text || fallback;
    }

    function truncate(value, length = 360) {
        const text = cleanText(value);
        return text.length > length ? `${text.slice(0, length - 1)}...` : text;
    }

    function normalizeName(value) {
        return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }

    function safeImageUrl(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        try {
            const url = new URL(raw, window.location.href);
            if (url.protocol === "https:" || url.protocol === "http:") return url.href;
        } catch (error) {}
        return "";
    }

    function normalizeRemoteUrl(value, label = "URL") {
        const raw = String(value || "").trim();
        if (!raw) throw new Error(`${label} is required.`);

        let url;
        try {
            url = new URL(raw);
        } catch (error) {
            throw new Error(`${label} must be a complete HTTP or HTTPS address.`);
        }

        if (url.protocol !== "https:" && url.protocol !== "http:") {
            throw new Error(`${label} must use HTTP or HTTPS.`);
        }
        if (window.location.protocol === "https:" && url.protocol !== "https:") {
            throw new Error(`${label} must use HTTPS when PortfoliOS is running on HTTPS.`);
        }
        return url.href;
    }

    function normalizeServer(value) {
        const href = normalizeRemoteUrl(value, "Server address");
        const url = new URL(href);
        if (url.username || url.password) {
            throw new Error("Server credentials must be entered in the username and password fields, not embedded in the address.");
        }
        url.search = "";
        url.hash = "";
        url.pathname = url.pathname.replace(/\/(?:player_api\.php|xmltv\.php|get\.php)\/?$/i, "").replace(/\/+$/, "");
        return url.href.replace(/\/$/, "");
    }

    function resolvePlaylistUrl(value, sourceUrl = "") {
        const raw = String(value || "").trim();
        if (!raw) return "";
        try {
            const url = sourceUrl ? new URL(raw, sourceUrl) : new URL(raw);
            if (url.protocol === "https:" || url.protocol === "http:") return url.href;
        } catch (error) {}
        return "";
    }

    function splitExtinf(line) {
        const body = String(line || "").replace(/^#EXTINF:/i, "");
        let quoted = false;
        for (let index = 0; index < body.length; index++) {
            const character = body[index];
            if (character === '"') quoted = !quoted;
            if (character === "," && !quoted) {
                return [body.slice(0, index), body.slice(index + 1)];
            }
        }
        return [body, ""];
    }

    function parseAttributes(value) {
        const attributes = {};
        const pattern = /([a-z0-9_-]+)\s*=\s*"([^"]*)"/gi;
        let match;
        while ((match = pattern.exec(String(value || "")))) {
            attributes[match[1].toLowerCase()] = match[2];
        }
        return attributes;
    }

    function detectStreamKind(url, hint = "") {
        const source = `${String(url || "").toLowerCase()} ${String(hint || "").toLowerCase()}`;
        if (/\.m3u8(?:$|[?#\s])|mpegurl|output=m3u8/.test(source)) return "hls";
        if (/\.(?:ts|m2ts)(?:$|[?#\s])|mpeg-?ts|output=ts/.test(source)) return "mpegts";
        return "direct";
    }

    function parseM3U(text, sourceUrl = "") {
        const source = String(text || "").replace(/^\uFEFF/, "");
        if (!/^\s*#EXTM3U/i.test(source)) {
            throw new Error("This file is not an extended M3U playlist.");
        }

        const lines = source.split(/\r?\n/);
        const headerLine = lines.find((line) => /^\s*#EXTM3U/i.test(line)) || "";
        const headerAttributes = parseAttributes(headerLine);
        const epgUrl = resolvePlaylistUrl(
            headerAttributes["url-tvg"] || headerAttributes["x-tvg-url"] || headerAttributes["tvg-url"],
            sourceUrl
        );
        const channels = [];
        const usedIds = new Set();
        let pending = null;
        let pendingGroup = "";

        lines.forEach((rawLine) => {
            const line = rawLine.trim();
            if (!line) return;
            if (/^#EXTINF:/i.test(line)) {
                const [metadata, title] = splitExtinf(line);
                const attributes = parseAttributes(metadata);
                pending = {
                    name: cleanText(attributes["tvg-name"] || title, "Unnamed channel"),
                    epgId: cleanText(attributes["tvg-id"]),
                    logo: safeImageUrl(attributes["tvg-logo"]),
                    group: cleanText(attributes["group-title"] || pendingGroup, "Uncategorized"),
                    typeHint: attributes.type || ""
                };
                return;
            }
            if (/^#EXTGRP:/i.test(line)) {
                pendingGroup = cleanText(line.replace(/^#EXTGRP:/i, ""));
                if (pending && pendingGroup) pending.group = pendingGroup;
                return;
            }
            if (line.startsWith("#")) return;

            const streamUrl = resolvePlaylistUrl(line, sourceUrl);
            if (!streamUrl) {
                pending = null;
                return;
            }

            const channel = pending || {
                name: `Channel ${channels.length + 1}`,
                epgId: "",
                logo: "",
                group: cleanText(pendingGroup, "Uncategorized"),
                typeHint: ""
            };
            const baseId = cleanText(channel.epgId) || `${normalizeName(channel.group)}-${normalizeName(channel.name)}` || `channel-${channels.length + 1}`;
            let id = `m3u-${baseId}`;
            let suffix = 2;
            while (usedIds.has(id)) id = `m3u-${baseId}-${suffix++}`;
            usedIds.add(id);
            channels.push({
                id,
                name: channel.name,
                epgId: channel.epgId,
                logo: channel.logo,
                group: channel.group,
                streamUrl,
                streamKind: detectStreamKind(streamUrl, channel.typeHint)
            });
            pending = null;
        });

        if (!channels.length) throw new Error("The playlist did not contain any playable HTTP streams.");
        return { channels, epgUrl };
    }

    function parseXmltvDate(value) {
        const match = String(value || "").trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}|Z))?/);
        if (!match) return 0;
        const [, year, month, day, hour, minute, second, zone] = match;
        let timestamp = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
        if (zone && zone !== "Z") {
            const sign = zone[0] === "+" ? 1 : -1;
            const offsetMinutes = (+zone.slice(1, 3) * 60) + +zone.slice(3, 5);
            timestamp -= sign * offsetMinutes * 60 * 1000;
        } else if (!zone) {
            timestamp = new Date(+year, +month - 1, +day, +hour, +minute, +second).getTime();
        }
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function pruneEpgCache(cache, now = Date.now()) {
        if (!cache || cache.schemaVersion !== SCHEMA_VERSION || !Number.isFinite(cache.fetchedAt)) return null;
        if (now - cache.fetchedAt > EPG_HARD_EXPIRY_MS) return null;

        const minimum = now - EPG_PAST_MS;
        const maximum = now + EPG_FUTURE_MS;
        const programmes = {};
        let programmeCount = 0;

        Object.entries(cache.programmes || {}).forEach(([channelId, entries]) => {
            if (!Array.isArray(entries) || programmeCount >= MAX_EPG_PROGRAMMES) return;
            const retained = entries
                .filter((entry) => Number(entry?.e) >= minimum && Number(entry?.s) <= maximum)
                .sort((a, b) => Number(a.s) - Number(b.s))
                .slice(0, 240);
            if (!retained.length) return;
            const available = Math.max(0, MAX_EPG_PROGRAMMES - programmeCount);
            programmes[channelId] = retained.slice(0, available);
            programmeCount += programmes[channelId].length;
        });

        return {
            ...cache,
            channels: cache.channels && typeof cache.channels === "object" ? cache.channels : {},
            programmes,
            programmeCount,
            expiresAt: cache.fetchedAt + EPG_REFRESH_MS
        };
    }

    function parseXmltvFragment(fragment, tagName) {
        const parser = new DOMParser();
        const xmlDocument = parser.parseFromString(fragment, "application/xml");
        if (!xmlDocument.querySelector("parsererror")) return xmlDocument.documentElement;

        const htmlDocument = parser.parseFromString(fragment, "text/html");
        const fallbackNode = htmlDocument.querySelector(tagName);
        if (fallbackNode) return fallbackNode;
        throw new Error(`The XMLTV guide contains an invalid <${tagName}> record.`);
    }

    function createXmltvAccumulator(sourceFingerprint = "", now = Date.now()) {
        if (typeof DOMParser === "undefined") throw new Error("XMLTV parsing is unavailable in this browser.");
        const channels = {};
        const programmes = {};
        const minimum = now - EPG_PAST_MS;
        const maximum = now + EPG_FUTURE_MS;
        let programmeCount = 0;
        let buffer = "";
        let sawRecord = false;

        function consumeRecord(fragment, tagName) {
            const node = parseXmltvFragment(fragment, tagName);
            sawRecord = true;
            if (tagName === "channel") {
                const id = cleanText(node.getAttribute("id"));
                if (!id) return;
                channels[id] = {
                    name: cleanText(node.querySelector("display-name")?.textContent, id),
                    icon: safeImageUrl(node.querySelector("icon")?.getAttribute("src"))
                };
                return;
            }

            if (programmeCount >= MAX_EPG_PROGRAMMES) return;
            const channelId = cleanText(node.getAttribute("channel"));
            const start = parseXmltvDate(node.getAttribute("start"));
            const stop = parseXmltvDate(node.getAttribute("stop")) || start + 60 * 60 * 1000;
            if (!channelId || !start || stop < minimum || start > maximum) return;
            if (!programmes[channelId]) programmes[channelId] = [];
            programmes[channelId].push({
                s: start,
                e: Math.max(stop, start + 60 * 1000),
                t: truncate(node.querySelector("title")?.textContent, 180) || "Untitled programme",
                d: truncate(node.querySelector("desc")?.textContent, 420),
                c: truncate(node.querySelector("category")?.textContent, 80)
            });
            programmeCount++;
        }

        function push(chunk = "", final = false) {
            const text = String(chunk || "");
            if (/<!DOCTYPE/i.test(text) || /<!DOCTYPE/i.test(`${buffer.slice(-32)}${text.slice(0, 32)}`)) {
                throw new Error("XMLTV documents with DTD declarations are not supported.");
            }
            buffer += text;

            while (buffer) {
                const channelIndex = buffer.search(/<channel\b/i);
                const programmeIndex = buffer.search(/<programme\b/i);
                let startIndex = -1;
                let tagName = "";
                if (channelIndex >= 0 && (programmeIndex < 0 || channelIndex < programmeIndex)) {
                    startIndex = channelIndex;
                    tagName = "channel";
                } else if (programmeIndex >= 0) {
                    startIndex = programmeIndex;
                    tagName = "programme";
                }

                if (startIndex < 0) {
                    buffer = final ? "" : buffer.slice(-64);
                    break;
                }
                if (startIndex > 0) buffer = buffer.slice(startIndex);

                const closingPattern = new RegExp(`</${tagName}\\s*>`, "i");
                const closingMatch = closingPattern.exec(buffer);
                if (!closingMatch) {
                    if (buffer.length > MAX_XMLTV_FRAGMENT_LENGTH) {
                        throw new Error(`An XMLTV <${tagName}> record exceeds the 2 MB safety limit.`);
                    }
                    if (final) throw new Error(`The XMLTV guide ends inside a <${tagName}> record.`);
                    break;
                }

                const endIndex = closingMatch.index + closingMatch[0].length;
                consumeRecord(buffer.slice(0, endIndex), tagName);
                buffer = buffer.slice(endIndex);
                if (programmeCount >= MAX_EPG_PROGRAMMES) {
                    buffer = "";
                    break;
                }
            }
            return programmeCount >= MAX_EPG_PROGRAMMES;
        }

        function finish() {
            push("", true);
            if (!sawRecord) throw new Error("The guide response did not contain XMLTV channel or programme records.");
            if (!programmeCount) throw new Error("The XMLTV guide contained no current or upcoming programmes.");
            Object.values(programmes).forEach((entries) => entries.sort((a, b) => a.s - b.s));
            return {
                schemaVersion: SCHEMA_VERSION,
                sourceFingerprint,
                fetchedAt: now,
                expiresAt: now + EPG_REFRESH_MS,
                channels,
                programmes,
                programmeCount
            };
        }

        return {
            push,
            finish,
            get isFull() {
                return programmeCount >= MAX_EPG_PROGRAMMES;
            }
        };
    }

    function parseXmltv(text, sourceFingerprint = "", now = Date.now()) {
        const payload = String(text || "");
        if (!payload.trim()) throw new Error("The guide response was empty.");
        const accumulator = createXmltvAccumulator(sourceFingerprint, now);
        accumulator.push(payload);
        return accumulator.finish();
    }

    async function prepareGuideStream(stream) {
        if (!stream?.getReader) throw new Error("Streaming guide downloads are unavailable in this browser.");
        const reader = stream.getReader();
        const first = await reader.read();
        const firstBytes = first.value || new Uint8Array();
        const restored = new ReadableStream({
            start(controller) {
                if (!first.done && firstBytes.length) controller.enqueue(firstBytes);
                const pump = () => reader.read().then(({ done, value }) => {
                    if (done) {
                        controller.close();
                        return;
                    }
                    controller.enqueue(value);
                    return pump();
                }).catch((error) => controller.error(error));
                if (first.done) controller.close();
                else pump();
            },
            cancel(reason) {
                return reader.cancel(reason);
            }
        });

        if (firstBytes[0] === 0x1f && firstBytes[1] === 0x8b) {
            if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot decompress the GZIP XMLTV guide.");
            return restored.pipeThrough(new DecompressionStream("gzip"));
        }
        return restored;
    }

    async function parseXmltvStream(stream, sourceFingerprint = "") {
        const decodedStream = await prepareGuideStream(stream);
        const reader = decodedStream.getReader();
        const decoder = new TextDecoder();
        const accumulator = createXmltvAccumulator(sourceFingerprint);
        let processedBytes = 0;
        let nextProgressUpdate = 5 * 1024 * 1024;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            processedBytes += value.byteLength;
            accumulator.push(decoder.decode(value, { stream: true }));
            if (processedBytes >= nextProgressUpdate) {
                setStatus(`Indexing guide data... ${(processedBytes / (1024 * 1024)).toFixed(0)} MB processed`, "working");
                nextProgressUpdate += 5 * 1024 * 1024;
            }
            if (accumulator.isFull) {
                await reader.cancel("The retained guide window reached its configured listing limit.");
                break;
            }
        }
        accumulator.push(decoder.decode());
        return accumulator.finish();
    }

    function fingerprint(value) {
        let hash = 2166136261;
        const input = String(value || "");
        for (let index = 0; index < input.length; index++) {
            hash ^= input.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, "0");
    }

    function currentSourceFingerprint(profile = appState.profile) {
        if (!profile) return "";
        return fingerprint([
            profile.sourceType || "",
            String(profile.server || "").toLowerCase(),
            String(profile.username || "").toLowerCase(),
            String(profile.label || "").toLowerCase(),
            String(profile.sourceKey || "")
        ].join("|"));
    }

    async function ensureStorage() {
        if (!window.SystemFS) throw new Error("SystemFS is not available.");
        await window.SystemFS.ensureDirectory(STORAGE_ROOT, {
            silent: true,
            metadata: { kind: "iptv-app-data", schemaVersion: SCHEMA_VERSION }
        });
    }

    async function readJson(path) {
        if (!window.SystemFS) return null;
        const record = await window.SystemFS.readFile(path);
        if (!record?.data) return null;
        try {
            const text = typeof record.data === "string" ? record.data : await new Blob([record.data]).text();
            return JSON.parse(text);
        } catch (error) {
            await window.SystemFS.deleteFile(path, { silent: true }).catch(() => {});
            return null;
        }
    }

    async function writeJson(path, value, kind) {
        await ensureStorage();
        const data = JSON.stringify(value);
        await window.SystemFS.writeFile(
            path,
            window.SystemFS.getName(path),
            STORAGE_ROOT,
            data,
            data.length,
            "application/json",
            false,
            { silent: true, metadata: { kind, schemaVersion: SCHEMA_VERSION } }
        );
    }

    async function deleteStored(path) {
        if (!window.SystemFS) return;
        const existing = await window.SystemFS.readFile(path);
        if (existing) await window.SystemFS.deleteFile(path, { silent: true });
    }

    function saveSession() {
        try {
            window.sessionStorage?.setItem(SESSION_KEY, JSON.stringify({
                schemaVersion: SCHEMA_VERSION,
                sourceType: appState.sourceType,
                sourceLabel: appState.sourceLabel,
                server: appState.profile?.server || "",
                username: appState.profile?.username || "",
                streamFormat: appState.profile?.streamFormat || "auto",
                password: appState.secrets.password || "",
                playlistUrl: appState.secrets.playlistUrl || "",
                epgUrl: appState.secrets.epgUrl || ""
            }));
        } catch (error) {}
    }

    function loadSession() {
        try {
            const parsed = JSON.parse(window.sessionStorage?.getItem(SESSION_KEY) || "null");
            return parsed?.schemaVersion === SCHEMA_VERSION ? parsed : null;
        } catch (error) {
            return null;
        }
    }

    function clearSession() {
        try {
            window.sessionStorage?.removeItem(SESSION_KEY);
        } catch (error) {}
        appState.secrets = {};
    }

    async function loadStoredState() {
        if (!window.SystemFS) return;
        await ensureStorage();
        const [profile, maintenance, cachedEpg] = await Promise.all([
            readJson(PROFILE_PATH),
            readJson(MAINTENANCE_PATH),
            readJson(EPG_PATH)
        ]);

        if (profile?.schemaVersion === SCHEMA_VERSION) {
            appState.profile = profile;
            appState.sourceMode = profile.sourceType || "xtream";
            appState.sourceLabel = profile.label || (profile.sourceType === "xtream" ? "Xtream account" : "M3U playlist");
        }
        if (maintenance?.schemaVersion === SCHEMA_VERSION) {
            appState.maintenance = { ...appState.maintenance, ...maintenance };
        }

        const pruned = pruneEpgCache(cachedEpg);
        if (!pruned) {
            if (cachedEpg) await deleteStored(EPG_PATH);
            appState.epg = null;
            return;
        }

        const expectedFingerprint = currentSourceFingerprint(profile);
        if (expectedFingerprint && pruned.sourceFingerprint === expectedFingerprint) {
            appState.epg = pruned;
            if (pruned.programmeCount !== Number(cachedEpg.programmeCount || 0)) {
                await writeJson(EPG_PATH, pruned, "iptv-epg-cache");
            }
        } else {
            await deleteStored(EPG_PATH);
            appState.epg = null;
        }
    }

    function abortPendingRequests() {
        pendingControllers.forEach((controller) => controller.abort());
        pendingControllers.clear();
    }

    async function fetchResource(url, responseType = "json", timeoutMs = 20000) {
        const controller = new AbortController();
        pendingControllers.add(controller);
        let timedOut = false;
        const timer = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer"
            });
            if (!response.ok) throw new Error(`The provider returned HTTP ${response.status}.`);
            if (responseType === "arrayBuffer") return await response.arrayBuffer();
            if (responseType === "text") return await response.text();
            return await response.json();
        } catch (error) {
            if (timedOut) throw new Error("The provider request timed out.");
            if (error?.name === "AbortError") {
                const cancelled = new Error("The provider request was cancelled.");
                cancelled.name = "AbortError";
                throw cancelled;
            }
            if (error instanceof TypeError || /failed to fetch|networkerror/i.test(error?.message || "")) {
                throw new Error("Direct browser access was blocked. The provider must support HTTPS and CORS; PortfoliOS does not proxy account credentials.");
            }
            throw error;
        } finally {
            window.clearTimeout(timer);
            pendingControllers.delete(controller);
        }
    }

    async function fetchGuideCache(url, sourceFingerprint) {
        const controller = new AbortController();
        pendingControllers.add(controller);
        let timedOut = false;
        const timer = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, 5 * 60 * 1000);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                cache: "no-store",
                credentials: "omit",
                referrerPolicy: "no-referrer"
            });
            if (!response.ok) throw new Error(`The guide provider returned HTTP ${response.status}.`);
            const stream = response.body || new Blob([await response.arrayBuffer()]).stream();
            return await parseXmltvStream(stream, sourceFingerprint);
        } catch (error) {
            if (timedOut) throw new Error("The guide download timed out after five minutes.");
            if (error?.name === "AbortError") {
                const cancelled = new Error("The guide download was cancelled.");
                cancelled.name = "AbortError";
                throw cancelled;
            }
            if (error instanceof TypeError || /failed to fetch|networkerror/i.test(error?.message || "")) {
                throw new Error("Direct guide access was blocked. The provider must support HTTPS and CORS; PortfoliOS does not proxy account credentials.");
            }
            throw error;
        } finally {
            window.clearTimeout(timer);
            pendingControllers.delete(controller);
        }
    }

    function xtreamEndpoint(server, path, username, password, parameters = {}) {
        const url = new URL(`${server.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
        url.searchParams.set("username", username);
        url.searchParams.set("password", password);
        Object.entries(parameters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
        });
        return url.href;
    }

    function xtreamStreamUrl(channel) {
        const server = appState.profile?.server || "";
        const username = appState.profile?.username || "";
        const password = appState.secrets.password || "";
        let format = channel.streamFormat || appState.profile?.streamFormat || "m3u8";
        if (format === "auto") format = "m3u8";
        return `${server.replace(/\/$/, "")}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(channel.streamId)}.${format}`;
    }

    function categoryList(channels, labels = {}) {
        const names = new Set(channels.map((channel) => cleanText(channel.group, "Uncategorized")));
        return [...names]
            .map((name) => ({ id: name, name: labels[name] || name }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }

    function setBusy(busy, message = "") {
        busyOperations = Math.max(0, busyOperations + (busy ? 1 : -1));
        appState.busy = busyOperations > 0;
        if (message) setStatus(message, busy ? "working" : appState.statusKind);
        if (rootEl) rootEl.dataset.busy = appState.busy ? "true" : "false";
        rootEl?.querySelectorAll("[data-iptv-connect-submit]").forEach((button) => {
            button.disabled = appState.busy;
        });
    }

    function setStatus(message, kind = "idle") {
        appState.status = cleanText(message, "Ready");
        appState.statusKind = kind;
        renderStatus();
    }

    function setSetupError(message = "") {
        appState.setupError = cleanText(message);
        const errorEl = rootEl?.querySelector("[data-iptv-setup-error]");
        if (!errorEl) return;
        errorEl.hidden = !appState.setupError;
        errorEl.textContent = appState.setupError;
    }

    function selectedChannel() {
        return appState.channels.find((channel) => channel.id === appState.selectedChannelId) || null;
    }

    function programmeEntries(channel) {
        if (!channel || !appState.epg) return [];
        if (channel.epgId && appState.epg.programmes[channel.epgId]) return appState.epg.programmes[channel.epgId];

        const target = normalizeName(channel.name);
        const matchingId = Object.entries(appState.epg.channels || {})
            .find(([, details]) => normalizeName(details?.name) === target)?.[0];
        return matchingId ? appState.epg.programmes[matchingId] || [] : [];
    }

    function nowAndNext(channel, now = Date.now()) {
        const entries = programmeEntries(channel);
        const currentIndex = entries.findIndex((entry) => entry.s <= now && entry.e > now);
        if (currentIndex >= 0) return { now: entries[currentIndex], next: entries[currentIndex + 1] || null };
        return { now: null, next: entries.find((entry) => entry.s > now) || null };
    }

    function formatTime(timestamp) {
        if (!timestamp) return "";
        return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    }

    function filteredChannels() {
        const query = normalizeName(appState.search);
        return appState.channels.filter((channel) => {
            if (appState.categoryId !== "all" && channel.group !== appState.categoryId) return false;
            if (!query) return true;
            return normalizeName(`${channel.name} ${channel.group}`).includes(query);
        });
    }

    function renderCategories() {
        const select = rootEl?.querySelector("[data-iptv-category]");
        if (!select) return;
        select.innerHTML = [
            `<option value="all">All categories</option>`,
            ...appState.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
        ].join("");
        select.value = appState.categories.some((category) => category.id === appState.categoryId)
            ? appState.categoryId
            : "all";
        select.disabled = !appState.channels.length;
    }

    function channelLogo(channel, className = "iptv-channel-logo") {
        const logo = safeImageUrl(channel?.logo);
        if (logo) return `<img class="${className}" src="${escapeHtml(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
        return `<span class="${className} is-fallback"><i class="fa-solid fa-tv"></i></span>`;
    }

    function renderChannels() {
        const list = rootEl?.querySelector("[data-iptv-channel-list]");
        const count = rootEl?.querySelector("[data-iptv-channel-count]");
        if (!list) return;
        const matches = filteredChannels();
        const visible = matches.slice(0, MAX_VISIBLE_CHANNELS);
        if (count) count.textContent = `${matches.length} channel${matches.length === 1 ? "" : "s"}`;

        if (!appState.channels.length) {
            list.innerHTML = `
                <div class="iptv-empty-list">
                    <i class="fa-solid fa-satellite-dish"></i>
                    <strong>No source connected</strong>
                    <span>Add Xtream credentials or an M3U playlist.</span>
                </div>`;
            return;
        }
        if (!matches.length) {
            list.innerHTML = `
                <div class="iptv-empty-list">
                    <i class="fa-solid fa-filter-circle-xmark"></i>
                    <strong>No matching channels</strong>
                    <span>Change the search or category filter.</span>
                </div>`;
            return;
        }

        list.innerHTML = visible.map((channel) => {
            const listing = nowAndNext(channel).now;
            return `
                <button type="button" class="iptv-channel-row${channel.id === appState.selectedChannelId ? " is-selected" : ""}"
                    data-iptv-channel="${escapeHtml(channel.id)}" title="Play ${escapeHtml(channel.name)}">
                    ${channelLogo(channel)}
                    <span class="iptv-channel-copy">
                        <strong>${escapeHtml(channel.name)}</strong>
                        <small>${escapeHtml(listing?.t || channel.group || "Live channel")}</small>
                    </span>
                    <i class="fa-solid fa-play" aria-hidden="true"></i>
                </button>`;
        }).join("") + (matches.length > visible.length
            ? `<div class="iptv-list-limit">Showing the first ${MAX_VISIBLE_CHANNELS} matches. Narrow the search to see more.</div>`
            : "");
    }

    function renderPlayerDetails() {
        const channel = selectedChannel();
        const title = rootEl?.querySelector("[data-iptv-now-title]");
        const detail = rootEl?.querySelector("[data-iptv-now-detail]");
        const logo = rootEl?.querySelector("[data-iptv-now-logo]");
        if (title) title.textContent = channel?.name || "Select a channel";
        if (detail) {
            const listing = nowAndNext(channel).now;
            detail.textContent = listing ? `${formatTime(listing.s)} - ${formatTime(listing.e)}  ${listing.t}` : (channel?.group || "Your stream will open here.");
        }
        if (logo) logo.innerHTML = channel ? channelLogo(channel, "iptv-now-logo-image") : `<i class="fa-solid fa-tv"></i>`;
    }

    function renderGuide() {
        const panel = rootEl?.querySelector("[data-iptv-guide-list]");
        const dateLabel = rootEl?.querySelector("[data-iptv-guide-date]");
        if (!panel) return;
        const channel = selectedChannel();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() + appState.guideDay);
        const startTime = start.getTime();
        const endTime = startTime + 24 * 60 * 60 * 1000;
        if (dateLabel) dateLabel.textContent = formatDate(startTime);

        if (!channel) {
            panel.innerHTML = `
                <div class="iptv-empty-guide">
                    <i class="fa-regular fa-calendar"></i>
                    <strong>No channel selected</strong>
                    <span>Choose a channel to inspect its schedule.</span>
                </div>`;
            return;
        }

        const entries = programmeEntries(channel).filter((entry) => entry.e > startTime && entry.s < endTime);
        if (!entries.length) {
            panel.innerHTML = `
                <div class="iptv-empty-guide">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    <strong>No guide listings</strong>
                    <span>Refresh the EPG or verify this channel's TVG ID.</span>
                </div>`;
            return;
        }

        const now = Date.now();
        panel.innerHTML = entries.map((entry) => `
            <article class="iptv-programme${entry.s <= now && entry.e > now ? " is-live" : ""}">
                <time>${escapeHtml(formatTime(entry.s))}</time>
                <div>
                    <strong>${escapeHtml(entry.t)}</strong>
                    ${entry.c ? `<small>${escapeHtml(entry.c)}</small>` : ""}
                    ${entry.d ? `<p>${escapeHtml(entry.d)}</p>` : ""}
                </div>
            </article>`).join("");
    }

    function renderStatus() {
        const status = rootEl?.querySelector("[data-iptv-status]");
        const epgStatus = rootEl?.querySelector("[data-iptv-epg-status]");
        if (status) {
            status.dataset.kind = appState.statusKind;
            status.innerHTML = `<i class="fa-solid ${appState.statusKind === "error" ? "fa-circle-exclamation" : appState.statusKind === "working" ? "fa-spinner fa-spin" : "fa-circle-info"}"></i><span>${escapeHtml(appState.status)}</span>`;
        }
        if (epgStatus) {
            if (!appState.epg) {
                epgStatus.textContent = "Guide not cached";
            } else {
                const stale = Date.now() > appState.epg.expiresAt;
                epgStatus.textContent = `${stale ? "Guide stale" : "Guide cached"} / ${appState.epg.programmeCount || 0} listings`;
            }
        }
    }

    function renderSetupState() {
        const setup = rootEl?.querySelector("[data-iptv-setup]");
        if (!setup) return;
        setup.hidden = !appState.setupOpen;
        setup.dataset.mode = appState.sourceMode;
        rootEl.querySelectorAll("[data-iptv-source-mode]").forEach((button) => {
            const selected = button.dataset.iptvSourceMode === appState.sourceMode;
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-selected", selected ? "true" : "false");
        });
        rootEl.querySelectorAll("[data-iptv-source-panel]").forEach((panel) => {
            panel.hidden = panel.dataset.iptvSourcePanel !== appState.sourceMode;
        });
        const cancel = rootEl.querySelector("[data-iptv-cancel-setup]");
        const forget = rootEl.querySelector("[data-iptv-forget-source]");
        if (cancel) cancel.hidden = !appState.channels.length;
        if (forget) forget.hidden = !appState.profile && !appState.epg;
        setSetupError(appState.setupError);
        updateProtocolAlert();
    }

    function updateProtocolAlert() {
        if (!rootEl) return;
        const hostedOnHttps = window.location.protocol === "https:";
        const alert = rootEl.querySelector("[data-iptv-protocol-alert]");
        const detail = rootEl.querySelector("[data-iptv-protocol-alert-detail]");
        const urlFields = rootEl.querySelectorAll("[data-iptv-xtream-server], [data-iptv-m3u-url], [data-iptv-m3u-epg-url]");
        let hasBlockedHttpUrl = false;

        urlFields.forEach((field) => {
            const fieldMode = field.closest("[data-iptv-source-panel]")?.dataset.iptvSourcePanel;
            const blocked = hostedOnHttps
                && fieldMode === appState.sourceMode
                && /^http:\/\//i.test(field.value.trim());
            field.setCustomValidity(blocked
                ? "HTTP sources are blocked because PortfoliOS is running on HTTPS. Use an HTTPS provider endpoint."
                : "");
            field.classList.toggle("is-http-blocked", blocked);
            hasBlockedHttpUrl = hasBlockedHttpUrl || blocked;
        });

        if (!alert) return;
        alert.hidden = !hostedOnHttps;
        alert.classList.toggle("is-blocked", hasBlockedHttpUrl);
        if (detail) {
            detail.textContent = hasBlockedHttpUrl
                ? "The entered HTTP address cannot be submitted or played from this HTTPS site. Use the provider's HTTPS endpoint."
                : "Provider, playlist, guide, and stream addresses must use HTTPS. Browsers block HTTP media inside this hosted app.";
        }
    }

    function renderShellState() {
        if (!rootEl) return;
        rootEl.dataset.mobileView = appState.mobileView;
        const source = rootEl.querySelector("[data-iptv-source-label]");
        const search = rootEl.querySelector("[data-iptv-search]");
        if (source) source.textContent = appState.sourceLabel;
        if (search) {
            search.value = appState.search;
            search.disabled = !appState.channels.length;
        }
        rootEl.querySelectorAll("[data-iptv-mobile-view]").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.iptvMobileView === appState.mobileView);
        });
        renderCategories();
        renderChannels();
        renderPlayerDetails();
        renderGuide();
        renderStatus();
        renderSetupState();
    }

    function applyProfileToForm() {
        if (!rootEl || !appState.profile) return;
        const profile = appState.profile;
        const server = rootEl.querySelector("[data-iptv-xtream-server]");
        const username = rootEl.querySelector("[data-iptv-xtream-username]");
        const format = rootEl.querySelector("[data-iptv-stream-format]");
        if (server && profile.server) server.value = profile.server;
        if (username && profile.username) username.value = profile.username;
        if (format && profile.streamFormat) format.value = profile.streamFormat;
    }

    function updateSource(channels, details) {
        const previousFingerprint = currentSourceFingerprint();
        const nextProfile = {
            schemaVersion: SCHEMA_VERSION,
            sourceType: details.sourceType,
            label: details.label,
            server: details.server || "",
            username: details.username || "",
            streamFormat: details.streamFormat || "auto",
            sourceKey: details.sourceKey || "",
            lastConnectedAt: Date.now()
        };
        const nextFingerprint = currentSourceFingerprint(nextProfile);
        appState.channels = channels;
        appState.categories = categoryList(channels);
        appState.sourceType = details.sourceType;
        appState.sourceMode = details.sourceType;
        appState.sourceLabel = details.label;
        appState.profile = nextProfile;
        if (previousFingerprint && previousFingerprint !== nextFingerprint) {
            appState.epg = null;
            appState.maintenance = {
                schemaVersion: SCHEMA_VERSION,
                epgFailureCount: 0,
                lastEpgFailureAt: 0,
                lastEpgError: ""
            };
            Promise.all([
                deleteStored(EPG_PATH),
                saveMaintenance()
            ]).catch((error) => console.warn("IPTV Stream: prior guide state could not be cleared.", error));
        }
        appState.categoryId = "all";
        appState.search = "";
        appState.selectedChannelId = "";
        appState.guideDay = 0;
        appState.setupOpen = false;
        setSetupError("");
        saveSession();
        writeJson(PROFILE_PATH, appState.profile, "iptv-source-profile").catch((error) => {
            console.warn("IPTV Stream: profile metadata could not be saved.", error);
        });
        renderShellState();
    }

    async function connectXtream(values, options = {}) {
        const server = normalizeServer(values.server);
        const username = cleanText(values.username);
        const password = String(values.password || "");
        if (!username || !password) throw new Error("Username and password are required.");

        setBusy(true, "Signing in and loading live channels...");
        const account = await fetchResource(xtreamEndpoint(server, "player_api.php", username, password), "json", 15000);
        if (!(account?.user_info?.auth === 1 || account?.user_info?.auth === "1")) {
            throw new Error("The provider did not accept these Xtream credentials.");
        }

        const [categoryPayload, streamPayload] = await Promise.all([
            fetchResource(xtreamEndpoint(server, "player_api.php", username, password, { action: "get_live_categories" }), "json", 20000),
            fetchResource(xtreamEndpoint(server, "player_api.php", username, password, { action: "get_live_streams" }), "json", 30000)
        ]);
        if (!Array.isArray(streamPayload) || !streamPayload.length) throw new Error("The account returned no live channels.");

        const categoryNames = Object.fromEntries((Array.isArray(categoryPayload) ? categoryPayload : [])
            .map((category) => [String(category.category_id), cleanText(category.category_name, "Uncategorized")]));
        const allowedFormats = Array.isArray(account.user_info?.allowed_output_formats)
            ? account.user_info.allowed_output_formats.map((item) => String(item).toLowerCase())
            : [];
        const requestedStreamFormat = values.streamFormat || "auto";
        let streamFormat = requestedStreamFormat;
        if (streamFormat === "auto") {
            streamFormat = allowedFormats.length > 0 && !allowedFormats.includes("m3u8") && allowedFormats.includes("ts")
                ? "ts"
                : "m3u8";
        }
        if (streamFormat !== "m3u8" && streamFormat !== "ts") streamFormat = "m3u8";

        const channels = streamPayload.map((stream, index) => ({
            id: `xtream-${stream.stream_id || index}`,
            streamId: stream.stream_id || index,
            name: cleanText(stream.name, `Channel ${index + 1}`),
            epgId: cleanText(stream.epg_channel_id),
            logo: safeImageUrl(stream.stream_icon),
            group: categoryNames[String(stream.category_id)] || "Uncategorized",
            streamKind: streamFormat === "ts" ? "mpegts" : "hls",
            streamFormat,
            allowFormatFallback: requestedStreamFormat === "auto"
        }));

        appState.secrets = {
            password,
            epgUrl: xtreamEndpoint(server, "xmltv.php", username, password)
        };
        updateSource(channels, {
            sourceType: "xtream",
            label: cleanText(account.server_info?.server_name, `${username} / Xtream`),
            server,
            username,
            streamFormat: requestedStreamFormat,
            sourceKey: fingerprint(`${server}|${username.toLowerCase()}`)
        });
        setStatus(`Connected to ${channels.length} live channels.`, "ready");
        if (!options.skipGuide) refreshGuide({ quiet: true }).catch(() => {});
    }

    async function connectRemoteM3U(values, options = {}) {
        const playlistUrl = normalizeRemoteUrl(values.playlistUrl, "Playlist URL");
        const customEpgUrl = values.epgUrl ? normalizeRemoteUrl(values.epgUrl, "EPG URL") : "";
        setBusy(true, "Downloading and parsing the M3U playlist...");
        const text = await fetchResource(playlistUrl, "text", 30000);
        const parsed = parseM3U(text, playlistUrl);
        appState.secrets = {
            playlistUrl,
            epgUrl: customEpgUrl || parsed.epgUrl
        };
        updateSource(parsed.channels, {
            sourceType: "m3u",
            label: cleanText(values.label, new URL(playlistUrl).hostname || "Remote M3U"),
            sourceKey: fingerprint(playlistUrl)
        });
        setStatus(`Loaded ${parsed.channels.length} channels from the remote playlist.`, "ready");
        if (appState.secrets.epgUrl && !options.skipGuide) refreshGuide({ quiet: true }).catch(() => {});
    }

    async function connectUploadedM3U() {
        if (!playlistFile) throw new Error("Choose an M3U or M3U8 playlist file.");
        setBusy(true, "Reading the local playlist...");
        const parsed = parseM3U(await playlistFile.text());
        appState.secrets = { epgUrl: parsed.epgUrl };
        updateSource(parsed.channels, {
            sourceType: "upload",
            label: cleanText(playlistFile.name, "Local M3U"),
            sourceKey: fingerprint(`${playlistFile.name}|${playlistFile.size}|${playlistFile.lastModified}`)
        });
        setStatus(`Loaded ${parsed.channels.length} channels from ${playlistFile.name}.`, "ready");
        if (guideFile) {
            await importGuideStream(guideFile.stream());
        } else if (appState.secrets.epgUrl) {
            refreshGuide({ quiet: true }).catch(() => {});
        }
    }

    async function saveMaintenance() {
        await writeJson(MAINTENANCE_PATH, appState.maintenance, "iptv-maintenance");
    }

    async function recordGuideFailure(error) {
        appState.maintenance = {
            schemaVersion: SCHEMA_VERSION,
            epgFailureCount: (Number(appState.maintenance.epgFailureCount) || 0) + 1,
            lastEpgFailureAt: Date.now(),
            lastEpgError: truncate(error?.message || error, 180)
        };

        const cacheTooOld = appState.epg && Date.now() - appState.epg.fetchedAt > EPG_HARD_EXPIRY_MS;
        if (appState.maintenance.epgFailureCount >= 3 || cacheTooOld) {
            await deleteStored(EPG_PATH);
            appState.epg = null;
            if (appState.sourceType !== "xtream") {
                appState.secrets.epgUrl = "";
                saveSession();
            }
        }
        await saveMaintenance();
    }

    async function commitGuideCache(cache) {
        appState.epg = pruneEpgCache(cache);
        appState.maintenance = {
            schemaVersion: SCHEMA_VERSION,
            epgFailureCount: 0,
            lastEpgFailureAt: 0,
            lastEpgError: ""
        };
        await Promise.all([
            writeJson(EPG_PATH, appState.epg, "iptv-epg-cache"),
            saveMaintenance()
        ]);
        renderChannels();
        renderGuide();
        renderStatus();
        setStatus(`Guide updated with ${appState.epg.programmeCount} current and upcoming listings.`, "ready");
    }

    async function importGuideStream(stream) {
        setStatus("Parsing and indexing XMLTV guide data...", "working");
        const cache = await parseXmltvStream(stream, currentSourceFingerprint());
        await commitGuideCache(cache);
    }

    async function refreshGuide(options = {}) {
        const epgUrl = appState.secrets.epgUrl;
        if (!epgUrl) {
            if (!options.quiet) throw new Error("This source has no XMLTV guide URL. Add one in Source settings or upload an XMLTV file.");
            return;
        }

        try {
            setBusy(true, "Downloading XMLTV guide data...");
            const cache = await fetchGuideCache(
                normalizeRemoteUrl(epgUrl, "EPG URL"),
                currentSourceFingerprint()
            );
            await commitGuideCache(cache);
        } catch (error) {
            if (error?.name === "AbortError") {
                if (!options.quiet) throw error;
                return;
            }
            await recordGuideFailure(error).catch(() => {});
            renderChannels();
            renderGuide();
            renderStatus();
            setStatus(error.message, "error");
            if (!options.quiet) throw error;
        } finally {
            setBusy(false);
        }
    }

    async function clearGuideCache() {
        await deleteStored(EPG_PATH);
        appState.epg = null;
        appState.maintenance = {
            schemaVersion: SCHEMA_VERSION,
            epgFailureCount: 0,
            lastEpgFailureAt: 0,
            lastEpgError: ""
        };
        await saveMaintenance();
        renderChannels();
        renderGuide();
        setStatus("The local guide cache was cleared.", "ready");
    }

    function ensureLibrary(globalName, source, marker) {
        if (window[globalName]) return Promise.resolve(window[globalName]);
        if (libraryPromises.has(globalName)) return libraryPromises.get(globalName);

        const promise = new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-iptv-library="${marker}"]`);
            const script = existing || document.createElement("script");
            const onLoad = () => window[globalName]
                ? resolve(window[globalName])
                : reject(new Error(`${globalName} loaded without initializing.`));
            const onError = () => reject(new Error(`${globalName} could not be loaded.`));
            script.addEventListener("load", onLoad, { once: true });
            script.addEventListener("error", onError, { once: true });
            if (!existing) {
                script.src = source;
                script.crossOrigin = "anonymous";
                script.referrerPolicy = "no-referrer";
                script.dataset.iptvLibrary = marker;
                document.head.appendChild(script);
            }
        }).catch((error) => {
            libraryPromises.delete(globalName);
            throw error;
        });
        libraryPromises.set(globalName, promise);
        return promise;
    }

    function stopPlayback() {
        playbackGeneration++;
        if (hlsPlayer) {
            hlsPlayer.destroy();
            hlsPlayer = null;
        }
        if (mpegtsPlayer) {
            try {
                mpegtsPlayer.pause();
                mpegtsPlayer.unload();
                mpegtsPlayer.detachMediaElement();
                mpegtsPlayer.destroy();
            } catch (error) {}
            mpegtsPlayer = null;
        }
        if (videoEl) {
            videoEl.pause();
            videoEl.removeAttribute("src");
            videoEl.load();
        }
    }

    function showPlaybackMessage(message, kind = "loading") {
        const overlay = rootEl?.querySelector("[data-iptv-player-message]");
        if (!overlay) return;
        overlay.hidden = !message;
        overlay.dataset.kind = kind;
        overlay.innerHTML = message
            ? `<i class="fa-solid ${kind === "error" ? "fa-triangle-exclamation" : "fa-spinner fa-spin"}"></i><span>${escapeHtml(message)}</span>`
            : "";
    }

    async function startHls(url, generation) {
        if (videoEl?.canPlayType("application/vnd.apple.mpegurl")) {
            videoEl.src = url;
            await videoEl.play();
            return;
        }

        const Hls = await ensureLibrary("Hls", HLS_SCRIPT, "hls");
        if (generation !== playbackGeneration || !videoEl) return;
        if (!Hls.isSupported()) throw new Error("This browser does not provide the Media Source support required for HLS playback.");

        hlsNetworkRetries = 0;
        hlsMediaRetries = 0;
        hlsPlayer = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxLiveSyncPlaybackRate: 1.25
        });
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            if (generation !== playbackGeneration || !videoEl) return;
            videoEl.play().catch((error) => {
                if (error?.name !== "AbortError") showPlaybackMessage("Press play to start this channel.", "ready");
            });
        });
        hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
            if (!data?.fatal || generation !== playbackGeneration) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && hlsNetworkRetries < 2) {
                hlsNetworkRetries++;
                hlsPlayer?.startLoad();
                return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hlsMediaRetries < 1) {
                hlsMediaRetries++;
                hlsPlayer?.recoverMediaError();
                return;
            }
            hlsPlayer?.destroy();
            hlsPlayer = null;
            if (selectedChannel()?.allowFormatFallback && !playbackFallbackTried) {
                tryXtreamPlaybackFallback("hls").catch(() => {});
                return;
            }
            showPlaybackMessage("Playback failed. Verify provider CORS, stream availability, and browser codec support.", "error");
            setStatus("The selected HLS stream could not be played.", "error");
        });
        hlsPlayer.loadSource(url);
        hlsPlayer.attachMedia(videoEl);
    }

    async function startMpegTs(url, generation) {
        const mpegts = await ensureLibrary("mpegts", MPEGTS_SCRIPT, "mpegts");
        if (generation !== playbackGeneration || !videoEl) return;
        if (!mpegts.getFeatureList?.().mseLivePlayback) {
            throw new Error("This browser does not provide the Media Source support required for MPEG-TS playback.");
        }
        mpegtsPlayer = mpegts.createPlayer({ type: "mse", isLive: true, url, cors: true }, {
            enableWorker: true,
            stashInitialSize: 512 * 1024,
            lazyLoad: false,
            autoCleanupSourceBuffer: true,
            liveBufferLatencyChasing: true,
            liveBufferLatencyMaxLatency: 5,
            liveBufferLatencyMinLatency: 1
        });
        mpegtsPlayer.on(mpegts.Events.ERROR, () => {
            if (generation !== playbackGeneration) return;
            if (selectedChannel()?.allowFormatFallback && !playbackFallbackTried) {
                tryXtreamPlaybackFallback("mpegts").catch(() => {});
                return;
            }
            showPlaybackMessage("The MPEG-TS stream failed. Verify provider CORS and browser codec support.", "error");
            setStatus("The selected MPEG-TS stream could not be played.", "error");
        });
        mpegtsPlayer.attachMediaElement(videoEl);
        mpegtsPlayer.load();
        await mpegtsPlayer.play();
    }

    async function tryXtreamPlaybackFallback(failedKind) {
        const channel = selectedChannel();
        if (!channel || appState.sourceType !== "xtream" || !channel.allowFormatFallback || playbackFallbackTried) return false;
        playbackFallbackTried = true;
        const alternateFormat = failedKind === "hls" ? "ts" : "m3u8";
        const alternateKind = alternateFormat === "ts" ? "mpegts" : "hls";
        stopPlayback();
        const generation = playbackGeneration;
        showPlaybackMessage(`Retrying ${channel.name} as ${alternateFormat === "ts" ? "MPEG-TS" : "HLS"}...`);
        setStatus(`The first stream format failed; retrying ${alternateFormat.toUpperCase()}...`, "working");

        try {
            const alternateChannel = { ...channel, streamFormat: alternateFormat, streamKind: alternateKind };
            const url = xtreamStreamUrl(alternateChannel);
            if (window.location.protocol === "https:" && new URL(url).protocol !== "https:") {
                throw new Error("This channel uses HTTP and cannot play from the HTTPS PortfoliOS frontend.");
            }
            if (alternateKind === "hls") await startHls(url, generation);
            else await startMpegTs(url, generation);
            if (generation !== playbackGeneration) return false;
            channel.streamFormat = alternateFormat;
            channel.streamKind = alternateKind;
            setStatus(`Playing ${channel.name} using ${alternateFormat.toUpperCase()}.`, "ready");
            return true;
        } catch (error) {
            if (generation !== playbackGeneration || error?.name === "AbortError") return false;
            showPlaybackMessage(error.message || "Neither Xtream stream format could be played.", "error");
            setStatus(error.message || "Neither Xtream stream format could be played.", "error");
            return false;
        }
    }

    async function playChannel(channel) {
        if (!channel || !videoEl) return;
        stopPlayback();
        playbackFallbackTried = false;
        const generation = playbackGeneration;
        appState.selectedChannelId = channel.id;
        appState.guideDay = 0;
        appState.mobileView = "player";
        renderShellState();
        showPlaybackMessage(`Opening ${channel.name}...`);
        setStatus(`Opening ${channel.name}...`, "working");

        try {
            const url = channel.streamUrl || xtreamStreamUrl(channel);
            if (!url || (appState.sourceType === "xtream" && !appState.secrets.password)) {
                throw new Error("This Xtream session has expired. Open Source and enter the account password again.");
            }
            if (window.location.protocol === "https:" && new URL(url).protocol !== "https:") {
                throw new Error("This channel uses HTTP and cannot play from the HTTPS PortfoliOS frontend.");
            }
            if (channel.streamKind === "hls") {
                await startHls(url, generation);
            } else if (channel.streamKind === "mpegts") {
                await startMpegTs(url, generation);
            } else {
                videoEl.src = url;
                await videoEl.play();
            }
            if (generation !== playbackGeneration) return;
            setStatus(`Playing ${channel.name}.`, "ready");
        } catch (error) {
            if (generation !== playbackGeneration || error?.name === "AbortError") return;
            showPlaybackMessage(error.message || "The stream could not be played.", "error");
            setStatus(error.message || "The stream could not be played.", "error");
        }
    }

    async function forgetSource() {
        abortPendingRequests();
        stopPlayback();
        clearSession();
        await Promise.all([
            deleteStored(PROFILE_PATH),
            deleteStored(EPG_PATH),
            deleteStored(MAINTENANCE_PATH)
        ]);
        appState.sourceType = "";
        appState.sourceLabel = "No source";
        appState.profile = null;
        appState.channels = [];
        appState.categories = [];
        appState.selectedChannelId = "";
        appState.epg = null;
        appState.setupOpen = true;
        appState.setupError = "";
        playlistFile = null;
        guideFile = null;
        setStatus("Source metadata, session credentials, and guide cache were removed.", "ready");
        renderShellState();
    }

    async function restoreSessionSource() {
        if (appState.channels.length) return true;
        const session = loadSession();
        if (!session?.sourceType) return false;
        appState.sourceMode = session.sourceType;
        if (session.sourceType === "xtream" && session.server && session.username && session.password) {
            await connectXtream(session, { skipGuide: true });
            return true;
        }
        if (session.sourceType === "m3u" && session.playlistUrl) {
            await connectRemoteM3U({
                playlistUrl: session.playlistUrl,
                epgUrl: session.epgUrl || "",
                label: session.sourceLabel || "Remote M3U"
            }, { skipGuide: true });
            return true;
        }
        return false;
    }

    async function handleSubmit(event) {
        const form = event.target.closest("[data-iptv-source-form]");
        if (!form) return;
        event.preventDefault();
        if (appState.busy) return;
        setSetupError("");

        try {
            if (appState.sourceMode === "xtream") {
                await connectXtream({
                    server: rootEl.querySelector("[data-iptv-xtream-server]")?.value,
                    username: rootEl.querySelector("[data-iptv-xtream-username]")?.value,
                    password: rootEl.querySelector("[data-iptv-xtream-password]")?.value,
                    streamFormat: rootEl.querySelector("[data-iptv-stream-format]")?.value
                });
            } else if (appState.sourceMode === "m3u") {
                await connectRemoteM3U({
                    playlistUrl: rootEl.querySelector("[data-iptv-m3u-url]")?.value,
                    epgUrl: rootEl.querySelector("[data-iptv-m3u-epg-url]")?.value,
                    label: rootEl.querySelector("[data-iptv-m3u-label]")?.value
                });
            } else {
                await connectUploadedM3U();
            }
        } catch (error) {
            setSetupError(error.message || "The source could not be connected.");
            setStatus(error.message || "The source could not be connected.", "error");
        } finally {
            setBusy(false);
        }
    }

    async function handleClick(event) {
        const modeButton = event.target.closest("[data-iptv-source-mode]");
        if (modeButton) {
            appState.sourceMode = modeButton.dataset.iptvSourceMode;
            setSetupError("");
            renderSetupState();
            return;
        }

        const channelButton = event.target.closest("[data-iptv-channel]");
        if (channelButton) {
            const channel = appState.channels.find((item) => item.id === channelButton.dataset.iptvChannel);
            await playChannel(channel);
            return;
        }

        const mobileButton = event.target.closest("[data-iptv-mobile-view]");
        if (mobileButton) {
            appState.mobileView = mobileButton.dataset.iptvMobileView;
            renderShellState();
            return;
        }

        const action = event.target.closest("[data-iptv-action]")?.dataset.iptvAction;
        if (!action) return;
        if (action === "open-source") {
            appState.setupOpen = true;
            applyProfileToForm();
            renderSetupState();
        } else if (action === "close-source") {
            appState.setupOpen = false;
            renderSetupState();
        } else if (action === "choose-playlist") {
            rootEl.querySelector("[data-iptv-playlist-file]")?.click();
        } else if (action === "choose-guide") {
            rootEl.querySelector("[data-iptv-guide-file]")?.click();
        } else if (action === "refresh-guide") {
            refreshGuide().catch((error) => setSetupError(error.message));
        } else if (action === "clear-guide") {
            await clearGuideCache();
        } else if (action === "forget-source") {
            await forgetSource();
        } else if (action === "guide-previous") {
            appState.guideDay = Math.max(-1, appState.guideDay - 1);
            renderGuide();
        } else if (action === "guide-next") {
            appState.guideDay = Math.min(2, appState.guideDay + 1);
            renderGuide();
        } else if (action === "guide-today") {
            appState.guideDay = 0;
            renderGuide();
        } else if (action === "open-sync-settings") {
            await window.openDesktopWindow?.("settings");
            window.openSettingsPanel?.("cloud-sync");
        }
    }

    function handleInput(event) {
        if (event.target.matches("[data-iptv-search]")) {
            appState.search = event.target.value;
            renderChannels();
            return;
        }
        if (event.target.matches("[data-iptv-xtream-server], [data-iptv-m3u-url], [data-iptv-m3u-epg-url]")) {
            updateProtocolAlert();
        }
    }

    function handleChange(event) {
        if (event.target.matches("[data-iptv-category]")) {
            appState.categoryId = event.target.value || "all";
            renderChannels();
            return;
        }
        if (event.target.matches("[data-iptv-playlist-file]")) {
            playlistFile = event.target.files?.[0] || null;
            const label = rootEl.querySelector("[data-iptv-playlist-file-label]");
            if (label) label.textContent = playlistFile?.name || "No playlist selected";
            return;
        }
        if (event.target.matches("[data-iptv-guide-file]")) {
            guideFile = event.target.files?.[0] || null;
            const label = rootEl.querySelector("[data-iptv-guide-file-label]");
            if (label) label.textContent = guideFile?.name || "No guide selected";
        }
    }

    function handleVideoReady() {
        showPlaybackMessage("");
    }

    function handleVideoError() {
        if (hlsPlayer || mpegtsPlayer || !videoEl?.getAttribute("src")) return;
        if (selectedChannel()?.allowFormatFallback && !playbackFallbackTried) {
            tryXtreamPlaybackFallback("hls").catch(() => {});
            return;
        }
        showPlaybackMessage("This direct stream format or codec is not supported by the browser.", "error");
        setStatus("The browser could not decode the selected direct stream.", "error");
    }

    function setVolume(volume) {
        if (!videoEl) return;
        videoEl.volume = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
    }

    function renderBody() {
        return `
            <div class="iptv-shell" data-iptv-root data-mobile-view="channels">
                <header class="iptv-toolbar">
                    <button type="button" class="iptv-icon-button" data-iptv-action="open-source" title="Source settings" aria-label="Source settings">
                        <i class="fa-solid fa-plug"></i>
                    </button>
                    <div class="iptv-source-summary">
                        <strong>IPTV Stream</strong>
                        <span data-iptv-source-label>No source</span>
                    </div>
                    <label class="iptv-search-control">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="search" data-iptv-search placeholder="Search channels" autocomplete="off" disabled>
                    </label>
                    <select class="iptv-category-select" data-iptv-category aria-label="Channel category" disabled>
                        <option value="all">All categories</option>
                    </select>
                    <button type="button" class="iptv-icon-button" data-iptv-action="refresh-guide" title="Refresh guide" aria-label="Refresh guide">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                    <button type="button" class="iptv-icon-button" data-iptv-action="clear-guide" title="Clear guide cache" aria-label="Clear guide cache">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </header>

                <nav class="iptv-mobile-tabs" aria-label="IPTV views">
                    <button type="button" data-iptv-mobile-view="channels" class="is-active"><i class="fa-solid fa-list"></i><span>Channels</span></button>
                    <button type="button" data-iptv-mobile-view="player"><i class="fa-solid fa-play"></i><span>Player</span></button>
                    <button type="button" data-iptv-mobile-view="guide"><i class="fa-regular fa-calendar"></i><span>Guide</span></button>
                </nav>

                <main class="iptv-workspace">
                    <aside class="iptv-channel-pane" data-iptv-pane="channels">
                        <div class="iptv-pane-heading">
                            <strong>Live channels</strong>
                            <span data-iptv-channel-count>0 channels</span>
                        </div>
                        <div class="iptv-channel-list" data-iptv-channel-list></div>
                    </aside>

                    <section class="iptv-player-pane" data-iptv-pane="player">
                        <div class="iptv-video-stage">
                            <video data-iptv-video controls playsinline preload="metadata"></video>
                            <div class="iptv-player-message" data-iptv-player-message hidden></div>
                            <div class="iptv-video-idle">
                                <i class="fa-solid fa-satellite-dish"></i>
                            </div>
                        </div>
                        <div class="iptv-now-playing">
                            <span class="iptv-now-logo" data-iptv-now-logo><i class="fa-solid fa-tv"></i></span>
                            <div>
                                <strong data-iptv-now-title>Select a channel</strong>
                                <span data-iptv-now-detail>Your stream will open here.</span>
                            </div>
                        </div>
                    </section>

                    <aside class="iptv-guide-pane" data-iptv-pane="guide">
                        <div class="iptv-guide-heading">
                            <button type="button" data-iptv-action="guide-previous" title="Previous day" aria-label="Previous day"><i class="fa-solid fa-chevron-left"></i></button>
                            <button type="button" class="iptv-guide-date" data-iptv-action="guide-today" data-iptv-guide-date title="Today"></button>
                            <button type="button" data-iptv-action="guide-next" title="Next day" aria-label="Next day"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                        <div class="iptv-guide-list" data-iptv-guide-list></div>
                    </aside>
                </main>

                <footer class="iptv-statusbar">
                    <div data-iptv-status data-kind="idle"><i class="fa-solid fa-circle-info"></i><span>Choose an authorized IPTV source to begin.</span></div>
                    <button type="button" data-iptv-action="open-sync-settings" title="Open sync settings">
                        <i class="fa-solid fa-database"></i>
                        <span data-iptv-epg-status>Guide not cached</span>
                    </button>
                </footer>

                <section class="iptv-setup" data-iptv-setup aria-labelledby="iptv-setup-title">
                    <form class="iptv-setup-form" data-iptv-source-form>
                        <div class="iptv-setup-header">
                            <div>
                                <h2 id="iptv-setup-title">Connect a TV source</h2>
                                <p>Use a service or playlist you are authorized to access.</p>
                            </div>
                            <button type="button" class="iptv-icon-button" data-iptv-action="close-source" data-iptv-cancel-setup hidden title="Close" aria-label="Close source settings">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div class="iptv-source-switch" role="tablist" aria-label="Source type">
                            <button type="button" role="tab" class="is-active" data-iptv-source-mode="xtream"><i class="fa-solid fa-user-lock"></i><span>Xtream</span></button>
                            <button type="button" role="tab" data-iptv-source-mode="m3u"><i class="fa-solid fa-link"></i><span>M3U URL</span></button>
                            <button type="button" role="tab" data-iptv-source-mode="upload"><i class="fa-solid fa-file-arrow-up"></i><span>Upload</span></button>
                        </div>

                        <div class="iptv-protocol-alert" data-iptv-protocol-alert role="alert" ${window.location.protocol === "https:" ? "" : "hidden"}>
                            <i class="fa-solid fa-lock"></i>
                            <span>
                                <strong>HTTPS sources required</strong>
                                <small data-iptv-protocol-alert-detail>Provider, playlist, guide, and stream addresses must use HTTPS. Browsers block HTTP media inside this hosted app.</small>
                            </span>
                        </div>

                        <div class="iptv-source-panel" data-iptv-source-panel="xtream">
                            <label><span>Server address</span><input type="url" data-iptv-xtream-server placeholder="https://provider.example" autocomplete="url"></label>
                            <div class="iptv-field-row">
                                <label><span>Username</span><input type="text" data-iptv-xtream-username autocomplete="username"></label>
                                <label><span>Password</span><input type="password" data-iptv-xtream-password autocomplete="current-password"></label>
                            </div>
                            <label><span>Stream format</span>
                                <select data-iptv-stream-format>
                                    <option value="auto">Automatic</option>
                                    <option value="m3u8">HLS (.m3u8)</option>
                                    <option value="ts">MPEG-TS (.ts)</option>
                                </select>
                            </label>
                        </div>

                        <div class="iptv-source-panel" data-iptv-source-panel="m3u" hidden>
                            <label><span>Playlist URL</span><input type="url" data-iptv-m3u-url placeholder="https://provider.example/playlist.m3u8" autocomplete="url"></label>
                            <label><span>XMLTV guide URL <small>optional</small></span><input type="url" data-iptv-m3u-epg-url placeholder="https://provider.example/guide.xml" autocomplete="url"></label>
                            <label><span>Source name <small>optional</small></span><input type="text" data-iptv-m3u-label placeholder="Living room TV" maxlength="80"></label>
                        </div>

                        <div class="iptv-source-panel" data-iptv-source-panel="upload" hidden>
                            <div class="iptv-file-picker">
                                <button type="button" data-iptv-action="choose-playlist"><i class="fa-solid fa-file-video"></i><span>Choose M3U playlist</span></button>
                                <span data-iptv-playlist-file-label>No playlist selected</span>
                            </div>
                            <div class="iptv-file-picker">
                                <button type="button" data-iptv-action="choose-guide"><i class="fa-regular fa-calendar-plus"></i><span>Choose XMLTV guide</span></button>
                                <span data-iptv-guide-file-label>No guide selected</span>
                            </div>
                        </div>

                        <div class="iptv-privacy-note">
                            <i class="fa-solid fa-shield-halved"></i>
                            <span>Passwords and credential-bearing URLs stay in this browser tab. Only non-secret source metadata and normalized EPG listings are written to <code>${STORAGE_ROOT}</code>. Cross-device sync remains controlled in Settings.</span>
                        </div>
                        <div class="iptv-setup-error" data-iptv-setup-error hidden></div>
                        <div class="iptv-setup-actions">
                            <button type="button" class="iptv-danger-button" data-iptv-action="forget-source" data-iptv-forget-source hidden><i class="fa-regular fa-trash-can"></i><span>Forget source</span></button>
                            <button type="submit" class="iptv-connect-button" data-iptv-connect-submit><i class="fa-solid fa-plug-circle-bolt"></i><span>Connect</span></button>
                        </div>
                    </form>
                </section>

                <input type="file" data-iptv-playlist-file accept=".m3u,.m3u8,application/x-mpegURL,audio/x-mpegurl" hidden>
                <input type="file" data-iptv-guide-file accept=".xml,.xmltv,.gz,application/xml,text/xml,application/gzip" hidden>
            </div>`;
    }

    window.IPTVStreamTools = Object.freeze({
        parseM3U,
        parseXmltvDate,
        pruneEpgCache,
        detectStreamKind
    });

    window.appRegistry[APP_ID] = {
        title: "IPTV Stream",
        icon: "fa-solid fa-tv",
        windowClass: "iptv-window media-window",
        renderBody,
        onOpen: async (windowEl) => {
            const generation = ++mountGeneration;
            rootEl = windowEl.querySelector("[data-iptv-root]");
            videoEl = windowEl.querySelector("[data-iptv-video]");
            unregisterAudio = window.registerAppAudioAdapter?.(APP_ID, { setVolume }) || null;

            rootEl?.addEventListener("click", handleClick);
            rootEl?.addEventListener("submit", handleSubmit);
            rootEl?.addEventListener("input", handleInput);
            rootEl?.addEventListener("change", handleChange);
            videoEl?.addEventListener("loadeddata", handleVideoReady);
            videoEl?.addEventListener("playing", handleVideoReady);
            videoEl?.addEventListener("error", handleVideoError);
            setVolume(window.state?.volume ?? 70);

            try {
                await loadStoredState();
                if (generation !== mountGeneration || !rootEl) return;
                applyProfileToForm();
                renderShellState();
                const restored = await restoreSessionSource();
                if (generation !== mountGeneration || !rootEl) return;
                if (!restored) {
                    appState.setupOpen = !appState.channels.length;
                    renderShellState();
                }
            } catch (error) {
                if (generation !== mountGeneration || !rootEl) return;
                setStatus(error.message || "IPTV Stream could not initialize.", "error");
                setSetupError(error.message || "IPTV Stream could not initialize.");
                renderShellState();
            } finally {
                if (generation === mountGeneration) setBusy(false);
            }

            rootEl?.querySelector("[data-iptv-search], [data-iptv-xtream-server], button")?.focus({ preventScroll: true });
        },
        onRestore: () => {
            rootEl?.querySelector("[data-iptv-search], button")?.focus({ preventScroll: true });
        },
        onFocus: () => {},
        onMinimize: () => {
            videoEl?.pause();
        },
        onMaximize: () => {},
        onClose: () => {
            mountGeneration++;
            abortPendingRequests();
            stopPlayback();
            busyOperations = 0;
            appState.busy = false;
            rootEl?.removeEventListener("click", handleClick);
            rootEl?.removeEventListener("submit", handleSubmit);
            rootEl?.removeEventListener("input", handleInput);
            rootEl?.removeEventListener("change", handleChange);
            videoEl?.removeEventListener("loadeddata", handleVideoReady);
            videoEl?.removeEventListener("playing", handleVideoReady);
            videoEl?.removeEventListener("error", handleVideoError);
            unregisterAudio?.();
            unregisterAudio = null;
            rootEl = null;
            videoEl = null;
        },
        setVolume
    };
})();
