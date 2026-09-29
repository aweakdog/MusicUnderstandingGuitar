import test from 'node:test';
import assert from 'node:assert/strict';
import { Stats } from '../js/stats.js';

class MemStore {
  constructor() { this.m = {}; }
  load(k, fb) { return k in this.m ? structuredClone(this.m[k]) : fb; }
  save(k, v) { this.m[k] = structuredClone(v); }
}

test('记录、汇总、持久化', () => {
  const store = new MemStore();
  const st = new Stats(store);
  st.record('hear', 6, 3, true, 1200);
  st.record('hear', 6, 3, false, 4000);
  st.record('name', 1, 0, true, 800);
  const s = st.summary('hear');
  assert.equal(s.n, 2);
  assert.equal(s.acc, 0.5);
  assert.equal(s.avgMs, 2600);
  const again = new Stats(store);
  assert.equal(again.cell('hear', 6, 3).tries, 2);
  assert.equal(again.cell('hear', 1, 1), null);
});

test('加权出题：错得多的位置被抽中得更频繁，且不连续出同一题', () => {
  const st = new Stats(new MemStore());
  for (let i = 0; i < 10; i++) st.record('hear', 1, 0, true, 500);
  for (let i = 0; i < 10; i++) st.record('hear', 6, 5, false, 6000);
  const cands = [{ s: 1, f: 0 }, { s: 6, f: 5 }];
  let weak = 0;
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) if (st.pick('hear', cands, null, rand).s === 6) weak++;
  assert.ok(weak > 1500, `薄弱位置只被抽中 ${weak} 次`);
  for (let i = 0; i < 50; i++) assert.equal(st.pick('hear', cands, '6-5', rand).s, 1);
});

test('没练过的位置权重高于已经熟练的位置', () => {
  const st = new Stats(new MemStore());
  for (let i = 0; i < 5; i++) st.record('name', 2, 1, true, 600);
  assert.ok(st.weight('name', 3, 3) > st.weight('name', 2, 1));
});
