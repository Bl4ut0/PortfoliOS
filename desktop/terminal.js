/**
 * PortfoliOS: CLI Terminal Component
 * Handles parsing CLI commands, rendering outputs, and Local AI command guidance.
 * Implements Unix-like kernel behaviors, multi-user accounts, prompt styling, and filesystem tools.
 */

// CLI state variables
let currentUser = "guest";
let currentDir = "/home/guest";
let userDirMap = {};
let activePrompt = null;
const history = [];
let historyIndex = -1;
let currentInputVal = "";
let terminalJobId = 0;
const terminalJobs = new Map();

// SHA-256 Hashing helper
async function sha256(message) {
    if (!message) return "";
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// User database loaders & writers
async function loadUsers() {
    let users = {};
    let loaded = false;
    try {
        const file = await window.SystemFS.readFile("/etc/users.json");
        if (file && file.data) {
            users = JSON.parse(file.data);
            loaded = true;
        }
    } catch (e) {
        console.error("Failed to load users DB:", e);
    }

    // Browser-local simulation accounts only; this is not an authentication boundary.
    const defaultUsers = {
        "guest": {
            username: "guest",
            passwordHash: "",
            groups: ["guest"],
            home: "/home/guest"
        },
        "root": {
            username: "root",
            passwordHash: "fc62b0878564f7ab38a9561b369ad89b65e90d1bf4303d76e7b165b46e3d2ff9", // "root"
            groups: ["root", "sudo"],
            home: "/root"
        },
        "bl4ut0": {
            username: "bl4ut0",
            passwordHash: "",
            groups: ["bl4ut0", "sudo"],
            home: "/home/bl4ut0"
        },
        "private": {
            username: "private",
            passwordHash: "",
            groups: ["private"],
            home: "/home/private"
        }
    };

    // Merge default users in case some are missing
    let changed = false;
    for (const key in defaultUsers) {
        if (!users[key]) {
            users[key] = defaultUsers[key];
            changed = true;
        }
    }

    if (changed || !loaded) {
        try {
            await window.SystemFS.ensureDirectory("/etc", { silent: true });
            await window.SystemFS.writeFile("/etc/users.json", "users.json", "/etc", JSON.stringify(users, null, 2), undefined, "application/json", false, { silent: true });
        } catch (e) {
            console.error("Failed to initialize or update default users:", e);
        }
    }

    userDirMap = users;
    return users;
}

async function saveUsers(users) {
    try {
        await window.SystemFS.ensureDirectory("/etc", { silent: true });
        await window.SystemFS.writeFile("/etc/users.json", "users.json", "/etc", JSON.stringify(users, null, 2), undefined, "application/json", false, { silent: true });
        userDirMap = users;
    } catch (e) {
        console.error("Failed to save users DB:", e);
    }
}

async function ensureUserHomeDirectories(users) {
    for (const username in users) {
        const homePath = users[username].home;
        if (homePath) {
            try {
                await window.SystemFS.ensureDirectory(homePath, { silent: true });
            } catch (e) {
                console.error(`Failed to ensure home dir for ${username}:`, e);
            }
        }
    }
}

// Path resolver
function resolvePath(pathStr) {
    if (!pathStr) return currentDir;

    let resolved = pathStr;
    if (resolved === "~") {
        const homeDir = userDirMap[currentUser]?.home || (currentUser === "root" ? "/root" : `/home/${currentUser}`);
        resolved = homeDir;
    } else if (resolved.startsWith("~/")) {
        const homeDir = userDirMap[currentUser]?.home || (currentUser === "root" ? "/root" : `/home/${currentUser}`);
        resolved = homeDir + resolved.slice(1);
    }

    if (!resolved.startsWith("/")) {
        resolved = currentDir === "/" ? "/" + resolved : currentDir + "/" + resolved;
    }

    const parts = resolved.split("/").filter(Boolean);
    const stack = [];
    for (const part of parts) {
        if (part === ".") {
            continue;
        } else if (part === "..") {
            if (stack.length > 0) stack.pop();
        } else {
            stack.push(part);
        }
    }

    return "/" + stack.join("/");
}

async function getFileRecord(path) {
    const cleanPath = window.SystemFS.normalizePath(path);
    if (cleanPath === "/") {
        return { path: "/", name: "/", parent: "", isDirectory: true, size: 0, type: "directory" };
    }
    return await window.SystemFS.readFile(cleanPath);
}

// Prompt formatter
function updatePrompt() {
    const promptEl = document.getElementById("terminal-prompt");
    if (!promptEl) return;

    const user = currentUser || "guest";
    const isRoot = user === "root";
    const promptChar = isRoot ? "#" : "$";

    let displayDir = currentDir;
    const userHome = userDirMap[user]?.home || (isRoot ? "/root" : `/home/${user}`);
    if (currentDir === userHome) {
        displayDir = "~";
    } else if (currentDir.startsWith(userHome + "/")) {
        displayDir = "~" + currentDir.slice(userHome.length);
    }

    const userColor = isRoot ? "var(--rose)" : "var(--theme-accent)";
    const pathColor = "var(--blue)";

    let displayUser = user;
    if (user === "bl4ut0") {
        displayUser = "Bl4ut0";
    } else if (user === "private") {
        const privateUser = window.getCurrentUser ? window.getCurrentUser() : null;
        displayUser = privateUser?.handle || "private";
    }

    promptEl.innerHTML = `<span style="color: ${userColor}; font-weight: bold;">${escapeHtml(displayUser)}@portfoliOS</span>:<span style="color: ${pathColor}; font-weight: bold;">${escapeHtml(displayDir)}</span>${promptChar}&nbsp;`;

    // Update window title bar dynamically to match
    const titleEl = document.getElementById("cli-window-title");
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-terminal"></i> ${escapeHtml(displayUser)}@portfoliOS:${escapeHtml(displayDir)}`;
    }
}

// Interactive prompt state machine helper
function promptUser(label, isPassword, callback) {
    activePrompt = { label, isPassword, callback };

    const promptEl = document.getElementById("terminal-prompt");
    if (promptEl) {
        promptEl.textContent = label;
    }

    const inputEl = document.getElementById("terminal-input");
    if (inputEl) {
        inputEl.type = isPassword ? "password" : "text";
        inputEl.value = "";
        inputEl.focus();
    }
}

// History setup helper
function setupHistory() {
    const inputEl = document.getElementById("terminal-input");
    if (!inputEl || inputEl.dataset.historyBound === "true") return;
    inputEl.dataset.historyBound = "true";

    inputEl.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") {
            event.preventDefault();
            if (history.length === 0) return;
            if (historyIndex === -1) {
                currentInputVal = inputEl.value;
                historyIndex = history.length - 1;
            } else if (historyIndex > 0) {
                historyIndex--;
            }
            inputEl.value = history[historyIndex];
            setTimeout(() => { inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length; }, 0);
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            if (historyIndex === -1) return;
            if (historyIndex < history.length - 1) {
                historyIndex++;
                inputEl.value = history[historyIndex];
            } else {
                historyIndex = -1;
                inputEl.value = currentInputVal;
            }
        } else if (event.key === "Enter" && !event.isComposing) {
            event.preventDefault();
            inputEl.form?.requestSubmit();
        }
    });
}

// Redirection output handler
async function handleRedirection(pathStr, text, append) {
    const resolved = resolvePath(pathStr);
    const parent = window.SystemFS.getParentPath(resolved);
    const name = window.SystemFS.getName(resolved);

    // Strip HTML tags so we save clean content
    const cleanText = String(text ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");

    const record = await getFileRecord(resolved);
    let finalData = cleanText;

    if (record) {
        if (record.isDirectory) {
            throw new Error(`cannot redirect to '${pathStr}': Is a directory`);
        }
        if (append) {
            finalData = (record.data || "") + "\n" + cleanText;
        }
    }

    await window.SystemFS.writeFile(
        resolved,
        name,
        parent,
        finalData,
        finalData.length,
        "text/plain",
        false
    );
}

// String escape helper
function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Argument parser (respecting quotes)
function parseArgs(cmdPart) {
    const args = [];
    let current = "";
    let inDoubleQuotes = false;
    let inSingleQuotes = false;

    for (let i = 0; i < cmdPart.length; i++) {
        const char = cmdPart[i];
        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
        } else if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
        } else if (char === ' ' && !inDoubleQuotes && !inSingleQuotes) {
            if (current) {
                args.push(current);
                current = "";
            }
        } else {
            current += char;
        }
    }
    if (current) {
        args.push(current);
    }
    return args;
}

// Command parser supporting > and >>
function parseCommandLine(cmdLine) {
    let inDoubleQuotes = false;
    let inSingleQuotes = false;
    let redirectIndex = -1;
    let append = false;

    for (let i = 0; i < cmdLine.length; i++) {
        const char = cmdLine[i];
        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
        } else if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
        } else if (!inDoubleQuotes && !inSingleQuotes) {
            if (char === '>' && cmdLine[i + 1] === '>') {
                redirectIndex = i;
                append = true;
                break;
            } else if (char === '>') {
                redirectIndex = i;
                append = false;
                break;
            }
        }
    }

    let commandPart = cmdLine;
    let targetFile = null;

    if (redirectIndex !== -1) {
        commandPart = cmdLine.slice(0, redirectIndex).trim();
        const operatorLength = append ? 2 : 1;
        targetFile = cmdLine.slice(redirectIndex + operatorLength).trim();
        if ((targetFile.startsWith('"') && targetFile.endsWith('"')) ||
            (targetFile.startsWith("'") && targetFile.endsWith("'"))) {
            targetFile = targetFile.slice(1, -1);
        }
    }

    return { commandPart, targetFile, append };
}

// Multi-user logic implementations
async function runSu(targetUser) {
    const user = targetUser || "root";
    const users = await loadUsers();
    if (!users[user]) {
        window.addTerminalLine(`su: user ${user} does not exist`);
        return;
    }

    const userObj = users[user];

    if (!userObj.passwordHash || currentUser === "root") {
        currentUser = user;
        currentDir = userObj.home || "/";
        window.addTerminalLine(`Logged in as ${currentUser}`);
        updatePrompt();
        return;
    }

    promptUser("Password: ", true, async (password) => {
        const hash = await sha256(password);
        if (hash === userObj.passwordHash) {
            currentUser = user;
            currentDir = userObj.home || "/";
            window.addTerminalLine(`Logged in as ${currentUser}`);
            updatePrompt();
        } else {
            window.addTerminalLine("su: Authentication failure");
        }
    });
}

async function runPasswd(targetUser) {
    const user = targetUser || currentUser;
    const users = await loadUsers();
    if (!users[user]) {
        window.addTerminalLine(`passwd: user ${user} does not exist`);
        return;
    }

    if (currentUser !== "root" && currentUser !== user) {
        window.addTerminalLine("passwd: You may not view or modify password information for other users.");
        return;
    }

    const userObj = users[user];

    const changePasswordFlow = () => {
        promptUser("New password: ", true, (newPass) => {
            if (!newPass) {
                window.addTerminalLine("passwd: password cannot be empty");
                return;
            }
            promptUser("Retype new password: ", true, async (retypePass) => {
                if (newPass !== retypePass) {
                    window.addTerminalLine("passwd: passwords do not match");
                    window.addTerminalLine("passwd: password unchanged");
                    return;
                }
                userObj.passwordHash = await sha256(newPass);
                await saveUsers(users);
                window.addTerminalLine("passwd: password updated successfully");
            });
        });
    };

    if (currentUser !== "root" && userObj.passwordHash) {
        promptUser("Current password: ", true, async (currPass) => {
            const hash = await sha256(currPass);
            if (hash !== userObj.passwordHash) {
                window.addTerminalLine("passwd: Authentication token manipulation error");
                return;
            }
            changePasswordFlow();
        });
    } else {
        changePasswordFlow();
    }
}

async function runUserAdd(username) {
    if (currentUser !== "root") {
        window.addTerminalLine("useradd: Only root may add a user to the system.");
        return;
    }

    if (!username) {
        window.addTerminalLine("useradd: Please specify a username.");
        return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        window.addTerminalLine("useradd: Invalid username (only alphanumeric characters, dashes, and underscores allowed).");
        return;
    }

    const users = await loadUsers();
    if (users[username]) {
        window.addTerminalLine(`useradd: The user '${username}' already exists.`);
        return;
    }

    promptUser("Enter password for new user: ", true, (newPass) => {
        promptUser("Retype password: ", true, async (retypePass) => {
            if (newPass !== retypePass) {
                window.addTerminalLine("useradd: passwords do not match");
                window.addTerminalLine("useradd: user creation aborted");
                return;
            }

            const passwordHash = newPass ? await sha256(newPass) : "";
            const homePath = `/home/${username}`;

            users[username] = {
                username,
                passwordHash,
                groups: [username],
                home: homePath
            };

            await saveUsers(users);

            try {
                await window.SystemFS.ensureDirectory(homePath, { silent: true });
            } catch (e) {
                console.error("Failed to create home directory for new user:", e);
            }

            window.addTerminalLine(`useradd: User '${username}' created successfully.`);
            window.addTerminalLine(`useradd: Created home directory ${homePath}`);
        });
    });
}

async function runUserDel(username) {
    if (currentUser !== "root") {
        return "userdel: Only root may delete a user from the system.";
    }

    if (!username) {
        return "userdel: Please specify a username.";
    }

    if (username === "root" || username === "guest") {
        return `userdel: Cannot delete default user '${username}'.`;
    }

    const users = await loadUsers();
    if (!users[username]) {
        return `userdel: The user '${username}' does not exist.`;
    }

    delete users[username];
    await saveUsers(users);

    return `userdel: User '${username}' deleted successfully.`;
}

async function runGroups(targetUser) {
    const user = targetUser || currentUser;
    const users = await loadUsers();
    if (!users[user]) {
        return `groups: '${user}': no such user`;
    }
    return `${user} : ${users[user].groups.join(" ")}`;
}

async function runId(targetUser) {
    const user = targetUser || currentUser;
    const users = await loadUsers();
    if (!users[user]) {
        return `id: '${user}': no such user`;
    }
    const userObj = users[user];
    const isRoot = user === "root";
    const uid = isRoot ? 0 : 1000 + Object.keys(users).indexOf(user);
    const gid = uid;

    const groupsStr = userObj.groups.map(g => {
        const gName = g;
        const gId = gName === "root" || gName === "sudo" ? 0 : 1000 + Object.keys(users).indexOf(gName);
        return `${gId}(${gName})`;
    }).join(",");

    return `uid=${uid}(${user}) gid=${gid}(${user}) groups=${groupsStr}`;
}

// Filesystem logic implementations
async function runCd(pathStr) {
    let targetPath = pathStr;
    if (!targetPath) {
        targetPath = userDirMap[currentUser]?.home || (currentUser === "root" ? "/root" : `/home/${currentUser}`);
    }

    const resolved = resolvePath(targetPath);
    const record = await getFileRecord(resolved);

    if (!record) {
        return `cd: no such file or directory: ${pathStr}`;
    }

    if (!record.isDirectory) {
        return `cd: not a directory: ${pathStr}`;
    }

    currentDir = resolved;
    updatePrompt();
}

async function runLs(args) {
    const flags = [];
    const paths = [];
    for (const arg of args) {
        if (arg.startsWith("-")) {
            flags.push(arg);
        } else {
            paths.push(arg);
        }
    }

    const showDetails = flags.some(f => f.includes("l"));
    const showAll = flags.some(f => f.includes("a"));

    const targetDir = paths[0] ? resolvePath(paths[0]) : currentDir;
    const record = await getFileRecord(targetDir);

    if (!record) {
        return `ls: cannot access '${paths[0] || ""}': No such file or directory`;
    }

    if (!record.isDirectory) {
        if (showDetails) {
            return formatLsRecord(record);
        }
        return record.name;
    }

    const items = await window.SystemFS.readDir(targetDir);

    if (showDetails) {
        const lines = [];
        if (showAll) {
            const dotRecord = { name: ".", isDirectory: true, size: 0, lastModified: record.lastModified };
            const dotDotRecord = { name: "..", isDirectory: true, size: 0, lastModified: Date.now() };
            lines.push(formatLsRecord(dotRecord));
            lines.push(formatLsRecord(dotDotRecord));
        }

        for (const item of items) {
            lines.push(formatLsRecord(item));
        }
        return lines.join("\n");
    } else {
        const names = [];
        if (showAll) {
            names.push(".");
            names.push("..");
        }
        for (const item of items) {
            names.push(item.name);
        }
        return names.join("  ");
    }
}

function formatLsRecord(item) {
    const isDir = item.isDirectory;
    const typeChar = isDir ? "d" : "-";
    const perms = isDir ? "rwxr-xr-x" : "rw-r--r--";
    const links = isDir ? 2 : 1;

    const isEtcOrRoot = item.path?.startsWith("/etc") || item.path?.startsWith("/root");
    const owner = isEtcOrRoot ? "root" : "guest";
    const group = isEtcOrRoot ? "root" : "guest";

    const sizeStr = isDir ? "0 B" : formatBytes(item.size || 0);

    const mdate = new Date(item.lastModified || Date.now());
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[mdate.getMonth()];
    const day = String(mdate.getDate()).padStart(2, " ");
    const hour = String(mdate.getHours()).padStart(2, "0");
    const min = String(mdate.getMinutes()).padStart(2, "0");
    const dateStr = `${month} ${day} ${hour}:${min}`;

    const displayName = isDir && item.name !== "." && item.name !== ".." ? `${item.name}/` : item.name;

    return `${typeChar}${perms}  ${links} ${owner.padEnd(8)} ${group.padEnd(8)} ${sizeStr.padStart(8)} ${dateStr} ${displayName}`;
}

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(0)} ${sizes[i]}`;
}

async function runCat(pathStr) {
    if (!pathStr) {
        return "cat: missing file operand";
    }
    const resolved = resolvePath(pathStr);
    const record = await getFileRecord(resolved);

    if (!record) {
        return `cat: ${pathStr}: No such file or directory`;
    }

    if (record.isDirectory) {
        return `cat: ${pathStr}: Is a directory`;
    }

    return record.data || "";
}

async function runTouch(pathStr) {
    if (!pathStr) {
        return "touch: missing file operand";
    }
    const resolved = resolvePath(pathStr);
    const parent = window.SystemFS.getParentPath(resolved);
    const name = window.SystemFS.getName(resolved);

    const record = await getFileRecord(resolved);
    if (record) {
        await window.SystemFS.writeFile(resolved, record.name, record.parent, record.data, record.size, record.type, record.isDirectory, { lastModified: Date.now() });
    } else {
        await window.SystemFS.writeFile(resolved, name, parent, "", 0, "text/plain", false);
    }
}

async function runMkdir(pathStr) {
    if (!pathStr) {
        return "mkdir: missing operand";
    }
    const resolved = resolvePath(pathStr);
    const record = await getFileRecord(resolved);
    if (record) {
        return `mkdir: cannot create directory '${pathStr}': File exists`;
    }

    const parent = window.SystemFS.getParentPath(resolved);
    const name = window.SystemFS.getName(resolved);
    await window.SystemFS.writeFile(resolved, name, parent, null, 0, "directory", true);
}

async function runRm(args) {
    const flags = [];
    const paths = [];
    for (const arg of args) {
        if (arg.startsWith("-")) {
            flags.push(arg);
        } else {
            paths.push(arg);
        }
    }

    const recursive = flags.some(f => f.includes("r") || f.includes("R"));
    const force = flags.some(f => f.includes("f"));
    const pathStr = paths[0];

    if (!pathStr) {
        return "rm: missing operand";
    }

    const resolved = resolvePath(pathStr);
    const record = await getFileRecord(resolved);

    if (!record) {
        if (force) return;
        return `rm: cannot remove '${pathStr}': No such file or directory`;
    }

    if (record.isDirectory && !recursive) {
        return `rm: cannot remove '${pathStr}': Is a directory`;
    }

    if (record.isDirectory) {
        await window.SystemFS.deleteFileRecursive(resolved);
    } else {
        await window.SystemFS.deleteFile(resolved);
    }
}

function createTerminalAsyncJob(label, run, options = {}) {
    return {
        __terminalAsyncJob: true,
        label,
        run,
        kind: options.kind || "background",
        cancel: options.cancel || null
    };
}

function isTerminalAsyncJob(value) {
    return Boolean(value?.__terminalAsyncJob && typeof value.run === "function");
}

function createLocalAIChatJob(prompt, context = {}) {
    return createTerminalAsyncJob(
        "Local AI queued in background GPU worker. Terminal remains available while it answers.",
        (onChunk) => window.LocalAI.chat(prompt, context, onChunk),
        {
            kind: "local-ai",
            cancel: () => window.LocalAI.cancelGeneration?.("cli-job")
        }
    );
}

function getTerminalJob(jobId) {
    const normalizedId = Number.parseInt(String(jobId || "").replace(/^%/, ""), 10);
    if (Number.isFinite(normalizedId)) return terminalJobs.get(normalizedId) || null;
    return [...terminalJobs.values()].reverse().find((job) => job.status === "running" || job.status === "cancelling") || null;
}

function formatTerminalJobs() {
    const jobs = [...terminalJobs.values()];
    if (!jobs.length) return "No active background jobs.";

    return jobs.map((job) => {
        const elapsedSeconds = Math.max(0, Math.round((Date.now() - job.startedAt) / 1000));
        return `[${job.id}] ${job.status.padEnd(10)} ${job.kind} (${elapsedSeconds}s)`;
    }).join("\n");
}

async function cancelTerminalJob(jobId) {
    const job = getTerminalJob(jobId);
    if (!job) {
        if (!jobId && window.LocalAI?.getStatus?.().status === "generating") {
            const cancelled = await window.LocalAI.cancelGeneration?.("cli");
            return cancelled ? "Local AI cancellation requested." : "The AI response had already finished.";
        }
        return jobId ? `kill: job ${jobId} was not found` : "No cancellable background job is running.";
    }
    if (typeof job.cancel !== "function") {
        return `[job ${job.id}] does not support cancellation.`;
    }

    job.cancelRequested = true;
    job.status = "cancelling";
    if (job.statusLine) job.statusLine.textContent = `[job ${job.id}] Cancelling Local AI response...`;
    const cancelled = await job.cancel();
    return cancelled === false
        ? `[job ${job.id}] had already finished.`
        : `[job ${job.id}] cancellation requested.`;
}

async function startTerminalAsyncJob(job, targetFile, append) {
    const jobId = ++terminalJobId;
    const statusLine = window.addTerminalLine(`[job ${jobId}] ${job.label}`, "muted");
    const jobRecord = {
        id: jobId,
        kind: job.kind || "background",
        status: "running",
        statusLine,
        startedAt: Date.now(),
        cancel: job.cancel,
        cancelRequested: false
    };
    terminalJobs.set(jobId, jobRecord);

    try {
        let aiLine = null;
        let responseText = "";

        const onChunk = (delta) => {
            responseText += String(delta || "");
            if (targetFile) return;

            if (!aiLine) {
                if (statusLine) {
                    statusLine.textContent = `[job ${jobId}] Local AI answering...`;
                }
                aiLine = window.addTerminalLine("", "ai-response");
            }
            aiLine.textContent = responseText;
            
            const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
            if (output) output.scrollTop = output.scrollHeight;
        };

        const result = await job.run(onChunk);
        const finalText = String(result ?? "");
        jobRecord.status = jobRecord.cancelRequested ? "cancelled" : "completed";

        if (targetFile) {
            await handleRedirection(targetFile, finalText, append);
            if (statusLine) {
                statusLine.textContent = jobRecord.cancelRequested
                    ? `[job ${jobId}] Local AI response cancelled`
                    : `[job ${jobId}] Local AI response written to ${targetFile}`;
            }
            return;
        }

        if (statusLine) {
            statusLine.textContent = jobRecord.cancelRequested
                ? `[job ${jobId}] Local AI response cancelled`
                : `[job ${jobId}] Local AI response ready`;
        }
        if (aiLine) {
            aiLine.textContent = finalText;
        } else {
            window.addTerminalLine(finalText, "ai-response");
        }
    } catch (error) {
        jobRecord.status = "failed";
        const message = error?.message || "Local AI failed.";
        if (statusLine) {
            statusLine.textContent = `[job ${jobId}] Local AI failed: ${message}`;
        } else {
            window.addTerminalLine(`[job ${jobId}] Local AI failed: ${message}`, "muted");
        }
    } finally {
        terminalJobs.delete(jobId);
    }
}

function getLocalAICapabilitiesText() {
    return [
        "Local AI CLI controls:",
        "  ai status             show service, model, and runtime state",
        "  ai models             list available local/cloud models",
        "  ai use <name|number>  select a model (stops the current loaded model)",
        "  ai on                 enable the selected model",
        "  ai cancel             cancel the active answer but keep the model loaded",
        "  ai off                stop the service and release the model",
        "  ai settings           open Settings > Local AI",
        "  ai <question>         ask in a background job",
        "  jobs                  list active background jobs",
        "  kill [%job]           cancel a background job"
    ].join("\n");
}

function isCliCapabilitiesQuestion(value) {
    const text = String(value || "").toLowerCase();
    return /what can you do|what.*commands|available commands|(?:cli|terminal).*(?:help|capabilit)|capabilit.*(?:cli|terminal)/.test(text);
}

function formatLocalAIStatus() {
    const status = window.LocalAI.getStatus();
    const lines = [
        `State:   ${status.status}`,
        `Model:   ${status.modelLabel}`,
        `Runtime: ${status.executionMode}`,
        `Detail:  ${status.statusText}`
    ];
    if (status.memoryMB) lines.splice(3, 0, `Memory:  ~${status.memoryMB} MB`);
    if (status.modelNote) lines.push(`Note:    ${status.modelNote}`);
    if (status.status === "generating") lines.push("Control: ai cancel");
    return lines.join("\n");
}

function getLocalAIModelsText() {
    const models = window.LocalAI.getAvailableModels?.() || [];
    const selectedId = window.LocalAI.getSelectedModelId?.();
    if (!models.length) return "No AI models are available in this profile.";

    return models.map((model, index) => {
        const marker = model.id === selectedId ? "*" : " ";
        const runtime = model.type?.startsWith("cloud-") ? "cloud" : `${model.memoryMB} MB`;
        return `${marker} ${String(index + 1).padStart(2)}  ${model.label} [${runtime}]`;
    }).join("\n") + "\nUse: ai use <number or model name>";
}

function normalizeAIModelSearch(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/q\d+f\d+(?:_\d+)?/g, " ")
        .replace(/\bmlc\b/g, " ")
        .replace(/[^a-z0-9.]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveLocalAIModel(query) {
    const models = window.LocalAI.getAvailableModels?.() || [];
    const rawQuery = String(query || "").trim();
    const numericIndex = Number.parseInt(rawQuery, 10);
    if (/^\d+$/.test(rawQuery) && models[numericIndex - 1]) {
        return { model: models[numericIndex - 1], matches: [] };
    }

    const aliases = {
        "smol 360m": "SmolLM2-360M-Instruct-q4f16_1-MLC",
        "smollm2 360m": "SmolLM2-360M-Instruct-q4f16_1-MLC",
        "qwen 0.5b": "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
        "llama 1b": "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        "gemma 1b": "gemma-3-1b-it-q4f16_1-MLC",
        "gemma 2 2b": "gemma-2-2b-it-q4f16_1-MLC"
    };
    const normalizedQuery = normalizeAIModelSearch(rawQuery);
    const aliasId = aliases[normalizedQuery];
    const exact = models.find((model) => model.id.toLowerCase() === rawQuery.toLowerCase())
        || models.find((model) => normalizeAIModelSearch(model.label) === normalizedQuery)
        || models.find((model) => model.id === aliasId);
    if (exact) return { model: exact, matches: [] };

    const matches = models.filter((model) => {
        const searchable = `${normalizeAIModelSearch(model.label)} ${normalizeAIModelSearch(model.id)}`;
        return normalizedQuery && searchable.includes(normalizedQuery);
    });
    return { model: matches.length === 1 ? matches[0] : null, matches };
}

async function runLocalAICommand(args) {
    if (!window.LocalAI) {
        return "Local AI service is unavailable.";
    }

    const subcommand = (args[0] || "").toLowerCase();
    if (!subcommand || subcommand === "status" || subcommand === "info") return formatLocalAIStatus();

    if (subcommand === "help" || subcommand === "commands" || subcommand === "capabilities") {
        return getLocalAICapabilitiesText();
    }

    if (subcommand === "models" || subcommand === "list") return getLocalAIModelsText();

    if (subcommand === "settings" || subcommand === "config" || subcommand === "configure") {
        if (window.openDesktopWindow) {
            await Promise.resolve(window.openDesktopWindow("settings"));
            window.openSettingsPanel?.("local-ai");
        }
        return "Opened Settings > Local AI.";
    }

    if (subcommand === "use" || subcommand === "model") {
        const query = args.slice(1).join(" ");
        if (!query) return "Usage: ai use <model number or name>. Run 'ai models' first.";
        const status = window.LocalAI.getStatus();
        if (status.busy) return "Local AI is busy. Run 'ai cancel' before changing models.";

        const resolved = resolveLocalAIModel(query);
        if (!resolved.model) {
            if (resolved.matches.length > 1) {
                return `Model name is ambiguous: ${resolved.matches.map((model) => model.label).join(", ")}`;
            }
            return `No available AI model matched "${query}". Run 'ai models' to list choices.`;
        }

        const nextStatus = window.LocalAI.setSelectedModelId(resolved.model.id);
        return `Selected ${nextStatus.modelLabel}. Run 'ai on' to enable it.`;
    }

    if (subcommand === "on" || subcommand === "enable" || subcommand === "start") {
        const status = window.LocalAI.getStatus();
        if (status.status === "generating") return "Local AI is already enabled and answering. Run 'ai cancel' to interrupt it.";
        if (status.ready) return `${status.modelLabel} is already ready.`;
        const nextStatus = await window.LocalAI.enable("Portfolio CLI");
        return nextStatus.ready ? `${nextStatus.modelLabel} is ready.` : "Local AI startup was cancelled.";
    }

    if (subcommand === "cancel" || subcommand === "interrupt") {
        return cancelTerminalJob(args[1]);
    }

    if (subcommand === "stop" && window.LocalAI.getStatus().status === "generating") {
        return cancelTerminalJob(args[1]);
    }

    if (subcommand === "off" || subcommand === "disable" || subcommand === "stop") {
        await window.LocalAI.disable("cli");
        return "Local AI stopped and its loaded model was released.";
    }

    const questionText = args.join(" ");
    if (isCliCapabilitiesQuestion(questionText)) return getLocalAICapabilitiesText();

    const status = window.LocalAI.getStatus();
    if (status.status === "generating") {
        return "Local AI is already answering in a background job. Run 'jobs' or 'ai cancel'.";
    }

    if (!window.LocalAI.isReady()) {
        const question = questionText;
        if (question && window.SimpleBrain) {
            const answer = window.SimpleBrain.query(question);
            if (answer) return answer;
        }
        return "Local/Cloud AI is disabled. Run 'ai on', or use 'ai settings' to configure it.";
    }
    
    // Check if the query asks for system actions (open app, close app, speak, toast)
    // If so, redirect it directly to Lobe (the mascot) to execute agentically.
    if (window.BrainHelper && (
        questionText.toLowerCase().includes("open ") || 
        questionText.toLowerCase().includes("close ") || 
        questionText.toLowerCase().includes("say ") || 
        questionText.toLowerCase().includes("speak ") || 
        questionText.toLowerCase().includes("notify ") ||
        questionText.toLowerCase().includes("toast ")
    )) {
        window.BrainHelper.ask(questionText);
        return "Redirecting action request to Lobe mascot helper...";
    }

    return createLocalAIChatJob(questionText, {
        user: currentUser,
        cwd: currentDir,
        mode: "cli"
    });
}

function isPrivateDesktopProfile() {
    return (window.getCurrentUser ? window.getCurrentUser()?.id : window.state?.currentUserId) === "private";
}

function getCliHelpText() {
    if (!isPrivateDesktopProfile()) return window.cliCommands.help;
    return [
        "Commands:",
        "  whoami          current shell user",
        "  whoami --info   private profile summary",
        "  projects        list available private-profile nodes",
        "  inspect <id>    print an available dossier",
        "  quick           open direct review mode",
        "  play / doom     open Doom engine loader",
        "  workstation     focus desktop workspace",
        "  links           private profile link policy",
        "  status          available system status",
        "  open <target>   open available public targets",
        "  clear           clear terminal"
    ].join("\n");
}

function getCliProfileSummary() {
    if (!isPrivateDesktopProfile()) return window.cliCommands.whoami;
    return "Private User - synced PortfoliOS profile with owner-specific project nodes, personal links, and local lab shortcuts removed.";
}

function getCliLinks() {
    if (!isPrivateDesktopProfile()) return window.cliCommands.links;
    return "Private profile mode does not expose owner contact links. Use the Store to install apps or open hosted services.";
}

function getVisibleCliSystems() {
    return window.getVisibleSystems ? window.getVisibleSystems() : (window.systems || []);
}

function isCliSystemVisible(id) {
    return !window.isVisibleForCurrentUser || window.isVisibleForCurrentUser(id);
}

// Core execution engine
async function executeCommand(command, args, raw) {
    if (command === "clear") {
        const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
        if (output) output.innerHTML = "";
        return;
    }

    if (command === "help") {
        return [
            getCliHelpText(),
            "",
            "Kernel System commands:",
            "  su [user]       switch active user session",
            "  passwd [user]   change account password",
            "  useradd <user>  add a new user (requires root)",
            "  userdel <user>  delete a user (requires root)",
            "  groups [user]   show group memberships",
            "  id [user]       show UID, GID and groups information",
            "  pwd             print current working directory",
            "  cd [path]       change directory (supports relative, absolute, ~)",
            "  ls [-l] [path]  list directory contents with permission layout",
            "  cat <file>      display file contents",
            "  touch <file>    create an empty file or update timestamp",
            "  mkdir <dir>     create a directory",
            "  rm [-rf] <path> delete file or directory recursively",
            "  echo <text>     print text (redirect with > or >> to files)",
            "  ai <command|text> manage or talk to the Local AI assistant",
            "  jobs            list active background jobs",
            "  kill [%job]     cancel a background job",
            isPrivateDesktopProfile()
                ? "  whoami --info   print private profile summary"
                : "  whoami --info   print Alex's developer profile summary"
        ].join("\n");
    }

    if (command === "whoami") {
        if (args.includes("--profile") || args.includes("-p") || args.includes("--info") || args.includes("--profile-summary")) {
            return getCliProfileSummary();
        }
        return currentUser;
    }

    if (command === "whois" || command === "profile") {
        return getCliProfileSummary();
    }

    if (command === "links") {
        return getCliLinks();
    }

    if (command === "projects") {
        const systems = getVisibleCliSystems();
        return systems.map((item) => `${item.id.padEnd(12)} ${item.status.padEnd(8)} ${item.title}`).join("\n");
    }

    if (command === "status") {
        const systems = getVisibleCliSystems().filter((item) => !item.mobileOnly);
        return systems.length
            ? systems.map((item) => `${item.id.padEnd(14)} ${item.status.padEnd(8)} ${item.title}`).join("\n")
            : "No visible system nodes in this profile.";
    }

    if (command === "quick") {
        if (window.switchView) window.switchView("quick");
        return "Quick Review opened.";
    }

    if (command === "play" || command === "doom" || command === "doomsource") {
        if (window.isAppInstalled && !window.isAppInstalled("doomsource")) {
            return "Error: Doom is not installed. Launch the Store from the desktop to install it.";
        }
        if (window.switchView) window.switchView("desktop");
        if (window.renderDossier) window.renderDossier("doomsource");
        if (window.openDesktopWindow) window.openDesktopWindow("doomsource");
        return "Doom opened. W/S move, A/D strafe, Left/Right look. Q shoots. E opens doors.";
    }

    if (command === "openrct2" || command === "rct" || command === "rct2") {
        if (window.isAppInstalled && !window.isAppInstalled("openrct2")) {
            return "Error: OpenRCT2 is not installed. Launch the Store from the desktop to install it.";
        }
        if (window.switchView) window.switchView("desktop");
        if (window.renderDossier) window.renderDossier("openrct2");
        if (window.openDesktopWindow) window.openDesktopWindow("openrct2");
        return "OpenRCT2 runtime app opened.";
    }

    if (command === "linux" || command === "workstation") {
        if (window.switchView) window.switchView("desktop");
        if (command === "linux") {
            if (!isCliSystemVisible("linux")) return "Linux lab is not available in this profile.";
            if (window.openDesktopWindow) window.openDesktopWindow("linux");
            return "lab@bl4ut0 opened.";
        } else {
            if (!isPrivateDesktopProfile() && window.openDesktopWindow) window.openDesktopWindow("profile");
            return "Desktop workspace focused.";
        }
    }

    if (command === "inspect") {
        const target = args.join(" ");
        const item = window.systemById ? window.systemById(target) : null;
        if (!item || !isCliSystemVisible(item.id)) {
            return `No dossier found for "${target}". Try: projects`;
        }
        if (window.renderDossier) window.renderDossier(item.id);
        if (window.openDesktopWindow) window.openDesktopWindow("dossier");
        return [
            `# ${item.title}`,
            `${item.type} / ${item.status}`,
            "",
            item.summary,
            "",
            `Stack: ${item.tech.join(", ")}`,
            `Signal: ${item.signal}`
        ].join("\n");
    }

    if (command === "open") {
        const target = args.join(" ");
        if (isPrivateDesktopProfile() && target !== "doomsource") {
            return `Target "${target}" is unavailable in the private profile.`;
        }
        const openTargets = window.openTargets || {};
        const href = openTargets[target];
        if (!href) {
            return `Unknown target "${target}". Try: open devhub`;
        }
        window.open(href, "_blank", "noopener,noreferrer");
        return `Opening ${href}`;
    }

    // su
    if (command === "su") {
        await runSu(args[0]);
        return;
    }

    // passwd
    if (command === "passwd") {
        await runPasswd(args[0]);
        return;
    }

    // useradd
    if (command === "useradd" || command === "adduser") {
        await runUserAdd(args[0]);
        return;
    }

    // userdel
    if (command === "userdel") {
        return await runUserDel(args[0]);
    }

    // groups
    if (command === "groups") {
        return await runGroups(args[0]);
    }

    // id
    if (command === "id") {
        return await runId(args[0]);
    }

    // pwd
    if (command === "pwd") {
        return currentDir;
    }

    // cd
    if (command === "cd") {
        return await runCd(args[0]);
    }

    // ls
    if (command === "ls") {
        return await runLs(args);
    }

    // cat
    if (command === "cat") {
        return await runCat(args[0]);
    }

    // touch
    if (command === "touch") {
        return await runTouch(args[0]);
    }

    // mkdir
    if (command === "mkdir") {
        return await runMkdir(args[0]);
    }

    // rm
    if (command === "rm") {
        return await runRm(args);
    }

    // echo
    if (command === "echo") {
        return args.join(" ");
    }

    if (command === "jobs") {
        return formatTerminalJobs();
    }

    if (command === "kill") {
        return await cancelTerminalJob(args[0]);
    }

    if (command === "ai" || command === "assistant") {
        return await runLocalAICommand(args);
    }

    if (command === "lobe") {
        if (!window.BrainHelper) {
            return "Lobe mascot helper is not loaded.";
        }
        const action = (args[0] || "").toLowerCase();
        if (action === "show" || action === "open") {
            window.BrainHelper.show();
            return "Lobe mascot helper displayed.";
        }
        if (action === "hide" || action === "close") {
            window.BrainHelper.hide();
            return "Lobe mascot helper hidden.";
        }
        if (action === "ask" || action === "chat") {
            const promptText = args.slice(1).join(" ");
            if (!promptText) return "Usage: lobe ask <prompt>";
            window.BrainHelper.ask(promptText);
            return `Passing query to Lobe mascot: "${promptText}"`;
        }
        // Default: toggle bubble visibility
        window.BrainHelper.show();
        window.BrainHelper.openBubble();
        return "Lobe helper opened.";
    }

    if (isCliCapabilitiesQuestion(raw)) {
        return getLocalAICapabilitiesText();
    }

    const localAIStatus = window.LocalAI?.getStatus?.();
    if (localAIStatus?.status === "generating") {
        return "Local AI is already answering in a background job. Run 'jobs' or 'ai cancel'.";
    }

    if (window.LocalAI?.isReady?.()) {
        return createLocalAIChatJob(`The user entered this PortfoliOS CLI input: ${raw}`, {
            user: currentUser,
            cwd: currentDir,
            mode: "cli" // Bypass agent loop
        });
    }

    // Intercept with SimpleBrain before command-not-found
    if (window.SimpleBrain) {
        const simpleAnswer = window.SimpleBrain.query(raw);
        if (simpleAnswer) return simpleAnswer;
    }

    return `${command || raw}: command not found. You can run 'ai on' or enable a higher-tier model in the AI app to handle more complicated information requests.`;
}

// Public handleCommand wrapper
window.handleCommand = async (rawValue) => {
    const raw = rawValue.trim();
    if (!raw) return;

    // Command history setup
    if (history.length === 0 || history[history.length - 1] !== raw) {
        history.push(raw);
    }
    historyIndex = -1;

    // Format output command echo with standard prompt styling
    const userColor = currentUser === "root" ? "color: var(--rose)" : "color: var(--theme-accent)";
    const pathColor = "color: var(--blue)";
    const isRoot = currentUser === "root";
    const promptChar = isRoot ? "#" : "$";

    let displayDir = currentDir;
    const userHome = userDirMap[currentUser]?.home || (isRoot ? "/root" : `/home/${currentUser}`);
    if (currentDir === userHome) {
        displayDir = "~";
    } else if (currentDir.startsWith(userHome + "/")) {
        displayDir = "~" + currentDir.slice(userHome.length);
    }

    let displayUser = currentUser;
    if (currentUser === "bl4ut0") {
        displayUser = "Bl4ut0";
    } else if (currentUser === "private") {
        const privateUser = window.getCurrentUser ? window.getCurrentUser() : null;
        displayUser = privateUser?.handle || "private";
    }

    const promptPrefixHtml = `<span style="${userColor}; font-weight: bold;">${escapeHtml(displayUser)}@portfoliOS</span>:<span style="${pathColor}; font-weight: bold;">${escapeHtml(displayDir)}</span>${promptChar} `;
    const displayHtml = `${promptPrefixHtml}${escapeHtml(raw)}`;

    window.addTerminalLine(displayHtml, "command", true);

    // Parsing redirects
    const { commandPart, targetFile, append } = parseCommandLine(raw);
    const args = parseArgs(commandPart);
    const command = args[0]?.toLowerCase();
    const cmdArgs = args.slice(1);

    try {
        const result = await executeCommand(command, cmdArgs, commandPart);
        if (result !== undefined) {
            if (isTerminalAsyncJob(result)) {
                startTerminalAsyncJob(result, targetFile, append);
                return;
            }
            if (targetFile) {
                await handleRedirection(targetFile, result, append);
            } else {
                window.addTerminalLine(result);
            }
        }
    } catch (e) {
        window.addTerminalLine(`Error executing command: ${e.message}`, "muted");
    }
};

window.streamTextToTerminal = (text, className = "ai-response") => {
    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
    if (!output) return;

    const container = document.createElement("div");
    container.className = `terminal-line ${className}`.trim();
    output.appendChild(container);

    container.innerHTML = `<span class="ai-thinking">Thinking...</span>`;
    output.scrollTop = output.scrollHeight;

    setTimeout(() => {
        container.innerHTML = "";
        let index = 0;
        function tick() {
            const currentText = text.slice(0, index)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            container.innerHTML = currentText + '<span class="ai-cursor"></span>';
            output.scrollTop = output.scrollHeight;
            index += 2; // Type 2 characters at a time for snappier delivery
            if (index <= text.length + 1) {
                window.setTimeout(tick, 2 + Math.random() * 3); // Faster pacing
            } else {
                container.innerHTML = text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br>');
            }
        }
        tick();
    }, 100 + Math.random() * 100); // Sub-200ms initial response time
};



window.addTerminalLine = (text, className = "", isHtml = false) => {
    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
    if (!output) return;

    const line = document.createElement("p");
    line.className = `terminal-line ${className}`.trim();
    if (isHtml) {
        line.innerHTML = text;
    } else {
        line.textContent = text;
    }
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
    return line;
};

window.typeTerminalLine = (text, className = "", speed = 7) => {
    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
    if (!output) return;

    const line = document.createElement("p");
    line.className = `terminal-line ${className}`.trim();
    output.appendChild(line);

    let index = 0;
    function tick() {
        line.textContent = text.slice(0, index);
        output.scrollTop = output.scrollHeight;
        index += 1;
        if (index <= text.length) {
            window.setTimeout(tick, speed);
        }
    }
    tick();
};

window.asciiMotd = `
<pre class="cli-motd" style="color: var(--theme-primary); font-size: 0.65rem; line-height: 1.0; margin-bottom: 1rem; overflow-x: auto;">
██████╗  ██████╗ ██████╗ ████████╗███████╗ ██████╗ ██╗     ██╗ ██████╗ ███████╗
██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██╔═══██╗██║     ██║██╔═══██╗██╔════╝
██████╔╝██║   ██║██████╔╝   ██║   █████╗  ██║   ██║██║     ██║██║   ██║███████╗
██╔═══╝ ██║   ██║██╔══██╗   ██║   ██╔══╝  ██║   ██║██║     ██║██║   ██║╚════██║
██║     ╚██████╔╝██║  ██║   ██║   ██║     ╚██████╔╝███████╗██║╚██████╔╝███████║
╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝ ╚══════╝╚═╝ ╚═════╝ ╚══════╝
</pre>
<div style="margin-bottom: 0.5rem">System: <strong style="color: var(--text)">PortfoliOS v1.0.0</strong> (x86_64-browser)</div>
<div style="margin-bottom: 1rem">Access Level: <strong style="color: var(--theme-accent)">GUEST</strong></div>
<div style="color: var(--text-soft)">Type <strong style="color: var(--theme-primary)">help</strong> for system commands, or run <strong style="color: var(--theme-primary)">ai on</strong> to enable local command guidance.</div>
<br/>
`;

window.startCliIntro = () => {
    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
    if (!output) return;

    output.innerHTML = window.asciiMotd;
    let delay = 120;

    const cliIntroLines = isPrivateDesktopProfile() ? [
        ["POST OK / loading private.cli", "muted"],
        ["mount /experience/desktop /apps/store /apps/files /apps/cli", "muted"],
        ["PortfoliOS private shell ready.", ""],
        [getCliHelpText(), "muted"]
    ] : (window.cliIntroLines || []);
    cliIntroLines.forEach(([text, className]) => {
        window.setTimeout(() => window.typeTerminalLine(text, className), delay);
        delay += Math.min(1800, 220 + text.length * 7);
    });
};

// Form submission handler
document.addEventListener("submit", (event) => {
    if (event.target.id === "terminal-form") {
        event.preventDefault();
        const input = window.byId ? window.byId("terminal-input") : document.getElementById("terminal-input");
        if (!input) return;
        const val = input.value;
        input.value = "";

        if (activePrompt) {
            if (activePrompt.isPassword) {
                window.addTerminalLine(activePrompt.label, "command");
            } else {
                window.addTerminalLine(`${activePrompt.label}${val}`, "command");
            }

            const cb = activePrompt.callback;
            activePrompt = null;

            updatePrompt();
            input.type = "text";
            cb(val);
        } else {
            window.handleCommand(val);
        }
    }
});

// Initialize CLI Session
async function initCli() {
    try {
        const users = await loadUsers();
        await ensureUserHomeDirectories(users);

        // Initialize based on signed-in desktop user
        const systemUser = window.getCurrentUser ? window.getCurrentUser()?.id : null;
        if (systemUser && users[systemUser]) {
            currentUser = systemUser;
            currentDir = users[systemUser].home || `/home/${systemUser}`;
        }
    } catch (e) {
        console.error("Failed to load users DB or home directories:", e);
    }
    window.initializeCliWindow();
}

window.initializeCliWindow = () => {
    updatePrompt();
    setupHistory();
};

// Listen for user changes on the desktop to automatically update the CLI user session
if (window.EventBus) {
    window.EventBus.on("user:changed", (user) => {
        if (user && userDirMap && userDirMap[user.id]) {
            currentUser = user.id;
            currentDir = userDirMap[user.id].home || `/home/${user.id}`;
            updatePrompt();
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCli);
} else {
    initCli();
}
