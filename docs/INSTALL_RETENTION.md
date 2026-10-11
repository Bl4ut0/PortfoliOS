# Private installation retention

Private installations use one profile-scoped `bl4ut0_<user>_app_install_<app>` preference per application. True records installation; false is an explicit uninstall tombstone. The legacy installed-app array remains compatible, but cannot erase per-app installs or resurrect explicit uninstalls. Existing legacy entries migrate additively. Normal Desktop and Mobile Store actions update only their target app, so simultaneous actions for different apps do not replace each other's whole list. Per-app preferences use the existing revision-aware settings backup and peer refresh.

Successful private installation waits for settings persistence as well as Desktop shortcut creation. Shortcuts remain removable independently of installation. Reinstalling restores a missing shortcut and respects a copy moved into a Desktop folder. Explicitly created/installed shortcuts and their layout are marked as user customization so first-sync default restoration does not discard them.

SystemFS assigns a write revision and supports an atomic expected-record check inside its IndexedDB transaction. Backup scanner metadata writes use that check so an older snapshot cannot overwrite newer layout, settings or file content. A detected conflict fails that backup without advancing its successful manifest; retry processes the current version.

Drive backup records only paths handled in its initial transfer pass. New files created after that snapshot are not falsely acknowledged as uploaded. A subsequent backup uploads them instead of interpreting their absence in Drive as deletion. Active installed-app shortcuts and workspace settings/layout are retained and uploaded if missing remotely, including when an older backup already acknowledged them incorrectly. A remotely missing directory is recreated rather than recursively deleting local descendants based only on absence.

This favors preservation when deletion intent is ambiguous. Explicit distributed deletion tombstones, atomic moves and conditional cross-device updates remain separate work. Removing a desktop shortcut locally still leaves the app installed and ordinary refresh respects removal. This does not automatically restore all previously lost files, certify game downloads, or prove a real cross-device Drive roundtrip. Reinstall or Send to Desktop can restore an already-missing app shortcut.

## Regression evidence

`node scripts/check-install-retention-browser.js` uses real SystemFS, actual Store installation and a simulated remote Drive. It holds backup during installation, checks atomic stale scanner write rejection, manifest acknowledgment and another backup, reproduces an old poisoned manifest, restores a newer legacy empty list, concurrently changes apps in two tabs, verifies uninstall tombstones, reinstalls, reloads and switches profiles. Running its poisoned-manifest case against the previous sync implementation deletes the installed shortcut; the corrected implementation retains and uploads it.

Existing Store and context-menu browser checks cover all 18 Desktop-capable Store entries, shortcut deletion, folder copies, reinstall and profile isolation. No production Google credentials are used by these tests.
