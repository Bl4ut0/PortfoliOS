# Bl4ut0 Portfolio OS

Client-first Experience OS concept: a personal operating environment that connects the dev hub, projects, homelab work, community resources, professional identity, and future public status pages through Desktop, Mobile, Quick, and CLI interfaces.

The shell runs independently in each visitor's browser. Server-side pieces can be added for data, status, PHP endpoints, or hosted assets, but the desktop/mobile/quick/CLI sessions are not shared streamed machines.

## Directory Structure

* **[core/](core/)**: Core system services (Reactive State proxy, EventBus, storage fallbacks, virtual SystemFS indexedDB, Google Drive sync, preferences loader, and app-loader).
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
   * Local address for testing: `http://localhost:8080` (or your local port).
   * Your production domain: `https://os.yourdomain.com`.
4. **Client ID Input**: Configure this Client ID only in the **Cloud Sync** panel of the Settings app. Individual apps always save to local `SystemFS` and do not own cloud authentication or synchronization.
5. **Security Scopes**: The sync engine requires the `drive.file` scope. This is a secure scope that restricts the app's access to only read/write files that *this specific application* created.

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

## Next Build Pass

- Add real status endpoints for public services.
- Add dedicated project dossier pages.
- Wire WardenIT to a professional route or separate domain.
- Expand productivity/service apps and hosted tools/PDF surfaces (Office Document app complete).
- Expand single-turn local AI skills library in `core/simple-brain.js`.
- Add screenshots or release media for key projects.
- Add analytics only after deciding what privacy posture the site should have.

