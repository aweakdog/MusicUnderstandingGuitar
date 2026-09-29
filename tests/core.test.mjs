import test from 'node:test';
import assert from 'node:assert/strict';
import { OPEN, pc, pitchAt, syllable, freqOf, nOfFreq, nearestOfClass, positions, matchingPositions, labelOf } from '../js/theory.js';
import { pluck } from '../js/synth.js';
import { detectPitch } from '../js/pitch.js';

test('空弦编号：相邻弦差 5，只有 3→2 弦差 4', () => {
  assert.deepEqual(OPEN.slice(1), [28, 23, 19, 14, 9, 4]);
  const gaps = [6, 5, 4, 3, 2].map((s) => OPEN[s - 1] - OPEN[s]);
  assert.deepEqual(gaps, [5, 5, 5, 4, 5]);
});

test('用户的例子：6 弦 3 品 = 7 = so，右上再右上 = 19 = 高八度 so', () => {
  assert.equal(pitchAt(6, 3), 7);
  assert.equal(syllable(7), 'so');
  assert.equal(pitchAt(4, 5), 7 + 5 * 2 + 2);
  assert.equal(pitchAt(4, 5), 19);
  assert.equal(pc(19), 7);
});

test('唱名插值：do de re ri mi fa fo so sa la li xi', () => {
  assert.deepEqual([...Array(12).keys()].map(syllable).join(' '), 'do de re ri mi fa fo so sa la li xi');
  assert.equal(syllable(-1), 'xi');
});

test('频率：6 弦空弦 82.41Hz，5 弦空弦 110Hz，1 弦空弦 329.63Hz，12 品翻倍', () => {
  assert.ok(Math.abs(freqOf(4) - 82.407) < 0.01);
  assert.ok(Math.abs(freqOf(9) - 110) < 0.01);
  assert.ok(Math.abs(freqOf(28) - 329.628) < 0.01);
  assert.ok(Math.abs(freqOf(pitchAt(6, 12)) / freqOf(pitchAt(6, 0)) - 2) < 1e-9);
  assert.ok(Math.abs(nOfFreq(freqOf(19)) - 19) < 1e-9);
});

test('忽略八度时找最近的同音级', () => {
  const r = nearestOfClass(freqOf(19) * 2 ** (10 / 1200), 7);
  assert.equal(r.n, 19);
  assert.ok(Math.abs(r.cents - 10) < 1e-6);
  assert.equal(nearestOfClass(freqOf(31), 7).n, 31);
});

test('位置筛选与同音匹配', () => {
  assert.equal(positions({ fretMin: 0, fretMax: 12 }).length, 6 * 13);
  const strict = matchingPositions(19, { fretMin: 0, fretMax: 12 }, true).map((p) => `${p.s}-${p.f}`).sort();
  assert.deepEqual(strict, ['3-0', '4-5', '5-10'].sort());
  const loose = matchingPositions(19, { fretMin: 0, fretMax: 12 }, false);
  assert.ok(loose.length > strict.length);
  assert.ok(loose.every((p) => pc(p.n) === 7));
});

test('标签：默认不显示，数字 / 唱名 / 绝对编号', () => {
  assert.equal(labelOf(19, 'none'), '');
  assert.equal(labelOf(19, 'number'), '7');
  assert.equal(labelOf(19, 'syllable'), 'so');
  assert.equal(labelOf(19, 'absolute'), '19');
});

test('拨弦合成音准：全指板 0～15 品误差都在 5 音分以内（用 YIN 检测）', () => {
  const sr = 48000;
  const worst = { cents: 0 };
  for (const s of [6, 5, 4, 3, 2, 1]) {
    for (const f of [0, 3, 7, 12, 15]) {
      const n = pitchAt(s, f);
      const buf = pluck(freqOf(n), sr, { seconds: 0.4 });
      const frame = buf.subarray(Math.floor(0.08 * sr), Math.floor(0.08 * sr) + 4096);
      const r = detectPitch(frame, sr);
      assert.ok(r, `检测不到 ${s} 弦 ${f} 品`);
      const cents = 1200 * Math.log2(r.freq / freqOf(n));
      if (Math.abs(cents) > Math.abs(worst.cents)) Object.assign(worst, { s, f, cents });
      assert.ok(Math.abs(cents) < 5, `${s} 弦 ${f} 品偏了 ${cents.toFixed(1)} 音分`);
    }
  }
});

test('音高检测：正弦波（人声频段）与安静输入', () => {
  const sr = 44100;
  for (const f of [98, 196, 261.63, 440, 700]) {
    const buf = new Float32Array(2048).map((_, i) => 0.3 * Math.sin((2 * Math.PI * f * i) / sr));
    const r = detectPitch(buf, sr);
    assert.ok(r && Math.abs(1200 * Math.log2(r.freq / f)) < 3, `正弦 ${f}Hz 检测为 ${r && r.freq}`);
  }
  assert.equal(detectPitch(new Float32Array(2048), sr), null);
});
