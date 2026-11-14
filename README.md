# Bl4ut0 Portfolio OS

Client-first Experience OS & browser-native developer workspace: a personal operating environment connecting dev hubs, projects, homelab infrastructure, community resources, professional identity, and cloud services through Desktop, Mobile, Quick, and CLI interfaces.

The shell executes entirely in each visitor's browser. Server-side endpoints assist with optional auth relays and storage sync, but all window management, terminal execution, virtual filesystems, and cryptographic keys run locally on the client without streamed VM machines.

---

## Platform Strategy & Delivery Milestones

> **Desktop 1st, Mobile 2nd (Mobile Last)**
>
> PortfoliOS follows a strict **Desktop-First** architectural delivery model. The **Desktop platform is the primary milestone target** where the complete windowed operating environment, Root `/` POSIX virtual filesystem, user-space Linux x86_64 syscall translation, Zero-Knowledge Keyring Vault, terminal developer toolchain, and creative WASM engines are built, validated, and hardened.
>
> The **Mobile platform is secondary and delivered last in all milestone sequences**. Mobile remains an independent, lightweight touch companion that shares core services (SystemFS, identity, media, sync) with Desktop, but all primary feature development, runtime capabilities, and system enhancements land and stabilize on Desktop before mobile touch adaptations, mobile parity, and viewport passes are scheduled.

---

## Structured Access System

PortfoliOS incorporates a browser-native **Structured Access System** that bridges POSIX system semantics with web isolation:

1. **Root `/` POSIX Virtual Filesystem**:
   - The virtual filesystem mounts full root `/`, providing standard POSIX hierarchies: `/`, `/home/<user>`, `/usr/local/bin`, `/etc`, `/tmp`, and `/documents`.
   - Strict path normalization blocks directory traversal escapes above root `/`.
   - Full persistence through IndexedDB (`SystemFS`) with profile isolation.

2. **User-Space Linux x86_64 POSIX Syscall Translation Table**:
   - Implemented in user-space (`posix-syscall-table.js`) without requiring heavy Linux container images, VM emulators, or secondary OS loaders.
   - Defines syscall connector mappings; this does not establish real Linux binary/CLI execution:
     - **File I/O**: `sys_open`, `sys_openat`, `sys_read`, `sys_write`, `sys_close`, `sys_stat`, `sys_fstat`, `sys_lstat`, `sys_lseek`, `sys_getdents64`, `sys_mkdir`, `sys_unlink` -> mapped to SystemFS Root `/`.
     - **Networking**: `sys_socket`, `sys_connect`, `sys_sendto`, `sys_recvfrom` -> mapped to native TCP/UDP sockets via Native Relay.
     - **TTY/PTY Control**: `sys_ioctl` (`TIOCGWINSZ`, `TCGETS`, `TCSETS`) -> mapped to PTY controller with ANSI stream formatting and OAuth detection.
     - **Memory**: `sys_brk`, `sys_mmap` -> mapped to WebAssembly linear memory.

3. **Encrypted saved tool logins**:
   - The OS credential broker persists account records and explicit subsystem links only inside profile-scoped `/documents/vault.enc`.
   - AES-256-GCM uses a fresh IV per save; PBKDF2-HMAC-SHA512 derives an in-memory key at 600,000 rounds. Reload/profile changes lock access without deleting saved accounts.
   - Desktop Settings → Saved Logins imports an existing Codex login JSON directly into encrypted storage. Multiple accounts and shared consumers are supported; unused removal is explicit.
   - This storage milestone does not complete native CLI execution, live sign-in/refresh or cross-device recovery. See [the vault contract and remaining gates](docs/VAULT_AUTH.md).

4. **Git credential connector**:
   - The seeded `git-credential-portfolios` entry is a placeholder for scoped native Git integration. Manual execution refuses to print secrets into terminal output; native Git HTTPS authentication is not yet certified.

5. **Windows Native Messaging Relay (`PortfoliOS-NativeRelay`)**:
   - Companion Chrome/Firefox extension and lightweight Windows native messaging host (`PortfoliOS-NativeRelay.msi`).
   - Unlocks raw duplex TCP and UDP network sockets directly from browser WebAssembly runtimes, powering web multiplayer (UT99), CLI network requests, and external dev servers.

---

## Shared Design and Agent Decisions

The workspace's common standards are maintained in [PortfoliOS-Orchestration](https://github.com/Bl4ut0/PortfoliOS-Orchestration). Start with its [agent instructions](https://github.com/Bl4ut0/PortfoliOS-Orchestration/blob/main/AGENTS.md) and [core documentation index](https://github.com/Bl4ut0/PortfoliOS-Orchestration/blob/main/docs/core/README.md). This repository retains implementation contracts, runtime source, audits, and its release roadmap.

## Repositories and Portable References

- Canonical OS: [Bl4ut0/PortfoliOS](https://github.com/Bl4ut0/PortfoliOS)
- Shared Orchestration: [Bl4ut0/PortfoliOS-Orchestration](https://github.com/Bl4ut0/PortfoliOS-Orchestration)
- Browser Engine: [Bl4ut0/PortfoliOS-Browser.JS](https://github.com/Bl4ut0/PortfoliOS-Browser.JS)
- Runtime Layer: [Bl4ut0/PortfoliOS-Runtime](https://github.com/Bl4ut0/PortfoliOS-Runtime)

Use repository-relative links within this repository and full GitHub URLs when referencing another repository. Do not use local contributor drive letters, user-home paths, or file URLs in documentation.

Clone into a directory of your choice:

```sh
git clone https://github.com/Bl4ut0/PortfoliOS.git
cd PortfoliOS
```

---

## Directory Structure

* **[core/](core/)**: Core system services:
  * **[credential-vault.js](core/credential-vault.js)**: Encrypted account records, saved subsystem links and revocable access; [contract](docs/VAULT_AUTH.md).
  * **[runtime-bridge.js](core/runtime-bridge.js)**: Secondary connector adapter, POSIX Root `/` VFS bridge, PTY controller, process harness, Zero-Knowledge Keyring Vault, and Git credential helper.
  * **[cloud-auth.js](core/cloud-auth.js)** & **[cloud-sync.js](core/cloud-sync.js)**: Unified cloud authentication and sync drivers (Google Drive & Microsoft OneDrive).
  * **[filesystem.js](core/filesystem.js)**: Virtual File System (`SystemFS`) backed by IndexedDB with root `/` hierarchy.
  * **[gdrive-sync.js](core/gdrive-sync.js)**: Google Drive sync provider enforcing client-side encrypted `/documents/vault.enc` sync and blocking unencrypted `/etc`.
  * **[security-service.js](core/security-service.js)**: SecurityKernel local scanning, executable quarantine, and token isolation.
  * **[event-bus.js](core/event-bus.js)**, **[state.js](core/state.js)**, **[app-framework.js](core/app-framework.js)**, **[app-loader.js](core/app-loader.js)**, **[preferences.js](core/preferences.js)**.
* **[desktop/](desktop/)**: Desktop UI components, workspace markup, and window management:
  * **[workspace.html](desktop/workspace.html)**: Complete desktop DOM structure, Start launcher, taskbar, settings, and Zero-Knowledge Vault modal.
  * **[terminal.js](desktop/terminal.js)**: Linux terminal emulator, POSIX command executors (`apt`, `curl`, `wget`, `sh`, `npm`, `vault`, `codex`, `agy`, `claude`, `xai`).
  * **[settings.js](desktop/settings.js)**: Desktop Settings app with Cloud Sync and Zero-Knowledge Keyring Vault management.
  * **[shell.js](desktop/shell.js)**, **[taskbar.js](desktop/taskbar.js)**, **[dossier.js](desktop/dossier.js)**.
* **[mobile/](mobile/)**: Independent mobile OS framework (Desktop 1st, Mobile 2nd). Mobile-optimized apps and launcher sharing core services.
* **[quick/](quick/)**: Split-screen quick search index layout.
* **[apps/](apps/)**: Complete modular desktop catalog (Office Document Editor, Code OSS, IPTV Player, Webamp, File Explorer, Task Manager, DoomSource, OpenRCT2, UT99).
* **[services/](services/)**:
  * **[native-relay/](services/native-relay/)**: Windows Native Messaging Host (`.msi`) and browser extension for raw TCP/UDP duplex networking.
* **[styles/](styles/)**: Segmented style sheets (`styles-v1.css`, `styles/components.css`, `styles/tokens.css`).
* **[main.js](main.js)** & **`index.html`**: Entry points and staged boot loaders.

---

## Test Locally

Run the complete app contract audit, cloud driver tests, and runtime bridge test suites:

```powershell
npm test
```

Serve locally with Python or any HTTP server:

```powershell
python -m http.server 4173
```

Open `http://localhost:4173`.

---

## Deployment

Build and deployment coordination lives in [PortfoliOS-Orchestration](https://github.com/Bl4ut0/PortfoliOS-Orchestration). Follow its [build and deployment guide](https://github.com/Bl4ut0/PortfoliOS-Orchestration/blob/main/docs/BUILD_AND_DEPLOY.md).

Compatibility commands from this repository:

```sh
npm run deploy:dry
npm run deploy
npm run deploy:full
```

---

## Zero-Knowledge Keyring & Vault Shell Commands

The `vault` command and Desktop Settings share the same encrypted broker:

* `vault init`, `vault unlock`, `vault lock`, `vault status`: Manage the passphrase and current access state.
* `vault accounts`, `vault list`: Manage saved accounts and subsystem links, or display metadata.
* `vault link <login-id> <subsystem>`, `vault unlink <subsystem>`: Select or disconnect one subsystem without deleting other users of that login.
* `vault remove <unused-login-id>`: Remove only an unreferenced saved login.
* `vault export`: Save a fresh encrypted checkpoint to `/documents/vault.enc`; this does not prove cloud upload.
* `vault migrate`: Explicitly migrate matching profile-owned legacy records after unlock.
* `vault purge`: Confirm deletion of this profile's encrypted file and revoke access. Other profiles and existing cloud recovery copies remain.

The passphrase unlock is required after reload; provider sign-in is repeated only when the actual provider requires it. See [storage, access control, tests and limitations](docs/VAULT_AUTH.md).

---

## Useful CLI Commands

* **Developer & AI**: `codex`, `agy`, `claude`, `xai`, `ai`, `git-credential-portfolios`
* **Keyring & Security**: `vault <init|status|lock|unlock|accounts|list|link|unlink|remove|migrate|export|purge>`
* **Package Management & System**: `apt <install|remove|update|list|search>`, `npm install -g <pkg>`
* **Network & Tools**: `curl <url>`, `wget <url>`, `chmod +x <file>`, `./<script>`, `sh <script>`, `which <cmd>`
* **POSIX File Navigation**: `ls`, `cd`, `pwd`, `cat`, `head`, `tail`, `grep`, `find`, `tree`, `stat`, `mkdir`, `rm`, `cp`, `mv`
* **Diagnostics**: `uname`, `neofetch`, `ps`, `df`, `free`, `uptime`, `env`, `sys`

---

## Experience Modes

- **Desktop (Priority 1)**: Full-fidelity windowed workspace with Start launcher, taskbar, system tray, Zero-Knowledge Keyring Vault modal, native terminal CLI toolchain, local AI, File Explorer, Code OSS, Office Document Editor, IPTV Player, Webamp player, and playable WASM engines (DOOM, OpenRCT2, UT99).
- **Mobile (Priority 2 / Last)**: Independent Android-styled browser companion with gesture navigation, notifications, quick-settings shade, lock screen, and touch-optimized apps. Prioritized after desktop milestones are verified.
- **Quick**: High-speed searchable portfolio index for visitors seeking immediate information.
- **CLI**: POSIX terminal shell providing the complete developer toolchain with root `/` access.

---

## Cloud Sync & Security Isolation

PortfoliOS supports dual cloud drivers: **Google Drive** and **Microsoft OneDrive**.

1. **Credential encryption**: The broker persists only encrypted `/documents/vault.enc`; no new plaintext keyring/home copy is created. Approved document backup can carry this ciphertext; `/etc` and hidden dotfiles remain excluded. This rule covers credentials, not encryption of every ordinary document.
2. **Local Security Center**: User imports and cloud restores are verified inside the browser before entering the workspace. Executables, scripts, and active documents undergo quarantine inspection without uploading files to third-party scanning services.
3. **Session Lease & Conflict Recovery**: Private profiles maintain a single active lease across devices with conflict resolution and tombstones for deleted files.

---

## Roadmap

Prioritized delivery order, acceptance criteria, and milestone progress are tracked in [ROADMAP.md](ROADMAP.md).
