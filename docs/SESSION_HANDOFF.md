# Private session handoff and recovery

Build 2026.10.11.16 adds one active Google workspace per account across Desktop and Mobile. This replaces concurrent Google workspace editing with a controlled handoff; local-only fixture profiles and the disposable public profile do not use this service.

## Entry and handoff

Google identity is verified server-side through the Google userinfo endpoint. A remembered profile name is never the authority. The server atomically persists an account lease under a stable filesystem lock. The active session renews every 15 seconds; ownership expires after 180 seconds without a successful renewal. An expired owner still requires an explicitly warned force takeover, because silence does not establish that its work was saved.

A second session requests **Save other session & take over** and waits. The owner locks interaction, flushes supported Desktop editor lifecycle hooks and strict Mobile pause/save hooks, closes tasks, saves preferences, completes Drive reconciliation, then releases ownership to the waiting session. Failed saves, installs in progress, scanner errors and failed backups block normal handoff. Retry remains available. An unsynced switch to public cannot release ownership to a waiting takeover.

The destination reconciles its retained local state and the latest cloud checkpoint before mounting the workspace. Failure leaves sign-in gated, including repeated attempts. Same-tab reload retains a non-credential session identifier; a lifetime browser Web Lock prevents a duplicated tab from reusing that identifier. Google bearer credentials remain memory-only and must be reconnected after reload.

Force takeover is a separate action with a warning. It cannot save an unreachable device. The old session loses cloud write authority, locks when it next checks ownership, and attempts supported local saves. When that device next signs in and acquires ownership, its retained changes are snapshotted before reconciliation. Inactive devices do not automatically upload recovery payloads.

## Serialized cloud writes

`core/private-session.php` holds the account lock while forwarding a permitted Drive mutation. Session identifier and generation must match before every mutation; a queued old-generation request is rejected. This covers workspace writes, snapshot creation, folders, updates, deletes and final upload chunks. Reads stay client-to-Google. The gateway forwards only constrained Google Drive file URLs, never arbitrary hosts, and rejects other origins.

Uploads stream through PHP. Files over 4 MiB use resumable uploads with 4 MiB chunks; each chunk checks ownership independently. The current recovery policy limits individual files to 256 MiB. A partial upload or uncertain network outcome is not success and cannot release a graceful handoff. Atomic server locking cannot cancel an upstream Google operation that continues after a transport timeout; reconciliation and retained snapshots remain necessary.

## Merge rules

The canonical hidden Drive checkpoint `/.portfolios-sync-state.json` records confirmed content hashes, explicit deletion tombstones and Drive versions. Each browser retains its own last confirmed baseline separately from preferences. Matching Drive versions avoid downloading unchanged contents; matching local file revisions avoid rehashing unchanged data.

- Equal content needs no file transfer.
- One-sided edits transfer automatically.
- Divergent documents preserve the local version in a recovery snapshot and `/Recovered Sessions/<snapshot>/...`; the current cloud version becomes the normal workspace file. No text or binary document merge is invented.
- Preferences merge independently by key against their baseline. Independent app install choices survive. Same-key conflicts keep the current cloud value and retain the old settings file for review. New live edits arriving during reconciliation are retained locally for the next pass, with guards against stale snapshot import and queued-save overwrite; explicit null resets remain values.
- SystemFS records deletion intent in the same IndexedDB transaction as deletion. Only an intent matching the locally confirmed file revision can delete an unchanged remote file. Missing local storage without that proof restores the cloud copy instead of deleting it.
- Edit-versus-delete conflicts preserve the edited version. A cloud tombstone removes an unchanged stale copy; changed stale content is preserved separately. Deliberate recreation after a confirmed tombstone can upload normally.
- Expected-record and expected-absence checks protect imports/deletes from local writes that occur during scanning or downloading.

Checkpoints and successful timestamps advance only after the merge completes. New files created outside that pass remain pending for a later pass. Interrupted operations retry against the last confirmed baseline. Folder presence is preserved conservatively; folder deletion and stable-identity atomic moves are not delivered by this framework.

## Recovery history

Before reconciliation changes files, the owner uploads an immutable delta under its private Drive folder's **Recovery Sessions** folder. It contains changed approved files, hashes, explicit deletion records, inferred move candidates and the base checkpoint. The manifest uploads last; folders without a manifest are incomplete snapshots. A delta is a recovery record, not a standalone full-system image. Prior snapshots are never pruned automatically.

**Settings → Accounts → Session recovery** (Desktop) or the shared account controls in Mobile lists local conflict copies and can load the newest 50 Drive snapshots on demand. Snapshot file contents must match their manifest hashes and pass SecurityKernel inspection. Restoring opens the existing SystemFS **Save As** dialog; it never applies recorded deletions or overwrites the active workspace implicitly.

## Host requirements and limits

Use PHP 8.1+ with cURL, outbound HTTPS to Google and a writable private directory outside the served site. `PORTFOLIOS_SESSION_DIR` may select that directory. The default is a private sibling of the document root, namespaced by installation path. Keep this persistent directory across releases/restarts; do not publish it or copy lease files into Git. The implementation assumes one PHP deployment or servers sharing this directory with reliable filesystem locking. Independent replicas with separate disks are not supported.

The server stores account hashes, session metadata and brief verified identity caches; it never stores Google bearer tokens or document contents. The identity cache uses irreversible token hashes and expires after 30 seconds, so token revocation may take up to that interval to be observed. Server state uses atomic replacement under a separate stable account lock.

Online verification is required to open or continue a Google workspace. Network/authentication failure locks interaction and retains local data; public entry remains available. This deliberately changes the earlier Google-profile offline continuation behavior. Public switching keeps private data. Offline local-only switching closes the private workspace without claiming that its server lease was released; a different device still requires the warned force action. An online waiting handoff cannot be released without a completed sync.

All devices must reload the new release: already-running older code writes directly to Drive and cannot be fenced retroactively. External Drive editors do not participate in the lease. Recovery cannot preserve edits never uploaded from an unreachable/lost device. Only SystemFS and integrated app save hooks are covered; engine-native IndexedDB databases, unsaved unsupported app internals and ROM caches are not certified. Desktop grid displacement and file/folder drag bugs are separate issues.

Duplicate cloud path records fail safely for manual review rather than choosing an arbitrary copy. Snapshot retention/pruning, persistent resumable retry queues, automatic conflict UI comparisons, folder deletion review and full engine-save coverage remain future work.

## Verification

- `npm test`: existing app, Google session, SecurityKernel and new pure merge contracts.
- `php scripts/check-session-lease.php`: actual server state machine, exclusive claims, handoff, generations, expiry, force and cancellation.
- `node scripts/check-session-gateway.js`: actual PHP binary streaming transport and HTTP coordinator, same-origin enforcement, independent verified accounts, required-save handoff, stale-write fencing and rejected upstream targets. A synthetic identity cache is seeded only in the local test server; production has no test-auth bypass.
- `node scripts/check-private-handoff-browser.js`: independent Chrome storage contexts, real Desktop/Mobile entry and SystemFS, retry gates, reload/duplicate-tab identities, confirmed handoff, failed-save retry, forced takeover, retained offline edits, native recovery Save As, missing-storage safety, explicit tombstones and bounded large uploads. Google and Drive network services are simulated.
- Existing installation retention, same-browser preference, staged loading and context-menu regressions remain relevant.

Browser checks accept `PORTFOLIOS_PLAYWRIGHT`; the PHP gateway check accepts `PORTFOLIOS_PHP` and requires its cURL extension. `PORTFOLIOS_TEST_URL` runs the browser scenario against deployed frontend assets while retaining isolated service fixtures. These checks do not certify a real signed-in Google roundtrip or every application's internal save engine.

API references: [Google userinfo](https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo), [Drive file versions](https://developers.google.com/workspace/drive/api/reference/rest/v3/files), [Drive multipart and resumable uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

## Refresh identity (2026-10-12)

Session IDs persist per tab in sessionStorage. Saved identities wait up to 1.2 seconds for the previous document's Web Lock to clear before being classified as a live duplicate. Concurrent tabs still receive distinct IDs.

The server lets the current identity resume an expired lease, advances its epoch to fence old writes, and preserves any waiting handoff. Different identities retain the confirmed-save takeover requirement. Refresh does not clear session or backup state.

Validated: repeated refreshes, delayed lock release, duplicated sessionStorage, expired same-owner resumption, waiting handoff retention, full Desktop/Mobile handoff and actual PHP gateway regressions. Real-account production reload behavior still needs user verification.
