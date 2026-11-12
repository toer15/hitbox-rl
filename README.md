# HITBOX — Rocket League Loadout Studio

A desktop app for building client-side cosmetic loadouts and finding Rocket League workshop maps.

**What it is:** a garage, a hitbox reference and a workshop map browser in one Electron app — plus a built-in **Setup** tab that installs everything needed to actually show your loadout in game.
**What it is not:** an item unlocker, and it never changes what other players see. Everything is client-side: only your screen changes.

![status](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-3F9BFF)

## Show it in game (Setup tab)

The Setup tab walks through what HITBOX needs to put your loadout on screen in Rocket League, and installs it for you:

1. **Rocket League** — auto-detected (Epic or Steam).
2. **BakkesMod** — the community's long-standing client-side mod loader. One click downloads the official installer and starts it.
3. **HITBOX bridge plugin** — a small plugin built by this repo (see the `bakkesmod-plugin/` folder, compiled by the `Build Hitbox bridge plugin` GitHub Actions workflow and attached to releases). One click downloads it into the BakkesMod plugins folder.

After that, hit **Apply in game** in the Garage. The bridge reads the live loadout and applies it client-side:

- **Paint** — any colour you picked (primary and secondary), applied as real colour overrides. The **As is** toggle leaves factory team paint alone.
- **Boost** — any boost with a mapped product id.
- **Car body** — in **freeplay / offline training** the chosen body is the real body, hitbox included. In **online matches** the server still owns the hitbox, so only the visuals change and your car handles like the body you actually have equipped.

Console commands in game: , ,  (dumps your currently equipped item ids to  so new bodies/boosts can be mapped — see `src/data/productIds.ts`).

The Mod maps tab also has an **Add map** box: paste any Steam Workshop link or item ID and HITBOX fetches the real title, author and size straight from Steam, so your shelf can hold every map the community has ever released, not just the curated list.

## What's inside

### Garage
- **Master MOD switch** — one toggle hides every chosen cosmetic at once (car, boost and paint), or brings the whole loadout back. The state persists between launches and is exported as `enabled`.
- **Launch RL** — detects an Epic or Steam installation and opens the correct launcher. The selected car is marked in the garage, and **Save changes** appears whenever the current loadout differs from the saved preset.
- **175 car bodies** from Epic's official hitbox list, searchable and filterable by hitbox.
- **150+ boosts**, including standard, limited, competitive reward and legacy colourways.
- **Paint** — any colour with a real colour picker, primary and secondary, 18 finishes including Metallic, Pearlescent, Anodized, Toon and Brushed Metal.
- **"As is" toggle** — leave the factory team paint alone, or override it.
- **Live top-down preview** with the actual hitbox drawn to scale around the car.
- **Exact hitbox readout** — length, width, height and ground height in Unreal Units, with the correct box for every body.

### Hitbox lab
All six real hitboxes — Octane, Dominus, Breakout, Plank, Hybrid, Merc — overlaid at the same scale, with measured dimensions, car counts and the full list per box. Click any box to filter the garage.

### Mod maps
A curated shelf of **70+ real Steam Workshop maps**: dribble courses, rings, parkour, obstacle courses, races, training maps, mini-games and remakes. Filter by type and difficulty, star favourites, copy workshop IDs, open the workshop page, or open your local Rocket League workshop folder. The folder button auto-detects Steam libraries on Windows, macOS and Linux.

### Library
Save loadouts locally, load them back, delete them, import and export `.rlpreset.json` files. Nothing is uploaded.

### Updates
Hitbox checks GitHub Releases eight seconds after launch and every six hours, downloads a new version in the background, and installs it when you quit. There is also a **Check updates** button in the top bar; when a build is ready it turns into **Restart update**.

Auto-updates require the installed NSIS build on Windows. The Windows installer is a one-click per-user package, so updates install silently in the background and relaunch without showing an installer wizard. The portable `.exe` cannot self-update, and unsigned macOS builds cannot install updates until the app is code-signed.

## Download

Grab the latest installer from the repository's **Releases** page:

- **Windows:** `Hitbox-1.0.2-Setup.exe` or the portable `.exe`
- **macOS:** `Hitbox-1.0.2.dmg` (unsigned build — right-click → Open the first time)
- **Linux:** `Hitbox-1.0.2.AppImage`

## Run from source

```bash
npm install
npm run electron:dev     # Vite renderer + Electron window
```

Useful scripts:

```bash
npm run dev              # renderer only, in a browser
npm run validate         # catalog integrity checks
npm run build            # typecheck + production renderer build
npm run start            # build, then launch Electron
npm run dist             # build a local installer for this OS
npm run dist:dir         # unpacked build in release/
npm run icon             # regenerate build/icon.png
```

Requires Node 20+.

## Cutting a GitHub release

The workflow at `.github/workflows/release.yml` builds Windows, macOS and Linux installers and attaches them to a GitHub Release.

1. Create the repository on GitHub and push this project:

```bash
git init
git add .
git commit -m "HITBOX 1.0.2"
git branch -M main
git remote add origin https://github.com/toer15/hitbox-rl.git
git push -u origin main
```

2. Bump the version in `package.json` if needed.
3. Tag and push:

```bash
git tag v1.0.2
git push origin v1.0.2
```

The workflow uses the automatic `GITHUB_TOKEN` (no extra secrets) to build all three platforms and attach the installers to that tag's release with the GitHub CLI. You can also run **Release desktop app → Run workflow** manually to get downloadable artifacts without publishing a release.

macOS builds are unsigned, so Gatekeeper needs a right-click → Open on first launch. Windows SmartScreen may show a warning for unsigned installers.

## Scope, honestly

Client-side cosmetics only change what **you** see. This app does not touch the Rocket League process, does not unlock anything in your inventory, and does not modify hitboxes or gameplay. It manages the preset and shows you the real collision data.

Applying a loadout in-game requires a client-side cosmetic mod that reads the preset. The exported format is deliberately plain:

```json
{
  "id": "0e7f…",
  "name": "Fennec · Blue",
  "updatedAt": "2026-11-12T10:00:00.000Z",
  "enabled": true,
  "loadout": {
    "team": "blue",
    "carId": "fennec",
    "boostId": "gold-rush",
    "primary": "#3F9BFF",
    "secondary": "#F2F5F7",
    "finishPrimary": "metallic",
    "finishSecondary": "glossy",
    "stockPaint": false
  }
}
```

Presets are stored in the Electron user-data folder (`%APPDATA%/Hitbox/presets` on Windows, `~/Library/Application Support/Hitbox/presets` on macOS, `~/.config/Hitbox/presets` on Linux).

## Data sources

- Car → hitbox mapping: [Epic Games Rocket League hitbox support page](https://www.epicgames.com/help/en-US/c-Category_RocketLeague/c-RocketLeague_Gameplay/rocket-league-car-hitboxes-a000084362)
- Hitbox dimensions: long-standing community measurements of the six presets (Unreal Units; 1 uu = 0.75 in). Psyonix does not publish per-box numbers in game.
- Workshop maps: real Steam Workshop IDs and sizes. Authors are credited where known.
- Boosts and paint colours: assembled from public Rocket League item catalogues.

Hitbox is an unofficial fan project. Not affiliated with Psyonix, Epic Games or Valve. Rocket League and all related marks belong to their owners.

## License

MIT
