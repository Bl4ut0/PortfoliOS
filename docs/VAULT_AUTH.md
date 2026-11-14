# Saved tool logins and the runtime vault

Implementation contract for the OS-owned credential broker. Desktop is the current delivery target. This storage milestone does not complete native CLI execution or provider sign-in.

## User workflow

1. Open the intended private workspace, then Settings → Cloud Sync → Saved Logins, or run `vault accounts` in Portfolio CLI.
2. Set up a master passphrase of at least 14 characters. Existing vaults must be unlocked; setup never silently replaces them.
3. Choose **Import Codex login JSON** and select an existing login file created by the official Codex CLI. The selected file is read directly into the broker and encrypted before storage. Do not upload it through File Explorer or paste credentials/passphrases into a chat or command line.
4. Choose a saved account for each compatible subsystem. Multiple accounts for the same provider remain separate. Importing Codex selects that account for `cli.codex`; it does not replace another account linked to `app.codex`.
5. Closing an app releases its temporary access without deleting its saved login or subsystem links. Unlinking the last subsystem makes a login unused. The manager offers **Remove unused login**, then explicit confirmation; **Keep login** preserves it.
6. Reload, profile switch, workspace lock and page teardown clear unlocked access. Unlocking restores saved accounts and links without repeating provider sign-in. A revoked or expired provider credential can still require refresh or a new provider login.

The PortfoliOS workspace login, vault unlock and live tool authentication are distinct states. A remembered OS email or a saved token is not proof that a CLI is authenticated. No synthetic `oauth-<tool>-<timestamp>` success is accepted.

## Storage and encryption

The only new persistent credential record is the profile-scoped SystemFS file `/documents/vault.enc`. It contains encrypted account records and saved consumer bindings; no plaintext sidecar, home auth file, browser storage entry, URL or debug export is created. Usual approved-file backup can carry this ciphertext. A completed local write does not establish successful cloud upload or a fresh cross-device restore.

Envelope v2 uses AES-256-GCM with a 128-bit tag, a fresh random 12-byte IV on every write, and profile-bound additional authenticated data. PBKDF2-HMAC-SHA512 derives a nonextractable in-memory key using 600,000 iterations and a random 32-byte salt at setup. The salt/key remain associated with that vault; the IV rotates on every save. The passphrase is not stored. Inputs bound KDF work to 100,000–1,000,000 rounds, 2 MiB for an envelope, 1 MiB for decrypted records, 256 KiB per credential and 100 accounts.

Every update is encrypted before an expected-record/expected-absence SystemFS write. A stale writer cannot silently overwrite another tab's record. A peer vault notification or external replacement locks cached access; the next unlock reads the latest record. This is conservative same-browser coordination, not distributed cloud conflict resolution. Backup inspection may change metadata/revision without changing ciphertext; the writer rebases only identical ciphertext and still checks the fresh record atomically. An encrypted-file conflict stops sync with both copies retained; do not auto-select opaque ciphertext by age/size.

Purge deletes the selected profile's canonical encrypted record and revokes its access. It does not revoke the provider's server-side authorization, erase another profile, remove historical plaintext remnants or erase remote recovery copies. PortfoliOS cannot recover a forgotten passphrase. Password strength is a user responsibility; length validation does not establish a numerical entropy guarantee.

## Host bridge API

`core/credential-vault.js` owns encryption, account records, bindings and leases. `core/runtime-bridge.js` supplies the current-profile gate, real SystemFS persistence, UI and runtime adapter. Settings/CLI load these modules on demand; boot, login, Mobile and Quick do not initialize the Desktop vault. Google workspace entry restores the encrypted file with critical state before mounting; unrelated documents can continue restoring in the background.

The trusted host facade `window.PortfoliOSVault` exposes:

| Operation | Behavior |
| --- | --- |
| `getStatus()` | Lock/setup state; account metadata is visible only after unlock |
| `initWithPassphrase(passphrase)` / `unlockWithPassphrase(passphrase)` | Initialize an absent vault or unlock an existing one |
| `importCodex(json)` | Parse a real Codex auth-file schema, encrypt and bind `cli.codex`; does not contact the provider |
| `listAccounts()` / `getBinding(consumer)` | Return identifiers, labels, provider families and links, never the secret |
| `link(id, consumer)` / `unlink(consumer)` | Persist the selected account for one registered subsystem; relinking revokes that subsystem's previous access |
| `acquire(consumer)` | Return a temporary lease with `read()` and `release()`; read requires an unlocked, current profile and a live matching link |
| `removeUnused(id)` | Refuse removal while any saved subsystem still references the login; other accounts stay usable |
| `checkpoint()` | Re-encrypt current state to the canonical file with a fresh IV |
| `lock()` | Revoke all access and clear in-memory records/key; ciphertext remains |
| `purgeAndReset()` | Explicit destructive recovery for the active profile |

Registered consumers are `cli.codex`, `app.codex`, `cli.agy`, `cli.gemini`, `cli.claude`, `cli.xai`, `cli.git` and `cli.gh`. Registration checks provider families, not OAuth audience/scope compatibility. Only Codex file import has a current UI/tested schema. Antigravity and other native connector recipes still require implementation and provider validation; a Google-family entry does not prove two CLIs accept the same token.

A connector must acquire its own registered consumer, release access on stop, and honor revocation on lock, unlink or profile change. Future native login/refresh output must return to the same encrypted broker, with account ownership captured before asynchronous work. Never persist live credentials to the shared runtime filesystem or send them through terminal output. The manual Git helper refuses to print credentials; a scoped native credential-protocol connector is still needed.

The facade is a capability for trusted first-party same-origin host code. It is not isolation against malicious same-origin scripts, extensions or an already compromised browser. Untrusted app frames must not receive the facade, broad filesystem access, tokens or keys. Revocation cannot erase a secret a previously trusted connector has already copied; native connectors must terminate/clear their temporary material as part of teardown. The independent Runtime library's older vault is not an alternative credential authority; a production adapter must use this OS service.

## Historical records

An existing v1 encrypted envelope can be explicitly unlocked only in its matching profile. Valid real credentials convert to account records; the next save produces v2. Fake placeholder records are rejected.

**Move legacy keyring into vault** accepts only profile-scoped `/etc/portfolios/vault/<provider>.json` records with an explicit matching `profileId`. Encrypt successfully before deleting the old record with an expected-record check. Unscoped historical keyrings have no attributable owner: SystemFS hides them from all profile/public listings, excludes them from ordinary migration/reset, and does not silently assign or delete them. This change does not claim historical plaintext was erased from raw IndexedDB or old home dotfiles. Prefer reimporting a selected official login file. Any historical cleanup needs an owner-confirmed recovery/removal plan.

## Verification and remaining milestones

`npm test` runs broker and runtime-adapter regressions. With Playwright available (`PORTFOLIOS_PLAYWRIGHT` may identify its installed package), run:

```sh
node scripts/check-credential-vault-browser.js
node scripts/check-staged-loading-browser.js
```

The browser fixture uses a disposable IndexedDB database and synthetic credentials. It checks two saved Codex accounts, shared consumers, ciphertext-only writes, reload/unlock, cancelled unlock, explicit unused removal, profile/public isolation and unowned-legacy preservation. It makes no external provider request. These tests do not exercise real OAuth refresh, token expiry or an authenticated CLI request. `node scripts/check-vault-cloud-state.js` checks opaque conflicts and partial-restore baselines. `node scripts/check-private-handoff-browser.js` transfers an encrypted Codex fixture between isolated browsers through synthetic Drive/session services, then unlocks it without a provider request. It also checks ordinary backup, offline conflict snapshots, Cancel Sync and recovery. This is not real Google-account or production Drive verification.

| Milestone | Status / acceptance gate |
| --- | --- |
| Encrypted account storage, saved links and revocable access | Implemented and covered by local broker/browser checks |
| Native process/PTY connector | Open: real executable launch, stdin/stdout/stderr, cancellation and exit status through the user's installed bridge |
| Ephemeral CLI auth material | Open: scoped `CODEX_HOME`/credential-protocol materialization, encrypted writeback after login/refresh, cleanup on stop/lock |
| Provider roundtrip | Open: real Codex login/import → command/request → reload/unlock → repeat; expired/invalid credentials must fail honestly |
| Antigravity and additional tools | Open: validate each supported CLI/login format, scopes and lifecycle; do not infer it from OS Google sign-in |
| Cloud and Mobile validation | Synthetic encrypted handoff/restore verified; real cloud-account restore, interactive divergent-vault recovery and later native Mobile controls remain open |

Official Codex authentication behavior is documented in [OpenAI's authentication guide](https://developers.openai.com/codex/auth/). The CLI, not PortfoliOS, owns provider sign-in. Retaining a file does not guarantee a provider will continue accepting its credentials.
