// DOM overlay: resource bar, goal card, info card, shop, toasts and dialogs.
import { QUESTS, SHOP, VERSION, Price } from './config';
import { Save, def } from './state';

const $ = (id: string) => document.getElementById(id)!;
export interface Button { label: string; onClick: () => void; disabled?: boolean; kind?: 'primary' | 'plain' }

let toastTimer = 0;
export const hud = {
  init(onShopBuy: (k: number) => void, onClaim: () => void, onReset: () => void) {
    $('version').textContent = VERSION;
    $('shopBtn').onclick = () => {
      const html = SHOP.map((it, k) => {
        const d = def(it);
        return `<button class="shop-item" data-k="${k}"><span class="em">${d.e}</span><span>${d.n}</span><b>${priceText(it.price)}</b></button>`;
      }).join('');
      this.modal(`<h2>Shop</h2><div class="shop-grid">${html}</div>`, [{ label: 'Close', onClick: () => {}, kind: 'plain' }]);
      document.querySelectorAll<HTMLButtonElement>('.shop-item').forEach(b =>
        b.onclick = () => { onShopBuy(+b.dataset.k!); this.closeModal(); });
    };
    $('claimBtn').onclick = onClaim;
    $('menuBtn').onclick = () => this.modal(
      `<h2>Kitty Merge</h2><p>Drag 3 matching items together to merge them. Merging on dead land heals it.
       Tap things for your cats to harvest. Drag 3 matching cats together to merge them too!</p>
       <p class="small">${VERSION}</p>`,
      [{ label: 'Reset progress', onClick: () => { if (confirm('Reset all progress?')) onReset(); }, kind: 'plain' },
       { label: 'Play', onClick: () => {} }]);
  },
  resources(s: Save) {
    $('coins').textContent = String(s.coins);
    $('gems').textContent = String(s.gems);
    $('stars').textContent = String(s.stars);
    $('cats').textContent = String(s.cats.length);
  },
  bump(which: 'coins' | 'gems' | 'stars' | 'cats') {
    const el = $(which).parentElement!;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  },
  quest(s: Save) {
    const q = QUESTS[s.quest], card = $('quest');
    if (!q) { card.classList.add('done'); $('questText').textContent = '🎉 All goals done! Heal the whole island.'; $('claimBtn').hidden = true; $('questBar').style.width = '100%'; return; }
    const p = Math.min(q.prog(s.stats), q.goal);
    $('questText').innerHTML = `${q.text} <span class="q-prog">${p}/${q.goal}</span>`;
    $('questReward').textContent = rewardText(q.reward);
    $('questBar').style.width = (p / q.goal) * 100 + '%';
    $('claimBtn').hidden = p < q.goal;
  },
  info(html: string, buttons: Button[] = []) {
    const el = $('info');
    // The info card is refreshed twice a second; only rebuild it when it actually changes.
    const sig = html + buttons.map(b => b.label + b.disabled).join();
    if (el.dataset.sig === sig && el.classList.contains('show')) return;
    el.dataset.sig = sig;
    el.innerHTML = `<div class="info-text">${html}</div>` + buttons.map((b, n) =>
      `<button data-n="${n}" class="${b.kind || 'primary'}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('');
    el.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => buttons[+b.dataset.n!].onClick());
    el.classList.add('show');
  },
  hideInfo() { $('info').classList.remove('show'); },
  toast(msg: string) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.remove('show'), 2000);
  },
  modal(html: string, buttons: Button[]) {
    $('modalBody').innerHTML = html;
    const bar = $('modalButtons');
    bar.innerHTML = buttons.map((b, n) => `<button data-n="${n}" class="${b.kind || 'primary'}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('');
    bar.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { this.closeModal(); buttons[+b.dataset.n!].onClick(); });
    $('modal').classList.add('show');
  },
  closeModal() { $('modal').classList.remove('show'); },
  modalOpen() { return $('modal').classList.contains('show'); },
  // Little icon that flies from a screen point to a resource counter.
  fly(emoji: string, x: number, y: number, to: 'coins' | 'gems' | 'stars') {
    const target = $(to).parentElement!.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'flyer'; el.textContent = emoji;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.body.appendChild(el);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(${target.left + 14 - x}px, ${target.top + target.height / 2 - y}px) translate(-50%,-50%) scale(.7)`, opacity: reduce ? 0 : 1 },
    ], { duration: reduce ? 300 : 650, easing: 'cubic-bezier(.5,0,.8,.4)' });
    anim.onfinish = () => { el.remove(); this.bump(to); };
  },
};

export const priceText = (p: Price) => [p.coins ? `${p.coins} 🪙` : '', p.gems ? `${p.gems} 💎` : ''].filter(Boolean).join(' ');
const rewardText = (r: Price & { stars?: number }) =>
  '+' + [r.coins ? `${r.coins} 🪙` : '', r.gems ? `${r.gems} 💎` : '', r.stars ? `${r.stars} ⭐` : ''].filter(Boolean).join(' ');
