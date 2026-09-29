// 拨弦音色：Karplus-Strong 算法。用一阶全通滤波补上小数延迟，保证音准（高把位也在几音分以内）。

export function pluck(freq, sampleRate, { seconds = 2.2, t60 = null, brightness = 0.55, seed = 1 } = {}) {
  const len = Math.floor(seconds * sampleRate);
  const out = new Float32Array(len);
  const period = sampleRate / freq;
  // 环路总延迟 = 整数延迟 N + 平均滤波的 0.5 + 全通的小数延迟 d
  const N = Math.max(2, Math.floor(period - 0.5 - 0.1));
  const d = period - 0.5 - N;
  const C = (1 - d) / (1 + d);
  // 衰减：低音延音长、高音短一些
  const T = t60 ?? Math.max(1.2, 3.2 - (freq - 80) / 400);
  const rho = 10 ** (-3 / (freq * T));

  // 初始激励：白噪声经一阶低通，brightness 越小越柔和
  let rnd = seed * 9301 + 49297;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280) * 2 - 1;
  const line = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    lp += brightness * (rand() - lp);
    line[i] = lp;
  }
  let mean = 0;
  for (let i = 0; i < N; i++) mean += line[i];
  mean /= N;
  let peak = 1e-9;
  for (let i = 0; i < N; i++) {
    line[i] -= mean;
    peak = Math.max(peak, Math.abs(line[i]));
  }
  for (let i = 0; i < N; i++) line[i] /= peak;

  let idx = 0, prev = 0, apX = 0, apY = 0;
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    out[i] = cur;
    const avg = 0.5 * (cur + prev) * rho;
    const ap = C * avg + apX - C * apY;
    apX = avg;
    apY = ap;
    prev = cur;
    line[idx] = ap;
    idx = idx + 1 === N ? 0 : idx + 1;
  }
  // 起音 3ms 淡入、结尾 80ms 淡出，避免爆音
  const a = Math.floor(0.003 * sampleRate), r = Math.floor(0.08 * sampleRate);
  for (let i = 0; i < a; i++) out[i] *= i / a;
  for (let i = 0; i < r; i++) out[len - 1 - i] *= i / r;
  return out;
}
