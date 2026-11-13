# Browser networking

Browser.JS is maintained in [PortfoliOS-Browser.JS](https://github.com/Bl4ut0/PortfoliOS-Browser.JS). PortfoliOS imports clean, checksum-verified engine releases and loads Browser only when opened.

## Supported policy

Users can select the installed Native Relay extension and local Host Bridge, or explicitly configure their own secure Wisp relay in Browser settings. Both Native Relay components must be installed and enabled for that mode. PortfoliOS does not provide a relay host, public Wisp discovery, external proxy-site fallback or paid remote-browser allocation. Legacy automatic/provider choices are ignored; explicitly remembered valid custom Wisp settings remain supported; unsupported connection configuration requests are rejected.

Without either configured transport, internal browser pages remain available. External sites are limited by normal browser networking, CORS and embedding restrictions; arbitrary browsing through rewritten proxy transport is unavailable. Multiplayer and CLI remain limited to protocols and destinations supported by the browser sandbox. This is a setup requirement, not an automatic cloud fallback. Browser-compatible HTTPS, WebSocket and WebRTC features are not categorically disabled.

With Native Relay active, traffic originates from the user's device/network; with custom Wisp it uses the user-selected relay operator. The OS server serves application assets and narrowly scoped OS APIs, not general destination traffic. Existing Google account/session and Drive gateways are separate OS services.

## Isolation and lifecycle

Trusted Browser.JS chrome is served through `apps/browser/browserjs.php` in a credentialless sandboxed iframe. Rewritten destinations remain on external `*.puter.zone` origins; that isolation dependency is separate from relay transport. No destination proxy service worker is installed on the OS origin. COOP/COEP on the OS remains intact. Profile switches destroy browser frames and retain the existing credentialless partition/reload guard.

## Build and import

Build and commit source in the [Browser.JS repository](https://github.com/Bl4ut0/PortfoliOS-Browser.JS/blob/main/portfolios/DEVELOPMENT.md). From the OS checkout, import the clean receipt-matching output with `node scripts/import-browserjs.mjs ../PortfoliOS-Browser.JS`. Run `npm test` and the native-network policy browser regression before release. Publish imported assets before entry points and verify the release receipt.

The old Hyperbeam endpoint responds with HTTP 410 and allocates no hosted session. Its historical implementation files are not an enabled product feature.

Device VPNs can route normal browser or Native Relay traffic at the OS level; they are not Wisp endpoints and do not grant raw socket access to browser JavaScript. Generic HTTP/SOCKS endpoint configuration is not implemented by Browser.JS. CLI networking is still constrained by the transports its runtime actually implements; the browser Wisp setting does not by itself configure CLI/game networking.
