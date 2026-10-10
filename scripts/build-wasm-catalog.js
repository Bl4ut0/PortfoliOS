#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "docs", "wasm");
const catalog = JSON.parse(fs.readFileSync(path.join(dir, "catalog.json"), "utf8"));
const check = process.argv.includes("--check");
const kinds = new Set(["wasm-application", "wasm-engine", "wasm-runtime", "browser-app-with-wasm-kernel", "javascript-webgl", "webgpu-runtime", "placeholder"]);
const priorities = new Set(["evaluate-first", "evaluate-later", "experimental", "maintain"]);
const statuses = new Set(["candidate", "integrated", "shell-only"]);
const docTypes = ["overview", "source", "build-api", "releases", "issues", "license"];
const groups = [["evaluate-first", "First evaluations"], ["evaluate-later", "Later evaluations"], ["experimental", "Experimental projects"], ["maintain", "Existing integrations and related browser apps"]];
function assert(ok, message) { if (!ok) throw new Error(message); }
function line(value) { return String(value).replace(/[\r\n|]/g, " "); }
function html(value) { return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function date(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value; }
assert(catalog.schemaVersion === 1, "Unsupported catalog schema");
assert(date(catalog.reviewedAt), "Invalid catalog review date");
assert(Array.isArray(catalog.projects) && catalog.projects.length > 0, "Empty catalog");
const ids = new Set();
for (const p of catalog.projects) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id) && !ids.has(p.id), "Invalid or duplicate project ID: " + p.id);
    ids.add(p.id);
    for (const key of ["name", "category", "summary", "runtime", "upstreamReadiness", "portfoliosReadiness", "desktop", "mobile", "storage", "lifecycle", "performance", "nextAction", "evidence"]) assert(typeof p[key] === "string" && p[key].trim(), p.id + ": missing " + key);
    assert(kinds.has(p.kind) && priorities.has(p.priority) && statuses.has(p.status), p.id + ": invalid classification");
    assert(date(p.lastReviewed) && p.lastReviewed <= catalog.reviewedAt, p.id + ": invalid review date");
    assert(p.artifact && ["version", "sha256", "measurementReport"].every(k => Object.hasOwn(p.artifact, k)), p.id + ": artifact evidence fields missing");
    assert(p.artifact.sha256 === null || /^[a-f0-9]{64}$/.test(p.artifact.sha256), p.id + ": invalid artifact SHA-256");
    assert(Array.isArray(p.documentation), p.id + ": documentation must be an array");
    for (const d of p.documentation) {
        const url = new URL(d.url);
        assert(url.protocol === "https:" && !url.username && !url.password, p.id + ": invalid documentation URL");
        assert(typeof d.label === "string" && d.label.trim() && typeof d.type === "string", p.id + ": invalid documentation label/type");
    }
    for (const type of docTypes) assert(p.documentation.some(d => d.type === type), p.id + ": missing documentation category " + type);
    assert(Array.isArray(p.localEvidence), p.id + ": local evidence must be an array");
    for (const local of p.localEvidence) {
        const target = path.resolve(root, local);
        assert(!path.isAbsolute(local) && target.startsWith(root + path.sep) && fs.existsSync(target), p.id + ": missing or unsafe local evidence path " + local);
    }
}
const total = catalog.projects.length;
const links = catalog.projects.reduce((n, p) => n + p.documentation.length, 0);
const first = catalog.projects.filter(p => p.priority === "evaluate-first");
const limitations = "Candidate means researched, not installed. Upstream browser support is separate from PortfoliOS acceptance. This review did not execute the candidate engines or benchmark them. Null version/hash/measurement fields mean evidence still needs collecting. Related JavaScript/WebGPU apps and the simulated Office shell are labeled explicitly.";
const md = ["# PortfoliOS WASM application catalog", "", "Reviewed " + catalog.reviewedAt + ". " + total + " entries; " + links + " documentation references. Generated from [catalog.json](catalog.json); edit the JSON and run node scripts/build-wasm-catalog.js.", "", "[Library home](README.md) | [Documentation index](DOCUMENTATION.md) | [Integration guide](INTEGRATION.md) | [Expansion roadmap](ROADMAP.md)", "", limitations, ""];
for (const [priority, label] of groups) {
    const items = catalog.projects.filter(p => p.priority === priority);
    md.push("## " + label, "", "| Project | Category | Runtime classification | Status |", "| --- | --- | --- | --- |");
    for (const p of items) md.push("| [" + line(p.name) + "](#" + p.id + ") | " + line(p.category) + " | " + p.kind + " | " + p.status + " |");
    md.push("");
}
md.push("## Project notes", "");
for (const p of catalog.projects) {
    md.push('<a id="' + p.id + '"></a>', "", "### " + p.name, "", p.summary, "", "- **Classification:** " + p.kind + "; " + p.status + "; " + p.priority + ".", "- **Runtime:** " + p.runtime, "- **Upstream readiness:** " + p.upstreamReadiness, "- **PortfoliOS readiness:** " + p.portfoliosReadiness, "- **Desktop:** " + p.desktop, "- **Mobile:** " + p.mobile, "- **Files and backup:** " + p.storage, "- **Lifecycle:** " + p.lifecycle, "- **Performance evidence:** " + p.performance, "- **Next action:** " + p.nextAction);
    if (p.licenseNotes) md.push("- **License review:** " + p.licenseNotes);
    md.push("- **Artifact evidence:** version " + (p.artifact.version || "unrecorded") + "; SHA-256 " + (p.artifact.sha256 || "unrecorded") + "; measurement report " + (p.artifact.measurementReport || "unrecorded") + ".");
    if (p.localEvidence.length) md.push("- **Local evidence:** " + p.localEvidence.map(f => "[" + f + "](../../" + f + ")").join(", ") + ".");
    md.push("- **Reviewed:** " + p.lastReviewed + " (" + p.evidence + ").", "", "**Documentation**", "");
    for (const d of p.documentation) md.push("- [" + d.label + "](" + d.url + ") (" + d.type + ").");
    md.push("");
}
const reference = ["# Upstream documentation index", "", "Reviewed " + catalog.reviewedAt + ". Generated from [catalog.json](catalog.json). Labels distinguish exact project references from contextual sources and pending provenance investigations.", "", "[Application catalog](APPLICATIONS.md) | [Integration guide](INTEGRATION.md) | [Project worksheet](PROJECT_TEMPLATE.md)", "", "A release or tracker URL is a navigation reference; it does not guarantee a binary exists or that upstream accepts issues there. Inclusion does not approve an artifact for distribution.", ""];
for (const p of catalog.projects) {
    reference.push("## " + p.name, "", "| Documentation area | Reference |", "| --- | --- |");
    for (const d of p.documentation) reference.push("| " + line(d.type) + " | [" + line(d.label) + "](" + d.url + ") |");
    reference.push("");
}
const article = p => {
    const rows = [["Classification", p.kind + " / " + p.status], ["Evaluation priority", p.priority], ["Runtime", p.runtime], ["Upstream", p.upstreamReadiness], ["PortfoliOS", p.portfoliosReadiness], ["Desktop", p.desktop], ["Mobile", p.mobile], ["Files and backup", p.storage], ["Lifecycle", p.lifecycle], ["Performance", p.performance], ["Next action", p.nextAction], ["License review", p.licenseNotes || "Inspect the exact artifact, bundled dependencies/assets, and notices before distribution."]];
    return '<details id="' + p.id + '"><summary>' + html(p.name) + ' <span>' + html(p.category + " · " + p.kind) + '</span></summary><p>' + html(p.summary) + '</p><dl>' + rows.map(([k, v]) => '<dt>' + html(k) + '</dt><dd>' + html(v) + '</dd>').join("") + '</dl><p><strong>Artifact evidence:</strong> version ' + html(p.artifact.version || "unrecorded") + '; SHA-256 ' + html(p.artifact.sha256 || "unrecorded") + '; measurement report ' + html(p.artifact.measurementReport || "unrecorded") + '.</p><h3>Documentation</h3><ul>' + p.documentation.map(d => '<li><a href="' + html(d.url) + '">' + html(d.label) + '</a> <small>' + html(d.type) + '</small></li>').join("") + '</ul>' + (p.localEvidence.length ? '<h3>Local evidence</h3><ul>' + p.localEvidence.map(f => '<li><a href="https://github.com/Bl4ut0/PortfoliOS/blob/main/' + encodeURI(f) + '">' + html(f) + '</a></li>').join("") + '</ul>' : "") + '<p class="reviewed">Reviewed ' + html(p.lastReviewed + " · " + p.evidence) + '</p></details>';
};
const page = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="portfolios-wasm-catalog" content="' + catalog.reviewedAt + '"><meta name="description" content="PortfoliOS WebAssembly application inventory, documentation, and integration roadmap"><title>PortfoliOS WASM application library</title><style>\n' +
':root{color-scheme:light dark;--bg:#f5f7fb;--panel:#fff;--ink:#172337;--muted:#475569;--line:#cbd5e1;--link:#075aaa}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:1rem/1.65 system-ui,sans-serif}main{max-width:72rem;margin:auto;padding:clamp(1rem,4vw,3rem)}h1{font-size:clamp(1.8rem,4vw,3rem);line-height:1.15}h2{margin-top:2.4rem}h3{font-size:1rem}a{color:var(--link);text-underline-offset:.18em}a:focus-visible,summary:focus-visible{outline:3px solid var(--link);outline-offset:4px}nav{display:flex;flex-wrap:wrap;gap:.6rem 1.2rem;margin:1.5rem 0}.note{border-left:4px solid var(--link);padding:1rem;background:var(--panel)}.count,.reviewed,small{color:var(--muted)}details{background:var(--panel);border:1px solid var(--line);border-radius:.75rem;padding:1rem 1.2rem;margin:.8rem 0;scroll-margin-top:1rem}summary{cursor:pointer;font-weight:700}summary span{display:block;font-weight:400;color:var(--muted);margin:.25rem 0 0 1.2rem;font-size:.9rem}dl{display:grid;grid-template-columns:11rem 1fr;gap:.7rem 1rem}dt{font-weight:700}dd{margin:0;overflow-wrap:anywhere}li{margin:.25rem 0;overflow-wrap:anywhere}small{font-size:.8rem}.jump{display:flex;flex-wrap:wrap;gap:.5rem 1rem}.jump a{padding:.25rem 0}@media(max-width:620px){dl{display:block}dt{margin-top:1rem}dd{margin-top:.2rem}details{padding:.9rem}main{padding:1rem}}@media(prefers-color-scheme:dark){:root{--bg:#090f19;--panel:#131d2c;--ink:#edf4ff;--muted:#b4c3d8;--line:#3f5067;--link:#76cdff}}@media print{details{break-inside:avoid}body{background:white;color:black}}\n' +
'</style></head><body><main><header><p class="count">PORTFOLIOS / APPLICATION RESEARCH · ' + catalog.reviewedAt + '</p><h1>WASM application library</h1><p>' + total + ' projects and ' + links + ' documentation references for expanding the virtual computer.</p><nav aria-label="Library documentation"><a href="https://github.com/Bl4ut0/PortfoliOS/tree/main/docs/wasm">Full documentation on GitHub</a><a href="catalog.json">JSON inventory</a><a href="https://github.com/Bl4ut0/PortfoliOS/blob/main/docs/wasm/INTEGRATION.md">Integration guide</a><a href="https://github.com/Bl4ut0/PortfoliOS/blob/main/docs/wasm/ROADMAP.md">Expansion roadmap</a><a href="https://os.bl4ut0.dev/">Open PortfoliOS</a></nav><p class="note">' + html(limitations) + '</p></header><h2>Start with useful workflows</h2><p>The first evaluation group covers PDF work, image editing, vector editing, media conversion, and OCR. Compare the two vector editors before selecting one. All app engines remain outside the shell startup path.</p><nav class="jump" aria-label="First evaluation projects">' + first.map(p => '<a href="#' + p.id + '">' + html(p.name) + '</a>').join("") + '</nav>' +
groups.map(([priority, label]) => '<section aria-labelledby="group-' + priority + '"><h2 id="group-' + priority + '">' + label + '</h2>' + catalog.projects.filter(p => p.priority === priority).map(article).join("") + '</section>').join("") +
'<footer><p>Source: <a href="catalog.json">catalog.json</a>. This self-contained documentation page loads no third-party application runtime.</p></footer></main></body></html>\n';
const outputs = { "APPLICATIONS.md": md.join("\n").trimEnd() + "\n", "DOCUMENTATION.md": reference.join("\n").trimEnd() + "\n", "index.html": page };
for (const [name, content] of Object.entries(outputs)) {
    const target = path.join(dir, name);
    if (check) assert(fs.existsSync(target) && fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") === content, name + " is stale; run node scripts/build-wasm-catalog.js");
    else fs.writeFileSync(target, content, "utf8");
}
console.log((check ? "Validated" : "Generated") + " WASM library: " + total + " projects, " + links + " documentation references; classification, metadata, local paths, and generated pages checked.");
