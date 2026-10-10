# Bl4ut0 Portfolio OS

Client-first Experience OS concept: a personal operating environment that connects the dev hub, projects, homelab work, community resources, professional identity, and future public status pages through Desktop, Mobile, Quick, and CLI interfaces.

The shell runs independently in each visitor's browser. Server-side pieces can be added for data, status, PHP endpoints, or hosted assets, but the desktop/mobile/quick/CLI sessions are not shared streamed machines.

## Directory Structure

* **[core/](core/)**: Core system services (Reactive State proxy, EventBus, storage fallbacks, virtual SystemFS indexedDB, SecurityKernel, Google Drive sync, preferences loader, and app-loader).
* **[data/](data/)**: Shared static dataset arrays (portfolio project nodes, catalogs, settings, bookmarks).
* **[desktop/](desktop/)**: Desktop UI components and shell boot orchestration (start launcher, taskbar window mapping, snapping desktop icons, context menus, and custom WAD inspector).
* **[mobile/](mobile/)**: Independent mobile OS framework, lazy loader, lifecycle, app registry, and mobile-only app modules. It shares neutral data/services with Desktop but not the desktop app catalog or window framework.
* **[quick/](quick/)**: Split-screen quick search index layout.
* **[apps/](apps/)**: The complete modular desktop catalog. Every app owns its `apps/<id>/app.js` registration and `app.css` lifecycle surface. Includes Office Document Editor, IPTV Player, Webamp Player, File Explorer, Task Manager, DoomSource, OpenRCT2, and UT99.
* **[services/](services/)**: Backend proxy services (e.g. Node.js WebSocket-to-UDP relay service for UT99 web multiplayer).
* **[styles/](styles/)**: Segmented CSS stylesheet system imported globally via `styles-v1.css`.
* **[main.js](main.js)**: Entry point orchestrator bootstrapping the OS shell on DOM load.
* **`index.html`** - HTML shell plus inert templates used by migrated first-party apps; no catalog window is live-mounted at startup.
* `DOOM.WAD` can be placed in the web root for the DOOM route.

## Test Locally

Run the modular app contract and first-party syntax audit:

```powershell
node scripts/check-app-contracts.js
```

Open `index.html` directly in a browser for most shell work. Use a local server when testing same-origin assets such as `DOOM.WAD`.

Optional local server:

```powershell
cd "C:\Dev Projects\bl4ut0-portfolio-os"
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Deployment

You can deploy the site either by manually uploading the root files to your web server or by using the built-in automated FTP deployment script.

### 1. Automated FTP Deployment
The repository includes an automated upload tool (`deploy.js`) to sync local changes to the remote web server.

1. Create a `.env` file in the project root:
   ```env
   FTP_HOST=ftp.yourdomain.com
   FTP_USER=your_ftp_username
   FTP_PASS=your_ftp_password
   FTP_PORT=21
   FTP_SECURE=false
   FTP_REMOTE_DIR=/public_html
   ```
2. Run deployment commands:
   * **Quick Deploy** (uploads code, scripts, HTML/CSS, and small assets only):
     ```bash
     npm run deploy
     ```
   * **Full Deploy** (uploads everything including large game engines and WASM binaries):
     ```bash
     npm run deploy:full
     ```
   * **Dry Run** (simulates deployment without uploading):
     ```bash
     npm run deploy:dry
     ```

---

## Google Drive Sync Configuration

To allow visitors to connect their Google Drive and backup their filesystem:

1. **Google Cloud Console**: Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. **OAuth Client ID**: Create an OAuth 2.0 Web Application Client ID.
3. **Authorized Origins**: Under **Authorized JavaScript origins**, you **must** add:
   * Local address for testing: `http://localhost:8005` (or your local port).
   * Your production domain: `https://os.yourdomain.com`.
   * Do not add an authorized redirect URI for the current Google Identity Services popup-token flow.
4. **Client ID Input**: Configure this Client ID only in the **Cloud Sync** panel of the Settings app. Individual apps always save to local `SystemFS` and do not own cloud authentication or synchronization.
5. **Security Scopes**: The sync engine requires the `drive.file` scope. This is a secure scope that restricts the app's access to only read/write files that *this specific application* created.

## Local Security Center

PortfoliOS includes a default-installed **Security Center** app. It is a local-only policy scanner: user imports and Google Drive restores are inspected inside the browser before they enter the normal SystemFS workspace. No files are sent to PortfoliOS, VirusTotal, or another scanning service.

- Executables, scripts, WebAssembly modules, and active code are blocked from normal file imports.
- HTML and SVG files, large archives, and files larger than 64 MiB are placed in a local `.quarantine` area for review instead of being opened, synced, or served as normal workspace files.
- Accepted files receive a local SHA-256 integrity record and scanner metadata.
- Cloud Sync fails closed if the SecurityKernel is unavailable, and it scans files before upload and before restore.
- Cloud access tokens are memory-only. PortfoliOS stores connection metadata locally, never a raw Google bearer token, so users sign in again when a browser session ends.
- Local AI file tools are restricted from hidden authentication data, quarantine, app binaries, ROMs, and system configuration paths.

This is defence in depth, not a substitute for operating-system antivirus or a promise to detect every malware family. Browser code cannot protect against a compromised operating system or a browser extension/agent granted unrestricted access. The Security Center is intended to make untrusted synced content inert by default and to limit the impact of a compromised page session.

### Browser hardening

The document also enforces its baseline CSP and referrer policy with HTML metadata, so those protections remain active if an upstream CDN does not forward origin headers. The Apache security header policy provides MIME sniffing protection, frame restrictions, the same CSP baseline, referrer controls, and HSTS. If Cloudflare is in front of the host, configure Cloudflare's HSTS policy and response headers too; a Cloudflare setting can override an origin header. A future CSP tightening pass should externalize remaining inline scripts before adding a restrictive `script-src` directive.

## Useful CLI Commands

- `help`
- `whoami`
- `projects`
- `inspect homelab`
- `quick`
- `linux`
- `workstation`
- `play` or `doom`
- `links`
- `status`
- `open devhub`
- `ai` / `brain` / `model`

## Experience Modes

- Desktop is a windowed app shell with a Start launcher, running-app taskbar, minimize/maximize/close controls, calendar flyout, system tray AI assistant, mini browser, draggable/resizable windows, network map, Linux Lab, Office Document Editor, IPTV Player, Webamp player, and playable DOOM / OpenRCT2 / UT99 engines.
- Mobile is an independent Android-leaning browser OS with retained app tasks, Home/Back/Recents navigation, a notification and quick-settings shade, lock screen, mobile Settings, local Files/Documents/PDF/Gallery apps, persistent music playback, and explicit Desktop/Quick handoff.
- Quick is a direct searchable portfolio index for visitors who want the information without using the desktop, phone, or terminal surfaces.
- CLI is the terminal interface for the same nodes and public routes with integrated AI commands.

## Store Direction

The PortfoliOS Store is evolving into an app catalog with categories for games, hosted services, media, and productivity tools. Current service candidates include `https://tools.bl4ut0.com` and `https://pdf.bl4ut0.com`; both launch cleanly from the Store even when security headers prevent iframe embedding.

## Mobile Behavior

Mobile is a dedicated experience, not a responsive desktop theme. On phone-sized viewports it occupies the full dynamic viewport, respects safe-area insets, and hides the global shell chrome. The installable web manifest starts at `?view=mobile`; users can also enter browser fullscreen from Mobile Settings or the quick-settings shade. Apps use their own mobile catalog and UI modules while sharing neutral services such as SystemFS, volume, portfolio records, and the persistent media service.

## DOOM Engine Loader

The DOOM window runs a WebAssembly browser source port. Install `DOOM + DOOM II` or a classic Doom package from Steam for the classic data route. The large game named `DOOM` is the 2016 reboot and is not the IWAD source for this loader. Expected files are classic IWADs such as `DOOM.WAD`, `DOOM2.WAD`, `TNT.WAD`, or `PLUTONIA.WAD`.

The current loader checks for `./DOOM.WAD` and `/DOOM.WAD` from the same origin and can inspect a local WAD header in-browser without uploading it. Example local path found during testing: `C:\Program Files (x86)\Steam\steamapps\common\Ultimate Doom\base\DOOM.WAD`.

## Game Data & Asset Ownership Compliance

All game data files, WADs, MPQs, PAKs, audio/texture archives, and ROMs referenced during local development and testing were obtained from legitimate, legally owned user installations (e.g., Steam, GOG, or original retail media).

**Self-Hosting Requirement**: This repository contains web engine runners, WebAssembly source ports, and UI shells only. Commercial game data binaries are strictly excluded from git tracking via `.gitignore`. If you wish to host your own version of these playable web applications (such as DOOM, Quake, Diablo, Unreal Tournament 99, Duke Nukem 3D, or OpenRCT2), you will need to provide your own legally acquired game source files.

## Roadmap and review

See [ROADMAP.md](ROADMAP.md) for prioritized milestones and acceptance criteria, and [docs/PROJECT_REVIEW.md](docs/PROJECT_REVIEW.md) for review evidence and remaining work.

Next: reliable sync recovery/conflicts, account and backup controls, cross-device restore, WardenIT case studies, reproducible releases, and real public service health.

## Private sessions

Choosing Desktop or Mobile opens the shared account chooser. Continue with Bl4ut0's public profile, reconnect a remembered private Google profile, or sign in with another Google account. Google sign-in activates that account's private workspace and backs up its SystemFS files and preferences. Desktop and Mobile use the same profile registry. File and preference changes schedule automatic backup while connected.

Each Google account uses a stable subject ID, a separate SystemFS home, and a separate virtual documents/downloads/music/pictures/save workspace. App engine binaries and ROM installation files are shared device resources. Legacy private data is copied during the first account migration without deleting the original files.

Account identity remains remembered after reload, while cloud credentials stay in memory. Reconnect to resume Drive backup. Production uses auth/google.php as a popup endpoint with compatible COOP headers while the main game/AI shell remains isolated. The endpoint sends its own PHP response headers, with .htaccess as a fallback on Apache hosts.

For filesystem changes, serve the repo and open scripts/check-profile-filesystem.html. It uses a disposable test database to verify account isolation, recursive deletes, backup paths, and pending-save races.

Public Bl4ut0 sessions are disposable: each page reload clears public SystemFS documents, saves, ROM imports, installed-app selections, preferences, and desktop/mobile layout. Built-in portfolio apps and default welcome files remain. Private account files and preferences persist. Downloaded app runtime binaries remain as shared device caches; resetting public installation selections does not remove a private account’s cached apps.

### Switching back to the public profile

Open **Settings → Accounts** on Desktop, or **Settings → Account & Drive backup** on Mobile. **Save to Drive & switch to public** closes apps to flush drafts, saves profile preferences, completes the current account's backup, then enters Bl4ut0's public workspace. A failed backup keeps the private account active. **Switch to Bl4ut0 public profile** works offline and keeps private changes on the device. Switching is blocked during app installation, Google sign-in, or an existing backup. Choosing public does not forget the private account or delete its Drive backup.

### Mobile App Store and app parity

**Store** is available on the default Mobile Home and in All apps. Search or filter the catalog, open built-in apps, and add/remove ROM Player. The mobile catalog now has 23 native apps, including Lobe, Task Manager, Security Center, Identity, and Dossier. Mobile appearance and Home layout changes are included in automatic private-profile backup. Installation selections are shared between Desktop and Mobile for compatible apps.

ROM Player supports NES, SNES, Game Boy/Color, GBA, Genesis, Master System, and Game Gear with EmulatorJS touch controls. Its launcher loads when added; emulator cores download on Play. ROM imports remain on-device, outside Drive backup. Home pauses the emulator and Recents resumes it. Use emulator-native save controls before stopping/closing a game. Heavy desktop games are listed with their availability.

See [mobile app parity](docs/MOBILE_APP_PARITY.md) for the adaptation map and remaining work. Run the optional isolated browser smoke with Playwright installed: `node scripts/check-mobile-apps-browser.js`. Set `PORTFOLIOS_PLAYWRIGHT` to a Playwright module path when using a bundled runtime. It creates its own loopback server and disposable Chromium contexts; its ROM fixture is an original diagnostic program and it uses no real Google account.

## Appearance and diagnostic review (2026-10-09)

See [docs/APPEARANCE_AUDIT.md](docs/APPEARANCE_AUDIT.md) for the seven-theme Desktop/Quick and native Mobile review, corrected surface/text pairs, screenshot evidence, and browser regression command. Debug exports now identify their build, loaded asset versions, page load/export dates, and current AI state. Existing Drive file updates retry temporary server/network failures with bounded exponential backoff; file creation, conflict recovery, and paginated discovery remain separate work.
