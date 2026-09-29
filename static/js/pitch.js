// 音高检测：YIN 算法（累积均值归一化差分函数 + 抛物线插值）。
// 返回 { freq, clarity } 或 null（太安静或找不到周期）。

export function detectPitch(buf, sampleRate, { minFreq = 60, maxFreq = 1100, threshold = 0.12, minRms = 0.01 } = {}) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < minRms) return null;

  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(n / 2));
  const W = n - maxTau;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // 累积均值归一化
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= maxTau && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // 没有低于阈值的点：取全局最小，但要求足够清晰
    let best = minTau;
    for (let t = minTau; t <= maxTau; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] > 0.3) return null;
    tau = best;
  }
  // 抛物线插值求小数周期
  let better = tau;
  if (tau > 1 && tau < maxTau) {
    const s0 = cmnd[tau - 1], s1 = cmnd[tau], s2 = cmnd[tau + 1];
    const den = s0 + s2 - 2 * s1;
    if (den !== 0) better = tau + (s0 - s2) / (2 * den);
  }
  return { freq: sampleRate / better, clarity: 1 - cmnd[tau] };
}
