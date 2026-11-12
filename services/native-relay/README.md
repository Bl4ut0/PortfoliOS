# PortfoliOS Native Relay

High-performance, cross-browser native networking bridge for PortfoliOS applications (`os.bl4ut0.dev`).

---

## Why This Exists

Browsers enforce strict sandbox boundaries:
1. **No Raw UDP**: Browsers cannot send raw UDP datagrams (required by UT2004 ports 7777, 7778, etc.).
2. **No Arbitrary TCP**: Browsers only support HTTP(S) and WebSockets (Diablo / Battle.net / IPX require raw TCP).
3. **Private Network Access (PNA)**: Connecting from `https://os.bl4ut0.dev` to `127.0.0.1` is blocked by modern browser security policies.

This system solves all three issues using the **WebExtensions Native Messaging** standard, scoped **exclusively** to `os.bl4ut0.dev`.

---

## Architecture

```text
[ Browser: os.bl4ut0.dev ]
        │
        ▼ window.postMessage (inpage-bridge.js)
[ PortfoliOS Extension Content Script ]
        │
        ▼ chrome.runtime.connect (background.js)
[ WebExtension Service Worker ]
        │
        ▼ stdio pipe (4-byte length-prefixed JSON)
[ Local Native Host: host.mjs (host-runner.bat) ]
        │
        ├─► UDP 7777 (UT2004 Master / Game Servers / LAN)
        └─► TCP 6112 (Diablo / Battle.net)
```

### Key Advantages:
* **Zero Open Ports**: Unlike a local HTTP proxy daemon, Native Messaging runs over standard I/O pipes (`stdin`/`stdout`). No ports are opened on `127.0.0.1`, which prevents firewall alerts and network exposure.
* **On-Demand Lifecycle**: The browser spawns the native host only when a game in PortfoliOS requests network access, and automatically terminates it when the tab closes.
* **Domain Locked**: Inactive on all domains except `os.bl4ut0.dev` (and `localhost` for development).
* **Multi-Browser**: Works across Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi, and Mozilla Firefox.

---

## Directory Structure

* `extension/`: Cross-browser WebExtension (Manifest V3) for Chrome, Edge, and Firefox.
* `host/`: Native Messaging Host runner, protocol handler (`host.mjs`), and registration scripts.
* `sdk/`: PortfoliOS game client library (`native-relay-client.js`) with automatic fallback to cloud relay.

---

## Setup & Installation

### Step 1: Install the Windows Host Bridge (Recommended)

Download and run **`PortfoliOS-NativeRelay.msi`**:
- Installs to `%LOCALAPPDATA%\PortfoliOS\NativeRelay\` (no admin rights required).
- Automatically registers Chrome, Edge, Brave, and Firefox native messaging keys.
- Can be cleanly uninstalled at any time from Windows **Settings > Apps > Installed apps**.

To build the MSI installer locally:
```powershell
npm run build:relay-msi
```

#### Alternative: Manual Registration via Script
##### Windows:
Open PowerShell in the `host/` folder and run:
```powershell
.\register-host.ps1
```

*This registers the native messaging host in the Windows Registry (`HKCU\Software\...`) for Chrome, Edge, Brave, and Firefox.*

#### Linux / macOS:
```bash
chmod +x register-host.sh host.mjs host-runner.sh
./register-host.sh
```

---

### Step 2: Install the Extension in Your Browser

#### Google Chrome / Microsoft Edge / Brave:
1. Navigate to `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `extension/` folder.
4. *(Optional)* If Chrome generates a unique Extension ID, re-run:
   ```powershell
   .\register-host.ps1 -ChromeExtensionId <YOUR_EXTENSION_ID>
   ```

#### Mozilla Firefox:
1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `extension/manifest.json`.

---

## Using in PortfoliOS Games

```javascript
import GameNetworkClient from '/services/native-relay/sdk/native-relay-client.js';

const client = new GameNetworkClient({
  cloudRelayUrl: 'wss://relay.os.bl4ut0.dev/v1/relay',
  preferNative: true
});

const status = await client.init();
console.log('Active Backend:', status.backend); // "native" (extension) or "cloud" (server fallback)

// Example: UT2004 UDP Socket
const udp = await client.createUdpSocket({ targetHost: 'ut2004.server.net', targetPort: 7777 });

udp.onMessage((bytes, rinfo) => {
  console.log(`Received ${bytes.length} bytes from ${rinfo.address}:${rinfo.port}`);
});

// Send packet
udp.send(packetUint8Array, 7777, 'ut2004.server.net');
```

---

## Fallback Strategy for Non-Extension Browsers (Safari / Mobile)

When a user visits PortfoliOS without the extension installed:
1. `GameNetworkClient.init()` detects that `window.PortfoliOSNativeRelay` is absent.
2. It automatically switches to **Tier 2: Cloud Relay** (`ut99-relay`), streaming packets over a secure WebSocket (`wss://relay.os.bl4ut0.dev`) to the central relay server.
3. This ensures all users can play, while users with the extension get direct local UDP/TCP performance with LAN multiplayer support and zero server bandwidth cost.
