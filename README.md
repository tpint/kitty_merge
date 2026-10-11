# Kitty Merge 🐾

A cat-themed merge game prototype, inspired by *Merge Dragons!*. Merge matching items to grow catnip, adopt kittens and heal a weedy garden. It's one HTML file with no build step, so it works in any browser on desktop and phone.

**Play:** https://tpint.github.io/kitty_merge/ (or open `index.html` locally)

## How to play

- **Merge:** drag an item onto (or next to) matching items. **3 in a group make 1** of the next level. **5 make 2**, which is the bonus for waiting.
- **Heal the land:** the brown 🍂 tiles are weeds. Merging items on weeds turns those tiles into grass (+1 🪙 each). Items that start *stuck* in the weeds (greyed out) can't be moved, but you can merge onto them to free them.
- **Clear the fog:** ☁️ tiles next to your garden can be cleared with coins (the price rises each time). Cleared fog becomes weeds, sometimes with a stuck item.
- **Win:** heal every tile to restore the garden, then start a fresh one and keep your coins.
- **Goals:** the bar at the top walks you through the game. Tap **Claim** for 🪙 or ⚡ rewards.

### Tap actions

| Item | Tap does |
|---|---|
| 🌳 Catnip Tree / 🌸 Blossom Tree | Spends 1 ⚡ and grows a sprout (Blossom can also drop 🌿 or 🧵) |
| 🐱 Cats | Give a random gift (🌱 🧵 🐟 🪙) then nap. Higher-level cats nap shorter and give better gifts |
| 🍱 Bento / 🏰 Cat Castle | Give coins on a cooldown |
| 🪙 💰 💎 | Collect 1 / 5 / 25 coins |

⚡ Energy refills 1 every 15 s (max 20). Drag any item onto the 🧺 **Sell** basket to sell it, which helps when the board is full. The shop sells level-1 items.

### Merge chains

| Chain | Levels |
|---|---|
| Catnip | 🌱 → 🌿 → 🪴 → 🌳 Tree → 🌸 Blossom Tree |
| Yarn | 🧵 → 🧶 → 🎀 → 🧸 → 🏰 Cat Castle |
| Fish | 🐟 → 🐠 → 🍣 → 🍱 Bento |
| Cats | 📦 Mystery Box → 🐱 → 😺 → 😸 → 😻 → 🦁 Lion King |
| Coins | 🪙 → 💰 → 💎 |

Progress is saved in the browser's `localStorage` and survives a refresh. **reset progress** at the bottom starts over.

## Tweaking

Balance numbers (energy, prices, nap times, fog cost) are in `CONFIG`, `CHAINS` and `QUESTS` at the top of the `<script>` in `index.html`.

## Testing

```
npm install
npx playwright install chromium
npm test
```

The test plays the game in headless Chromium at phone size. It covers merging, healing, cats, stuck items, swapping, selling, the shop, fog, the 5→2 bonus, save/refresh, the win screen and a small-phone layout, and it saves screenshots to `tests/screenshots/`.

## Road to iOS / Android

This prototype is plain HTML/JS with touch-friendly pointer input, so the next steps are:

1. **PWA:** add a web manifest and service worker so it installs to the home screen and works offline.
2. **App stores:** wrap the same web build with [Capacitor](https://capacitorjs.com/) to produce iOS and Android apps.
3. **Real art:** swap the emoji for sprite art, and move rendering to a canvas/game engine (e.g. Phaser or PixiJS) once boards get large or animated.
4. **Backend:** cloud saves and accounts (e.g. Supabase), and later events and in-app purchases.

## Changelog

- **v0.1:** First playable prototype: merge chains, weeds and stuck items, fog, cats with gifts, energy, goals, shop, sell basket, save/restore.
