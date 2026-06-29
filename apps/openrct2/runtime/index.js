/*****************************************************************************
 * Copyright (c) 2014-2026 OpenRCT2 developers
 *
 * For a complete list of all authors, please refer to contributors.md
 * Interested in contributing? Visit https://github.com/OpenRCT2/OpenRCT2
 *
 * OpenRCT2 is licensed under the GNU General Public License version 3.
 *****************************************************************************/
const SERVER_RCT_ZIP = "RCT.zip";

(async () =>
{
    await new Promise((res) => window.addEventListener("DOMContentLoaded", res));
    if (!window.SharedArrayBuffer)
    {
        document.getElementById("loadingWebassembly").innerText = "Error! SharedArrayBuffer is not defined. This page requires the COOP, COEP, and CORP response headers.";
        return;
    }
    if (!window.WebAssembly)
    {
        document.getElementById("loadingWebassembly").innerText = "Error! This page requires WebAssembly. Please upgrade your browser or enable WebAssembly support.";
        return;
    }

    let assets;
    try
    {
        const req = await fetch("openrct2.zip");
        if (!req.ok)
        {
            throw new Error("Response is not ok.");
        }
        const data = await req.blob();
        const zip = new JSZip();
        await zip.loadAsync(data);
        assets = {
            js: URL.createObjectURL(new Blob([await zip.file("openrct2.js").async("uint8array")], { type: "text/javascript" })),
            wasm: URL.createObjectURL(new Blob([await zip.file("openrct2.wasm").async("uint8array")], { type: "application/wasm" }))
        };
    }
    catch (e)
    {
        assets = null;
        console.warn("Failed to fetch openrct2.zip. Will pull non-compressed files.", e);
    }

    await new Promise((resolve) =>
    {
        const script = document.createElement("script");
        script.src = assets === null ? "openrct2.js" : assets.js;
        script.addEventListener("load", resolve);
        script.addEventListener("error", (e) =>
        {
            document.getElementById("loadingWebassembly").innerText = "Error loading openrct2.js. Upload openrct2.zip or loose openrct2.js/openrct2.wasm to this runtime folder.";
            console.error(e);
        });
        document.body.appendChild(script);
    });

    window.Module = await window.OPENRCT2_WEB({
        noInitialRun: true,
        arguments: [],
        preRun: [],
        postRun: [],
        canvas: document.getElementById("canvas"),
        print: function(msg)
        {
            console.log(msg);
        },
        printErr: function(msg)
        {
            console.log(msg);
        },
        totalDependencies: 0,
        monitorRunDependencies: () => {},
        locateFile: function(fileName)
        {
            if (assets !== null && fileName === "openrct2.wasm")
            {
                return assets.wasm;
            }
            console.log("loading", fileName);
            return fileName;
        }
    });

    Module.FS.mkdir("/persistent");
    Module.FS.mount(Module.FS.filesystems.IDBFS, { autoPersist: true }, "/persistent");

    Module.FS.mkdir("/RCT");
    Module.FS.mount(Module.FS.filesystems.IDBFS, { autoPersist: true }, "/RCT");

    Module.FS.mkdir("/OpenRCT2");
    Module.FS.mount(Module.FS.filesystems.IDBFS, { autoPersist: true }, "/OpenRCT2");

    await new Promise((res) => Module.FS.syncfs(true, res));

    const assetsOK = await updateAssets();
    if (!assetsOK)
    {
        return;
    }

    let changelog = "";
    try
    {
        const request = await fetch("https://api.github.com/repos/OpenRCT2/OpenRCT2/releases/latest");
        const json = JSON.parse(await request.text());
        changelog = json.body;
    }
    catch (e)
    {
        console.log("Failed to fetch changelog with error:", e);
    }

    Module.FS.writeFile("/OpenRCT2/changelog.txt", changelog);

    let filesFound = fileExists("/RCT/Data/ch.dat");
    if (!filesFound)
    {
        const serverAssetsLoaded = await loadServerGameAssets();
        filesFound = serverAssetsLoaded || fileExists("/RCT/Data/ch.dat");
    }

    const loadingMessage = document.getElementById("loadingWebassembly");
    if (loadingMessage)
    {
        loadingMessage.remove();
    }

    if (!filesFound)
    {
        document.getElementById("beforeLoad").style.display = "";
        await new Promise((res) =>
        {
            document.getElementById("selectFile").addEventListener("change", async (e) =>
            {
                if (await extractZip(e.target.files[0], resolveRctZipMount))
                {
                    document.getElementById("beforeLoad").remove();
                    res();
                }
            });
        });
    }
    Module.canvas.style.display = "";
    Module.callMain(["--user-data-path=/persistent/", "--openrct2-data-path=/OpenRCT2/"]);
})();

async function updateAssets()
{
    let currentVersion = "";
    try
    {
        currentVersion = Module.FS.readFile("/OpenRCT2/version", { encoding: "utf8" });
        console.log("Found asset version", currentVersion);
    }
    catch (e)
    {
        console.log("No asset version found");
    }
    let assetsVersion = "DEBUG";
    try
    {
        assetsVersion = Module.ccall("GetVersion", "string");
    }
    catch (e)
    {
        console.warn("Could not call 'GetVersion'. Is it added to EXPORTED_FUNCTIONS? Is ccall added to EXPORTED_RUNTIME_METHODS?");
    }

    if (currentVersion !== assetsVersion || assetsVersion.includes("DEBUG"))
    {
        console.log("Updating assets to", assetsVersion);
        document.getElementById("loadingWebassembly").innerText = "Asset update found. Downloading...";
        await clearDatabase("/OpenRCT2/");

        const response = await fetch("assets.zip");
        if (!response.ok)
        {
            if (response.status === 404)
            {
                document.getElementById("loadingWebassembly").innerText = "Error! assets.zip was not found in this runtime folder.";
            }
            else
            {
                document.getElementById("loadingWebassembly").innerText = `Error! Failed to download assets.zip (status: ${response.status}).`;
            }
            return false;
        }
        document.getElementById("loadingWebassembly").innerText = "Downloaded assets.zip";

        await extractZip(await response.blob(), () => "/OpenRCT2/");
        Module.FS.writeFile("/OpenRCT2/version", assetsVersion.toString());
    }
    return true;
}

async function loadServerGameAssets()
{
    const loadingMessage = document.getElementById("loadingWebassembly");
    try
    {
        loadingMessage.innerText = "Checking server-hosted RCT game data...";
        const response = await fetch(SERVER_RCT_ZIP, { cache: "no-store" });
        if (response.status === 404 || response.status === 403)
        {
            loadingMessage.innerText = "Server RCT.zip is not available. Waiting for local game data zip.";
            return false;
        }
        if (!response.ok)
        {
            loadingMessage.innerText = `Server RCT.zip is unavailable (status: ${response.status}).`;
            return false;
        }

        loadingMessage.innerText = "Installing server-hosted RCT game data...";
        return await extractZip(await response.blob(), resolveRctZipMount);
    }
    catch (e)
    {
        console.warn("Failed to load server-hosted RCT game data.", e);
        loadingMessage.innerText = "Server RCT.zip is unavailable. Waiting for local game data zip.";
        return false;
    }
}

async function extractZip(data, checkZip)
{
    const zip = new JSZip();
    let contents;
    try
    {
        contents = await zip.loadAsync(data);
    }
    catch (e)
    {
        if (typeof checkZip === "function")
        {
            checkZip(null);
        }
        throw e;
    }

    let mount = { targetBase: "/", stripPrefix: "" };
    if (typeof checkZip === "function")
    {
        const cont = checkZip(contents);
        if (cont === false)
        {
            return false;
        }
        mount = normalizeMountResult(cont);
    }

    for (const k in contents.files)
    {
        const entry = contents.files[k];
        const relativePath = getRelativeZipPath(k, mount.stripPrefix);
        if (relativePath === null || relativePath === "")
        {
            continue;
        }

        const outputPath = joinMountPath(mount.targetBase, relativePath);
        if (entry.dir)
        {
            ensureDirectory(outputPath);
        }
        else
        {
            ensureDirectory(getParentDirectory(outputPath));
            Module.FS.writeFile(outputPath, await entry.async("uint8array"));
        }
    }
    return true;
}

function resolveRctZipMount(zip)
{
    if (zip === null)
    {
        document.getElementById("statusMsg").innerText = "That file is not a readable zip. Please select a zip containing Data/ch.dat.";
        return false;
    }
    if (zip.file("Data/ch.dat"))
    {
        return "/RCT/";
    }
    if (zip.file("RCT/Data/ch.dat"))
    {
        return "/";
    }

    const flexibleChDat = Object.keys(zip.files).find((name) =>
    {
        const normalized = normalizeZipPath(name).toLowerCase();
        return normalized.endsWith("/data/ch.dat") && !zip.files[name].dir;
    });

    if (flexibleChDat)
    {
        const normalized = normalizeZipPath(flexibleChDat);
        const sourcePrefix = normalized.slice(0, normalized.length - "Data/ch.dat".length);
        return { targetBase: "/RCT/", stripPrefix: sourcePrefix };
    }

    document.getElementById("statusMsg").innerText = "That does not look right. Your file should be a zip containing Data/ch.dat. Please select your OpenRCT2 contents zip file.";
    return false;
}

function normalizeMountResult(result)
{
    if (typeof result === "string")
    {
        return { targetBase: result, stripPrefix: "" };
    }
    if (result && typeof result === "object")
    {
        return {
            targetBase: result.targetBase || result.base || "/",
            stripPrefix: normalizeZipPath(result.stripPrefix || "")
        };
    }
    return { targetBase: "/", stripPrefix: "" };
}

function normalizeZipPath(filePath)
{
    return String(filePath || "").replace(/\\/g, "/").replace(/^\.?\//, "");
}

function getRelativeZipPath(filePath, stripPrefix)
{
    const normalized = normalizeZipPath(filePath);
    const prefix = normalizeZipPath(stripPrefix);
    if (!prefix)
    {
        return normalized;
    }

    const lowerPath = normalized.toLowerCase();
    const lowerPrefix = prefix.toLowerCase();
    if (!lowerPath.startsWith(lowerPrefix))
    {
        return null;
    }
    return normalized.slice(prefix.length);
}

function joinMountPath(base, relativePath)
{
    const safeBase = String(base || "/").replace(/\/?$/, "/");
    return `${safeBase}${normalizeZipPath(relativePath)}`.replace(/\/+/g, "/");
}

function getParentDirectory(filePath)
{
    const index = filePath.lastIndexOf("/");
    return index <= 0 ? "/" : filePath.slice(0, index);
}

function ensureDirectory(dir)
{
    const normalized = String(dir || "/").replace(/\/+/g, "/");
    if (!normalized || normalized === "/")
    {
        return;
    }

    let current = "";
    for (const part of normalized.split("/").filter(Boolean))
    {
        current += `/${part}`;
        try
        {
            Module.FS.mkdir(current);
        }
        catch (e) {}
    }
}

async function clearDatabase(dir)
{
    await new Promise((res) => Module.FS.syncfs(false, res));
    const processFolder = (path) =>
    {
        let contents;
        try
        {
            contents = Module.FS.readdir(path);
        }
        catch (e)
        {
            return;
        }
        contents.forEach((entry) =>
        {
            if ([".", ".."].includes(entry)) return;
            try
            {
                Module.FS.readFile(path + entry);
                Module.FS.unlink(path + entry);
            }
            catch (e)
            {
                processFolder(path + entry + "/");
            }
        });
        if (path === dir) return;
        try
        {
            Module.FS.rmdir(path, { recursive: true });
        }
        catch (e)
        {
            console.log("Could not remove:", path);
        }
    };
    processFolder(dir);
    await new Promise((res) => Module.FS.syncfs(false, res));
}

function fileExists(path)
{
    try
    {
        Module.FS.readFile(path);
        return true;
    }
    catch (e) {}
    return false;
}
