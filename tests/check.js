// Browser check for Kitty Merge: plays the game in headless Chromium at phone size,
// checks the main flows, and saves screenshots to tests/screenshots/.
// Run: npm test   (first time: npm install && npx playwright install chromium)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const url = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const shots = path.join(__dirname, 'screenshots');
fs.mkdirSync(shots, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(shots, name + '.png') });

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const COLS = 7, idx = (r, c) => r * COLS + c;

async function openGame(browser, options = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...options });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
  return page;
}
const cell = (page, i) => page.locator(`.cell[data-i="${i}"]`);
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('kittymerge')));
const editSave = (page, fn) => page.evaluate(src => {
  const s = JSON.parse(localStorage.getItem('kittymerge'));
  new Function('s', src)(s);
  localStorage.setItem('kittymerge', JSON.stringify(s));
}, `(${fn})(s)`).then(() => page.reload()).then(() => page.waitForTimeout(300));
const itemAt = async (page, i) => (await state(page)).cells[i].item;
async function dragTo(page, fromBox, toBox) {
  const fx = fromBox.x + fromBox.width / 2, fy = fromBox.y + fromBox.height / 2;
  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await page.mouse.move(fx + 12, fy, { steps: 2 });
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
const drag = async (page, from, to) => dragTo(page, await cell(page, from).boundingBox(), await cell(page, to).boundingBox());

(async () => {
  const browser = await chromium.launch();
  const page = await openGame(browser);
  await shot(page, '1-start');
  check(await page.locator('.cell').count() === 63, 'board has 7x9 cells');

  // Generator: tap the catnip tree.
  const tree = idx(7, 3);
  const e0 = +(await page.textContent('#energy'));
  for (let k = 0; k < 3; k++) await cell(page, tree).click();
  const s1 = await state(page);
  check(s1.energy === e0 - 3, `tree taps spend energy (${e0} -> ${s1.energy})`);
  check(s1.cells.filter(c => c.item && c.item.c === 'nip' && c.item.t === 0).length >= 6, 'tree taps spawn sprouts');
  check(await page.locator('#claimBtn').count() === 1, 'first goal is claimable');
  await page.click('#claimBtn', { force: true });
  check((await state(page)).quest === 1, 'claiming advances the goal');

  // Merge: 3 boxes (one stuck in the weeds) -> kitten, healing weeds.
  const healedBefore = (await state(page)).stats.healed;
  await drag(page, idx(6, 4), idx(6, 3));
  const s2 = await state(page);
  const kitten = s2.cells.findIndex(c => c.item && c.item.c === 'cat' && c.item.t === 1);
  check(kitten === idx(6, 3), `3 boxes merge into a kitten at the drop cell (got ${kitten})`);
  check(s2.stats.healed > healedBefore, 'merging on weeds heals land');
  check(!s2.cells.some(c => c.item && c.item.c === 'cat' && c.item.t === 0), 'all 3 boxes were used up');
  await shot(page, '2-kitten');

  // Cat tap gives a gift, then naps.
  const count = s => s.cells.filter(c => c.item).length;
  const before = count(s2);
  await cell(page, kitten).click();
  const s3 = await state(page);
  check(count(s3) === before + 1 && s3.stats.catTaps === 1, 'tapping the kitten drops a gift');
  await page.waitForTimeout(1100);
  check(await cell(page, kitten).evaluate(el => el.classList.contains('napping')), 'kitten naps after a gift');
  await cell(page, kitten).click();
  check(count(await state(page)) === before + 1, 'napping kitten gives nothing');

  // Stuck items can't be dragged; dropping on a different item swaps them.
  const stuck = idx(5, 1);
  await drag(page, stuck, idx(6, 1));
  check((await itemAt(page, stuck))?.stuck === true, 'stuck items stay put');
  const a = await itemAt(page, idx(7, 1)), b = await itemAt(page, idx(8, 3));
  await drag(page, idx(7, 1), idx(8, 3));
  const a2 = await itemAt(page, idx(8, 3)), b2 = await itemAt(page, idx(7, 1));
  check(a2.c === a.c && b2.c === b.c, 'dropping on a different item swaps them');

  // Selling.
  const coins = (await state(page)).coins;
  await dragTo(page, await cell(page, idx(7, 1)).boundingBox(), await page.locator('#sell').boundingBox());
  const s4 = await state(page);
  check(!s4.cells[idx(7, 1)].item && s4.coins > coins, 'dragging to the basket sells the item');

  // Shop + fog.
  await editSave(page, s => { s.coins = 100; });
  await page.locator('#shop button').first().click();
  check((await state(page)).coins === 95, 'shop buys a sprout for 5');
  const fog = idx(2, 3);
  await cell(page, fog).click();
  check((await state(page)).cells[fog].land === 'fog', 'first fog tap only asks to confirm');
  await cell(page, fog).click();
  const s5 = await state(page);
  check(s5.cells[fog].land === 'weed' && s5.coins === 85, 'second fog tap clears it for 10');
  check(await cell(page, idx(0, 0)).evaluate(el => el.classList.contains('locked')), 'far fog is locked');

  // 5 in a row -> 2 of the next level.
  await editSave(page, s => {
    s.cells.forEach(c => { c.item = null; });
    [42, 43, 44, 45].forEach(i => { s.cells[i].item = { c: 'yarn', t: 0 }; });
    s.cells[56].item = { c: 'yarn', t: 0 };
  });
  await drag(page, 56, 46);
  const yarn = (await state(page)).cells.filter(c => c.item && c.item.c === 'yarn' && c.item.t === 1).length;
  check(yarn === 2, `merging 5 makes 2 (got ${yarn})`);

  // Persistence.
  const snap = JSON.stringify((await state(page)).cells);
  await page.reload(); await page.waitForTimeout(300);
  check(JSON.stringify((await state(page)).cells) === snap, 'board survives a refresh');
  await shot(page, '3-midgame');

  // Win screen.
  await editSave(page, s => { s.cells.forEach(c => { c.land = 'grass'; }); });
  check(await page.locator('#overlay.show').count() === 1, 'healing everything shows the win screen');
  await shot(page, '4-win');
  await page.click('#newGardenBtn');
  check((await state(page)).cells.some(c => c.land === 'weed'), 'new garden resets the board');

  check(page.errors.length === 0, `no page errors ${page.errors.join(' | ')}`);

  // Reduced motion + small phone.
  const rm = await openGame(browser, { reducedMotion: 'reduce', viewport: { width: 360, height: 640 } });
  const fits = await rm.evaluate(() => document.documentElement.scrollWidth <= innerWidth
    && document.querySelector('.shop').getBoundingClientRect().bottom <= innerHeight);
  check(fits, 'fits a 360x640 phone without scrolling');
  await shot(rm, '5-small-reduced-motion');

  await browser.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
