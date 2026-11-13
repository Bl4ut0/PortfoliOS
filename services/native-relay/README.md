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
* `sdk/`: PortfoliOS game client library (`native-relay-client.js`) with no cloud relay fallback.

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

const client = new GameNetworkClient();

const status = await client.init();
console.log('Active Backend:', status.backend); // "native"; init rejects when the local bridge is unavailable.

// Example: UT2004 UDP Socket
const udp = await client.createUdpSocket({ targetHost: 'ut2004.server.net', targetPort: 7777 });

udp.onMessage((bytes, rinfo) => {
  console.log(`Received ${bytes.length} bytes from ${rinfo.address}:${rinfo.port}`);
});

// Send packet
udp.send(packetUint8Array, 7777, 'ut2004.server.net');
```

---


## Browser sandbox mode (no installed relay)

PortfoliOS does not provide or automatically select a paid relay, public Wisp relay, hosted browser, or central WebSocket-to-UDP fallback. Install and enable both the extension and local Host Bridge for raw TCP/UDP and native networking. Downloading the installer alone does not enable these capabilities.

Without that setup, apps remain subject to browser restrictions: normal HTTPS/CORS, allowed WebSockets and browser-supported WebRTC may work; raw sockets, incompatible website embedding and unsupported multiplayer protocols remain unavailable. CLI HTTPS requests may use browser fetch where the destination permits it. These restrictions do not block ordinary OS APIs such as Google Drive. With the relay active, destination traffic originates on the user's device and network, not PortfoliOS hosting.

Legacy cloudRelayUrl/preferNative SDK constructor options no longer enable fallback. A missing relay yields a setup-required error rather than opening a remote connection. The separate external origin-isolation service used by Browser.JS is not a hosted destination-traffic relay and remains a distinct compatibility dependency.
