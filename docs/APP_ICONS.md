# Application icons and custom packs

Implemented in release **2026.10.11.8**.

## Using icons

Open **Settings > Appearance > App icons** on Desktop, or **Settings > Appearance** on Mobile. Select any catalog app, upload PNG/JPEG/WebP artwork, reset that app, or restore all defaults. The chooser includes Store applications before installation. Shared app IDs use the same override in Desktop and Mobile. A phone-only app keeps its own ID; Documents is not automatically the Desktop Office app.

Images are limited to 2 MB and 4096 pixels per side, inspected by file protection, and fitted without cropping into a transparent 128-pixel PNG. Conversion removes image metadata. Only passive raster artwork is accepted for user overrides; executable SVG and remote image URLs are not pack entries.

App artwork is local: existing ArtCraft, Code OSS and game logos remain, pinned OpenRCT2 and Webamp logos are bundled with notices, and purpose-built tools have individually colored Lucide tiles. A generic local tile covers future catalog apps. These fallback tiles are project presentation, not a claim to upstream branding. The canonical white-chevron/cyan-cursor OS mark remains separate.

## Profile storage and backup

The active profile owns `/Pictures/Icon Packs/active.json` in SystemFS. Private choices survive reload and are eligible for normal Drive backup. Public choices reset with the disposable public filesystem. Credentials, engine files and account metadata are not stored in icon packs.

Image conversion and writes capture their originating profile. Stale writes are rejected after an account change. Switching to public waits for queued icon writes before saving eligible workspace data. Corrupt or oversized restored packs cannot introduce external requests or active markup. Existing default artwork stays available when a pack cannot load.

Export creates a portable JSON download of the custom overrides. Import replaces the active overrides after validating and converting the complete input; unspecified apps use defaults. Resetting icons does not uninstall applications. Packs use app IDs rather than display names or platform icon names.

## Pack format

```json
{
  "format": "portfolios-icon-pack",
  "version": 1,
  "icons": {
    "store": "data:image/png;base64,...",
    "pdfcraft": "data:image/png;base64,..."
  }
}
```

Up to 64 entries and 8 MB per pack. Each entry must be a PNG data URL no longer than 130,000 characters and use an app ID of 1-64 lowercase letters, numbers or hyphens. The first character must be alphanumeric. Images are decoded and normalized before activation; invalid packs leave the current choices intact. Exporting after selecting custom icons produces a valid starting pack.

Linux icon themes and Android icon-pack APKs are not directly importable. Their artwork would need conversion into this format, with the source artwork's license respected. No external pack catalog or automatic pack download is implemented.

## Sources and verification

- [Lucide ISC license](https://lucide.dev/license); bundled license and exact package/source hashes: [core/icons](../core/icons).
- [OpenRCT2 artwork receipt and license](../core/icons/upstream/sources.json).
- Existing upstream editor notices remain in each app directory.
- `node scripts/check-app-icons-browser.js` checks catalog artwork decoding, real Appearance uploads, taskbar/title refresh, pack roundtrip/rejection, private reload/isolation, stale writes, native Mobile sharing and public reset. It uses disposable browser profiles; it does not claim a fresh Google Drive roundtrip.
- `node scripts/check-staged-loading-browser.js` checks that the small shared icon service does not initialize app engines or the unselected experience.
