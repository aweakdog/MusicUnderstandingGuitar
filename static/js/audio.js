// 浏览器里的发声和麦克风。
import { freqOf } from './theory.js';
import { pluck } from './synth.js';
import { detectPitch } from './pitch.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.cache = new Map();
    this.volume = 0.8;
    this.busyUntil = 0; // 正在发声的时间，麦克风在这段时间里不判定，免得听到自己
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  buffer(n) {
    const ctx = this.ensure();
    if (!this.cache.has(n)) {
      const data = pluck(freqOf(n), ctx.sampleRate, { seed: n + 7 });
      const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.copyToChannel(data, 0);
      this.cache.set(n, b);
    }
    return this.cache.get(n);
  }

  play(n, when = 0) {
    const ctx = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(n);
    const g = ctx.createGain();
    g.gain.value = 0.9;
    src.connect(g).connect(this.master);
    const t = ctx.currentTime + when;
    src.start(t);
    this.busyUntil = Math.max(this.busyUntil, performance.now() + (when + 1.4) * 1000);
    return src;
  }

  // 预先生成常用音，避免第一次播放卡顿
  warm(ns) {
    for (const n of ns) this.buffer(n);
  }
}

export class Mic {
  constructor(audio) {
    this.audio = audio;
    this.stream = null;
    this.timer = null;
  }

  get on() {
    return !!this.stream;
  }

  async start(onPitch) {
    const ctx = this.audio.ensure();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const src = ctx.createMediaStreamSource(this.stream);
    const an = ctx.createAnalyser();
    an.fftSize = 4096;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    this.timer = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      const muted = performance.now() < this.audio.busyUntil;
      const r = muted ? null : detectPitch(buf, ctx.sampleRate, { minFreq: 70, maxFreq: 1100 });
      onPitch(r, muted);
    }, 50);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
