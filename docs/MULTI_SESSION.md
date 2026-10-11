# Multi-session preferences and backup coordination

## Implemented

`core/storage.js` owns origin-wide Web Locks and per-setting revision metadata. Private preference saves and restores acquire a profile-specific `preferences` lock. Saves read current local values after queued work and filesystem reads complete; they do not retain an old queued snapshot. Profile changes abort stale writes/restores.

The Storage wrapper records revisions for private preference and installation-list changes. Settings JSON contains `__portfoliosPreferenceRevisions`. Explicit removals are represented as null values so a stale restore cannot reinstate reset accents. A restore only replaces a locally revised setting with a strictly newer revision. Legacy settings still restore on devices without local revisions. Revision metadata contains no authorization credentials and is removed when forgetting that account.

Storage events refresh the active profile in other tabs without switching their selected accounts. Native Mobile reloads its own preferences without resetting tasks or navigation. Desktop and Mobile keep independent theme settings. Mobile preference JSON uses one revision for its whole object.

Drive backup acquires an exclusive, non-waiting profile-specific `drive` Web Lock. Another tab receives a retryable busy error before reading or writing Drive. The existing per-tab busy flag remains in force. Browser lock ownership automatically ends on tab closure; failure clears the busy state and releases the lock. Browsers without Web Locks retain local preference saving but Drive backup is blocked with an explanatory error.

## Boundaries

Web Locks coordinate tabs on the same origin and browser storage partition. They do not coordinate separate browsers, devices or origins. Preference revision comparison helps reject older restored choices, but depends on device clocks and does not provide distributed cloud locking or conditional Drive writes. Concurrent cross-device document and desktop-layout merges remain unverified. Private installation choices now have per-app records; see [installation retention](INSTALL_RETENTION.md). Shared preferences and backups do not grant administrator access.

The separately audited desktop grid reflow, concurrent desktop layout writes and fully atomic Drive move/deletion handling remain separate work. Installation retention now prevents newly created paths from being falsely acknowledged by an in-progress backup. Do not describe it as universal multi-device conflict resolution.

## Verification

`node scripts/check-multi-session-browser.js` uses real browser tabs, shared IndexedDB/local storage and Web Locks. It checks peer theme updates, stale restore and accent reset protection, latest-value queued writes, profile-switch cancellation, backup exclusion, failure release, tab-close recovery, reload persistence and native Mobile peer preferences. Remote backup reads are simulated; no production Google credentials are used.
