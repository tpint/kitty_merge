// All balance numbers live here.

export const VERSION = 'v0.2';
export const SAVE_KEY = 'kittymerge2';

export const MAP_SIZE = 23;          // island is generated inside a MAP_SIZE x MAP_SIZE grid
export const TILE_W = 128;
export const TILE_H = 64;

export type ChainId = 'nip' | 'yarn' | 'fish' | 'box' | 'coin' | 'gem' | 'gift' | 'orb';
export type Drop = [ChainId, number, number]; // chain, level, weight

export interface Harvest {
  time: number;    // seconds of work for a level-1 cat
  regrow: number;  // seconds before it can be harvested again
  count: number;   // items dropped per harvest
  drops: Drop[];
}
export interface ItemDef {
  e: string;          // emoji used as art
  n: string;          // name
  harvest?: Harvest;  // tap to send a cat to harvest it
  coin?: number;      // tap to collect coins
  gem?: number;       // tap to collect gems
  gift?: number;      // tap to open, spills this many items
  heal?: number;      // drop on dead land: heals tiles within this radius
  hatch?: boolean;    // merging 3 hatches a kitten
}

export const CHAINS: Record<ChainId, ItemDef[]> = {
  nip: [
    { e: '🌱', n: 'Catnip Sprout' },
    { e: '🌿', n: 'Catnip' },
    { e: '🪴', n: 'Potted Catnip', harvest: { time: 3, regrow: 20, count: 1, drops: [['nip', 0, 1]] } },
    { e: '🌳', n: 'Catnip Tree', harvest: { time: 4, regrow: 25, count: 2, drops: [['nip', 0, 6], ['nip', 1, 2], ['orb', 0, 1]] } },
    { e: '🌸', n: 'Blossom Tree', harvest: { time: 5, regrow: 30, count: 3, drops: [['nip', 1, 4], ['orb', 0, 2], ['box', 0, 1], ['gift', 0, 1]] } },
  ],
  yarn: [
    { e: '🧵', n: 'Thread' },
    { e: '🧶', n: 'Yarn Ball' },
    { e: '🎀', n: 'Ribbon', harvest: { time: 3, regrow: 20, count: 1, drops: [['coin', 0, 1]] } },
    { e: '🧸', n: 'Teddy Bear', harvest: { time: 4, regrow: 25, count: 2, drops: [['coin', 0, 3], ['yarn', 0, 2]] } },
    { e: '🏰', n: 'Cat Castle', harvest: { time: 5, regrow: 40, count: 3, drops: [['coin', 1, 2], ['gem', 0, 1], ['box', 0, 1]] } },
  ],
  fish: [
    { e: '🐟', n: 'Minnow' },
    { e: '🐠', n: 'Goldfish' },
    { e: '🍣', n: 'Sushi', harvest: { time: 3, regrow: 20, count: 1, drops: [['coin', 0, 2], ['fish', 0, 1]] } },
    { e: '🍱', n: 'Bento Box', harvest: { time: 4, regrow: 30, count: 2, drops: [['coin', 0, 2], ['coin', 1, 1]] } },
  ],
  box:  [ { e: '📦', n: 'Kitten Box', hatch: true } ],
  coin: [ { e: '🪙', n: 'Coin', coin: 1 }, { e: '💰', n: 'Coin Bag', coin: 5 }, { e: '👑', n: 'Crown', coin: 25 } ],
  gem:  [ { e: '💎', n: 'Gem', gem: 1 }, { e: '🔮', n: 'Gem Orb', gem: 5 } ],
  gift: [ { e: '🎁', n: 'Gift', gift: 3 }, { e: '🧰', n: 'Treasure Chest', gift: 6 } ],
  orb:  [ { e: '✨', n: 'Life Spark', heal: 1 }, { e: '🌟', n: 'Life Star', heal: 2 }, { e: '☀️', n: 'Sunbeam', heal: 3 } ],
};

export const GIFT_POOL: Drop[] = [
  ['nip', 0, 4], ['nip', 1, 2], ['yarn', 0, 3], ['fish', 0, 3], ['coin', 0, 3], ['coin', 1, 1],
  ['orb', 0, 2], ['box', 0, 2], ['gem', 0, 1],
];
// Items found stuck in dead land / hidden in fog when the island is generated.
export const DEAD_POOL: Drop[] = [
  ['nip', 0, 5], ['nip', 1, 2], ['nip', 2, 1], ['yarn', 0, 4], ['yarn', 1, 1], ['yarn', 2, 1],
  ['fish', 0, 4], ['fish', 1, 1], ['box', 0, 2], ['coin', 0, 2],
];
export const FOG_POOL: Drop[] = [
  ...DEAD_POOL, ['gift', 0, 2], ['nip', 3, 1], ['yarn', 3, 1], ['fish', 2, 1], ['gem', 0, 1], ['orb', 0, 2],
];

export interface CatLevel {
  n: string; body: string; dark: string; belly: string; eye: string;
  scale: number; speed: number; stripes?: boolean; fluffy?: boolean; tux?: boolean; crown?: boolean; mane?: string;
}
// Cats are the "dragons": they roam freely, harvest what you tap, and merge 3 -> 1 like items.
export const CATS: CatLevel[] = [
  { n: 'Kitten',     body: '#bdb7c9', dark: '#8f88a0', belly: '#f4eff7', eye: '#4aa3df', scale: 0.55, speed: 1.0, stripes: true },
  { n: 'Ginger Cat', body: '#f2a154', dark: '#d07028', belly: '#fff1dc', eye: '#57b35a', scale: 0.64, speed: 1.3, stripes: true },
  { n: 'Fluffy Cat', body: '#f8f5f0', dark: '#ddd2c2', belly: '#ffffff', eye: '#3f8fd8', scale: 0.72, speed: 1.6, fluffy: true },
  { n: 'Tuxedo Cat', body: '#3b3742', dark: '#1f1c25', belly: '#ffffff', eye: '#f2c230', scale: 0.8,  speed: 2.0, tux: true },
  { n: 'Royal Cat',  body: '#a58ad8', dark: '#7a5db5', belly: '#f1e9ff', eye: '#f2c230', scale: 0.88, speed: 2.5, stripes: true, crown: true },
  { n: 'Lion King',  body: '#e8b04a', dark: '#c98a28', belly: '#fff0c8', eye: '#8a5320', scale: 1.0,  speed: 3.2, mane: '#b5651d', crown: true },
];
export const CAT_WALK_SPEED = 1.8;   // tiles per second for a kitten
export const CAT_MERGE_RADIUS = 1.4; // cats this close (in tiles) count as a group

export const SELL_VALUE = [1, 2, 5, 12, 25, 50];

export interface Price { coins?: number; gems?: number }
export const SHOP: { c: ChainId; t: number; price: Price }[] = [
  { c: 'box', t: 0, price: { coins: 30 } },
  { c: 'nip', t: 0, price: { coins: 5 } },
  { c: 'yarn', t: 0, price: { coins: 5 } },
  { c: 'fish', t: 0, price: { coins: 8 } },
  { c: 'orb', t: 0, price: { coins: 15 } },
  { c: 'gift', t: 0, price: { gems: 3 } },
];

export interface Stats {
  made: Record<string, number>; healed: number; harvests: number; gifts: number; sparks: number;
  fog: number; hatched: number; maxCat: number;
}
export interface Quest { text: string; goal: number; prog: (s: Stats) => number; reward: Price & { stars?: number } }
export const QUESTS: Quest[] = [
  { text: 'Merge 3 📦 Kitten Boxes to hatch a kitten', goal: 1, prog: s => s.hatched, reward: { coins: 10 } },
  { text: 'Tap the 🌳 Catnip Tree — your kitten will harvest it', goal: 1, prog: s => s.harvests, reward: { coins: 10 } },
  { text: 'Merge 3 🌱 Sprouts into 🌿 Catnip', goal: 1, prog: s => s.made.nip1 || 0, reward: { gems: 2 } },
  { text: 'Merge on dead land to heal 10 tiles', goal: 10, prog: s => s.healed, reward: { coins: 20 } },
  { text: 'Tap a 🎁 Gift to open it', goal: 1, prog: s => s.gifts, reward: { coins: 15 } },
  { text: 'Drag a ✨ Life Spark onto dead land', goal: 1, prog: s => s.sparks, reward: { stars: 5 } },
  { text: 'Clear a fog cloud with ⭐ stars', goal: 1, prog: s => s.fog, reward: { gems: 3 } },
  { text: 'Hatch 3 kittens', goal: 3, prog: s => s.hatched, reward: { coins: 30 } },
  { text: 'Drag 3 kittens together to make a Ginger Cat', goal: 1, prog: s => s.maxCat, reward: { gems: 5 } },
  { text: 'Heal 60 tiles', goal: 60, prog: s => s.healed, reward: { coins: 50 } },
  { text: 'Grow a 🌸 Blossom Tree', goal: 1, prog: s => s.made.nip4 || 0, reward: { gems: 10 } },
  { text: 'Clear 4 fog clouds', goal: 4, prog: s => s.fog, reward: { coins: 100 } },
];
