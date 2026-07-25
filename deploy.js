const ftp = require("basic-ftp");
const path = require("path");
const fs = require("fs");

// ── Load .env ──────────────────────────────────────────────────────────
function loadEnv(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
        process.env[key] = value;
    }
}

const envPath = path.resolve(__dirname, ".env");
if (!fs.existsSync(envPath)) {
    console.error("ERROR: .env file not found at", envPath);
    process.exit(1);
}
loadEnv(envPath);

// ── Config ─────────────────────────────────────────────────────────────
const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASS = process.env.FTP_PASS;
const FTP_PORT = parseInt(process.env.FTP_PORT || "21", 10);
const FTP_SECURE = (process.env.FTP_SECURE || "false").toLowerCase() === "true";
const REMOTE_DIR = process.env.FTP_REMOTE_DIR || "/domains/os.bl4ut0.dev/public_html";

if (!FTP_HOST || !FTP_USER || !FTP_PASS) {
    console.error("ERROR: Missing FTP credentials in .env file.");
    console.error("Required keys: FTP_HOST, FTP_USER, FTP_PASS");
    console.error("Optional keys: FTP_PORT (default 21), FTP_SECURE (default false), FTP_REMOTE_DIR");
    process.exit(1);
}

// ── Files to deploy ────────────────────────────────────────────────────
// Only deploy site assets — skip dev/config files
const DEPLOY_FILES = [
    "index.html",
    "manifest.webmanifest",
    "sw.js",
    "styles-v1.css",
    "main.js",
    "flappy.js",
    "identity-portrait.jpg",
    "doom-icon.png",
    "duke3d-icon.png",
    "diablo-icon.png",
    "quake-icon.png",
    "doom.js",
    "doom.wasm",
    "DOOM.WAD",
    "volume-hook.js",
    "apps",
    "core",
    "data",
    "desktop",
    "mobile",
    "quick",
    "styles",
    "diablo",
    "quake",
    "duke32"
];

const SKIP_LARGE_DEFAULT = ["DOOM.WAD", "doom.wasm", "doom.js", "volume-hook.js", "diablo", "quake", "duke32"];

// ── CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fullDeploy = args.includes("--full");
const onlyArg = args.find(a => a.startsWith("--only="));
const onlyFiles = onlyArg ? onlyArg.split("=")[1].split(",") : null;

// ── Helpers ────────────────────────────────────────────────────────────
function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} bytes`;
}

function getFilesToDeploy() {
    const projectDir = __dirname;

    if (onlyFiles) {
        return sortEntryPointLast(onlyFiles.filter(f => {
            const fullPath = path.join(projectDir, f);
            if (!fs.existsSync(fullPath)) {
                console.warn(`  WARN: --only file "${f}" not found, skipping.`);
                return false;
            }
            return true;
        }));
    }

    return sortEntryPointLast(DEPLOY_FILES.filter(f => {
        const fullPath = path.join(projectDir, f);
        if (!fs.existsSync(fullPath)) {
            console.warn(`  WARN: "${f}" not found locally, skipping.`);
            return false;
        }
        if (!fullDeploy && SKIP_LARGE_DEFAULT.includes(f)) {
            return false;
        }
        return true;
    }));
}

// Publish referenced assets before the HTML entry point. This prevents clients
// from receiving an index that points at files which have not uploaded yet.
function sortEntryPointLast(files) {
    return [...files].sort((a, b) => {
        if (a === "index.html") return 1;
        if (b === "index.html") return -1;
        return 0;
    });
}

function toRemotePath(fileName) {
    return fileName.replace(/\\/g, "/");
}

async function uploadFile(client, localPath, fileName) {
    const remotePath = toRemotePath(fileName);
    const remoteDir = path.posix.dirname(remotePath);
    const remoteName = path.posix.basename(remotePath);

    if (remoteDir && remoteDir !== ".") {
        await client.ensureDir(remoteDir);
        await client.uploadFrom(localPath, remoteName);
        await client.cd(REMOTE_DIR);
        return;
    }

    await client.uploadFrom(localPath, remoteName);
}

async function uploadDirFiltered(client, localDirPath, remoteDirPath, excludePattern) {
    const entries = fs.readdirSync(localDirPath, { withFileTypes: true });
    const absoluteRemoteDir = path.posix.join(REMOTE_DIR, toRemotePath(remoteDirPath));
    await client.ensureDir(absoluteRemoteDir);
    for (const entry of entries) {
        const localPath = path.join(localDirPath, entry.name);
        const remotePath = path.posix.join(remoteDirPath, entry.name);
        if (excludePattern && excludePattern.test(localPath)) {
            continue;
        }
        if (entry.isDirectory()) {
            await uploadDirFiltered(client, localPath, remotePath, excludePattern);
        } else {
            await client.ensureDir(absoluteRemoteDir);
            await client.uploadFrom(localPath, entry.name);
        }
    }
    await client.cd(REMOTE_DIR);
}

// ── Deploy ─────────────────────────────────────────────────────────────
async function deploy() {
    const filesToDeploy = getFilesToDeploy();

    console.log("");
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║          PortfoliOS FTP Deployment               ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log("");
    console.log(`  Host:       ${FTP_HOST}:${FTP_PORT}`);
    console.log(`  User:       ${FTP_USER}`);
    console.log(`  Secure:     ${FTP_SECURE ? "FTPS" : "FTP"}`);
    console.log(`  Remote dir: ${REMOTE_DIR}`);
    console.log(`  Mode:       ${dryRun ? "DRY RUN" : fullDeploy ? "FULL DEPLOY" : "QUICK DEPLOY (code only)"}`);
    console.log("");

    if (!fullDeploy && !onlyFiles) {
        console.log("  ℹ  Skipping large assets (DOOM.WAD, doom.wasm, doom.js).");
        console.log("     Use --full to upload everything, or --only=file1,file2");
        console.log("");
    }

    const totalSize = filesToDeploy.reduce((sum, f) => {
        return sum + fs.statSync(path.join(__dirname, f)).size;
    }, 0);

    console.log(`  Files to upload (${filesToDeploy.length}, ${formatBytes(totalSize)}):`);
    for (const f of filesToDeploy) {
        const size = fs.statSync(path.join(__dirname, f)).size;
        console.log(`    • ${f.padEnd(20)} ${formatBytes(size)}`);
    }
    console.log("");

    if (dryRun) {
        console.log("  ✓ Dry run complete. No files were uploaded.");
        return;
    }

    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
        console.log("  Connecting...");
        await client.access({
            host: FTP_HOST,
            port: FTP_PORT,
            user: FTP_USER,
            password: FTP_PASS,
            secure: FTP_SECURE,
            secureOptions: FTP_SECURE ? { rejectUnauthorized: false } : undefined
        });
        console.log("  ✓ Connected.");

        console.log(`  Navigating to ${REMOTE_DIR}...`);
        await client.ensureDir(REMOTE_DIR);
        console.log(`  ✓ Remote directory ready.`);
        
        // Clean up legacy files on remote
        if (!dryRun) {
            try {
                await client.remove("app.js");
                console.log("  ✓ Cleaned up legacy app.js from remote server.");
            } catch (err) {}
            try {
                await client.remove("styles.css");
                console.log("  ✓ Cleaned up legacy styles.css from remote server.");
            } catch (err) {}
        }
        
        console.log("");

        let uploaded = 0;
        for (const fileName of filesToDeploy) {
            const localPath = path.join(__dirname, fileName);
            const stat = fs.statSync(localPath);
            const start = Date.now();

            process.stdout.write(`  Uploading ${fileName.padEnd(20)}... `);

            if (stat.isDirectory()) {
                if (!fullDeploy) {
                    await uploadDirFiltered(client, localPath, fileName, /gamedata/i);
                } else {
                    await client.uploadFromDir(localPath, fileName);
                }
            } else {
                await uploadFile(client, localPath, fileName);
            }

            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            console.log(`done (${elapsed}s)`);
            uploaded++;
        }

        console.log("");
        console.log(`  ═══════════════════════════════════════════`);
        console.log(`  ✓ Deployment complete: ${uploaded}/${filesToDeploy.length} files uploaded.`);
        console.log(`  → https://os.bl4ut0.dev`);
        console.log(`  ═══════════════════════════════════════════`);
        console.log("");

    } catch (err) {
        console.error("");
        console.error(`  ✗ Deployment failed: ${err.message}`);
        if (err.code === "ENOTFOUND") {
            console.error(`    Could not resolve hostname "${FTP_HOST}".`);
        } else if (err.code === 530 || (err.message && err.message.includes("530"))) {
            console.error("    Authentication failed. Check FTP_USER and FTP_PASS in .env");
        }
        process.exit(1);
    } finally {
        client.close();
    }
}

deploy();
