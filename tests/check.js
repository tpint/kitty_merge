// Browser check for Kitty Merge: builds the game, serves it, plays it in headless Chromium at phone size,
// checks the main flows and saves screenshots to tests/screenshots/.
// Run: npm test   (first time: npm install && npx playwright install chromium)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const PORT = 4179, url = `http://localhost:${PORT}/`;
const shots = path.join(__dirname, 'screenshots');
fs.mkdirSync(shots, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(shots, name + '.png') });

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
const N = 23, idx = (i, j) => j * N + i;

function startServer() {
  const proc = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', PORT, '--strictPort'], { cwd: root });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', d => { if (String(d).includes(String(PORT))) resolve(proc); });
    proc.stderr.on('data', d => process.stderr.write(d));
    proc.on('exit', code => reject(new Error('preview server exited ' + code)));
  });
}

async function openGame(browser, options = {}, edit) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...options });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => m.type() === 'error' && page.errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.km);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.km);
  if (edit) await editSave(page, edit);
  await page.waitForTimeout(400);
  return page;
}
const save = page => page.evaluate(() => JSON.parse(JSON.stringify(window.km.save())));
// Change the save, store it, and reload the game from it.
async function editSave(page, fn) {
  await page.evaluate(src => {
    const s = window.km.save();
    new Function('s', src)(s);
    localStorage.setItem('kittymerge2', JSON.stringify(s));
  }, `(${fn})(s)`);
  await page.reload();
  await page.waitForFunction(() => window.km);
  await page.waitForTimeout(400);
}
const tile = (page, k) => page.evaluate(k => window.km.tileCss(k), k);
const cat = (page, id) => page.evaluate(id => window.km.catCss(id), id);
async function dragPts(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 15, a.y + 5, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}
const drag = async (page, from, to) => dragPts(page, await tile(page, from), await tile(page, to));
const tap = async (page, k) => { const p = await tile(page, k); await page.mouse.click(p.x, p.y); await page.waitForTimeout(300); };
const count = s => Object.keys(s.items).length;
const itemAt = (s, k) => s.items[k];
const waitFor = async (page, fn, ms) => { try { await page.waitForFunction(fn, null, { timeout: ms }); return true; } catch { return false; } };

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const page = await openGame(browser);
    await shot(page, '1-start');
    const s0 = await save(page);
    check(s0.land.filter(l => l === 3).length > 50 && s0.land.filter(l => l === 2).length > 30, 'island has dead land and fog');
    check(await page.locator('#questText').textContent().then(t => t.includes('Kitten Box')), 'first goal is to hatch a kitten');

    // Hatch: drag a box next to the other two (one stuck in dead land).
    await drag(page, idx(10, 12), idx(13, 10));
    let s = await save(page);
    check(s.cats.length === 1 && s.stats.hatched === 1, `3 boxes hatch a kitten (cats: ${s.cats.length})`);
    check(![idx(10, 12), idx(12, 10), idx(14, 10)].some(k => s.items[k]), 'all 3 boxes were used');
    check(s.stats.healed >= 1 && s.land[idx(14, 10)] === 1, 'merging on dead land heals it');
    check(s.stars > 0, 'merging earns stars');
    await page.waitForTimeout(600);
    await shot(page, '2-kitten');

    // Harvest: tap the tree, the kitten walks over and harvests it.
    const before = count(s);
    await tap(page, idx(11, 11));
    check((await save(page)).items[idx(11, 11)].queued === true, 'tapping the tree queues a harvest');
    await page.waitForTimeout(1500);
    await shot(page, '3-harvesting');
    const harvested = await waitFor(page, () => window.km.save().stats.harvests >= 1, 15000);
    s = await save(page);
    check(harvested && count(s) === before + 2, `kitten harvests the tree and it drops 2 items (${before} -> ${count(s)})`);
    check(s.items[idx(11, 11)].readyAt > Date.now(), 'tree regrows after a harvest');

    // Gift + coin.
    await page.waitForTimeout(800);
    const giftBefore = count(s);
    await tap(page, idx(10, 13));
    await page.waitForTimeout(600);
    s = await save(page);
    check(s.stats.gifts === 1 && count(s) === giftBefore + 2, 'gift opens into 3 items');
    const coins = s.coins;
    await tap(page, idx(11, 9));
    s = await save(page);
    check(s.coins === coins + 1 && !s.items[idx(11, 9)], 'tapping a coin collects it');

    // Life Spark heals an area of dead land.
    const healed = s.stats.healed;
    await drag(page, idx(10, 10), idx(8, 8));
    s = await save(page);
    check(s.stats.sparks === 1 && s.stats.healed >= healed + 3, `life spark heals dead land (${healed} -> ${s.stats.healed})`);
    await page.waitForTimeout(600);
    await shot(page, '4-healed');

    // Deterministic board for the rest.
    await editSave(page, s => {
      for (const k of Object.keys(s.items)) if (s.land[k] !== 3) delete s.items[k];
      const put = (i, j, c, t, extra = {}) => { s.items[j * 23 + i] = { id: s.nextId++, c, t, ...extra }; };
      put(10, 10, 'nip', 0); put(11, 10, 'nip', 0); put(10, 12, 'nip', 0);
      put(12, 12, 'yarn', 0); put(13, 13, 'fish', 0, { stuck: true });
      [[10, 10], [11, 10], [12, 10], [13, 10], [12, 9]].forEach(([i, j]) => { s.land[j * 23 + i] = 1; });
      s.cats = [0, 1, 2].map(n => ({ id: s.nextId++, t: 0, x: 9 + n * 0.8, y: 12.6 }));
    });
    // Cats merge 3 -> 1.
    s = await save(page);
    const [a, b] = s.cats;
    await dragPts(page, await cat(page, a.id), await cat(page, b.id));
    s = await save(page);
    check(s.cats.length === 1 && s.cats[0].t === 1 && s.stats.maxCat === 1, `3 kittens merge into a Ginger Cat (${s.cats.map(c => c.t)})`);
    await page.waitForTimeout(700);
    await shot(page, '5-cat-merge');

    // 3 sprouts merge.
    await drag(page, idx(10, 12), idx(10, 11));
    s = await save(page);
    check(s.items[idx(10, 11)]?.c === 'nip' && s.items[idx(10, 11)]?.t === 1 && !s.items[idx(10, 10)], 'dragging a sprout next to two more makes Catnip');
    // Stuck items don't move.
    await drag(page, idx(13, 13), idx(12, 11));
    check((await save(page)).items[idx(13, 13)]?.stuck, 'stuck items stay put');
    // Dropping onto a different item pushes it aside.
    await drag(page, idx(12, 12), idx(10, 11));
    s = await save(page);
    check(s.items[idx(10, 11)]?.c === 'yarn' && Object.values(s.items).some(it => it.c === 'nip' && it.t === 1), 'dropping on another item pushes it to a free spot');
    // Fog: open cluster costs stars.
    await editSave(page, s => { s.stars = 100; });
    const s1 = await save(page);
    const open = await page.evaluate(() => {
      const s = window.km.save(), N = 23;
      for (let c = 0; c < s.clusters.length; c++)
        for (let k = 0; k < N * N; k++)
          if (s.cluster[k] === c && s.land[k] === 3 && [k - 1, k + 1, k - N, k + N].some(n => s.land[n] === 1 || s.land[n] === 2)) return c;
      return -1;
    });
    const lp = await page.evaluate(c => window.km.clusterCss(c), open);
    await page.mouse.click(lp.x, lp.y);
    await page.waitForTimeout(300);
    check(await page.locator('#modal.show').count() === 1, 'tapping fog asks to clear it');
    await shot(page, '6-fog-dialog');
    await page.locator('#modalButtons button.primary').click();
    await page.waitForTimeout(1200);
    const s2 = await save(page);
    check(s2.stats.fog === 1 && s2.stars === 100 - s1.clusters[open].cost && s2.land.filter(l => l === 3).length < s1.land.filter(l => l === 3).length,
      'clearing fog spends stars and reveals land');
    await shot(page, '7-fog-cleared');

    // Shop.
    await editSave(page, s => { s.coins = 100; });
    await page.click('#shopBtn');
    await page.locator('.shop-item').first().click();
    s = await save(page);
    check(s.coins === 70 && Object.values(s.items).some(it => it.c === 'box' && !it.stuck), 'shop sells a Kitten Box for 30');

    // Panning moves the view.
    const p0 = await tile(page, idx(11, 11));
    await dragPts(page, { x: 40, y: 700 }, { x: 140, y: 650 });
    const p1 = await tile(page, idx(11, 11));
    check(Math.abs(p1.x - p0.x - 100) < 25, 'dragging empty space pans the island');

    // Persistence.
    const snap = JSON.stringify((await save(page)).items);
    await page.reload(); await page.waitForFunction(() => window.km);
    check(JSON.stringify((await save(page)).items) === snap, 'items survive a refresh');

    // Win.
    await editSave(page, s => { s.land = s.land.map(l => (l ? 1 : 0)); });
    check(await page.locator('#modal.show').count() === 1 && (await page.textContent('#modalBody')).includes('restored'), 'healing everything shows the win screen');
    await shot(page, '8-win');

    check(page.errors.length === 0, `no page errors ${page.errors.join(' | ')}`);

    // Small phone + reduced motion.
    const rm = await openGame(browser, { reducedMotion: 'reduce', viewport: { width: 360, height: 640 } });
    const fits = await rm.evaluate(() => {
      const r = id => document.getElementById(id).getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && r('shopBtn').bottom <= innerHeight && r('quest').right <= innerWidth;
    });
    check(fits, 'HUD fits a 360x640 phone');
    await shot(rm, '9-small-reduced-motion');
    check(rm.errors.length === 0, `no page errors on small phone ${rm.errors.join(' | ')}`);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
