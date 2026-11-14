# Loop Studio

A native PortfoliOS Desktop music-coding app powered by a self-hosted, unmodified `@strudel/web` 1.3.0 engine. It uses Web Audio; native TidalCycles, SuperCollider, a relay and a server-side audio process are not required.

## Play and keep a track

Install **Loop Studio** from Store → Media. Choose a starter and press Play. Edit the pattern and press **Ctrl+Enter** (or Update) to change it while the clock continues. A cycle is four beats. Tempo and mix are live controls. OS volume/mute applies immediately to sounding notes.

The sound shelf reads the [shared public sound index](../../data/sounds/README.md). Selecting a sound adds a track to the editor; playback changes only when you choose Update. Synth voices generate audio locally without sample files. The original Pocket Kit adds eight indexed percussion samples, about 88 KB total.

Open/Save/Save As use the common SystemFS navigation dialog, including computer upload and drag/drop. `.loop.json` projects default to `/music/Loop Studio`; file associations are configurable in Settings. Record captures the actual output locally. Save recording writes WebM/Opus or Ogg according to browser support; it does not claim WAV export. Both projects and recordings follow the selected profile's normal file/backup rules. Public profile data is disposable.

Stopping, minimizing, hiding the tab, closing or changing profile stops the clock and closes its AudioContext. Before close, edited work and unsaved recordings can be saved or discarded. Cancelled saves retain the editor; **Close without saving** actually closes it. Handoff/profile-switch autosave uses the originating profile and waits for writes.

## Supported music language

The app compiles a bounded subset of Strudel pattern expressions into real Strudel patterns. It does not call Strudel's JavaScript evaluator.

- Constructors: `stack`, `note`, `n`, `s`, `sound`.
- Mini-notation: sequences, rests, subdivisions, alternation, bounded repetition and Euclidean rhythms.
- Controls: sound, gain, pan, filters, envelopes, tempo transforms, reversal, palindrome, scale, transpose, add, segment, clip and simple room/delay controls.
- Strings, numbers and allowed chained calls only. No arbitrary statements, loops, functions, property access, callbacks, imports or remote sample loaders.

Input has limits on source size, nesting, call count, sound names, control ranges, cumulative speed/density, and final events per cycle. Invalid edits preserve the running pattern. Incomplete code can still be saved as inert project text; Play and model proposals require valid bounded patterns. This is not the full Strudel website/JavaScript REPL. Advanced instruments/effects, MIDI and audio-device compatibility need separate evaluation.

## Local co-composer

Co-compose uses the existing Local AI service only after a user asks for a draft. It requires an enabled **on-device** model and never enables/downloads a model automatically. `localOnly` is checked both at chat entry and provider dispatch so a model change cannot silently route the composition to a cloud provider. The dedicated music prompt avoids the general system-agent loop and portfolio dataset.

The model sees the current editor, tempo, request and installed sound names. Its structured response is parsed and validated, then displayed as a draft. Applying, playing and saving require separate user actions. Undo draft restores the previous editor. Invalid or late replies cannot write files, run scripts, play audio or update another profile. Cancellation affects only a generation owned by this app.

Small local models may return invalid JSON or unsupported notation; those drafts remain unapplied. Browser tests exercise this plumbing with a fixture provider, not a downloaded GPU model. Musical output quality on a real user's model remains to be evaluated.

## Browser-local MCP tools

`LoopStudio.connectTools()` returns `{port, close}` for an MCP JSON-RPC connection over a local `MessagePort`, while this app is open. It negotiates protocol `2025-06-18`, requires initialize → initialized, supports ping/tools-list/tools-call, validates arguments and revokes connections on close/profile change.

| Tool | Access |
| --- | --- |
| `list_sounds` | Shared sample metadata and built-in synth names |
| `read_project` | Current editor content only |
| `validate_pattern` | Syntax/bounds check without playback |
| `propose_project` | Validated draft requiring human Apply/Play |
| `stop_playback` | Stop this app |

No tool reads arbitrary SystemFS paths, accesses credentials, saves files, starts playback or makes external requests. The local co-composer uses these same handlers. This custom browser transport is not an HTTP/stdio server: external Codex/other MCP clients still need a transport adapter through the appropriate user-controlled bridge.

## Loading, provenance and licenses

Only small first-party controllers load on opening the app. The 656 KB engine loads on Play; sample files load when used. The catalog is network-first and can be refreshed from the shelf. Used code and content-hashed sound files participate in the service worker's on-use cache. They are never added to boot/login precache. Offline availability requires prior loading and retained browser caches; never-used sample files still need a connection.

[engine.json](engine.json) records the exact npm archive integrity and extracted-file SHA-256 hashes. Restore these unmodified upstream artifacts with:

```sh
python scripts/import-strudel.py
```

No npm package scripts run. The app and integration source are published under [AGPL-3.0-or-later](LICENSE), with the engine's notice and source entry points in [vendor](vendor). Original shared sample assets have their separate pack license. Upstream documentation/source: [Strudel integration](https://strudel.cc/technical-manual/project-start/), [Strudel repository](https://codeberg.org/uzu/strudel), [pinned npm package](https://www.npmjs.com/package/@strudel/web/v/1.3.0).

## Validation

```sh
node scripts/check-loop-studio.js
node scripts/check-loop-studio-browser.js
```

The browser check needs Playwright (optionally located through `PORTFOLIOS_PLAYWRIGHT`) and Chrome. It uses disposable local profiles, actual Strudel/Web Audio and MediaRecorder, real IndexedDB and the normal Store/file dialogs. It checks output signal, live sample changes, mute, recording/save, private reload/isolation, lifecycle/discard, local-only reviewed AI plumbing, theme/narrow layout and deferred loading. Native Mobile, real phone latency, full Strudel compatibility and real-model composition quality are not certified.
