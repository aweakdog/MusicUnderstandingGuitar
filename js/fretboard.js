// SVG 指板：1 弦在上、6 弦在下，品格从左往右（从 6 弦往 5 弦走就是「往上」）。
import { STRINGS, pitchAt, posKey } from './theory.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

export class Fretboard {
  constructor(container, { maxFret = 15, onClick } = {}) {
    this.container = container;
    this.maxFret = maxFret;
    this.onClick = onClick;
    this.markers = new Map();
    this.render();
  }

  // 品格的横坐标：按真实比例（越往高把位越窄），但压缩一下避免太挤
  fretX(f) {
    const L = 1000;
    const pos = (k) => L * (1 - 2 ** (-k / 12));
    const scale = (this.W - this.left - 20) / (pos(this.maxFret) * 0.93 + 40);
    return this.left + 40 + pos(f) * 0.93 * scale;
  }

  cellCenter(s, f) {
    const x = f === 0 ? this.left + 18 : (this.fretX(f - 1) + this.fretX(f)) / 2;
    return { x, y: this.stringY(s) };
  }

  stringY(s) {
    return this.top + (s - 1) * this.gap;
  }

  render() {
    this.container.innerHTML = '';
    this.W = 1100;
    this.left = 34;
    this.top = 26;
    this.gap = 34;
    const H = this.top + this.gap * 5 + 44;
    const svg = el('svg', { viewBox: `0 0 ${this.W} ${H}`, class: 'fretboard', role: 'img' });
    this.svg = svg;
    const board = el('g', {}, svg);
    const x0 = this.fretX(0), xN = this.fretX(this.maxFret);
    el('rect', { x: x0, y: this.top - 14, width: xN - x0, height: this.gap * 5 + 28, rx: 4, class: 'wood' }, board);
    // 品位标记点
    for (const f of [3, 5, 7, 9, 15, 17, 19, 21]) {
      if (f > this.maxFret) continue;
      const { x } = this.cellCenter(3, f);
      el('circle', { cx: x, cy: this.top + this.gap * 2.5, r: 6, class: 'inlay' }, board);
    }
    if (this.maxFret >= 12) {
      const { x } = this.cellCenter(3, 12);
      el('circle', { cx: x, cy: this.top + this.gap * 1.5, r: 6, class: 'inlay' }, board);
      el('circle', { cx: x, cy: this.top + this.gap * 3.5, r: 6, class: 'inlay' }, board);
    }
    // 品丝
    for (let f = 0; f <= this.maxFret; f++) {
      const x = this.fretX(f);
      el('line', { x1: x, x2: x, y1: this.top - 14, y2: this.top + this.gap * 5 + 14, class: f === 0 ? 'nut' : 'fret' }, board);
      if (f > 0) el('text', { x: this.cellCenter(1, f).x, y: this.top + this.gap * 5 + 36, class: 'fretnum' }, board).textContent = f;
    }
    el('text', { x: this.left + 18, y: this.top + this.gap * 5 + 36, class: 'fretnum' }, board).textContent = '0';
    // 琴弦（越粗的弦画得越粗）
    for (const s of STRINGS) {
      const y = this.stringY(s);
      el('line', { x1: this.left + 4, x2: xN, y1: y, y2: y, class: 'string', 'stroke-width': 0.8 + (s - 1) * 0.45 }, board);
      el('text', { x: 10, y: y + 4, class: 'strnum' }, board).textContent = s;
    }
    this.markLayer = el('g', {}, svg);
    // 点击区域
    const hit = el('g', {}, svg);
    for (const s of STRINGS) {
      for (let f = 0; f <= this.maxFret; f++) {
        const xa = f === 0 ? this.left : this.fretX(f - 1);
        const xb = f === 0 ? this.fretX(0) : this.fretX(f);
        const r = el('rect', { x: xa, y: this.stringY(s) - this.gap / 2, width: xb - xa, height: this.gap, class: 'hit', 'data-s': s, 'data-f': f }, hit);
        r.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.onClick?.(s, f, pitchAt(s, f));
        });
      }
    }
    this.container.appendChild(svg);
    this.redrawMarkers();
  }

  // 标记：{ s, f, cls, label }；cls 可选 target / ok / bad / hint / heat
  setMarkers(list) {
    this.markers = new Map(list.map((m) => [posKey(m.s, m.f), m]));
    this.redrawMarkers();
  }

  addMarker(m) {
    this.markers.set(posKey(m.s, m.f), m);
    this.redrawMarkers();
  }

  clear() {
    this.setMarkers([]);
  }

  redrawMarkers() {
    if (!this.markLayer) return;
    this.markLayer.innerHTML = '';
    for (const m of this.markers.values()) {
      if (m.f > this.maxFret) continue;
      const { x, y } = this.cellCenter(m.s, m.f);
      const g = el('g', { class: `marker ${m.cls || ''}` }, this.markLayer);
      if (m.cls === 'heat') {
        el('rect', { x: x - 15, y: y - 12, width: 30, height: 24, rx: 5, fill: m.color, class: 'heatcell' }, g);
      } else {
        el('circle', { cx: x, cy: y, r: 13 }, g);
      }
      if (m.label) el('text', { x, y: y + 4.5, class: 'mlabel' }, g).textContent = m.label;
    }
  }

  // 手机上指板要横向滚动：把某个位置滚到可见区域中间
  reveal(s, f) {
    const box = this.container.closest('.board-card');
    if (!box || box.scrollWidth <= box.clientWidth) return;
    const px = (this.cellCenter(s, f).x / this.W) * this.svg.getBoundingClientRect().width;
    box.scrollTo({ left: Math.max(0, px - box.clientWidth / 2), behavior: 'smooth' });
  }

  flash(s, f) {
    const { x, y } = this.cellCenter(s, f);
    const c = el('circle', { cx: x, cy: y, r: 13, class: 'flash' }, this.markLayer);
    setTimeout(() => c.remove(), 350);
  }

  setMaxFret(n) {
    this.maxFret = n;
    this.render();
  }
}
