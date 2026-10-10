# Browser providers

The Browser loads only when opened. Desktop and Mobile share `core/browser-workspace.js`; mobile keeps its portfolio explorer. Remembered providers use `bl4ut0_<profile>_BrowserProvider`, so existing profile settings and Drive backup carry the choice between experiences. Public profile storage resets with the existing public-session reset. Remote access credentials never enter localStorage, SystemFS, browser task snapshots, or Drive.

## Available routes

- **ProxySite**: opens https://www.proxysite.com/ in a real browser tab.
- **hide.me**: opens https://hide.me/en/proxy in a real browser tab.
- **Hyperbeam**: an optional embedded remote Chromium browser, allocated only after an explicit Start action.

Free proxy websites do not document integration APIs. PortfoliOS does not invent proxy URL formats, submit forms to them, bypass their embedding policies, or silently send a destination directly. Copy the destination address and enter it on the selected provider's page. External provider cookies are not partitioned by PortfoliOS profile; private workspace selection is not a separate cookie jar for a normal external browser tab.

All browsing egress goes through the provider. The PortfoliOS PHP endpoint only starts/stops Hyperbeam sessions, checks accounting, and authorizes participants. It is not an HTTP/SOCKS relay.

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
8. Failed requests, corrupt storage, missing credentials or disabled free-only confirmation fail closed. Free proxy launchers remain usable. To continue after quota exhaustion, explicitly choose a free provider; remote cookies/history do not transfer to it.

Lease IDs, access URLs and participant secrets remain in process memory and the private server ledger. They are not application logs. Provider-side browser profiles are disposable and are never shared between private workspace profiles. Neither the client profile ID nor an IP address is treated as verified Google identity; PHP cookie ownership and lease capabilities protect access, with a per-IP daily limit and a global concurrency limit protecting the shared free pool.

## Remote viewer and isolation

Only `apps/browser/remote.php` opts out of COEP. It loads in a credentialless iframe under the isolated parent, preserving WASM/AI isolation. Embedded Hyperbeam therefore requires a browser with credentialless iframe support (current Chromium-based browsers). Other browsers retain the free proxy options. The viewer loads the pinned official `@hyperbeam/web@0.0.38` SDK only after a session is started and validates parent origin, message source, provider hostname and expiration. No third-party SDK runs in the main OS document.

## Validation

- `npm test`
- `node scripts/check-browser-providers.js` (set `PORTFOLIOS_PHP` and, if needed, `PORTFOLIOS_PLAYWRIGHT`)
- `php scripts/check-browser-quota.php`
- `node scripts/check-staged-loading-browser.js`

Live Hyperbeam session validation requires server credentials, verified free-only billing settings, and a public webhook URL. Mocked tests do not establish real provider billing behavior.

## Provider documentation

- https://www.proxysite.com/
- https://hide.me/en/proxy
- https://hyperbeam.com/
- https://docs.hyperbeam.com/rest-api/dispatch/get-usage
- https://docs.hyperbeam.com/guides/timeouts
- https://docs.hyperbeam.com/guides/authenticating-participants
- https://docs.hyperbeam.com/client-sdk/javascript/overview
