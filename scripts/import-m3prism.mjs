/** Import a verified release built in the independent M3-Prism repository. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv.length !== 3) {
  throw new Error(
    "Usage: node scripts/import-m3prism.mjs <M3-Prism checkout>",
  );
}

const checkout = fs.realpathSync(process.argv[2]);
const artifact = path.join(checkout, "app/client/dist");
const receipt = JSON.parse(
  fs.readFileSync(path.join(artifact, "release.json"), "utf8"),
);
if (
  receipt.repository !== "https://github.com/Bl4ut0/M3-Prism" ||
  !/^[a-f0-9]{40}$/.test(receipt.revision)
) {
  throw new Error("Invalid M3-Prism release identity");
}

const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: checkout,
  encoding: "utf8",
}).trim();
const dirty = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=normal"],
  { cwd: checkout, encoding: "utf8" },
).trim();
if (revision !== receipt.revision || dirty || receipt.dirty) {
  throw new Error(
    "Build from a clean, committed M3-Prism checkout before importing",
  );
}

const files = Object.keys(receipt.files);
if (
  !["index.html", "hamburger.png", "vite.svg"].every((f) =>
    files.includes(f),
  ) ||
  !files.some((f) => /^assets\/index-.*\.js$/.test(f))
) {
  throw new Error("Incomplete M3-Prism release");
}

for (const file of files) {
  if (
    !/^[\w./-]+$/.test(file) ||
    file.split("/").includes("..") ||
    path.isAbsolute(file) ||
    /(?:^|\/)(?:sw|controller\.sw|localcontrollersw)\.js$/.test(file)
  ) {
    throw new Error("Unexpected release path: " + file);
  }
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(artifact, file)))
    .digest("hex");
  if (hash !== receipt.files[file]) {
    throw new Error("M3-Prism checksum mismatch: " + file);
  }
}

const output = path.join(root, "apps/iptv/m3prism");
fs.mkdirSync(output, { recursive: true });
for (const file of files.sort(
  (a, b) => (a === "index.html") - (b === "index.html"),
)) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(artifact, file), destination);
}
fs.copyFileSync(
  path.join(artifact, "release.json"),
  path.join(output, "release.json"),
);

const current = new Set(files);
for (const entry of fs.readdirSync(path.join(output, "assets"))) {
  if (
    /^(?:index|vendor-[\w-]+)-.*\.(?:js|css)(?:\.map)?$/.test(entry) &&
    !current.has("assets/" + entry)
  ) {
    fs.unlinkSync(path.join(output, "assets", entry));
  }
}

console.log(
  "Imported M3-Prism " +
    receipt.revision +
    " with " +
    files.length +
    " verified assets.",
);
