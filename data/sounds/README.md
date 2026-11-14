# Shared sound library

PortfoliOS serves a public, reusable sample index at [`data/sounds/catalog.json`](catalog.json). Loop Studio uses it as its sample bank; other apps can request a fallback sound map when they do not supply their own files.

The bundled **PortfoliOS Pocket Kit** contains eight original synthesized sounds: kick (`bd`), snare (`sd`), closed/open hats (`hh`, `oh`), clap, rim click, low tom and bell. Total audio size is 88,328 bytes. These are static shared assets, separate from private recordings/projects in SystemFS.

## Add a pack

Create a directory under `data/sounds`, put audio files there and add `pack.json`:

```json
{
  "id": "my-kit",
  "title": "My drum kit",
  "license": "CC0-1.0",
  "source": "https://github.com/example/my-kit",
  "sounds": [
    {"id": "softkick", "title": "Soft kick", "category": "drums", "files": ["soft-kick.wav"]},
    {"id": "vinylhat", "title": "Vinyl hat", "category": "texture", "files": ["hat-1.ogg", "hat-2.ogg"]}
  ]
}
```

The license/source above are examples: enter the actual terms and source for your files and include required license/attribution text in the pack. This directory and its index are publicly served. Keep personal recordings in profile-scoped SystemFS unless you intend to publish them.

Rebuild and validate the index from the OS checkout:

```sh
python scripts/build-sound-library.py
node scripts/check-loop-studio.js
```

The script computes sizes and SHA-256 hashes, reads WAV durations and rejects duplicates, traversal, missing files, unsupported formats and oversized assets. Sound IDs begin with a letter and use letters/numbers/underscores/hyphens; keep them stable so saved patterns continue to resolve. Use simple sample filenames with letters, numbers, spaces, dots, underscores and hyphens.

Publish the pack files **and** updated `catalog.json` through the [Orchestration deploy workflow](https://github.com/Bl4ut0/PortfoliOS-Orchestration/blob/main/docs/BUILD_AND_DEPLOY.md). The OS deployment manifest already includes `data`; a selected upload can use `--only=data/sounds`. The uploader does not remove old remote files. Renaming/removing IDs can break older patterns, so retain referenced sounds or provide an explicit migration. In Loop Studio, choose **Refresh** on the sound shelf after publication.

Only sample URLs are loaded during playback; adding a pack does not load its audio at startup or add it to boot cache. Content-hash query keys invalidate changed sample bytes. The unversioned catalog is revalidated on refresh and can fall back to a previously used cached index offline.

Current limits: 512 sound IDs, 1–16 sample variants per sound, 8 MiB per file and a 1 MiB index. Supported containers are WAV, Ogg, MP3, FLAC, M4A and WebM; actual decoding depends on the browser/codec. WAV durations are measured; other formats do not receive invented timing metadata.

To generate missing original starter assets in a fresh/custom checkout:

```sh
python scripts/build-sound-library.py --starter-kit
```

This adds missing starter files without replacing existing ones. Normal indexing never generates or deletes sample audio.

## App API

Load `core/sound-library.js` on demand, then use:

```javascript
const catalog = await SoundLibrary.getCatalog();
const updatedCatalog = await SoundLibrary.getCatalog({refresh: true});
const fallback = await SoundLibrary.sampleMap({
  only: ["bd", "sd", "hh"],
  excludeNames: Object.keys(appOwnedSamples)
});
const samples = {...fallback, ...appOwnedSamples};
```

Catalog records include human names, categories, pack/license/source metadata, files, byte sizes, hashes and measured WAV durations. Metadata is validated and frozen. Sample URLs stay on this PortfoliOS origin under `data/sounds`; arbitrary external URLs are rejected. No user credentials or filesystem paths enter the shared index. Apps remain responsible for user-triggered playback, the shared volume adapter and lifecycle teardown.
