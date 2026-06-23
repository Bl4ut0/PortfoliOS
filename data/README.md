# PortfoliOS Shared Data Layer

This directory holds the static configuration arrays and portfolio project nodes. Modifying the files in this directory changes what appears on the site (project grids, bookmarks, wallpapers) without affecting system code.

---

## Data Schemas

1. **[systems.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/data/systems.js)**
   Defines the nodes mapped across the Desktop, Mobile, and Quick views.
   - **Fields**:
     - `id` (string): Unique identifier.
     - `title` (string): Node name.
     - `type` (string): Category sublabel.
     - `status` (string): "Online", "Playable", "Dev", "Planned", "Stable".
     - `icon` (string): CSS FontAwesome class or icon asset file name.
     - `color` (string): HEX color associated with the tile/links.
     - `summary` (string): Brief paragraph.
     - `signal` (string): Detailed technical notes.
     - `tech` (Array of strings): Technologies used.
     - `links` (Array of tuple arrays): `[label, url, icon]`.
     - `position` (Array of numbers): `[leftPercentage, topPercentage]` on the Network Map.
     - `launchApp` (string, optional): Overrides dossier view to open a window on click.
     - `desktopOnly` / `mobileOnly` (boolean, optional): Restricts view context.

2. **[apps.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/data/apps.js)**
   Contains `desktopApps` (available system programs) and `storeApps` (installable extensions).
   - **Fields for `storeApps`**:
     - `id` (string): Matching app Registry key.
     - `title` (string): Title display.
     - `icon` (string): Icon class or URL.
     - `category` (string): Store section category.
     - `description` (string): App store info.
     - `size` (string): Simulated size download.
     - `publisher` (string): Author credits.

3. **[bookmarks.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/data/bookmarks.js)**
   Bookmarks bar items in the Browser window.
   - **Fields**:
     - `id`, `label`, `url`, `icon`, `systemId`.
     - `embeddable` (boolean): `true` allows rendering inside an iframe; `false` prompts open tab fallback.

4. **[config.js](file:///c:/Dev Projects/bl4ut0-portfolio-os/data/config.js)**
   Definitions for:
   - `wallpaperOptions`: Themes in settings.
   - `quickRoutes` & `quickFilters`: Sidebar groupings in Quick access view.
   - `cliCommands` & `cliIntroLines`: CLI MOTD text and help layouts.
