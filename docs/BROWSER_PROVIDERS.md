# Browser providers

Browser loads only when opened. Desktop and Mobile share `core/browser-workspace.js`; Mobile keeps its portfolio explorer. The browser source is maintained in [PortfoliOS-Browser.JS](https://github.com/Bl4ut0/PortfoliOS-Browser.JS), with its build and host protocol documented there. This repository owns the host adapter and imports generated releases rather than maintaining a second editable browser source copy.

## Native browser settings

Browser opens directly to its own tabs, address bar, search, Back/Forward, and Reload controls. The extra Relay toolbar and Services button have been removed.

Use the browser menu → Settings → Proxy to choose automatic Browser.js relay discovery or a custom secure Wisp endpoint. Custom endpoints must use `wss:` and contain no username, password, query, or fragment. HTTP/SOCKS proxies and proxy websites are different protocols and cannot be entered as Wisp endpoints. Automatic discovery URLs stay in memory.

The optional Remember control stores the choice at `bl4ut0_<profile>_BrowserProxy`. Remembered provider choices use `bl4ut0_<profile>_BrowserProvider`. Both use the existing profile preferences/Drive mechanism, follow the same workspace between Desktop and Mobile, and reset with the public experience on reload. Browser cookies, website credentials, and history are not backed up to Drive. OS Google tokens and private files never enter this bridge.

Settings → Proxy → Open connection options offers Hosted Browser.js, Scramjet, external ProxySite/hide.me launchers, and optional Hyperbeam. Back to browser or Escape closes these options without replacing the current frame or its tabs. Choosing another provider explicitly switches the browser. Alternate embedded providers have a Browser settings control to return to native settings. A slow-loading browser offers recovery options.

## Loading and isolation

The trusted Browser.js interface is served through `apps/browser/browserjs.php` in a credentialless sandboxed iframe. This maintained interface is same-origin trusted code: credentialless storage does not prevent it from accessing same-origin DOM. Rewritten destination pages and their proxy service workers remain on external `*.puter.zone` origins. No proxy service worker is installed on the PortfoliOS origin. The parent retains cross-origin isolation for WASM/AI.

Browser code, engine assets, and relay connections stay out of boot/login. Home or minimize preserves Browser.js tabs. Closing the app disposes its frames. Credentialless frames require a supporting Chromium browser; unsupported clients retain external proxy options.

Credentialless storage is partitioned by the top-level document and child origin, not by individual iframe. The first workspace to use a provider owns that partition until root reload. Profile changes destroy Browser frames. A different account must reload before reusing that provider; it may choose an unused provider meanwhile. Reload is explicit because it can interrupt memory-only Drive authorization. Browser UI keys also include the workspace identifier. Desktop and Mobile in the same workspace may share temporary provider storage, with separate live tabs per view.

During this integration, the upstream automatic discovery endpoint returned an authorization error for our origin. A failed navigation opens Proxy settings with a clear recovery message. Configure a Wisp endpoint that permits PortfoliOS, or explicitly choose Hosted Browser.js in connection options. It opens its own New Tab page and receives no requested destination from PortfoliOS. Demo-only relay services are not configured as production fallbacks.

The relay operator handles website traffic and can observe the traffic it carries. PortfoliOS serves browser assets and does not relay destination traffic through its server. Upstream automatic discovery/isolation availability and website compatibility remain external dependencies.

## Build and import a release

In the independent fork:

```sh
git submodule update --init external/dreamlandjs
node scripts/build-portfolios.mjs --install
# Commit validated source changes, then build from the clean revision.
node scripts/build-portfolios.mjs
```

In PortfoliOS:

```sh
node scripts/import-browserjs.mjs /path/to/PortfoliOS-Browser.JS
```

The importer verifies a clean checkout, the exact fork revision, required files, safe paths, and every asset checksum. `apps/browser/browserjs/release.json` records the revision, corresponding-source URL, input pins, and checksums. Native About/Proxy source links identify that revision. Generated runtime assets and the AGPL license are committed here; dependencies and editable engine source stay in the fork. The fork's build profile rebuilds the browser UI using pinned official precompiled Scramjet/injection inputs; it does not claim a fresh Rust engine build.

Bump the OS release/cache version, run the checks below, publish engine assets before browser/OS entry points, and verify the live revision and file hashes. Roll back using a previously validated fork artifact with a fresh OS release version.

## Configure Hyperbeam

Hyperbeam is **disabled by default**. The project currently contains no provider key. First verify the developer account's actual free entitlement, whether paid overages can be disabled, and how its usage seconds map to billable participant-minutes. Marketing advertises 10,000 monthly participant-minutes; that is an account allowance shared by all users, not a per-user allowance. Monitoring cannot replace an account-level no-overage guarantee.

Create a PHP configuration **outside the public document root** at `../portfolios-private/hyperbeam.php` relative to the public root, or point the server environment variable `PORTFOLIOS_HYPERBEAM_CONFIG` at another private absolute path. Do not place this configuration in the repository or FTP-uploaded application directories:

```php
<?php
return [
    'enabled' => true,
    'api_key' => 'YOUR_SERVER_ONLY_KEY',
    // Enable only after verifying the account can stay free with paid overages disabled.
    'free_only_confirmed' => true,
    'origin' => 'https://os.bl4ut0.dev',
    'ledger_path' => __DIR__ . '/hyperbeam-ledger.json',
    'monthly_limit_seconds' => 9000 * 60,
    'session_seconds' => 20 * 60,
    'max_concurrent' => 3,
    'daily_sessions_per_ip' => 6,
];
```

Alternatively set `HYPERBEAM_ENABLED=true`, `HYPERBEAM_API_KEY`, and `HYPERBEAM_FREE_ONLY_CONFIRMED=true` in the PHP server environment. Local deployment `.env` values are not automatically PHP environment variables and must not be uploaded. PHP needs cURL, sessions, and writable private storage. A dedicated Hyperbeam account/key avoids usage by unrelated projects changing the available allowance.

## Usage enforcement

1. A same-origin, CSRF-protected start request checks the provider's monthly usage API.
2. A global file lock reserves the entire maximum session duration plus 60 seconds before a provider request is sent. Concurrent workers cannot allocate the same allowance.
3. A provider authorization webhook binds each reservation to a single Hyperbeam participant ID. The remote admin token is never returned to the client, preventing clients from extending enforced timeouts.
4. Provider-side absolute, inactivity and offline timeouts bound sessions even if the client or PortfoliOS server fails. Sessions do not cross the UTC month boundary.
5. The active Browser checks usage availability every 30 seconds. Unverifiable accounting stops local browsing and attempts provider termination. A full budget blocks new sessions while already-reserved sessions retain their remaining time.
6. Closing, minimizing, mobile Home, experience/profile changes, or backgrounding the page ends the remote connection and requests termination. Reload never silently recreates a remote session.
7. The ledger retains full reservations for the month, including failed/uncertain starts. The budget uses the larger of (a) usage at initial setup plus all committed allocations and (b) current provider usage plus all outstanding allocations. Completed allocations are not blindly charged twice. Unused reservation time is not refunded, so short or uncertain sessions can stop service before 9,000 actual minutes. Do not describe the UI's available budget as exact remaining provider credit.
8. Failed requests, corrupt storage, missing credentials or disabled free-only confirmation fail closed. Community browsers and external proxy launchers remain available independently. To continue after quota exhaustion, explicitly choose a free provider; remote cookies/history do not transfer to it.

Lease IDs, access URLs and participant secrets remain in process memory and the private server ledger. They are not application logs. Provider-side browser profiles are disposable and are never shared between private workspace profiles. Neither the client profile ID nor an IP address is treated as verified Google identity; PHP cookie ownership and lease capabilities protect access, with a per-IP daily limit and a global concurrency limit protecting the shared free pool.

## Remote viewer and isolation

The remote viewer at `apps/browser/remote.php` opts out of COEP, alongside the trusted Browser.js document. It loads in a credentialless iframe under the isolated parent, preserving WASM/AI isolation. Embedded Hyperbeam therefore requires a browser with credentialless iframe support (current Chromium-based browsers). Other browsers retain the external proxy options. The viewer loads the pinned official `@hyperbeam/web@0.0.38` SDK only after a session is started and validates parent origin, message source, provider hostname and expiration. No third-party SDK runs in the main OS document.

## Validation

- `npm test`
- `node scripts/check-browserjs-browser.js`: built browser Settings → Proxy on Desktop/Mobile, endpoint validation, profile persistence/public reset, options dismissal/tab preservation, and bridge sender validation.
- `node scripts/check-browser-providers.js`: provider selection, startup deferral, lifecycle, partition ownership, unsupported-browser fallback, and bounded Hyperbeam behavior.
- `php scripts/check-browser-quota.php`
- `node scripts/check-staged-loading-browser.js`

Browser UI checks require PHP and Playwright; set `PORTFOLIOS_PHP` and `PORTFOLIOS_PLAYWRIGHT` when they are not available on PATH. Live destination checks must verify the actual fork build and external content isolation. Mocked relay tests establish local behavior, not external relay uptime or real Hyperbeam billing behavior. Live Hyperbeam validation requires server credentials, verified free-only settings, and a public webhook URL.

## Provider documentation

- [Maintained browser fork](https://github.com/Bl4ut0/PortfoliOS-Browser.JS)
- [Browser.js upstream](https://github.com/HeyPuter/browser.js)
- [Scramjet](https://github.com/MercuryWorkshop/scramjet)
- [Wisp protocol](https://github.com/MercuryWorkshop/wisp-protocol)
- [Credentialless iframes](https://developer.chrome.com/blog/iframe-credentialless)
- [ProxySite](https://www.proxysite.com/)
- [hide.me](https://hide.me/en/proxy)
- [Hyperbeam usage](https://docs.hyperbeam.com/rest-api/dispatch/get-usage)
- [Hyperbeam timeouts](https://docs.hyperbeam.com/guides/timeouts)
- [Hyperbeam participant authorization](https://docs.hyperbeam.com/guides/authenticating-participants)
