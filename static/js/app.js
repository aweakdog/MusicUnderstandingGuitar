import { SYLLABLES, STRINGS, pc, syllable, positions, samePitch, labelOf, nearestOfClass, nOfFreq, posKey } from './theory.js';
import { Fretboard } from './fretboard.js';
import { Audio, Mic } from './audio.js';
import { Stats } from './stats.js';
import { store } from './store.js';

const BUILD = document.body.dataset.build || '';
const $ = (id) => document.getElementById(id);
const now = () => performance.now();
const secs = (ms) => (ms / 1000).toFixed(1);

const settings = Object.assign(
  { fretMin: 0, fretMax: 12, strings: [...STRINGS], labelMode: 'none', strict: true, singStrict: false, auto: true, volume: 0.8, mode: 'hear' },
  store.load('settings', {}),
);
const saveSettings = () => store.save('settings', settings);

const audio = new Audio();
audio.setVolume(settings.volume);
const mic = new Mic(audio);
const stats = new Stats(store);
const board = new Fretboard($('board'), { maxFret: settings.fretMax, onClick: (s, f, n) => current?.click?.(s, f, n) });

const range = () => ({ fretMin: settings.fretMin, fretMax: settings.fretMax, strings: settings.strings });
const cands = () => positions(range());
const lbl = (n) => labelOf(n, settings.labelMode);
const inRange = (s, f) => settings.strings.includes(s) && f >= settings.fretMin && f <= settings.fretMax;

// ---------- 页面上的通用部件 ----------
function prompt(big, hint = '', cls = '') {
  $('big').innerHTML = big;
  $('big').className = `big ${cls}`;
  $('hint').innerHTML = hint;
}

function controls(list) {
  const box = $('controls');
  box.innerHTML = '';
  for (const c of list) {
    const b = document.createElement('button');
    b.innerHTML = c.label + (c.kbd ? `<kbd>${c.kbd}</kbd>` : '');
    if (c.primary) b.className = 'primary';
    if (c.id) b.id = c.id;
    b.addEventListener('click', (e) => {
      e.currentTarget.blur();
      c.onClick();
    });
    box.appendChild(b);
  }
}

const session = { ok: 0, n: 0, ms: 0 };
function sessionAdd(ok, ms) {
  session.n += 1;
  session.ok += ok ? 1 : 0;
  session.ms += ms;
  showSession();
}
function showSession() {
  $('session').textContent = session.n ? `本轮 ${session.ok}/${session.n} · 平均 ${secs(session.ms / session.n)} 秒` : '';
}

// ---------- 自由弹 ----------
const explore = {
  showAll: false,
  enter() {
    prompt('随便点，听每个位置的声音', '先闭上眼听，再睁眼看位置；想对照编号，在下面的设置里打开「位置上显示」。');
    this.draw();
  },
  draw() {
    controls([
      { label: this.showAll ? '隐藏全部' : '显示全部位置', onClick: () => { this.showAll = !this.showAll; this.draw(); } },
      { label: '清空', onClick: () => { this.showAll = false; board.clear(); this.draw(); } },
    ]);
    if (this.showAll) {
      const mode = settings.labelMode === 'none' ? 'number' : settings.labelMode;
      board.setMarkers(cands().map((p) => ({ s: p.s, f: p.f, cls: 'soft', label: labelOf(p.n, mode) })));
    }
  },
  click(s, f, n) {
    audio.play(n);
    board.flash(s, f);
    if (settings.labelMode !== 'none' && !this.showAll) board.addMarker({ s, f, cls: 'soft', label: lbl(n) });
  },
};

// ---------- 听音找位 ----------
const hear = {
  enter() { this.next(); },
  exit() { clearTimeout(this.timer); },
  next() {
    clearTimeout(this.timer);
    this.t = stats.pick('hear', cands(), this.last);
    this.last = posKey(this.t.s, this.t.f);
    this.answered = false;
    this.t0 = now();
    board.clear();
    prompt('听这个音，在指板上找到它', settings.strict ? '八度也要对：要找同一个音高。' : '只要音级对就算对（忽略八度）。');
    controls([
      { label: '再听一遍', kbd: '空格', primary: true, onClick: () => this.play() },
      { label: '下一题', kbd: 'Enter', onClick: () => this.next() },
    ]);
    this.play();
  },
  play() { audio.play(this.t.n); },
  click(s, f, n) {
    audio.play(n);
    board.flash(s, f);
    if (this.answered) return;
    this.answered = true;
    const ok = samePitch(n, this.t.n, settings.strict);
    const ms = now() - this.t0;
    const answers = cands().filter((p) => samePitch(p.n, this.t.n, settings.strict));
    board.setMarkers([
      ...answers.map((p) => ({ s: p.s, f: p.f, cls: 'hint', label: lbl(p.n) })),
      { s, f, cls: ok ? 'ok' : 'bad', label: lbl(n) },
    ]);
    stats.record('hear', this.t.s, this.t.f, ok, ms);
    sessionAdd(ok, ms);
    if (ok) {
      prompt('对了', `${secs(ms)} 秒。绿圈是这个音在范围内的所有位置。`, 'ok');
      if (settings.auto) this.timer = setTimeout(() => this.next(), 1400);
    } else {
      prompt('不对', '绿圈是正确的位置，马上重放正确的音。可以继续点来对比声音，按 Enter 下一题。', 'bad');
      this.timer = setTimeout(() => this.play(), 800);
    }
  },
  key(e) {
    if (e.code === 'Space') this.play();
    if (e.key === 'Enter') this.next();
  },
};

// ---------- 看位唱音 ----------
const sing = {
  enter() {
    $('meter').classList.remove('hidden');
    this.next();
  },
  exit() {
    $('meter').classList.add('hidden');
    clearTimeout(this.timer);
    mic.stop();
  },
  next() {
    clearTimeout(this.timer);
    this.t = stats.pick('sing', cands(), this.last);
    this.last = posKey(this.t.s, this.t.f);
    this.done = false;
    this.hinted = false;
    this.hold = 0;
    this.t0 = now();
    board.setMarkers([{ s: this.t.s, f: this.t.f, cls: 'target pulse' }]);
    board.reveal(this.t.s, this.t.f);
    this.intro();
    this.draw();
    this.meter(null);
  },
  intro() {
    const how = settings.singStrict ? '用真吉他弹出这个位置的音，八度也要对。' : '对着麦克风唱出这个位置的音，八度不用管。';
    prompt('看黄色的位置，唱出这个音', mic.on ? `${how}唱准并保持一小会儿就算对。` : `${how}先点「开启麦克风」。`);
  },
  draw() {
    controls([
      { label: mic.on ? '关闭麦克风' : '开启麦克风', primary: !mic.on, kbd: 'M', onClick: () => this.toggleMic() },
      { label: '听参考音', kbd: '空格', onClick: () => this.reference() },
      { label: '放弃，看答案', onClick: () => this.giveUp() },
      { label: '下一题', kbd: 'Enter', onClick: () => this.next() },
    ]);
  },
  async toggleMic() {
    if (mic.on) {
      mic.stop();
      this.meter(null);
    } else {
      try {
        await mic.start((r, muted) => this.onPitch(r, muted));
      } catch (err) {
        prompt('打不开麦克风', `需要用 localhost 或 https 打开这个网页，并在浏览器里允许使用麦克风。（${err.name || err}）`, 'bad');
        return this.draw();
      }
    }
    this.intro();
    this.draw();
  },
  // 偏差音分：忽略八度时和最近的同音级比；严格时和目标音高比
  centsOf(freq) {
    return settings.singStrict ? (nOfFreq(freq) - this.t.n) * 100 : nearestOfClass(freq, pc(this.t.n)).cents;
  },
  onPitch(r, muted) {
    if (this.done || muted || !r) {
      this.hold = 0;
      if (!this.done) this.meter(null, muted ? '（正在放音，暂停判定）' : '');
      return;
    }
    const cents = this.centsOf(r.freq);
    this.meter(cents);
    if (Math.abs(cents) <= 35) {
      this.hold += 50;
      if (this.hold >= 400) this.success();
    } else {
      this.hold = 0;
    }
  },
  meter(cents, note = '') {
    const needle = $('needle');
    if (cents == null) {
      needle.classList.remove('live');
      needle.style.left = '50%';
      $('meterText').textContent = note || (mic.on ? '在听……' : '');
      return;
    }
    needle.classList.add('live');
    needle.style.left = `${Math.max(0, Math.min(100, 50 + cents / 2))}%`;
    const semis = Math.round(cents / 100);
    let t;
    if (Math.abs(cents) <= 35) t = '准了，保持住';
    else if (semis === 0) t = cents > 0 ? '偏高一点' : '偏低一点';
    else t = `偏${semis > 0 ? '高' : '低'} ${Math.abs(semis)} 个半音`;
    $('meterText').textContent = t;
  },
  success() {
    this.done = true;
    const ms = now() - this.t0;
    const ok = !this.hinted;
    stats.record('sing', this.t.s, this.t.f, ok, ms);
    sessionAdd(ok, ms);
    board.setMarkers([{ s: this.t.s, f: this.t.f, cls: 'ok', label: lbl(this.t.n) }]);
    prompt(ok ? '唱对了' : '唱对了（听过参考音，不计为正确）', `${secs(ms)} 秒。马上放一遍标准音给你对照。`, 'ok');
    this.meter(null, '');
    setTimeout(() => audio.play(this.t.n), 200);
    if (settings.auto) this.timer = setTimeout(() => this.next(), 2400);
  },
  reference() {
    this.hinted = true;
    audio.play(this.t.n);
  },
  giveUp() {
    if (this.done) return;
    this.done = true;
    const ms = now() - this.t0;
    stats.record('sing', this.t.s, this.t.f, false, ms);
    sessionAdd(false, ms);
    board.setMarkers([{ s: this.t.s, f: this.t.f, cls: 'bad', label: lbl(this.t.n) }]);
    prompt('答案是这个音', '已经播放。可以跟着唱几遍，再按 Enter 下一题。', 'bad');
    audio.play(this.t.n);
  },
  click(s, f, n) {
    audio.play(n);
    board.flash(s, f);
  },
  key(e) {
    if (e.code === 'Space') this.reference();
    if (e.key === 'Enter') this.next();
    if (e.key === 'm' || e.key === 'M') this.toggleMic();
  },
};

// ---------- 看位说数 ----------
const name = {
  enter() {
    const pad = $('pad');
    pad.innerHTML = '';
    SYLLABLES.forEach((syl, k) => {
      const b = document.createElement('button');
      b.innerHTML = `<b>${k}</b><span>${syl}</span>`;
      b.dataset.k = k;
      b.addEventListener('click', (e) => {
        e.currentTarget.blur();
        this.answer(k);
      });
      pad.appendChild(b);
    });
    pad.classList.remove('hidden');
    this.next();
  },
  exit() {
    $('pad').classList.add('hidden');
    clearTimeout(this.timer);
  },
  next() {
    clearTimeout(this.timer);
    this.t = stats.pick('name', cands(), this.last);
    this.last = posKey(this.t.s, this.t.f);
    this.answered = false;
    this.t0 = now();
    board.setMarkers([{ s: this.t.s, f: this.t.f, cls: 'target pulse' }]);
    board.reveal(this.t.s, this.t.f);
    prompt('黄色的位置是几？', '点下面的按钮，或者直接按键盘：0～9，「-」是 10，「=」是 11。答完会放出这个音。');
    controls([{ label: '下一题', kbd: 'Enter', onClick: () => this.next() }]);
    document.querySelectorAll('#pad button').forEach((b) => (b.className = ''));
  },
  answer(k) {
    if (this.answered) return;
    this.answered = true;
    const right = pc(this.t.n);
    const ok = k === right;
    const ms = now() - this.t0;
    audio.play(this.t.n);
    document.querySelector(`#pad button[data-k="${right}"]`).className = 'ok';
    if (!ok) document.querySelector(`#pad button[data-k="${k}"]`).className = 'bad';
    board.setMarkers([{ s: this.t.s, f: this.t.f, cls: ok ? 'ok' : 'bad', label: String(right) }]);
    stats.record('name', this.t.s, this.t.f, ok, ms);
    sessionAdd(ok, ms);
    prompt(ok ? `对了　<span class="num">${right}</span>${syllable(right)}` : `是 <span class="num">${right}</span>${syllable(right)}`, `${secs(ms)} 秒`, ok ? 'ok' : 'bad');
    if (ok && settings.auto) this.timer = setTimeout(() => this.next(), 1100);
  },
  click(s, f, n) {
    audio.play(n);
    board.flash(s, f);
  },
  key(e) {
    if (e.key === 'Enter') return this.next();
    if (/^[0-9]$/.test(e.key)) return this.answer(Number(e.key));
    if (e.key === '-') return this.answer(10);
    if (e.key === '=') return this.answer(11);
  },
};

// ---------- 看数找位 ----------
const findall = {
  enter() { this.next(); },
  exit() { clearTimeout(this.timer); },
  next() {
    clearTimeout(this.timer);
    const seed = stats.pick('findall', cands(), this.last);
    this.last = posKey(seed.s, seed.f);
    this.p = pc(seed.n);
    this.targets = cands().filter((q) => pc(q.n) === this.p);
    this.found = new Set();
    this.wrong = 0;
    this.done = false;
    this.t0 = this.tLast = now();
    board.clear();
    controls([
      { label: '显示答案', onClick: () => this.reveal() },
      { label: '下一题', kbd: 'Enter', onClick: () => this.next() },
    ]);
    this.status();
  },
  status(extra = '') {
    prompt(`<span class="num">${this.p}</span>${SYLLABLES[this.p]}`, `在范围内找出这个音的所有位置：已找到 ${this.found.size} / ${this.targets.length}，点错 ${this.wrong} 次。${extra}`);
  },
  click(s, f, n) {
    audio.play(n);
    board.flash(s, f);
    if (this.done) return;
    const key = posKey(s, f);
    if (pc(n) === this.p) {
      if (!inRange(s, f) || this.found.has(key)) return;
      this.found.add(key);
      stats.record('findall', s, f, true, now() - this.tLast);
      this.tLast = now();
      board.addMarker({ s, f, cls: 'ok', label: settings.labelMode === 'none' ? '' : lbl(n) });
    } else {
      this.wrong += 1;
      stats.record('findall', s, f, false, now() - this.tLast);
      board.addMarker({ s, f, cls: 'bad', label: lbl(n) });
    }
    if (this.found.size === this.targets.length) this.finish();
    else this.status();
  },
  finish() {
    this.done = true;
    const ms = now() - this.t0;
    sessionAdd(this.wrong === 0, ms);
    prompt(`全部找到了　<span class="num">${this.p}</span>${SYLLABLES[this.p]}`, `${this.targets.length} 个位置，用了 ${secs(ms)} 秒，点错 ${this.wrong} 次。`, this.wrong ? '' : 'ok');
    if (settings.auto) this.timer = setTimeout(() => this.next(), 1800);
  },
  reveal() {
    if (this.done) return;
    this.done = true;
    sessionAdd(false, now() - this.t0);
    for (const q of this.targets) if (!this.found.has(posKey(q.s, q.f))) board.addMarker({ s: q.s, f: q.f, cls: 'hint', label: String(this.p) });
    this.status('绿圈是没找到的。');
  },
  key(e) {
    if (e.key === 'Enter') this.next();
  },
};

// ---------- 统计 ----------
const MODE_NAMES = { hear: '听音找位', sing: '看位唱音', name: '看位说数', findall: '看数找位' };
const statsView = {
  heat: 'hear',
  enter() {
    $('statsView').classList.remove('hidden');
    prompt('统计', '热力图：颜色越红表示越容易错，格子里的数字是平均用时（秒）。按这个找自己的薄弱位置，出题时也会自动多出这些位置。');
    controls([]);
    this.draw();
  },
  exit() {
    $('statsView').classList.add('hidden');
    board.clear();
  },
  draw() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = Object.entries(MODE_NAMES).map(([m, label]) => {
      const a = stats.summary(m, today.getTime());
      const b = stats.summary(m);
      const cell = (x) => (x.n ? `${x.n} 题 · ${Math.round(x.acc * 100)}% · ${secs(x.avgMs)} 秒` : '—');
      return `<tr><td>${label}</td><td>${cell(a)}</td><td>${cell(b)}</td></tr>`;
    });
    $('statsView').innerHTML = `
      <table class="stats-table"><tr><th>模式</th><th>今天</th><th>全部</th></tr>${rows.join('')}</table>
      <div class="stats-actions">热力图：<select id="heatMode">${Object.entries(MODE_NAMES).map(([m, l]) => `<option value="${m}" ${m === this.heat ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button id="resetStats">清空全部统计</button></div>`;
    $('heatMode').addEventListener('change', (e) => { this.heat = e.target.value; this.drawHeat(); });
    $('resetStats').addEventListener('click', () => {
      if (confirm('确定清空全部统计吗？清空后不能恢复。')) { stats.reset(); this.draw(); }
    });
    this.drawHeat();
  },
  drawHeat() {
    const list = [];
    for (const p of positions({ fretMin: 0, fretMax: settings.fretMax, strings: STRINGS })) {
      const c = stats.cell(this.heat, p.s, p.f);
      if (!c) continue;
      const hue = Math.round(120 * c.acc);
      list.push({ s: p.s, f: p.f, cls: 'heat', color: `hsl(${hue} 75% 72%)`, label: secs(c.avgMs) });
    }
    board.setMarkers(list);
  },
  click(s, f, n) {
    audio.play(n);
    board.flash(s, f);
  },
};

// ---------- 模式切换、键盘、设置 ----------
const modes = { explore, hear, sing, name, findall, stats: statsView };
let current = null;

function switchMode(m) {
  current?.exit?.();
  settings.mode = m;
  saveSettings();
  session.ok = session.n = session.ms = 0;
  showSession();
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  board.clear();
  current = modes[m];
  current.enter();
}

document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => switchMode(b.dataset.mode)));

document.addEventListener('keydown', (e) => {
  if (e.target.closest('select, input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space') e.preventDefault();
  current?.key?.(e);
});

function initSettings() {
  for (const id of ['fretMin', 'fretMax']) {
    $(id).innerHTML = [...Array(16).keys()].map((f) => `<option value="${f}">${f}</option>`).join('');
    $(id).value = settings[id];
  }
  $('stringBoxes').innerHTML = STRINGS.map((s) => `<label><input type="checkbox" value="${s}" ${settings.strings.includes(s) ? 'checked' : ''}>${s}</label>`).join('');
  $('labelMode').value = settings.labelMode;
  $('strict').value = settings.strict ? '1' : '0';
  $('singStrict').value = settings.singStrict ? '1' : '0';
  $('auto').value = settings.auto ? '1' : '0';
  $('volume').value = settings.volume;
  $('legend').innerHTML = SYLLABLES.map((s, k) => `<div><b>${k}</b>${s}</div>`).join('');
  $('build').textContent = BUILD;

  const apply = (restart = true) => {
    saveSettings();
    if (restart) switchMode(settings.mode);
  };
  const onFret = () => {
    let a = Number($('fretMin').value), b = Number($('fretMax').value);
    if (a > b) [a, b] = [b, a];
    Object.assign(settings, { fretMin: a, fretMax: Math.max(b, 1) });
    $('fretMin').value = settings.fretMin;
    $('fretMax').value = settings.fretMax;
    board.setMaxFret(Math.max(settings.fretMax, 5));
    apply();
  };
  $('fretMin').addEventListener('change', onFret);
  $('fretMax').addEventListener('change', onFret);
  $('stringBoxes').addEventListener('change', () => {
    const picked = [...$('stringBoxes').querySelectorAll('input:checked')].map((i) => Number(i.value));
    if (!picked.length) {
      $('stringBoxes').querySelector(`input[value="${settings.strings[0]}"]`).checked = true;
      return;
    }
    settings.strings = picked;
    apply();
  });
  $('labelMode').addEventListener('change', (e) => { settings.labelMode = e.target.value; apply(); });
  $('strict').addEventListener('change', (e) => { settings.strict = e.target.value === '1'; apply(); });
  $('singStrict').addEventListener('change', (e) => { settings.singStrict = e.target.value === '1'; apply(); });
  $('auto').addEventListener('change', (e) => { settings.auto = e.target.value === '1'; apply(false); });
  $('volume').addEventListener('input', (e) => { settings.volume = Number(e.target.value); audio.setVolume(settings.volume); apply(false); });
}

// 第一次交互时预先生成常用音，之后播放不卡
let warmed = false;
document.addEventListener('pointerdown', () => {
  if (warmed) return;
  warmed = true;
  audio.ensure();
  const ns = [...new Set(positions({ fretMin: 0, fretMax: 15 }).map((p) => p.n))];
  const step = () => {
    const batch = ns.splice(0, 4);
    if (!batch.length) return;
    audio.warm(batch);
    setTimeout(step, 30);
  };
  step();
}, { capture: true });

initSettings();
board.setMaxFret(Math.max(settings.fretMax, 5));
switchMode(modes[settings.mode] ? settings.mode : 'hear');

// 给自动化测试用
window.guitar12 = { settings, stats, audio, mic, board, modes, get current() { return current; }, switchMode };
