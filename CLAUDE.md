# Kitty Merge

Single-file merge-game prototype (cat-themed Merge Dragons): everything (HTML, CSS, JS) is in `index.html`. No build step. Target is web now, iOS/Android later (via Capacitor), so keep input pointer-based and layouts phone-first.

- Balance values live in `CONFIG`, `CHAINS` and `QUESTS` at the top of the `<script>`.
- Progress is saved in `localStorage` under the key `kittymerge`. When adding fields to the save, keep old saves loading (missing fields are defaulted from `freshState()` on load).
- Respect `prefers-reduced-motion`: give a gentler effect rather than none.

## Testing

`npm test` runs `tests/check.js`. It plays the game in headless Chromium at phone size, checks the main flows and saves screenshots to `tests/screenshots/`. Run it after gameplay/UI changes and look at the screenshots. Extend it when adding features.

## Every push

1. Bump the version label in `index.html` (`<span class="version">vX.Y</span>`) so the user can tell which build they're testing.
2. Update `README.md` (including the changelog) to reflect the change.
3. Run `npm test` first.
4. This Windows PC has no global git identity: commit with `-c user.name="Trin Pinthavirut" -c user.email="t.pinthavirut@gmail.com"`.
