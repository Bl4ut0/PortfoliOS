# Browser providers

The Browser loads only when opened. Desktop and Mobile share `core/browser-workspace.js`; mobile keeps its portfolio explorer. Remembered providers use `bl4ut0_<profile>_BrowserProvider`, so existing profile settings and Drive backup carry the choice between experiences. Public profile storage resets with the existing public-session reset. Remote access credentials never enter localStorage, SystemFS, browser task snapshots, or Drive.

## In-window browsing

Opening Browser immediately embeds **Browser.js by HeyPuter**, with real tabs, an address bar, search, back/forward and reload controls. Its upstream New Tab page is the default homepage on desktop and mobile. Google can be opened from that page. The provider does not accept a documented initial-URL command from our origin, so PortfoliOS does not simulate navigation with an outer address bar.

The **Services** button offers **Scramjet** as an alternative. Its hosted demo accepts an initial destination and starts at Google. Its developer-oriented toolbar is cramped on phones; Browser.js is the mobile default. Remembering an embedded provider applies to the current workspace profile and follows it between desktop and mobile. Neither engine nor relay loads during PortfoliOS boot/login: this happens only when Browser is opened. Minimizing or using mobile Home preserves community browser tabs; closing the app removes the frame.

Both browsers are hosted on external origins and use an external Wisp relay to fetch destination websites. PortfoliOS serves the app interface only. No HTTP/SOCKS traffic relay, HTML rewriting proxy, third-party engine script, or service worker is installed on the PortfoliOS origin. Provider accounts and destinations can be restricted, public endpoints can fail or change, and these community instances have no uptime or permanent-free guarantee. This is browser compatibility through a community relay, not the full compatibility of a native browser.

**ProxySite** and **hide.me** remain under External web proxy websites. Both prohibit framing with SAMEORIGIN headers. These are explicitly separate-tab tools, not routes for the embedded browser. PortfoliOS does not invent form/API URLs or bypass embedding restrictions. External browser-tab cookies are managed by the user's real browser and are outside our profile isolation.

**Hyperbeam** remains an optional embedded remote Chromium browser, allocated only after an explicit Start action. The PHP endpoint only controls sessions and accounting; it does not relay website content. It remains disabled until the server is configured and free-only billing is confirmed.

## Workspace isolation and browser state

Community frames use a separate origin, a credentialless context, no referrer, and a sandbox without top navigation, escaping popups, or parent storage access. Parent WASM/AI cross-origin isolation remains enabled. No PortfoliOS Google authorization, SystemFS files, profile details or Drive credentials are sent to these providers. Browsing cookies/history are temporary provider state and are not part of Drive backup. The relay can observe the destinations and traffic it handles; workspace sign-in does not provide anonymity from the provider.

Credentialless frames require supporting Chromium browsers (current Chrome/Edge). Unsupported clients receive an explicit message and retain external proxy options; PortfoliOS does not weaken its isolation headers or silently navigate directly.

Credentialless cookies/storage are partitioned by the top-level document and child origin, **not by each iframe**. Removing a frame does not immediately clear its partition. The first workspace using a provider owns that provider partition until PortfoliOS reloads. Switching workspace profiles destroys all Browser frames. A different profile cannot reuse that provider during the same document lifetime: it is offered an explicit reload to obtain fresh storage, or can choose an unused provider. Reload is never forced because it can interrupt memory-only Drive authorization. Normal app close/reopen by the same workspace may retain provider state until root reload. Desktop and mobile in that workspace can share that temporary partition; individual live tabs are managed by each provider view.

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

Only `apps/browser/remote.php` opts out of COEP. It loads in a credentialless iframe under the isolated parent, preserving WASM/AI isolation. Embedded Hyperbeam therefore requires a browser with credentialless iframe support (current Chromium-based browsers). Other browsers retain the external proxy options. The viewer loads the pinned official `@hyperbeam/web@0.0.38` SDK only after a session is started and validates parent origin, message source, provider hostname and expiration. No third-party SDK runs in the main OS document.

## Validation

Live community-provider checks on 2026-10-10 loaded Google inside the integrated desktop and phone layouts and observed external Wisp connections. Desktop address-bar navigation and a physical Back click passed Google → Wikipedia → Google. Google under an Android user agent returned an upstream 404 in one check, so phone website compatibility is not assured. Browser.js also rendered a missing favicon on example.com over its Back control; keyboard Back worked. These upstream UI/content failures are not fixed by the PortfoliOS wrapper and do not establish native-browser compatibility. Services remains reachable outside the provider frame.

The Browser host passed all 28 desktop/mobile, embedded/chooser theme scenarios (513 contrast checks). Automated provider tests use mocks and cover startup deferral, live-tab preservation, parent isolation, profile partition ownership, unsupported-browser fallback, provider choices, and the optional Hyperbeam accounting/lifecycle boundaries.

- `npm test`
- `node scripts/check-browser-providers.js` (set `PORTFOLIOS_PHP` and, if needed, `PORTFOLIOS_PLAYWRIGHT`)
- `php scripts/check-browser-quota.php`
- `node scripts/check-staged-loading-browser.js`

Live Hyperbeam session validation requires server credentials, verified free-only billing settings, and a public webhook URL. Mocked tests do not establish real provider billing behavior.

## Provider documentation

- https://github.com/HeyPuter/browser.js
- https://browser.puter.com/
- https://github.com/MercuryWorkshop/scramjet
- https://scramjet.mercurywork.shop/
- https://github.com/MercuryWorkshop/wisp-protocol
- https://developer.chrome.com/blog/iframe-credentialless

- https://www.proxysite.com/
- https://hide.me/en/proxy
- https://hyperbeam.com/
- https://docs.hyperbeam.com/rest-api/dispatch/get-usage
- https://docs.hyperbeam.com/guides/timeouts
- https://docs.hyperbeam.com/guides/authenticating-participants
- https://docs.hyperbeam.com/client-sdk/javascript/overview
