// The island scene: ground, items, cats, fog, input and all game actions.
import Phaser from 'phaser';
import { CATS, CAT_MERGE_RADIUS, CAT_WALK_SPEED, ChainId, GIFT_POOL, QUESTS, SAVE_KEY, SELL_VALUE, SHOP, TILE_H, TILE_W } from './config';
import { CLIFF_H, GROUND_VARIANTS, itemKey, makeArt } from './art';
import { hud } from './hud';
import * as S from './state';
import { CatData, DEAD, FOG, Item, LIVING, N, WATER, def, ij, idx } from './state';

type Image = Phaser.GameObjects.Image;
type Container = Phaser.GameObjects.Container;

const HW = TILE_W / 2, HH = TILE_H / 2;
const toWorld = (i: number, j: number) => ({ x: (i - j) * HW, y: (i + j) * HH });
const toTileF = (x: number, y: number) => ({ i: (x / HW + y / HH) / 2, j: (y / HH - x / HW) / 2 });
const center = (k: number) => { const [i, j] = ij(k); return toWorld(i, j); };
function tileAt(x: number, y: number) {
  const { i, j } = toTileF(x, y), ri = Math.round(i), rj = Math.round(j);
  return ri < 0 || rj < 0 || ri >= N || rj >= N ? -1 : idx(ri, rj);
}
const DEPTH = 10;              // items/cats/clouds sort by DEPTH + screen y
const TOP = 5_000_000;         // labels, bars, effects
const HELD = 10_000_000;       // whatever is being dragged
const ITEM_SCALE = 0.82;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

interface ItemView { id: number; k: number; box: Container; sprite: Image; marker?: Image }
interface CatView {
  d: CatData; box: Container; rig: Container; body: Image; tail: Image;
  state: 'idle' | 'walk' | 'harvest' | 'held'; targetId?: number; dest?: { x: number; y: number };
  wanderAt: number; work: number; workTotal: number; hop: number; bar: Phaser.GameObjects.Graphics;
}
type Hit = { kind: 'item'; v: ItemView } | { kind: 'cat'; c: CatView } | { kind: 'tile'; k: number };
interface Gesture {
  id: number; x: number; y: number; hit: Hit; mode: 'pending' | 'pan' | 'item' | 'cat';
  from?: { x: number; y: number };
}

export class World extends Phaser.Scene {
  s!: S.Save;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  ground: (Image | null)[] = [];
  items = new Map<number, ItemView>();
  cats = new Map<number, CatView>();
  clouds = new Map<number, Image[]>();
  labels = new Map<number, Container>();
  hls: Image[] = [];
  selHl!: Image;
  selected: Hit | null = null;
  gesture: Gesture | null = null;
  pinch: { dist: number; zoom: number } | null = null;
  sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  leaves!: Phaser.GameObjects.Particles.ParticleEmitter;
  dirty = false; lastSave = 0; lastCatSave = 0; lastInfo = 0;

  constructor() { super('world'); }

  create() {
    this.s = S.load();
    makeArt(this);
    this.buildGround();
    this.buildFog();
    for (const [k, it] of Object.entries(this.s.items)) this.addItemView(+k, it);
    for (const d of this.s.cats) this.addCatView(d);
    this.selHl = this.add.image(0, 0, 'hl_sel').setDepth(2).setVisible(false);
    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 90, max: 260 }, lifespan: 700, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 },
      gravityY: 250, emitting: false,
    }).setDepth(TOP);
    this.leaves = this.add.particles(0, 0, 'leaf', {
      speed: { min: 40, max: 140 }, lifespan: 800, scale: { start: 1, end: 0.3 }, alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 }, gravityY: -30, emitting: false,
    }).setDepth(TOP);

    this.setupCamera();
    this.setupInput();
    hud.init(k => this.buy(k), () => this.claim(), () => this.reset());
    this.refreshHud();
    this.scale.on('resize', () => this.cameras.main.setSize(this.scale.width, this.scale.height));

    (window as any).km = {
      save: () => this.s,
      tileCss: (k: number) => this.worldToCss(center(k).x, center(k).y - 18),
      catCss: (id: number) => { const c = this.cats.get(id)!; return this.worldToCss(c.box.x, c.box.y - 30 * CATS[c.d.t].scale); },
      clusterCss: (c: number) => { const l = this.labels.get(c)!; return this.worldToCss(l.x, l.y); },
      idx,
      setZoom: (z: number) => this.cameras.main.setZoom(z * this.dpr),
    };
  }

  // ---------- Building the world ----------
  buildGround() {
    const halo = this.add.graphics().setDepth(-1);
    halo.fillStyle(0x86d8e6, 1);
    for (let k = 0; k < N * N; k++) if (this.s.land[k] !== WATER) {
      const { x, y } = center(k);
      halo.fillPoints([{ x, y: y - HH * 1.9 }, { x: x + HW * 1.9, y }, { x, y: y + HH * 2.1 }, { x: x - HW * 1.9, y }], true);
    }
    for (let n = 0; n < 40; n++) {
      const a = Math.random() * Math.PI * 2, r = 11 + Math.random() * 5, c = (N - 1) / 2;
      const p = toWorld(c + Math.cos(a) * r, c + Math.sin(a) * r);
      const w = this.add.image(p.x, p.y, 'wave').setDepth(-0.5).setAlpha(0);
      if (!reduceMotion()) this.tweens.add({ targets: w, alpha: 0.8, x: p.x + 20, duration: 1800 + Math.random() * 1500, yoyo: true, repeat: -1, delay: Math.random() * 3000 });
      else w.setAlpha(0.5);
    }
    this.ground = new Array(N * N).fill(null);
    const southWater = (i: number, j: number) => {
      const w = (a: number, b: number) => a >= N || b >= N || this.s.land[idx(a, b)] === WATER;
      return w(i + 1, j) || w(i, j + 1);
    };
    for (let sum = 0; sum <= 2 * (N - 1); sum++)
      for (let i = 0; i < N; i++) {
        const j = sum - i; if (j < 0 || j >= N) continue;
        const k = idx(i, j); if (this.s.land[k] === WATER) continue;
        const { x, y } = toWorld(i, j);
        if (southWater(i, j)) this.add.image(x, y, 'cliff').setOrigin(0.5, (HH + 1) / (TILE_H + 2 + CLIFF_H)).setDepth(0);
        this.ground[k] = this.add.image(x, y, this.groundKey(k)).setDepth(1);
      }
  }
  groundKey(k: number) {
    const v = ((k * 2654435761) >>> 0) % GROUND_VARIANTS;
    return (this.s.land[k] === LIVING ? 'grass' : 'dead') + v;
  }

  buildFog() {
    const rnd = S.mulberry32(99);
    for (let k = 0; k < N * N; k++) {
      if (this.s.land[k] !== FOG) continue;
      const { x, y } = center(k), c = this.s.cluster[k];
      const img = this.add.image(x + (rnd() - 0.5) * 30, y - 10 + (rnd() - 0.5) * 16, 'cloud')
        .setScale(0.85 + rnd() * 0.25).setDepth(DEPTH + y + 60);
      if (!reduceMotion()) this.tweens.add({ targets: img, x: img.x + 8, y: img.y - 4, duration: 2200 + rnd() * 1800, yoyo: true, repeat: -1 });
      if (!this.clouds.has(c)) this.clouds.set(c, []);
      this.clouds.get(c)!.push(img);
    }
    this.refreshLabels();
  }
  fogOpen(c: number) {
    for (let k = 0; k < N * N; k++)
      if (this.s.cluster[k] === c && this.s.land[k] === FOG && S.neighbors(k).some(n => S.isGround(this.s, n))) return true;
    return false;
  }
  refreshLabels() {
    this.labels.forEach(l => l.destroy()); this.labels.clear();
    this.s.clusters.forEach((cl, c) => {
      if (!this.s.land.some((l, k) => l === FOG && this.s.cluster[k] === c)) return;
      const open = this.fogOpen(c), p = toWorld(cl.cx, cl.cy);
      const txt = this.add.text(0, 0, open ? `⭐ ${cl.cost}` : '🔒', {
        fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#5b4a6e',
      }).setOrigin(0.5);
      const w = txt.width + 34, h = 50;
      const bg = this.add.graphics();
      bg.fillStyle(open ? 0xffffff : 0xe8edf5, open ? 0.95 : 0.8).fillRoundedRect(-w / 2, -h / 2, w, h, 25);
      if (open) bg.lineStyle(4, 0xffc94d, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 25);
      const box = this.add.container(p.x, p.y - 30, [bg, txt]).setDepth(TOP - 10).setSize(w, h);
      this.labels.set(c, box);
    });
  }

  addItemView(k: number, it: Item, opts: { pop?: boolean; from?: { x: number; y: number } } = {}) {
    const { x, y } = center(k);
    const shadow = this.add.image(0, 6, 'shadow').setScale(0.95);
    const sprite = this.add.image(0, 12, itemKey(it.c, it.t)).setOrigin(0.5, 1).setScale(ITEM_SCALE);
    const box = this.add.container(x, y, [shadow, sprite]).setDepth(DEPTH + y);
    const v: ItemView = { id: it.id, k, box, sprite };
    this.items.set(it.id, v);
    box.setVisible(this.s.land[k] !== FOG);
    this.styleItem(v);
    if (opts.from && !reduceMotion()) {
      box.setPosition(opts.from.x, opts.from.y);
      this.tweens.add({ targets: box, x, duration: 450, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: box, y: { from: opts.from.y, to: y }, duration: 450, ease: 'Back.easeIn' });
      sprite.setScale(0.2);
      this.tweens.add({ targets: sprite, scale: ITEM_SCALE, duration: 300 });
    } else if (opts.pop) {
      sprite.setScale(reduceMotion() ? ITEM_SCALE * 0.9 : 0.1);
      this.tweens.add({ targets: sprite, scale: ITEM_SCALE, duration: reduceMotion() ? 150 : 380, ease: reduceMotion() ? 'Linear' : 'Back.easeOut' });
    }
    return v;
  }
  styleItem(v: ItemView) {
    const it = this.s.items[v.k];
    if (!it) return;
    if (it.stuck) v.sprite.setTint(0x7d6a99); else v.sprite.clearTint();
    const d = def(it), regrowing = !!d.harvest && (it.readyAt || 0) > Date.now();
    v.sprite.setAlpha(regrowing ? 0.55 : 1);
    if (it.queued && !v.marker) {
      v.marker = this.add.image(0, -100, 'em_🐾').setScale(0.55);
      v.box.add(v.marker);
      if (!reduceMotion()) this.tweens.add({ targets: v.marker, y: -112, duration: 450, yoyo: true, repeat: -1 });
    } else if (!it.queued && v.marker) { v.marker.destroy(); v.marker = undefined; }
  }
  viewAt(k: number) { const it = this.s.items[k]; return it ? this.items.get(it.id) : undefined; }
  removeItemView(v: ItemView, how: 'fade' | 'none' = 'fade') {
    this.items.delete(v.id);
    if (how === 'none') { v.box.destroy(); return; }
    this.tweens.add({ targets: v.box, alpha: 0, y: v.box.y - 30, duration: 220, onComplete: () => v.box.destroy() });
  }
  moveItemView(v: ItemView, k: number) {
    v.k = k;
    const { x, y } = center(k);
    v.box.setDepth(DEPTH + y);
    this.tweens.add({ targets: v.box, x, y, scale: 1, duration: 160, ease: 'Sine.easeOut' });
  }

  addCatView(d: CatData, pop = false) {
    const lvl = CATS[d.t], p = toWorld(d.x, d.y);
    const shadow = this.add.image(0, 2, 'shadow').setScale(lvl.scale * 1.2);
    const tail = this.add.image(30, -25, `tail${d.t}`).setOrigin(0.14, 0.89);
    const body = this.add.image(0, 0, `cat${d.t}`).setOrigin(0.5, 0.97);
    const rig = this.add.container(0, 0, [tail, body]).setScale(lvl.scale);
    const box = this.add.container(p.x, p.y, [shadow, rig]).setDepth(DEPTH + p.y + 20);
    const bar = this.add.graphics().setDepth(TOP);
    const cv: CatView = { d, box, rig, body, tail, state: 'idle', wanderAt: this.time.now + 1500 + Math.random() * 2000, work: 0, workTotal: 1, hop: 0, bar };
    this.cats.set(d.id, cv);
    if (!reduceMotion()) {
      this.tweens.add({ targets: tail, angle: { from: -12, to: 14 }, duration: 800 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: body, scaleY: 1.035, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (pop) {
      rig.setScale(0.1);
      this.tweens.add({ targets: rig, scale: lvl.scale, duration: reduceMotion() ? 150 : 500, ease: reduceMotion() ? 'Linear' : 'Back.easeOut' });
    }
    return cv;
  }
  // The cat is saved right away; it appears on screen after `delay` ms (after the merge animation).
  spawnCat(t: number, x: number, y: number, delay = 200) {
    const d: CatData = { id: this.s.nextId++, t, x, y };
    this.s.cats.push(d);
    this.time.delayedCall(delay, () => {
      if (!this.s.cats.includes(d)) return;
      const cv = this.addCatView(d, true);
      this.sparkle(cv.box.x, cv.box.y - 40, 18);
    });
  }
  removeCat(cv: CatView, to?: { x: number; y: number }) {
    this.cats.delete(cv.d.id);
    this.s.cats = this.s.cats.filter(c => c.id !== cv.d.id);
    cv.bar.destroy();
    this.tweens.add({ targets: cv.box, x: to?.x ?? cv.box.x, y: to?.y ?? cv.box.y, alpha: 0, scale: 0.4, duration: 220, onComplete: () => cv.box.destroy() });
  }

  // ---------- Camera ----------
  setupCamera() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#4fb8cf');
    const span = N * HW;
    cam.setBounds(-span - 300, -400, span * 2 + 600, N * TILE_H + 800);
    const cssW = this.scale.width / this.dpr, cssH = this.scale.height / this.dpr;
    const z = Phaser.Math.Clamp(Math.min(cssW / (5.6 * TILE_W), cssH / (11 * TILE_H)), 0.35, 0.7);
    cam.setZoom(z * this.dpr);
    const c = toWorld((N - 1) / 2, (N - 1) / 2);
    cam.centerOn(c.x, c.y + 20);
  }
  zoomAt(px: number, py: number, z: number) {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(px, py);
    cam.setZoom(Phaser.Math.Clamp(z, 0.28 * this.dpr, 1.5 * this.dpr));
    cam.preRender();
    const after = cam.getWorldPoint(px, py);
    cam.scrollX += before.x - after.x; cam.scrollY += before.y - after.y;
  }
  worldToCss(wx: number, wy: number) {
    const cam = this.cameras.main;
    return { x: ((wx - cam.worldView.x) * cam.zoom) / this.dpr, y: ((wy - cam.worldView.y) * cam.zoom) / this.dpr };
  }

  // ---------- Input ----------
  setupInput() {
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (hud.modalOpen()) return;
      const down = this.input.manager.pointers.filter(q => q.isDown);
      if (down.length >= 2) {
        this.cancelGesture();
        const [a, b] = down;
        this.pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.cameras.main.zoom };
        return;
      }
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.gesture = { id: p.id, x: p.x, y: p.y, hit: this.hitTest(w.x, w.y), mode: 'pending' };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.pinch) {
        const down = this.input.manager.pointers.filter(q => q.isDown);
        if (down.length >= 2) {
          const [a, b] = down, d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
          this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (this.pinch.zoom * d) / this.pinch.dist);
        }
        return;
      }
      const g = this.gesture;
      if (!g || p.id !== g.id || !p.isDown) return;
      if (g.mode === 'pending') {
        if (Phaser.Math.Distance.Between(p.x, p.y, g.x, g.y) < 10 * this.dpr) return;
        if (g.hit.kind === 'item' && !this.s.items[g.hit.v.k]?.stuck) this.startItemDrag(g, g.hit.v);
        else if (g.hit.kind === 'cat') this.startCatDrag(g, g.hit.c);
        else g.mode = 'pan';
      }
      const cam = this.cameras.main, w = cam.getWorldPoint(p.x, p.y);
      if (g.mode === 'pan') {
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      } else if (g.mode === 'item' && g.hit.kind === 'item') {
        g.hit.v.box.setPosition(w.x, w.y + 24);
        this.previewItem(g.hit.v, tileAt(w.x, w.y + 24));
      } else if (g.mode === 'cat' && g.hit.kind === 'cat') {
        g.hit.c.box.setPosition(w.x, w.y + 30);
        this.previewCat(g.hit.c);
      }
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (this.pinch) { if (!this.input.manager.pointers.some(q => q.isDown)) this.pinch = null; return; }
      const g = this.gesture;
      if (!g || p.id !== g.id) return;
      this.gesture = null;
      this.clearHl();
      if (g.mode === 'pending') this.tap(g.hit);
      else if (g.mode === 'item' && g.hit.kind === 'item') this.dropItem(g.hit.v);
      else if (g.mode === 'cat' && g.hit.kind === 'cat') this.dropCat(g.hit.c, g.from!);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAt(p.x, p.y, this.cameras.main.zoom * (dy > 0 ? 0.9 : 1.1));
    });
  }
  cancelGesture() {
    const g = this.gesture; this.gesture = null; this.clearHl();
    if (!g) return;
    if (g.mode === 'item' && g.hit.kind === 'item') this.moveItemView(g.hit.v, g.hit.v.k);
    if (g.mode === 'cat' && g.hit.kind === 'cat') this.dropCat(g.hit.c, g.from!, true);
  }
  hitTest(wx: number, wy: number): Hit {
    let best: Hit | null = null, bestDepth = -Infinity;
    for (const c of this.cats.values()) {
      const sc = CATS[c.d.t].scale, dx = wx - c.box.x, dy = wy - c.box.y;
      if (Math.abs(dx) < 55 * sc + 10 && dy < 16 && dy > -150 * sc && c.box.depth > bestDepth) { best = { kind: 'cat', c }; bestDepth = c.box.depth; }
    }
    if (best) return best;
    // The item standing on the tile under the finger wins; tall sprites are only hit through empty tiles.
    const under = this.viewAt(tileAt(wx, wy));
    if (under && under.box.visible) return { kind: 'item', v: under };
    for (const v of this.items.values()) {
      if (!v.box.visible) continue;
      const dx = wx - v.box.x, dy = wy - v.box.y;
      if (Math.abs(dx) < 44 && dy > -92 && dy < 26 && v.box.depth > bestDepth) { best = { kind: 'item', v }; bestDepth = v.box.depth; }
    }
    return best || { kind: 'tile', k: tileAt(wx, wy) };
  }

  // ---------- Highlights ----------
  hl(k: number, key: string) {
    const img = this.hls.find(h => !h.visible) || (() => { const h = this.add.image(0, 0, key).setDepth(2); this.hls.push(h); return h; })();
    const { x, y } = center(k);
    img.setTexture(key).setPosition(x, y).setVisible(true);
  }
  clearHl() {
    this.hls.forEach(h => h.setVisible(false));
    for (const c of this.cats.values()) c.body.clearTint();
  }

  // ---------- Selection & info ----------
  select(hit: Hit | null) {
    this.selected = hit;
    this.selHl.setVisible(false);
    if (!hit) { hud.hideInfo(); return; }
    if (hit.kind === 'item') { const { x, y } = center(hit.v.k); this.selHl.setPosition(x, y).setVisible(true); }
    this.showInfo();
  }
  showInfo() {
    const h = this.selected;
    if (!h) return;
    if (h.kind === 'cat') {
      const cv = this.cats.get(h.c.d.id);
      if (!cv) return this.select(null);
      const lvl = CATS[cv.d.t], next = CATS[cv.d.t + 1];
      const doing = cv.state === 'harvest' ? 'Harvesting…' : cv.state === 'walk' && cv.targetId !== undefined ? 'On the way to harvest.' : 'Waiting for a job.';
      hud.info(`<b>${lvl.n}</b> · Lv ${cv.d.t + 1}<br>${doing} Works ${lvl.speed}× fast.` +
        (next ? ` Drag 3 together → <b>${next.n}</b>.` : ' Max level!'));
      return;
    }
    if (h.kind !== 'item') return;
    const it = this.s.items[h.v.k];
    if (!it || it.id !== h.v.id) return this.select(null);
    const d = def(it), parts: string[] = [];
    if (it.stuck) parts.push('Stuck in dead land. Merge matching items next to it to free it.');
    else if (d.harvest) {
      const left = Math.ceil(((it.readyAt || 0) - Date.now()) / 1000);
      parts.push(left > 0 ? `Regrows in ${left}s.` : it.queued ? 'A cat is coming to harvest it!' : 'Tap to send a cat to harvest it.');
    } else if (d.heal) parts.push(`Drag onto dead land to heal it (radius ${d.heal}).`);
    else if (d.hatch) parts.push('Merge 3 to hatch a kitten!');
    if (!d.max) parts.push(`Merge 3 → <b>${def({ c: it.c, t: it.t + 1 }).e} ${def({ c: it.c, t: it.t + 1 }).n}</b>.`);
    else if (!d.hatch) parts.push('Max level!');
    const sell = SELL_VALUE[it.t] ?? 1;
    hud.info(`<b>${d.e} ${d.n}</b> · Lv ${it.t + 1}<br>${parts.join(' ')}`,
      it.stuck ? [] : [{ label: `Sell +${sell}🪙`, kind: 'plain', onClick: () => this.sell(h.v) }]);
  }

  // ---------- Actions ----------
  tap(hit: Hit) {
    if (hit.kind === 'tile') {
      const k = hit.k;
      if (k >= 0 && this.s.land[k] === FOG) return this.tapFog(this.s.cluster[k]);
      return this.select(null);
    }
    if (hit.kind === 'cat') {
      this.select(hit);
      this.floatText(hit.c.box.x, hit.c.box.y - 110 * CATS[hit.c.d.t].scale, '❤️');
      if (!reduceMotion()) this.tweens.add({ targets: hit.c.rig, y: -22, duration: 150, yoyo: true, ease: 'Quad.easeOut' });
      return;
    }
    const v = hit.v, it = this.s.items[v.k];
    if (!it) return;
    const d = def(it);
    if (it.stuck) { this.select(hit); return; }
    if (d.coin || d.gem) return this.collect(v, it);
    if (d.gift) return this.openGift(v, it);
    if (d.harvest) {
      const left = (it.readyAt || 0) - Date.now();
      if (left <= 0) {
        if (!this.cats.size) hud.toast('No cats yet! Merge 3 📦 Kitten Boxes to hatch one.');
        else { it.queued = !it.queued; this.styleItem(v); this.markDirty(); }
      }
    }
    this.select(hit);
  }

  collect(v: ItemView, it: Item) {
    const d = def(it), css = this.worldToCss(v.box.x, v.box.y - 40);
    delete this.s.items[v.k];
    this.removeItemView(v);
    if (d.coin) { this.s.coins += d.coin; hud.fly('🪙', css.x, css.y, 'coins'); }
    if (d.gem) { this.s.gems += d.gem; hud.fly('💎', css.x, css.y, 'gems'); }
    this.select(null);
    this.changed();
  }
  openGift(v: ItemView, it: Item) {
    const d = def(it), from = { x: v.box.x, y: v.box.y - 30 };
    delete this.s.items[v.k];
    this.removeItemView(v);
    this.sparkle(from.x, from.y, 20);
    this.spill(v.k, from, d.gift!, GIFT_POOL);
    this.s.stats.gifts++;
    this.select(null);
    this.changed();
  }
  spill(k: number, from: { x: number; y: number }, count: number, pool: [ChainId, number, number][]) {
    for (let n = 0; n < count; n++) {
      const [c, t] = S.pick(pool);
      const e = S.nearestEmpty(this.s, k);
      if (e < 0) { hud.toast('The island is full! Merge or sell something.'); break; }
      const item = this.newItem(c, t);
      this.s.items[e] = item;
      this.time.delayedCall(n * 90, () => { if (this.s.items[e] === item) this.addItemView(e, item, { from }); });
    }
  }
  newItem(c: ChainId, t: number): Item { return { id: this.s.nextId++, c, t }; }

  sell(v: ItemView) {
    const it = this.s.items[v.k]; if (!it) return;
    const value = SELL_VALUE[it.t] ?? 1, css = this.worldToCss(v.box.x, v.box.y - 40);
    delete this.s.items[v.k];
    this.removeItemView(v);
    this.s.coins += value;
    hud.fly('🪙', css.x, css.y, 'coins');
    this.select(null);
    this.changed();
  }

  buy(k: number) {
    const offer = SHOP[k], p = offer.price;
    if ((p.coins || 0) > this.s.coins || (p.gems || 0) > this.s.gems) return hud.toast('Not enough ' + (p.gems ? '💎 gems' : '🪙 coins'));
    const cam = this.cameras.main;
    let at = tileAt(cam.midPoint.x, cam.midPoint.y);
    if (at < 0 || !S.isGround(this.s, at)) at = idx(11, 11);
    const e = S.isGround(this.s, at) && !this.s.items[at] ? at : S.nearestEmpty(this.s, at);
    if (e < 0) return hud.toast('The island is full!');
    this.s.coins -= p.coins || 0; this.s.gems -= p.gems || 0;
    const item = this.newItem(offer.c, offer.t);
    this.s.items[e] = item;
    const v = this.addItemView(e, item, { pop: true });
    this.sparkle(v.box.x, v.box.y - 30, 10);
    this.select({ kind: 'item', v });
    this.changed();
  }

  tapFog(c: number) {
    this.select(null);
    if (c < 0) return;
    if (!this.fogOpen(c)) return hud.toast('Clear the fog closer to your camp first.');
    const cost = this.s.clusters[c].cost;
    hud.modal(`<div class="big">☁️</div><h2>Clear this fog?</h2><p>Costs <b>${cost} ⭐</b> — you have ${this.s.stars} ⭐.<br>Earn stars by merging.</p>`, [
      { label: 'Not now', kind: 'plain', onClick: () => {} },
      { label: `Clear ⭐ ${cost}`, disabled: this.s.stars < cost, onClick: () => this.unlockFog(c) },
    ]);
  }
  unlockFog(c: number) {
    const cost = this.s.clusters[c].cost;
    if (this.s.stars < cost) return;
    this.s.stars -= cost;
    for (let k = 0; k < N * N; k++) {
      if (this.s.cluster[k] !== c || this.s.land[k] !== FOG) continue;
      this.s.land[k] = DEAD;
      const v = this.viewAt(k);
      if (v) {
        v.box.setVisible(true);
        v.sprite.setScale(0.1);
        this.tweens.add({ targets: v.sprite, scale: ITEM_SCALE, duration: 400, delay: 200 + Math.random() * 300, ease: 'Back.easeOut' });
      }
    }
    for (const img of this.clouds.get(c) || [])
      this.tweens.add({ targets: img, alpha: 0, scale: img.scale * 1.6, y: img.y - 60, duration: 700 + Math.random() * 400, onComplete: () => img.destroy() });
    this.clouds.delete(c);
    this.s.stats.fog++;
    this.refreshLabels();
    this.changed();
  }

  // ---------- Dragging items ----------
  startItemDrag(g: Gesture, v: ItemView) {
    g.mode = 'item';
    v.box.setDepth(HELD);
    this.tweens.add({ targets: v.box, scale: 1.15, duration: 120 });
    this.select(null);
  }
  previewItem(v: ItemView, to: number) {
    this.clearHl();
    const it = this.s.items[v.k];
    if (!it || to < 0) return;
    const g = this.mergeTargets(v.k, to, it);
    if (g) { g.forEach(k => this.hl(k, 'hl_merge')); return; }
    const d = def(it);
    if (d.heal && this.s.land[to] === DEAD) { this.healArea(to, d.heal).forEach(k => this.hl(k, 'hl_heal')); return; }
    if (S.isGround(this.s, to)) this.hl(to, 'hl_drop');
  }
  // Tiles that would merge if the item at `from` were dropped on `to` (drop tile first), or null.
  mergeTargets(from: number, to: number, it: Item): number[] | null {
    if (!S.isGround(this.s, to) || to === from || !S.canMerge(it)) return null;
    const dst = this.s.items[to];
    if (dst && !S.same(dst, it)) return null;
    const g = S.group(this.s, to, it, from);
    if (!dst) g.shift();
    return g.length + 1 >= 3 ? [to, ...g.filter(k => k !== to)] : null;
  }
  healArea(at: number, r: number) {
    const [ci, cj] = ij(at), out: number[] = [];
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || j < 0 || i >= N || j >= N || Math.abs(i - ci) + Math.abs(j - cj) > r) continue;
      if (this.s.land[idx(i, j)] === DEAD) out.push(idx(i, j));
    }
    return out;
  }
  dropItem(v: ItemView) {
    const from = v.k, it = this.s.items[from];
    const to = tileAt(v.box.x, v.box.y);
    this.tweens.add({ targets: v.box, scale: 1, duration: 100 });
    if (!it || to < 0 || to === from || !S.isGround(this.s, to)) return this.moveItemView(v, from);
    const dst = this.s.items[to], d = def(it);

    if (dst && S.same(dst, it)) {
      const g = this.mergeTargets(from, to, it);
      if (g) { delete this.s.items[from]; this.merge(g, g.length, it, v); return; }
      hud.toast(S.canMerge(it) ? 'Need 3 matching items to merge' : 'That one is already max level!');
      return this.moveItemView(v, from);
    }
    if (d.heal && this.s.land[to] === DEAD) return this.useOrb(v, to);
    if (dst?.stuck) { hud.toast('That item is stuck — merge onto it to free it.'); return this.moveItemView(v, from); }

    delete this.s.items[from];
    this.s.items[to] = it;
    this.moveItemView(v, to);
    if (dst) {
      // Push the item that was there to the nearest free spot, like Merge Dragons.
      const dv = this.items.get(dst.id)!;
      let e = S.nearestEmpty(this.s, to);
      if (e < 0) e = from;
      this.s.items[e] = dst;
      this.moveItemView(dv, e);
    }
    const g = S.group(this.s, to, it);
    if (g.length >= 3 && S.canMerge(it)) this.merge(g, g.length, it);
    else this.select({ kind: 'item', v });
    this.changed();
  }

  // n matching items merge; `order` are the board tiles involved, drop tile first.
  merge(order: number[], n: number, kind: { c: ChainId; t: number }, dragged?: ItemView) {
    const target = center(order[0]);
    const views = order.map(k => this.viewAt(k)).filter((v): v is ItemView => !!v);
    if (dragged) views.push(dragged);
    const { outs, rem } = S.mergeResult(n);
    for (const k of order) delete this.s.items[k];
    for (const v of views) {
      this.items.delete(v.id);
      this.tweens.add({ targets: v.box, x: target.x, y: target.y, scale: 0.5, alpha: 0, duration: 200, ease: 'Quad.easeIn', onComplete: () => v.box.destroy() });
    }
    for (const k of order) if (this.s.land[k] === DEAD) this.heal(k, 150);

    const hatch = !!def(kind).hatch, next = kind.t + 1;
    const created: [number, Item][] = [];
    if (hatch) {
      for (let o = 0; o < outs; o++) {
        const [i, j] = ij(order[o]);
        this.spawnCat(0, i + 0.2, j + 0.2);
      }
      this.s.stats.hatched += outs;
      for (let r = 0; r < rem; r++) created.push([order[order.length - 1 - r], this.newItem(kind.c, kind.t)]);
    } else {
      for (let o = 0; o < outs; o++) created.push([order[o], this.newItem(kind.c, next)]);
      for (let r = 0; r < rem; r++) created.push([order[outs + r], this.newItem(kind.c, kind.t)]);
      const key = kind.c + next;
      this.s.stats.made[key] = (this.s.stats.made[key] || 0) + outs;
    }
    for (const [k, item] of created) this.s.items[k] = item;
    this.time.delayedCall(190, () => {
      for (const [k, item] of created) if (this.s.items[k] === item) {
        const v = this.addItemView(k, item, { pop: true });
        if (k === order[0] && !hatch) this.select({ kind: 'item', v });
      }
    });
    const stars = outs * next;
    this.s.stars += stars;
    this.sparkle(target.x, target.y - 30, 16 + outs * 6);
    this.floatText(target.x, target.y - 100, `+${stars} ⭐`);
    const css = this.worldToCss(target.x, target.y - 60);
    hud.fly('⭐', css.x, css.y, 'stars');
    if (hatch) hud.toast(outs > 1 ? `${outs} kittens hatched! 🐱` : 'A kitten hatched! 🐱');
    this.changed();
  }

  heal(k: number, delay = 0) {
    if (this.s.land[k] !== DEAD) return;
    this.s.land[k] = LIVING;
    this.s.stats.healed++;
    const it = this.s.items[k];
    if (it?.stuck) { delete it.stuck; const v = this.items.get(it.id); if (v) this.styleItem(v); }
    this.time.delayedCall(delay, () => {
      const g = this.ground[k]; if (!g) return;
      g.setTexture(this.groundKey(k));
      if (!reduceMotion()) { g.setScale(0.85); this.tweens.add({ targets: g, scale: 1, duration: 300, ease: 'Back.easeOut' }); }
      const { x, y } = center(k);
      this.leaves.explode(6, x, y);
    });
  }
  useOrb(v: ItemView, at: number) {
    const it = this.s.items[v.k]!, d = def(it);
    delete this.s.items[v.k];
    const { x, y } = center(at);
    this.items.delete(v.id);
    this.tweens.add({ targets: v.box, x, y: y - 20, alpha: 0, scale: 1.6, duration: 250, onComplete: () => v.box.destroy() });
    const [ci, cj] = ij(at);
    for (const k of this.healArea(at, d.heal!)) {
      const [i, j] = ij(k);
      this.heal(k, 120 * (Math.abs(i - ci) + Math.abs(j - cj)));
    }
    this.sparkle(x, y - 20, 24);
    this.s.stats.sparks++;
    this.select(null);
    this.changed();
  }

  // ---------- Cats ----------
  startCatDrag(g: Gesture, cv: CatView) {
    g.mode = 'cat';
    g.from = { x: cv.d.x, y: cv.d.y };
    if (cv.targetId !== undefined) this.release(cv);
    cv.state = 'held'; cv.bar.clear();
    cv.box.setDepth(HELD);
    cv.rig.y = 0;
    this.tweens.add({ targets: cv.rig, angle: { from: -8, to: 8 }, duration: 160, yoyo: true, repeat: -1 });
    this.select(null);
  }
  catGroup(cv: CatView, x: number, y: number) {
    const order: { c: CatView; x: number; y: number }[] = [{ c: cv, x, y }], seen = new Set([cv.d.id]);
    for (let q = 0; q < order.length; q++)
      for (const o of this.cats.values()) {
        if (seen.has(o.d.id) || o.d.t !== cv.d.t || o.state === 'held') continue;
        if (Math.hypot(o.d.x - order[q].x, o.d.y - order[q].y) <= CAT_MERGE_RADIUS) { seen.add(o.d.id); order.push({ c: o, x: o.d.x, y: o.d.y }); }
      }
    return order.map(o => o.c);
  }
  previewCat(cv: CatView) {
    this.clearHl();
    const { i, j } = toTileF(cv.box.x, cv.box.y);
    const g = this.catGroup(cv, i, j);
    if (g.length >= 3 && cv.d.t < CATS.length - 1) g.forEach(c => c !== cv && c.body.setTint(0xfff0a0));
  }
  dropCat(cv: CatView, from: { x: number; y: number }, cancel = false) {
    this.tweens.killTweensOf(cv.rig);
    cv.rig.angle = 0;
    const { i, j } = toTileF(cv.box.x, cv.box.y);
    const k = tileAt(cv.box.x, cv.box.y);
    cv.state = 'idle';
    cv.wanderAt = this.time.now + 2500;
    if (cancel || k < 0 || !S.isGround(this.s, k)) { cv.d.x = from.x; cv.d.y = from.y; this.placeCat(cv, true); return; }
    cv.d.x = i; cv.d.y = j;
    this.placeCat(cv);
    const g = this.catGroup(cv, i, j);
    if (g.length >= 3 && cv.d.t < CATS.length - 1) {
      const { outs, rem } = S.mergeResult(g.length);
      const used = g.slice(0, g.length - rem), at = toWorld(i, j), t = cv.d.t + 1;
      used.forEach(c => this.removeCat(c, at));
      for (let o = 0; o < outs; o++) this.spawnCat(t, i + o * 0.5, j + o * 0.3);
      this.s.stats.maxCat = Math.max(this.s.stats.maxCat, t);
      const stars = outs * (t + 1) * 2;
      this.s.stars += stars;
      this.floatText(at.x, at.y - 120, `+${stars} ⭐`);
      hud.toast(`${outs > 1 ? outs + '× ' : ''}${CATS[t].n}!`);
    }
    this.changed();
  }
  placeCat(cv: CatView, animate = false) {
    const p = toWorld(cv.d.x, cv.d.y);
    if (animate) this.tweens.add({ targets: cv.box, x: p.x, y: p.y, duration: 200 });
    else cv.box.setPosition(p.x, p.y);
    cv.box.setDepth(DEPTH + p.y + 20);
  }
  release(cv: CatView) {
    cv.targetId = undefined; cv.bar.clear();
  }
  tileOfItem(id: number) {
    const v = this.items.get(id);
    return v && this.s.items[v.k]?.id === id ? v.k : -1;
  }
  findJob(cv: CatView): number | undefined {
    const claimed = new Set([...this.cats.values()].map(c => c.targetId).filter(x => x !== undefined));
    let best: number | undefined, bestD = Infinity;
    const now = Date.now();
    for (const [k, it] of Object.entries(this.s.items)) {
      if (!it.queued || it.stuck || claimed.has(it.id) || (it.readyAt || 0) > now) continue;
      const [i, j] = ij(+k), d = Math.hypot(i - cv.d.x, j - cv.d.y);
      if (d < bestD) { bestD = d; best = it.id; }
    }
    return best;
  }
  updateCats(time: number, dt: number) {
    for (const cv of this.cats.values()) {
      if (cv.state === 'held') continue;
      const lvl = CATS[cv.d.t];
      if (cv.state === 'idle') {
        const job = this.findJob(cv);
        if (job !== undefined) { cv.targetId = job; cv.state = 'walk'; }
        else if (time > cv.wanderAt) {
          const ci = Math.round(cv.d.x), cj = Math.round(cv.d.y), spots: number[] = [];
          for (let j = cj - 3; j <= cj + 3; j++) for (let i = ci - 3; i <= ci + 3; i++)
            if (i >= 0 && j >= 0 && i < N && j < N && this.s.land[idx(i, j)] === LIVING && !this.s.items[idx(i, j)]) spots.push(idx(i, j));
          if (spots.length) {
            const [i, j] = ij(spots[Math.floor(Math.random() * spots.length)]);
            cv.dest = { x: i + (Math.random() - 0.5) * 0.3, y: j + (Math.random() - 0.5) * 0.3 };
            cv.state = 'walk';
          }
          cv.wanderAt = time + 3000 + Math.random() * 4000;
        }
      }
      if (cv.state === 'walk') {
        let dest = cv.dest;
        if (cv.targetId !== undefined) {
          const k = this.tileOfItem(cv.targetId), it = k >= 0 ? this.s.items[k] : undefined;
          if (!it || !it.queued) { this.release(cv); cv.state = 'idle'; continue; }
          const [i, j] = ij(k);
          dest = { x: i + 0.42, y: j + 0.42 };
        }
        if (!dest) { cv.state = 'idle'; continue; }
        const dx = dest.x - cv.d.x, dy = dest.y - cv.d.y, dist = Math.hypot(dx, dy);
        const step = (CAT_WALK_SPEED * (1 + 0.15 * cv.d.t) * dt) / 1000;
        if (dist <= step) {
          cv.d.x = dest.x; cv.d.y = dest.y; cv.rig.y = 0;
          if (cv.targetId !== undefined) {
            const it = this.s.items[this.tileOfItem(cv.targetId)];
            cv.state = 'harvest'; cv.work = 0; cv.workTotal = def(it).harvest!.time / lvl.speed;
          } else { cv.state = 'idle'; cv.dest = undefined; }
        } else {
          cv.d.x += (dx / dist) * step; cv.d.y += (dy / dist) * step;
          cv.hop += dt * 0.013;
          cv.rig.y = reduceMotion() ? 0 : -Math.abs(Math.sin(cv.hop)) * 12;
          const sx = dx - dy; // screen-space direction
          if (Math.abs(sx) > 0.05) cv.rig.scaleX = Math.sign(sx) * lvl.scale;
        }
        this.placeCat(cv);
      }
      if (cv.state === 'harvest') {
        const k = this.tileOfItem(cv.targetId!);
        if (k < 0 || !this.s.items[k].queued) { this.release(cv); cv.state = 'idle'; cv.rig.angle = 0; continue; }
        cv.work += dt / 1000;
        cv.rig.angle = reduceMotion() ? 0 : Math.sin(time * 0.02) * 7;
        const p = Math.min(cv.work / cv.workTotal, 1), x = cv.box.x, y = cv.box.y - 150 * lvl.scale - 18;
        cv.bar.clear().fillStyle(0x3b2a33, 0.75).fillRoundedRect(x - 42, y - 8, 84, 16, 8)
          .fillStyle(0x7ed957, 1).fillRoundedRect(x - 39, y - 5, 78 * p, 10, 5);
        if (p >= 1) { cv.rig.angle = 0; cv.bar.clear(); this.finishHarvest(cv, k); cv.state = 'idle'; cv.wanderAt = time + 1500; }
      }
    }
  }
  finishHarvest(cv: CatView, k: number) {
    const it = this.s.items[k], h = def(it).harvest!;
    const v = this.viewAt(k)!;
    it.queued = false;
    it.readyAt = Date.now() + h.regrow * 1000;
    this.release(cv);
    this.styleItem(v);
    this.spill(k, { x: v.box.x, y: v.box.y - 40 }, h.count, h.drops);
    this.s.stats.harvests++;
    this.floatText(cv.box.x, cv.box.y - 140 * CATS[cv.d.t].scale, '♥');
    this.changed();
  }

  // ---------- Goals, HUD, saving ----------
  claim() {
    const q = QUESTS[this.s.quest];
    if (!q || q.prog(this.s.stats) < q.goal) return;
    const r = q.reward;
    this.s.coins += r.coins || 0; this.s.gems += r.gems || 0; this.s.stars += r.stars || 0;
    hud.toast('Goal complete! 🎉');
    this.s.quest++;
    this.changed();
  }
  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    this.s = S.generate();
    S.persist(this.s);
    location.reload();
  }
  changed() { this.dirty = true; this.refreshHud(); }
  refreshHud() {
    hud.resources(this.s);
    hud.quest(this.s);
    if (!this.s.won && !this.s.land.some(l => l === DEAD || l === FOG)) {
      this.s.won = true;
      hud.modal('<div class="big">😻🌸🏝️</div><h2>Island restored!</h2><p>Every corner of the island is green again and the cats are purring.</p>',
        [{ label: 'Yay!', onClick: () => {} }]);
    }
  }
  markDirty() { this.dirty = true; }
  sparkle(x: number, y: number, n: number) { this.sparks.explode(reduceMotion() ? Math.ceil(n / 3) : n, x, y); }
  floatText(x: number, y: number, text: string) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif', fontSize: '30px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#5b3a4a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(TOP);
    this.tweens.add({ targets: t, y: y - (reduceMotion() ? 0 : 60), alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }

  update(time: number, dt: number) {
    this.updateCats(time, Math.min(dt, 100));
    const now = Date.now();
    // Harvestables come back to life when regrown; a ready one breathes a little.
    for (const v of this.items.values()) {
      const it = this.s.items[v.k];
      if (!it || it.id !== v.id || !def(it).harvest || it.stuck) continue;
      const ready = (it.readyAt || 0) <= now;
      if (ready && v.sprite.alpha < 1) { v.sprite.setAlpha(1); this.sparkle(v.box.x, v.box.y - 50, 6); }
      if (ready && !reduceMotion() && !this.tweens.isTweening(v.sprite)) v.sprite.scaleY = ITEM_SCALE * (1 + 0.03 * Math.sin(time * 0.004 + v.id));
    }
    if (this.selected && time - this.lastInfo > 500) { this.lastInfo = time; this.showInfo(); }
    if (this.dirty && time - this.lastSave > 400) { this.dirty = false; this.lastSave = time; S.persist(this.s); }
    if (this.cats.size && time - this.lastCatSave > 4000) { this.lastCatSave = time; S.persist(this.s); }
  }
}
