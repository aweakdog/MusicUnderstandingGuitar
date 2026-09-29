// 每个练习模式下、每个指板位置的答题统计，以及按薄弱程度加权出题。
import { posKey } from './theory.js';

export class Stats {
  constructor(store) {
    this.store = store;
    this.data = store.load('stats', {});
    this.log = store.load('log', []);
  }

  entry(mode, s, f) {
    const m = (this.data[mode] ??= {});
    return (m[posKey(s, f)] ??= { tries: 0, correct: 0, ms: 0, streak: 0, last: 0 });
  }

  record(mode, s, f, ok, ms) {
    const e = this.entry(mode, s, f);
    e.tries += 1;
    e.correct += ok ? 1 : 0;
    e.ms += Math.min(ms, 30000);
    e.streak = ok ? e.streak + 1 : 0;
    e.last = Date.now();
    this.log.push({ t: Date.now(), mode, s, f, ok, ms: Math.round(ms) });
    if (this.log.length > 5000) this.log.splice(0, this.log.length - 5000);
    this.store.save('stats', this.data);
    this.store.save('log', this.log);
  }

  // 薄弱程度：没练过的、错得多的、反应慢的、最近连对少的，权重高
  weight(mode, s, f) {
    const e = this.data[mode]?.[posKey(s, f)];
    if (!e || e.tries === 0) return 3;
    const acc = e.correct / e.tries;
    const avg = e.ms / e.tries;
    return 0.5 + 3 * (1 - acc) + Math.min(2, avg / 3000) + (e.streak >= 3 ? 0 : 0.5);
  }

  pick(mode, candidates, avoidKey = null, rand = Math.random) {
    const pool = candidates.length > 1 ? candidates.filter((p) => posKey(p.s, p.f) !== avoidKey) : candidates;
    const ws = pool.map((p) => this.weight(mode, p.s, p.f));
    let r = rand() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= ws[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  summary(mode, sinceMs = 0) {
    const items = this.log.filter((x) => x.mode === mode && x.t >= sinceMs);
    const n = items.length;
    const ok = items.filter((x) => x.ok).length;
    const avg = n ? items.reduce((a, x) => a + x.ms, 0) / n : 0;
    return { n, acc: n ? ok / n : 0, avgMs: avg };
  }

  // 热力图用：每个位置的正确率和平均用时
  cell(mode, s, f) {
    const e = this.data[mode]?.[posKey(s, f)];
    if (!e || !e.tries) return null;
    return { acc: e.correct / e.tries, avgMs: e.ms / e.tries, tries: e.tries };
  }

  reset() {
    this.data = {};
    this.log = [];
    this.store.save('stats', this.data);
    this.store.save('log', this.log);
  }
}
