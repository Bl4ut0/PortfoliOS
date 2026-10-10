// Compatibility entry point. Upload transport lives in PortfoliOS-Orchestration.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

async function main() {
    const parent = path.dirname(__dirname);
    const origin = spawnSync("git", ["-C", parent, "remote", "get-url", "origin"], { encoding: "utf8", windowsHide: true });
    const identity = origin.stdout?.trim().replace(/^git@github\.com:/i, "https://github.com/").replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/").replace(/\/+$/, "").replace(/\.git$/i, "").toLowerCase();
    const runner = path.join(parent, "scripts/workspace.mjs");
    if (origin.status !== 0 || identity !== "https://github.com/bl4ut0/portfolios-orchestration" || !fs.existsSync(runner)) {
        throw new Error("Deployment now runs from https://github.com/Bl4ut0/PortfoliOS-Orchestration. Clone this OS checkout inside that repository, install its dependencies with npm ci, and run npm run deploy:dry there.");
    }
    const { main: orchestrate } = await import(pathToFileURL(runner).href);
    await orchestrate(["deploy", ...process.argv.slice(2)]);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
