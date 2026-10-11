// Procedural art: every texture is drawn at startup with canvas 2D, so there are no image files.
// Items use emoji; ground, cliffs, clouds and cats are drawn here.
import Phaser from 'phaser';
import { CATS, CHAINS, CatLevel, ChainId, TILE_H, TILE_W } from './config';
import { mulberry32 } from './state';

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
export const GROUND_VARIANTS = 3;
export const CLIFF_H = 30;
type Ctx = CanvasRenderingContext2D;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h)!;
  draw(t.getContext());
  t.refresh();
}
function diamond(ctx: Ctx, w: number, h: number, ox = 0, oy = 0) {
  ctx.beginPath();
  ctx.moveTo(ox + w / 2, oy); ctx.lineTo(ox + w, oy + h / 2); ctx.lineTo(ox + w / 2, oy + h); ctx.lineTo(ox, oy + h / 2);
  ctx.closePath();
}
function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, lw = 3) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

export const itemKey = (c: ChainId, t: number) => `it_${c}_${t}`;

export function makeArt(scene: Phaser.Scene) {
  const W = TILE_W + 4, H = TILE_H + 2; // slight overlap hides seams between tiles

  for (let v = 0; v < GROUND_VARIANTS; v++) {
    const rnd = mulberry32(v + 11);
    tex(scene, `grass${v}`, W, H, ctx => {
      diamond(ctx, W, H);
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#a6dc6e'); g.addColorStop(1, '#8ccd5c');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      for (let n = 0; n < 16; n++) {
        const x = 14 + rnd() * (W - 28), y = 8 + rnd() * (H - 16);
        ctx.strokeStyle = rnd() < 0.5 ? 'rgba(70,140,50,.45)' : 'rgba(190,240,140,.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 3, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + 3, y - 5); ctx.stroke();
      }
      if (v === 1) for (let n = 0; n < 3; n++) {
        const x = 30 + rnd() * (W - 60), y = 16 + rnd() * (H - 32);
        ellipse(ctx, x, y, 3, 3, ['#fff', '#ffe066', '#ff9ec7'][n]);
      }
      ctx.restore();
    });
    tex(scene, `dead${v}`, W, H, ctx => {
      diamond(ctx, W, H);
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#80708c'); g.addColorStop(1, '#675873');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(40,28,52,.55)'; ctx.lineWidth = 2;
      for (let n = 0; n < 3; n++) {
        let x = 20 + rnd() * (W - 40), y = 10 + rnd() * (H - 20);
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) { x += 6 + rnd() * 8; y += (rnd() - 0.5) * 10; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for (let n = 0; n < 5; n++) ellipse(ctx, 15 + rnd() * (W - 30), 8 + rnd() * (H - 16), 3, 2, 'rgba(160,140,170,.6)');
      ctx.restore();
    });
  }

  tex(scene, 'cliff', W, H + CLIFF_H, ctx => {
    const h2 = H / 2;
    const face = (pts: number[][], top: string, bottom: string) => {
      ctx.beginPath(); pts.forEach(([x, y], n) => n ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      const g = ctx.createLinearGradient(0, h2, 0, H + CLIFF_H); g.addColorStop(0, top); g.addColorStop(1, bottom);
      ctx.fillStyle = g; ctx.fill();
    };
    face([[0, h2], [W / 2, H], [W / 2, H + CLIFF_H], [0, h2 + CLIFF_H]], '#9b7048', '#6e4b2c');
    face([[W / 2, H], [W, h2], [W, h2 + CLIFF_H], [W / 2, H + CLIFF_H]], '#b5845a', '#7f5834');
    ctx.strokeStyle = 'rgba(70,45,25,.35)'; ctx.lineWidth = 2;
    for (const y of [12, 22]) {
      ctx.beginPath(); ctx.moveTo(0, h2 + y); ctx.lineTo(W / 2, H + y); ctx.lineTo(W, h2 + y); ctx.stroke();
    }
  });

  tex(scene, 'shadow', 100, 36, ctx => {
    const g = ctx.createRadialGradient(50, 18, 2, 50, 18, 48);
    g.addColorStop(0, 'rgba(30,20,40,.35)'); g.addColorStop(1, 'rgba(30,20,40,0)');
    ctx.save(); ctx.scale(1, 0.36); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(50, 50, 48, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  });

  tex(scene, 'cloud', 190, 120, ctx => {
    const puffs = [[60, 72, 40], [100, 58, 50], [140, 74, 38], [95, 86, 42], [40, 88, 26], [158, 90, 24]];
    for (const [x, y, r] of puffs) {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.2, x, y, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dde6f2');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });

  tex(scene, 'hl_sel', W, H, ctx => {
    diamond(ctx, W - 8, H - 4, 4, 2); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  });
  tex(scene, 'hl_merge', W, H, ctx => {
    diamond(ctx, W - 8, H - 4, 4, 2); ctx.fillStyle = 'rgba(255,214,80,.55)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff2a8'; ctx.stroke();
  });
  tex(scene, 'hl_drop', W, H, ctx => {
    diamond(ctx, W - 8, H - 4, 4, 2); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
    ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  });
  tex(scene, 'hl_heal', W, H, ctx => {
    diamond(ctx, W - 8, H - 4, 4, 2); ctx.fillStyle = 'rgba(140,255,150,.45)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#d6ffd0'; ctx.stroke();
  });

  tex(scene, 'spark', 24, 24, ctx => {
    ctx.translate(12, 12); ctx.fillStyle = '#fff6b0';
    ctx.beginPath();
    for (let n = 0; n < 8; n++) { const r = n % 2 ? 3 : 11, a = (n * Math.PI) / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  });
  tex(scene, 'leaf', 16, 16, ctx => { ellipse(ctx, 8, 8, 7, 4, '#7ed957'); });
  tex(scene, 'wave', 46, 12, ctx => {
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(4, 8); ctx.quadraticCurveTo(14, 1, 23, 7); ctx.quadraticCurveTo(32, 1, 42, 7); ctx.stroke();
  });

  for (const c of Object.keys(CHAINS) as ChainId[])
    CHAINS[c].forEach((d, t) => tex(scene, itemKey(c, t), 120, 120, ctx => {
      ctx.font = `90px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.e, 60, 66);
    }));
  for (const e of ['🐾', '⭐', '💤', '❤️', '🔒'])
    tex(scene, 'em_' + e, 64, 64, ctx => {
      ctx.font = `48px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, 32, 35);
    });

  CATS.forEach((p, t) => {
    tex(scene, `cat${t}`, 150, 160, ctx => drawCat(ctx, p));
    tex(scene, `tail${t}`, 70, 70, ctx => drawTail(ctx, p));
  });
}

const OUTLINE = 'rgba(55,35,50,.7)';

function drawTail(ctx: Ctx, p: CatLevel) {
  ctx.lineCap = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(10, 62); ctx.bezierCurveTo(50, 60, 30, 18, 56, 10); };
  path(); ctx.lineWidth = 17; ctx.strokeStyle = OUTLINE; ctx.stroke();
  path(); ctx.lineWidth = 12; ctx.strokeStyle = p.fluffy ? p.body : p.body; ctx.stroke();
  if (p.stripes || p.tux) { ellipse(ctx, 55, 11, 6, 6, p.tux ? '#ffffff' : p.dark); }
}

function drawCat(ctx: Ctx, p: CatLevel) {
  const cx = 75;
  ctx.lineJoin = 'round';
  if (p.mane) {
    ctx.beginPath();
    for (let n = 0; n < 28; n++) {
      const a = (n / 28) * Math.PI * 2, r = n % 2 ? 44 : 54;
      ctx.lineTo(cx + Math.cos(a) * r, 60 + Math.sin(a) * r * 0.95);
    }
    ctx.closePath(); ctx.fillStyle = p.mane; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
  }
  // Body
  if (p.fluffy) for (let n = 0; n < 12; n++) {
    const a = (n / 12) * Math.PI * 2;
    ellipse(ctx, cx + Math.cos(a) * 34, 112 + Math.sin(a) * 32, 12, 12, p.body, OUTLINE);
  }
  ellipse(ctx, cx, 112, 38, 36, p.body, p.fluffy ? undefined : OUTLINE);
  if (p.stripes) {
    ctx.strokeStyle = p.dark; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const [x, y] of [[44, 100], [42, 116], [106, 100], [108, 116]]) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x < cx ? 10 : -10), y + 3); ctx.stroke();
    }
  }
  ellipse(ctx, cx, 120, 21, 25, p.belly);
  // Paws
  ellipse(ctx, cx - 16, 146, 12, 8, p.tux ? '#ffffff' : p.belly, OUTLINE);
  ellipse(ctx, cx + 16, 146, 12, 8, p.tux ? '#ffffff' : p.belly, OUTLINE);
  // Ears
  const ear = (s: number) => {
    ctx.beginPath(); ctx.moveTo(cx + s * 34, 48); ctx.lineTo(cx + s * 38, 10); ctx.lineTo(cx + s * 10, 30); ctx.closePath();
    ctx.fillStyle = p.body; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 31, 40); ctx.lineTo(cx + s * 34, 19); ctx.lineTo(cx + s * 18, 32); ctx.closePath();
    ctx.fillStyle = '#ffb3c4'; ctx.fill();
  };
  ear(-1); ear(1);
  // Head
  if (p.fluffy) for (let n = 0; n < 10; n++) {
    const a = (n / 10) * Math.PI * 2;
    ellipse(ctx, cx + Math.cos(a) * 32, 62 + Math.sin(a) * 28, 10, 10, p.body, OUTLINE);
  }
  ellipse(ctx, cx, 62, 38, 33, p.body, p.fluffy ? undefined : OUTLINE);
  if (p.stripes) {
    ctx.strokeStyle = p.dark; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const dx of [-9, 0, 9]) { ctx.beginPath(); ctx.moveTo(cx + dx, 32); ctx.lineTo(cx + dx * 0.8, 44); ctx.stroke(); }
  }
  if (p.tux) ellipse(ctx, cx, 76, 20, 14, '#ffffff');
  // Eyes
  for (const s of [-1, 1]) {
    const ex = cx + s * 15, ey = 62;
    ellipse(ctx, ex, ey, 8.5, 10.5, '#2a2030');
    ellipse(ctx, ex, ey + 1, 6.5, 8.5, p.eye);
    ellipse(ctx, ex, ey + 1, 3.2, 7, '#1a1420');
    ellipse(ctx, ex - 2.5, ey - 4, 2.6, 2.6, '#ffffff');
  }
  // Cheeks, nose, mouth, whiskers
  ellipse(ctx, cx - 26, 76, 7, 4.5, 'rgba(255,120,150,.35)');
  ellipse(ctx, cx + 26, 76, 7, 4.5, 'rgba(255,120,150,.35)');
  ctx.beginPath(); ctx.moveTo(cx - 4.5, 72); ctx.lineTo(cx + 4.5, 72); ctx.lineTo(cx, 77); ctx.closePath();
  ctx.fillStyle = '#ff7f9c'; ctx.fill();
  ctx.strokeStyle = '#4a3040'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, 77); ctx.quadraticCurveTo(cx - 4, 83, cx - 8, 79); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 77); ctx.quadraticCurveTo(cx + 4, 83, cx + 8, 79); ctx.stroke();
  ctx.strokeStyle = 'rgba(80,60,70,.45)'; ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) for (const dy of [-3, 3]) {
    ctx.beginPath(); ctx.moveTo(cx + s * 14, 76 + dy * 0.3); ctx.lineTo(cx + s * 40, 72 + dy * 1.6); ctx.stroke();
  }
  if (p.crown) {
    ctx.beginPath();
    const pts = [[-18, 30], [-20, 10], [-9, 20], [0, 4], [9, 20], [20, 10], [18, 30]];
    pts.forEach(([x, y], n) => n ? ctx.lineTo(cx + x, y) : ctx.moveTo(cx + x, y));
    ctx.closePath(); ctx.fillStyle = '#ffd34d'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#b8860b'; ctx.stroke();
    ellipse(ctx, cx, 22, 3.5, 3.5, '#ff5c8a');
  }
}
