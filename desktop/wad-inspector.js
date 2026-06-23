/**
 * PortfoliOS: WAD File Inspector Component
 * Inspects and validates Doom engine WAD files (both uploaded locally and stored on the server).
 */

window.serverWadCandidates = ["./DOOM.WAD", "/DOOM.WAD"];
window.wadHeaderBytes = 12;

window.identifyWadName = (name) => {
    const normalized = name.toUpperCase();
    if (normalized === "DOOM.WAD") return "The Ultimate Doom / Doom";
    if (normalized === "DOOM2.WAD") return "Doom II: Hell on Earth";
    if (normalized === "TNT.WAD") return "Final Doom: TNT Evilution";
    if (normalized === "PLUTONIA.WAD") return "Final Doom: The Plutonia Experiment";
    if (normalized === "DOOM1.WAD") return "Doom shareware";
    return "Custom or unknown WAD";
};

window.parseWadHeader = (buffer) => {
    const header = new Uint8Array(buffer.slice(0, window.wadHeaderBytes));
    if (header.length < window.wadHeaderBytes) {
        throw new Error("WAD header is too short.");
    }

    const signature = String.fromCharCode(header[0], header[1], header[2], header[3]);
    const view = new DataView(header.buffer);
    const lumpCount = view.getInt32(4, true);
    const directoryOffset = view.getInt32(8, true);

    return {
        signature,
        lumpCount,
        directoryOffset,
        isWad: signature === "IWAD" || signature === "PWAD"
    };
};

window.parseContentRangeTotal = (value) => {
    if (!value) return null;
    const match = value.match(/\/(\d+)$/);
    return match ? Number(match[1]) : null;
};

window.buildWadStatus = ({ name, source, path, sizeBytes, headerBuffer, readyText }) => {
    const parsed = window.parseWadHeader(headerBuffer);
    const sizeFormatted = window.formatBytes ? window.formatBytes(sizeBytes) : `${sizeBytes} bytes`;

    return [
        `source: ${source}`,
        `file: ${name}`,
        path ? `path: ${path}` : null,
        `type: ${parsed.signature}${parsed.isWad ? "" : " (unexpected)"}`,
        `game: ${window.identifyWadName(name)}`,
        `size: ${sizeFormatted}`,
        `lumps: ${parsed.lumpCount}`,
        `directory: ${parsed.directoryOffset}`,
        "",
        parsed.isWad
            ? readyText
            : "This does not look like a standard IWAD/PWAD header."
    ].filter(Boolean).join("\n");
};

window.inspectWadFile = async (file) => {
    const status = window.byId ? window.byId("wad-status") : document.getElementById("wad-status");
    if (!file || !status) return;

    if (!/\.wad$/i.test(file.name)) {
        status.textContent = "Unsupported file type. Select a .WAD file.";
        return;
    }

    const headerBuffer = await file.slice(0, window.wadHeaderBytes).arrayBuffer();

    status.textContent = window.buildWadStatus({
        name: file.name,
        source: "local browser file",
        path: file.name,
        sizeBytes: file.size,
        headerBuffer,
        readyText: "Ready for a future WASM Doom engine route."
    });
};

window.fetchServerWadCandidate = async (path) => {
    const response = await fetch(path, {
        cache: "no-store",
        headers: { Range: `bytes=0-${window.wadHeaderBytes - 1}` }
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }

    const headerBuffer = await response.arrayBuffer();
    const contentRangeSize = window.parseContentRangeTotal(response.headers.get("content-range"));
    const contentLength = Number(response.headers.get("content-length"));
    const sizeBytes = contentRangeSize || (response.status === 200 && Number.isFinite(contentLength) ? contentLength : null);

    return {
        name: "DOOM.WAD",
        path,
        sizeBytes,
        headerBuffer
    };
};

window.inspectServerWad = async () => {
    const status = window.byId ? window.byId("server-wad-status") : document.getElementById("server-wad-status");
    const checkButton = window.byId ? window.byId("server-wad-check") : document.getElementById("server-wad-check");
    if (!status) return;

    status.textContent = "checking same-origin DOOM.WAD...";
    if (checkButton) checkButton.disabled = true;

    const errors = [];
    const candidates = window.serverWadCandidates || [];
    for (const candidate of candidates) {
        try {
            const result = await window.fetchServerWadCandidate(candidate);
            status.textContent = window.buildWadStatus({
                ...result,
                source: "server web root",
                readyText: "Server WAD is reachable. A client-side Doom engine can request this path for each visitor."
            });
            if (checkButton) checkButton.disabled = false;
            return;
        } catch (error) {
            errors.push(`${candidate}: ${error.message}`);
        }
    }

    status.textContent = [
        "DOOM.WAD was not reachable from this page yet.",
        "Place DOOM.WAD in the web root beside index.html, or expose it at /DOOM.WAD.",
        "",
        ...errors
    ].join("\n");
    if (checkButton) checkButton.disabled = false;
};
