# Private experience validation

Release: 2026.10.10.6. Reviewed 2026-10-10. This records tested behavior and remaining limits; it does not certify every application’s private storage.

## Verified paths

- Desktop and Mobile keep the typed experience selector, show their account selector before mounting workspace markup, and use the same remembered profile registry.
- Private SystemFS documents, downloads, pictures, music, exposed saved-game files and preferences use the selected profile namespace. Direct access to another profile’s home is rejected.
- Actual IndexedDB browser checks cover A/B documents and saves, recursive deletion, virtual backup paths, private preferences, public reset and pending writes. Added checks reject reads, listings, backup enumeration and deletes started before a profile switch, and suppress old-profile read/cursor results. A transaction already committed to its captured account is not rolled back by changing profiles.
- Native Desktop and phone Store checks install Codex Preview, save/read a real private file, reload and recover private files/theme/installation, switch A/B without sharing that file or installation, and reset public files/apps while preserving the private data.
- Private workspace identity stays active while Drive authorization is paused. Account/Drive tests cover memory-only tokens, multi-account activation, reconnect suppression in public, failed-backup retention and safe public switching. These are simulated provider tests; this release does not claim a fresh live Google OAuth or cross-device Drive round trip.
- The staged-loading browser suite checks selector/chooser/workspace order, independent shells, deferred AI/media, retry, offline startup and exact-release cache handling.

Run the reproducible browser audit from the OS root with Playwright available:

```sh
node scripts/check-private-experience-browser.js
node scripts/check-staged-loading-browser.js
```

PORTFOLIOS_PLAYWRIGHT can identify an installed Playwright module; PORTFOLIOS_BROWSER_CHANNEL selects an installed Chromium browser for the private audit. These browser contexts and account fixtures are disposable; they do not access the user’s live browser profiles or Google credentials. The SystemFS regression page uses a disposable IndexedDB database.

## Codex availability and updates

Codex CLI Preview is installable through both native Stores. It checks the active local workspace and provides [official CLI setup](https://learn.chatgpt.com/docs/codex/cli) and [ChatGPT authentication guidance](https://learn.chatgpt.com/docs/auth). Its Test local save action creates a plainly named check file under documents. This demonstrates the first-party app’s SystemFS access, not a guest Codex filesystem mount or a completed cloud backup.

The current [Runtime lab](https://github.com/Bl4ut0/PortfoliOS-Runtime/blob/main/docs/CLI_INSTALLATION.md) uses pinned @agent-wasm/codex@0.1.0, reporting Codex 0.145.0. Its version/help/device-login hand-off checks work locally. The referenced source repository remains unavailable; complete license notices and reproducible source correspondence are unverified. This executable is withheld from the production Store. No Codex binary, auth cache or provider credentials are deployed through the Preview.

Installing or updating official @openai/codex installs a native CLI for the user’s actual computer. It does not install a browser-compatible execution environment or upgrade the WASM port. Browser releases need a reviewed source/artifact, verified receipt, filesystem/process/network adapters and supported ChatGPT subscription sign-in. Google workspace selection does not authenticate ChatGPT. API-key billing is not a substitute for the project’s subscription-login goal.

## Remaining boundaries

Remembered local identity is a browser workspace boundary, not a server login, encrypted vault or protection from other trusted same-origin code. Shared app binaries/device caches are not private documents. The legacy private ROM library remains device-shared and excluded from Drive backup; it is not covered by the A/B document-isolation claim. Engine-native IndexedDB/OPFS saves and recovery databases need per-engine isolation/export checks before claiming full account privacy or backup.

Full Codex coding remains blocked on reviewed browser source, a real captured-profile SystemFS bridge, process/network support, credential isolation and a completed supported ChatGPT sign-in/inference test. GitHub operations, encrypted credential recovery, conflict/deletion recovery, physical-phone certification and a live cross-device backup proof remain separate milestones.
