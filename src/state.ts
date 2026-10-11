// Save data, island generation and the pure merge rules (no rendering here).
import { CHAINS, ChainId, DEAD_POOL, Drop, FOG_POOL, ItemDef, MAP_SIZE, SAVE_KEY, Stats } from './config';

export const WATER = 0, LIVING = 1, DEAD = 2, FOG = 3;

export interface Item { id: number; c: ChainId; t: number; stuck?: boolean; readyAt?: number; queued?: boolean }
export interface CatData { id: number; t: number; x: number; y: number }   // x/y in tile units (floats)
export interface Cluster { cost: number; cx: number; cy: number }
export interface Save {
  v: 2;
  land: number[];                 // per tile: WATER / LIVING / DEAD / FOG
  cluster: number[];              // fog cluster id per tile, -1 if none
  clusters: Cluster[];
  items: Record<number, Item>;    // keyed by tile index
  cats: CatData[];
  coins: number; gems: number; stars: number;
  quest: number;
  stats: Stats;
  nextId: number;
  won?: boolean;
}

export const N = MAP_SIZE;
export const idx = (i: number, j: number) => j * N + i;
export const ij = (k: number): [number, number] => [k % N, Math.floor(k / N)];
export const def = (it: { c: ChainId; t: number }): ItemDef & { max: boolean } =>
  ({ ...CHAINS[it.c][it.t], max: it.t === CHAINS[it.c].length - 1 });
export const same = (a?: { c: string; t: number } | null, b?: { c: string; t: number } | null) =>
  !!a && !!b && a.c === b.c && a.t === b.t;
export const canMerge = (it: { c: ChainId; t: number }) => !def(it).max || !!def(it).hatch;
export const isGround = (s: Save, k: number) => k >= 0 && (s.land[k] === LIVING || s.land[k] === DEAD);

export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick<T extends Drop>(pool: T[], rnd = Math.random): T {
  let r = rnd() * pool.reduce((a, d) => a + d[2], 0);
  for (const d of pool) if ((r -= d[2]) < 0) return d;
  return pool[pool.length - 1];
}

export function neighbors(k: number): number[] {
  const [i, j] = ij(k), out: number[] = [];
  if (i > 0) out.push(k - 1);
  if (i < N - 1) out.push(k + 1);
  if (j > 0) out.push(k - N);
  if (j < N - 1) out.push(k + N);
  return out;
}

// Connected (4-way) tiles holding the same item as `kind`, BFS from `start` (start first).
export function group(s: Save, start: number, kind: { c: string; t: number }, exclude = -1): number[] {
  const seen = new Set([start]), order = [start];
  for (let q = 0; q < order.length; q++)
    for (const n of neighbors(order[q]))
      if (!seen.has(n) && n !== exclude && same(s.items[n], kind)) { seen.add(n); order.push(n); }
  return order;
}

// Nearest empty ground tile to `from` (not `from` itself), searching outward over the whole grid.
export function nearestEmpty(s: Save, from: number, avoid: Set<number> = new Set()): number {
  const seen = new Set([from]), q = [from];
  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    if (k !== from && isGround(s, k) && !s.items[k] && !avoid.has(k)) return k;
    for (const n of neighbors(k)) if (!seen.has(n)) { seen.add(n); q.push(n); }
  }
  return -1;
}

// 3 -> 1, 5 -> 2 (the Merge Dragons bonus). Returns how many results and how many are left over.
export function mergeResult(n: number) {
  let outs = Math.floor(n / 5) * 2, rem = n % 5;
  if (rem >= 3) { outs++; rem -= 3; }
  return { outs, rem };
}

export const freshStats = (): Stats => ({ made: {}, healed: 0, harvests: 0, gifts: 0, sparks: 0, fog: 0, hatched: 0, maxCat: 0 });

export function generate(seed = 20261012): Save {
  const rnd = mulberry32(seed), c = (N - 1) / 2;
  const land: number[] = [], cluster: number[] = [];
  const sums: { x: number; y: number; n: number; band: number; sector: number }[] = [];
  const clusterOf = new Map<string, number>();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = i - c, dy = j - c, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const R = 10.2 * (1 + 0.1 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(5 * a + 2.1) + 0.04 * Math.sin(7 * a + 0.3));
    let l = WATER, cl = -1;
    if (d <= R) {
      if (d < 2.3) l = LIVING;
      else if (d < 5.2) l = DEAD;
      else {
        l = FOG;
        const band = d < 7.9 ? 0 : 1, sectors = band ? 7 : 5;
        const sector = Math.floor(((a + Math.PI) / (2 * Math.PI)) * sectors + band * 0.5) % sectors;
        const key = band + ':' + sector;
        if (!clusterOf.has(key)) { clusterOf.set(key, sums.length); sums.push({ x: 0, y: 0, n: 0, band, sector }); }
        cl = clusterOf.get(key)!;
        const sm = sums[cl]; sm.x += i; sm.y += j; sm.n++;
      }
    }
    land.push(l); cluster.push(cl);
  }
  // Order clusters: inner band first, cheaper first.
  const clusters: Cluster[] = sums.map(sm => ({
    cost: sm.band === 0 ? 6 + sm.sector * 3 : 30 + sm.sector * 6,
    cx: sm.x / sm.n, cy: sm.y / sm.n,
  }));

  const s: Save = {
    v: 2, land, cluster, clusters, items: {}, cats: [], coins: 20, gems: 5, stars: 0, quest: 0,
    stats: freshStats(), nextId: 1,
  };
  const put = (i: number, j: number, ch: ChainId, t: number, stuck = false) => {
    s.items[idx(i, j)] = { id: s.nextId++, c: ch, t, ...(stuck ? { stuck: true } : {}) };
  };
  // Starting camp (centre is (11, 11)).
  put(11, 11, 'nip', 3);
  put(12, 10, 'box', 0); put(10, 12, 'box', 0); put(14, 10, 'box', 0, true);
  put(9, 11, 'nip', 0); put(11, 13, 'nip', 0); put(11, 14, 'nip', 0, true);
  put(10, 13, 'gift', 0);
  put(10, 10, 'orb', 0);
  put(11, 9, 'coin', 0);
  // Scatter stuck items over dead land and inside the fog.
  for (let k = 0; k < N * N; k++) {
    if (s.items[k]) continue;
    if (land[k] === DEAD && rnd() < 0.33) { const [ch, t] = pick(DEAD_POOL, rnd); s.items[k] = { id: s.nextId++, c: ch, t, stuck: true }; }
    else if (land[k] === FOG && rnd() < 0.3) { const [ch, t] = pick(FOG_POOL, rnd); s.items[k] = { id: s.nextId++, c: ch, t, stuck: true }; }
  }
  return s;
}
export function load(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (s && s.v === 2 && Array.isArray(s.land) && s.land.length === N * N) {
        s.stats = { ...freshStats(), ...s.stats };
        s.cats = s.cats || [];
        return s;
      }
    }
  } catch { /* fall through to a new island */ }
  return generate();
}
export function persist(s: Save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}
