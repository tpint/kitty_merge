# Kitty Merge

Merge Dragons-style cat merge game. Phaser 3 + TypeScript + Vite; the user wants it as close to *Merge Dragons!* as possible. Target is web now, iOS/Android later via Capacitor, so keep input pointer-based (touch + mouse), layouts phone-first, and the build relative-path (`base: './'`).

- Balance and content live in `src/config.ts` (chains, harvests, cats, shop, goals). Rules that don't render live in `src/state.ts`; the scene in `src/world.ts`; the HTML overlay in `src/hud.ts`.
- Art is procedural/emoji (`src/art.ts`). Keep texture keys stable so real sprites can replace them later.
- Save is `localStorage` key `kittymerge2` (`SAVE_KEY`). When adding fields, keep old saves loading (`load()` defaults missing fields).
- `window.km` is a small test hook (save, tile/cat/cluster screen positions). The test relies on it.
- Respect `prefers-reduced-motion`: give a gentler effect rather than none.

## Testing

`npm test` builds, serves `dist/` with `vite preview` on port 4179, and plays the game in headless Chromium (`tests/check.js`), saving screenshots to `tests/screenshots/`. Run it after gameplay/UI changes and look at the screenshots. Extend it when adding features. If a run is killed, a leftover preview server can hold port 4179.

## Every push

1. Bump `VERSION` in `src/config.ts` so the user can tell which build they're testing (shown bottom-left and in the ☰ menu).
2. Update `README.md` (including the changelog) to reflect the change.
3. Run `npm test` first.
4. This Windows PC has no global git identity: commit with `-c user.name="Trin Pinthavirut" -c user.email="t.pinthavirut@gmail.com"`.
5. Pushing to `main` deploys GitHub Pages through the Actions workflow.
