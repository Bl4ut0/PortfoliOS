# PortfoliOS UT99 Relay

Small WebSocket-to-UDP relay for controlled Unreal Tournament 99 bridge tests.

This service is intentionally not a generic UDP proxy. A browser client can only open a relay session when all of these are true:

- the WebSocket `Origin` is allowlisted,
- the target is present in `relay.config.json`,
- the client presents a valid short-lived HMAC token,
- the token is scoped to the requested target,
- payload sizes and byte rates stay under configured limits.

## Install

```powershell
cd "C:\Dev Projects\bl4ut0-portfolio-os\services\ut99-relay"
npm install
Copy-Item relay.config.example.json relay.config.json
$env:UT99_RELAY_TOKEN_SECRET = "replace-with-at-least-32-random-characters"
npm start
```

Put the service behind TLS before exposing it publicly. The browser should connect with `wss://`, not plaintext `ws://`.

## Mint A Test Token

```powershell
$env:UT99_RELAY_TOKEN_SECRET = "replace-with-at-least-32-random-characters"
npm run mint-token -- --sub alex-test --target local-test --ttl 600
```

The printed token is only valid for the configured audience, target, and expiry time.

## WebSocket Protocol

Connect to:

```text
wss://relay.example.com/v1/ut99/relay
```

First message must be JSON:

```json
{
  "type": "ut99.relay.open",
  "targetId": "local-test",
  "port": 7777,
  "token": "payload.signature"
}
```

After the relay returns `ut99.relay.ready`, binary WebSocket frames are forwarded to the UDP target. UDP replies are returned as binary WebSocket frames.

Control frames are JSON:

```json
{ "type": "ut99.relay.ping" }
{ "type": "ut99.relay.close" }
```

## Security Notes

- Keep `targets` narrow. Do not expose arbitrary `host` or `port` fields to users.
- Keep tokens short-lived.
- Prefer controlled UT99 servers for the WASM bridge. Use the native OldUnreal client/helper for arbitrary public servers.
- Run as a restricted OS user.
- Put behind a reverse proxy with TLS, connection limits, request logging, and IP reputation/WAF controls.
- Monitor `/metrics` and relay logs.
