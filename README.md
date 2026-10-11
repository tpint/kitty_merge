# Kitty Merge 🐾

A cat-themed merge game prototype that plays like *Merge Dragons!*. You restore a cursed floating island by merging items, hatching kittens and sending your cats out to harvest.

**Play:** https://tpint.github.io/kitty_merge/

Built with [Phaser 3](https://phaser.io/) + TypeScript + Vite. All art is drawn in code (ground, cliffs, clouds, cats) or uses emoji (items), so there are no image files yet.

## How to play

- **The island:** an isometric floating island. Drag empty space to pan; pinch or use the mouse wheel to zoom.
- **Merge:** drag an item next to matching items. Items count as touching side by side or corner to corner, so a straight row across or down the screen merges. **3 make 1** of the next level; **5 make 2** (the bonus for waiting). Gold tiles show what will merge before you let go. Dropping an item on a different item pushes that item to a free spot.
- **Dead land:** the purple cracked ground is cursed. Merging on it heals it to grass. Items found on dead land are **stuck** (darkened) until you merge onto them.
- **Life Sparks** ✨ 🌟 ☀️: drag them onto dead land to heal an area (bigger sparks heal more).
- **Cats (the dragons):**
  - Merge 3 📦 Kitten Boxes to hatch a kitten.
  - Cats roam the island. **Tap a harvestable item** (🪴 🌳 🌸 🎀 🧸 🏰 🍣 🍱) and the nearest free cat walks over, works on it for a few seconds, and drops new items. The item then regrows.
  - **Drag 3 matching cats together** to merge them: Kitten → Ginger → Fluffy → Tuxedo → Royal → Lion King. Higher cats walk and work faster.
- **Fog ☁️:** clouds cover most of the island. Tap a cloud's ⭐ label to clear it with stars, which you earn by merging. Clouds marked 🔒 have to wait until the fog nearer your camp is cleared. Fog hides new items and chests.
- **Collect:** tap 🪙 💰 👑 for coins and 💎 🔮 for gems. Tap 🎁 🧰 to open them.
- **Goals:** the card at the top left walks you through the game; tap **Claim** for rewards.
- **Shop 🛒:** buy Kitten Boxes, sprouts, Life Sparks and more. Selected items can be **sold** from the info card.
- **Win:** heal every tile on the island.

Progress (island, items, cats, resources, goals) is saved in the browser's `localStorage`. **☰ → Reset progress** starts a new island.

### Merge chains

| Chain | Levels |
|---|---|
| Catnip | 🌱 → 🌿 → 🪴 (harvestable) → 🌳 Catnip Tree → 🌸 Blossom Tree |
| Yarn | 🧵 → 🧶 → 🎀 → 🧸 → 🏰 Cat Castle |
| Fish | 🐟 → 🐠 → 🍣 → 🍱 Bento |
| Coins | 🪙 → 💰 → 👑 |
| Gems | 💎 → 🔮 |
| Gifts | 🎁 → 🧰 Treasure Chest |
| Life | ✨ → 🌟 → ☀️ |
| Cats | 📦 Kitten Box → 🐱 Kitten → Ginger → Fluffy → Tuxedo → Royal → Lion King |

## Development

```
npm install
npm run dev        # local dev server with hot reload
npm run build      # type-check + production build into dist/
npm test           # build, then play the game in headless Chromium
```

The first time, also run `npx playwright install chromium`.

- `src/config.ts`: **all balance numbers**: chains, harvest times and drops, cat levels, shop, goals.
- `src/state.ts`: save format, island generation and the merge rules.
- `src/world.ts`: the Phaser scene: rendering, input (tap / drag / pan / pinch), cats' AI, merging, fog.
- `src/art.ts`: procedural textures (tiles, cliffs, clouds, cats).
- `src/hud.ts` + `src/style.css`: the HTML overlay (resources, goals, info card, shop, dialogs).
- `tests/check.js`: browser test. It covers hatching, harvesting, gifts, coins, Life Sparks, item merges (including straight rows), cat merges, stuck items, pushing, fog, shop, panning, save/refresh, the win screen and a small-phone layout. Screenshots go to `tests/screenshots/`.

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`.

## Road to iOS / Android

The game is a standard web build (`dist/`, relative paths), so the path to the app stores is:

1. **Capacitor:** `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`, `npx cap init`, `npx cap add android` / `ios`, with `webDir: dist`. Android builds on Windows with Android Studio; iOS needs a Mac with Xcode.
2. **Real art:** replace the emoji and procedural cats with sprite sheets (the texture keys in `art.ts` are the swap points).
3. **Sound and haptics:** merge, harvest and purr sounds, plus Capacitor Haptics.
4. **Cloud saves and accounts** (e.g. Supabase), then events, more islands and in-app purchases.

## Changelog

- **v0.3:** Fix: 3 items in a straight row across or down the screen now merge (corner-touching tiles count). Cats merge in those rows too. When a cat walks past an item, a tap picks whichever is closer to your finger.
- **v0.2:** Rebuilt as a *Merge Dragons*-style game: an isometric floating island with pan/zoom, dead land, fog clouds bought with stars, free-roaming cats that harvest and merge, Life Sparks, gifts, push-aside placement, goals, shop and sell. Moved to Phaser + TypeScript + Vite with GitHub Pages auto-deploy.
- **v0.1:** First prototype (flat 7×9 grid board).
