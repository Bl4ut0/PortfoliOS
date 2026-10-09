# Mobile application parity

Updated 2026-10-09. Mobile has its own app registry, touch UI, retained tasks, and navigation. It shares account identity, virtual files, app selections, media, and backup services with Desktop. Store is present on the default Home and in All apps, including private profiles.

| Desktop app | Mobile experience | Current limits |
| --- | --- | --- |
| Store | Native Store | Built-in app launch and optional ROM Player install/removal; desktop games show availability. |
| Settings | Native Settings | Account chooser, public switch, Drive save-and-switch, phone appearance/navigation/storage. Some advanced Desktop options remain Desktop-only. |
| Files | Native Files | Shared account-scoped SystemFS. |
| LibreOffice WASM | Documents | Text/Markdown editing and PDF viewing; not the full LibreOffice UI. |
| Browser | Native Browser | Phone navigation and shared links. |
| Local AI / Lobe | Native Lobe | Basic answers and shared model selection/enablement; mobile chat does not execute desktop tool actions. Cloud provider setup remains in Desktop Settings. |
| Task Manager | Native Task Manager | Lists/resumes/closes phone tasks and reports browser storage; no invented per-process CPU figures. |
| Security Center | Native Security Center | Workspace policy scan and quarantine review; no claim of full antivirus protection. |
| Identity | Native Identity | Active profile, avatar, session status, and account settings. |
| Dossier | Native Dossier | Profile-visible project list and native project routes. |
| Music Mini | Music | Shared media library, touch controls, background playback. |
| Webamp | Music alternative | Classic Winamp skin/equalizer UI remains Desktop-only. |
| Network Map | Home Lab / project apps | Native project information; interactive desktop topology remains Desktop-only. |
| Linux lab view | Home Lab | Native project information; desktop lab surface remains Desktop-only. |
| Portfolio CLI | Lobe / Files / Task Manager alternatives | Conversational help, file workflows, and task controls; no full mobile shell yet. |
| ROM Player | Native optional ROM Player | NES, SNES, GB/GBC, GBA, Genesis, Master System, Game Gear; ROM imports excluded from Drive backup. Touch controls use the existing EmulatorJS runtime. |
| Doom, Duke Nukem 3D, Diablo, Quake, UT99, OpenRCT2 | Desktop availability shown in Store | Need touch/controller UI, sizing, lifecycle, and real-device resource checks before being advertised as mobile-playable. |
| IPTV | Desktop availability shown in Store | Native guide/video controls and mobile playback need adaptation. |

Mobile also retains Calculator, Gallery, Flappy Bird, and native project apps (Dev Hub, Status, Home Lab, Automation, Addons, GuildCraft, Survival AI, WardenIT).

## Profile switching

Both Settings surfaces offer **Save to Drive & switch to public**, when the active account has a live Drive credential, and **Switch to Bl4ut0 public profile**, including offline use. A save transition closes app tasks to flush drafts/imports/scans, saves preferences, awaits a successful private backup, and then changes profile. Backup errors retain private identity. Private files/settings stay local and the memory-only Google authorization can be reused while the page stays open. Public reload resets its files, app selections, preferences, and saved mobile task state.

## Validation and remaining work

The automated suite checks app contracts, profile separation, failed backup handling, concurrent-switch locks, public reset, and Store installation visibility. The isolated Chromium smoke covers mobile Store/ROM install, an original diagnostic NES program, emulator pause/resume, new utility launch, Lobe session answers, account chooser placement, private-to-public switching, public reload cleanup, and Desktop account controls. It does not sign into a real Google account or benchmark real phone GPUs.

The ROM runtime uses [EmulatorJS options](https://emulatorjs.org/docs/options/) and the existing stable CDN. Engine-native saves remain separate from SystemFS exports; test save-file import/export and profile isolation before claiming those saves are backed up to Drive. Prioritize Doom/Diablo/Quake touch support and IPTV/CLI utility adaptation next, with memory, battery, offline, orientation, and accessibility checks on physical devices.
