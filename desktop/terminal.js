/**
 * PortfoliOS: CLI Terminal Component
 * Handles parsing CLI commands, rendering outputs, and simulating streaming AI responses.
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
    try {
        const file = await window.SystemFS.readFile("/etc/users.json");
        if (file && file.data) {
            const users = JSON.parse(file.data);
            userDirMap = {};
            for (const username in users) {
                userDirMap[username] = users[username];
            }
            return users;
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
        }
    };

    try {
        await window.SystemFS.ensureDirectory("/etc", { silent: true });
        await window.SystemFS.writeFile("/etc/users.json", "users.json", "/etc", JSON.stringify(defaultUsers, null, 2), undefined, "application/json", false, { silent: true });
    } catch (e) {
        console.error("Failed to initialize default users:", e);
    }

    userDirMap = defaultUsers;
    return defaultUsers;
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

    promptEl.innerHTML = `<span style="color: ${userColor}; font-weight: bold;">${escapeHtml(user)}@portfolios</span>:<span style="color: ${pathColor}; font-weight: bold;">${escapeHtml(displayDir)}</span>${promptChar}&nbsp;`;
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
    if (!inputEl) {
        setTimeout(setupHistory, 100);
        return;
    }

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
    if (typeof str !== "string") return "";
    return str
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

// Core execution engine
async function executeCommand(command, args, raw) {
    if (command === "clear") {
        const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
        if (output) output.innerHTML = "";
        return;
    }

    if (command === "help") {
        return [
            window.cliCommands.help,
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
            "  whoami --info   print Alex's developer profile summary"
        ].join("\n");
    }

    if (command === "whoami") {
        if (args.includes("--profile") || args.includes("-p") || args.includes("--info") || args.includes("--profile-summary")) {
            return window.cliCommands.whoami;
        }
        return currentUser;
    }

    if (command === "whois" || command === "profile") {
        return window.cliCommands.whoami;
    }

    if (command === "links") {
        return window.cliCommands.links;
    }

    if (command === "projects") {
        const systems = window.systems || [];
        return systems.map((item) => `${item.id.padEnd(12)} ${item.status.padEnd(8)} ${item.title}`).join("\n");
    }

    if (command === "status") {
        return [
            "public-site    online   bl4ut0.dev",
            "guildcraft     dev      dev.guildcraft.io",
            "doomsource     playable Doom WAD loader",
            "status-console planned  local module",
            "wardenit       planned  professional node"
        ].join("\n");
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

    if (command === "linux" || command === "workstation") {
        if (window.switchView) window.switchView("desktop");
        if (command === "linux") {
            if (window.openDesktopWindow) window.openDesktopWindow("linux");
            return "lab@bl4ut0 opened.";
        } else {
            if (window.openDesktopWindow) window.openDesktopWindow("profile");
            return "Desktop workspace focused.";
        }
    }

    if (command === "inspect") {
        const target = args.join(" ");
        const item = window.systemById ? window.systemById(target) : null;
        if (!item) {
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

    // Fallback: AI Assistant response
    window.simulateAiResponse(raw);
    return;
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

    const promptPrefixHtml = `<span style="${userColor}; font-weight: bold;">${escapeHtml(currentUser)}@portfolios</span>:<span style="${pathColor}; font-weight: bold;">${escapeHtml(displayDir)}</span>${promptChar} `;
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
            index += 1;
            if (index <= text.length) {
                window.setTimeout(tick, 10 + Math.random() * 15);
            } else {
                container.innerHTML = currentText;
            }
        }
        tick();
    }, 400 + Math.random() * 600);
};

window.simulateAiResponse = (query) => {
    const lower = query.toLowerCase();
    let response = "I'm a simulated AI assistant for PortfoliOS. Try asking about **projects**, **skills**, or my **purpose**.";

    if (lower.includes("who") || lower.includes("about") || lower.includes("yourself")) {
        response = "I am a simulated assistant built into **PortfoliOS**. I can tell you about Alex (Bl4ut0), an infrastructure operator and systems builder focused on connecting self-hosted tools and gaming ecosystems.";
    } else if (lower.includes("project") || lower.includes("portfolio") || lower.includes("built")) {
        response = "There are several active nodes in the portfolio:\n**Bl4ut0.dev** - The main dev portal.\n**GuildCraft** - A gaming community platform.\n**DOOM Source** - An embedded WASM Doom engine.\nType `projects` or `status` to see standard system lists.";
    } else if (lower.includes("skill") || lower.includes("tech") || lower.includes("stack") || lower.includes("experience")) {
        response = "Core skills include:\n- **Infrastructure**: Linux, Proxmox, Docker, Cloudflare\n- **Development**: Node.js, Lua (WoW), React, Python\n- **Operations**: Self-hosting, homelab automation, system administration";
    } else if (lower.includes("contact") || lower.includes("discord") || lower.includes("github")) {
        response = "You can find Alex on:\n- **GitHub**: github.com/Bl4ut0\n- **Discord**: discord.gg/fEwanmFR9m\nType `links` for a full directory.";
    } else if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
        response = "Hello! I'm the PortfoliOS Assistant. How can I help you navigate the system today?";
    } else if (lower.includes("doom") || lower.includes("game") || lower.includes("play")) {
        response = "Ah, DOOM. You can play it right here in the browser. Just type `play doom` to launch the engine.";
    } else if (lower.includes("clear")) {
        response = "Type `clear` as a raw command to clear the terminal screen.";
    } else if (lower.includes("joke") || lower.includes("funny")) {
        response = "Why do programmers prefer dark mode?\nBecause light attracts bugs.";
    }

    window.streamTextToTerminal(response);
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
<div style="color: var(--text-soft)">Type <strong style="color: var(--theme-primary)">help</strong> for system commands, or type natural language to chat with the AI assistant.</div>
<br/>
`;

window.startCliIntro = () => {
    const output = window.byId ? window.byId("terminal-output") : document.getElementById("terminal-output");
    if (!output) return;

    output.innerHTML = window.asciiMotd;
    let delay = 120;

    const cliIntroLines = window.cliIntroLines || [];
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
    } catch (e) {
        console.error("Failed to load users DB or home directories:", e);
    }
    updatePrompt();
    setupHistory();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCli);
} else {
    initCli();
}
