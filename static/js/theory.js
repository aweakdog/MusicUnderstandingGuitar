// 12 音系统：八度内 12 个半音编号 0～11，唱名用插值法命名。
// 绝对编号 n：以 6 弦空弦下方的 do 为 0，所以 6 弦空弦 = 4（mi），6 弦 3 品 = 7（so）。

export const SYLLABLES = ['do', 'de', 're', 'ri', 'mi', 'fa', 'fo', 'so', 'sa', 'la', 'li', 'xi'];

// 标准调弦各弦空弦的绝对编号，下标 1～6 对应 1 弦（最细）到 6 弦（最粗）。
// 相邻弦相差 5，只有 3 弦到 2 弦相差 4。
export const OPEN = [null, 28, 23, 19, 14, 9, 4];
export const STRINGS = [1, 2, 3, 4, 5, 6];

// 绝对编号 4（6 弦空弦）的频率，单位 Hz
const BASE_N = 4;
const BASE_FREQ = 82.40689;

export const pc = (n) => ((n % 12) + 12) % 12;
export const pitchAt = (string, fret) => OPEN[string] + fret;
export const syllable = (n) => SYLLABLES[pc(n)];
export const freqOf = (n) => BASE_FREQ * 2 ** ((n - BASE_N) / 12);
export const nOfFreq = (f) => BASE_N + 12 * Math.log2(f / BASE_FREQ);

// 频率相对某个绝对编号的偏差（音分，100 音分 = 1 个半音）
export const centsFrom = (f, n) => 1200 * Math.log2(f / freqOf(n));

// 忽略八度时，频率离音级 p 最近的那个绝对编号，以及偏差音分
export function nearestOfClass(f, p) {
  const x = nOfFreq(f);
  const n = Math.round((x - p) / 12) * 12 + p;
  return { n, cents: (x - n) * 100 };
}

// 指板上所有位置，按范围筛选
export function positions({ fretMin = 0, fretMax = 12, strings = STRINGS } = {}) {
  const out = [];
  for (const s of strings) for (let f = fretMin; f <= fretMax; f++) out.push({ s, f, n: pitchAt(s, f) });
  return out;
}

// 和目标同音的位置：strict = 同一个绝对音高，否则同一个音级（忽略八度）
export function samePitch(a, b, strict) {
  return strict ? a === b : pc(a) === pc(b);
}

export function matchingPositions(n, range, strict) {
  return positions(range).filter((p) => samePitch(p.n, n, strict));
}

export const posKey = (s, f) => `${s}-${f}`;

// 位置上显示的文字
export function labelOf(n, mode) {
  if (mode === 'number') return String(pc(n));
  if (mode === 'syllable') return syllable(n);
  if (mode === 'absolute') return String(n);
  return '';
}
