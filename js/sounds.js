// Sound effects, synthesised in the browser so there are no audio files.
// Every effect takes `at`: how many seconds from now it should start.

export function createSounds(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);

  // Every sound plays through the bus, so swapping it silences whatever is playing.
  let bus = newBus();
  function newBus() {
    const gain = ctx.createGain();
    gain.connect(master);
    return gain;
  }

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

  function envelope(at, duration, gain) {
    const t = ctx.currentTime + at;
    const node = ctx.createGain();
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, duration / 3));
    node.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    node.connect(bus);
    return { node, t };
  }

  function tone({ wave = 'sine', from, to = from, at = 0, duration = 0.2, gain = 0.25, vibrato = 0, rate = 9 }) {
    const { node, t } = envelope(at, duration, gain);
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 2600;
    osc.connect(soften).connect(node);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = rate;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + duration + 0.05);
    }
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function hiss({ at = 0, duration = 0.1, gain = 0.2, freq = 1000, q = 1 }) {
    const { node, t } = envelope(at, duration, gain);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    source.connect(filter).connect(node);
    source.start(t);
    source.stop(t + duration + 0.05);
  }

  // The pet's own voice, shaped by its wave and pitch.
  const calls = {
    happy: (wave, p, at) => tone({ wave, from: p * 0.9, to: p * 1.4, at, duration: 0.22 }),
    ouch: (wave, p, at) => tone({ wave, from: p * 1.6, to: p * 0.7, at, duration: 0.35 }),
    yowl: (wave, p, at) => {
      tone({ wave, from: p * 1.1, to: p * 2, at, duration: 0.25 });
      tone({ wave, from: p * 2, to: p * 0.9, at: at + 0.25, duration: 0.45, vibrato: p * 0.06 });
    },
    giggle: (wave, p, at) => {
      for (let i = 0; i < 6; i++) {
        tone({ wave, from: p * (1.3 + (i % 2) * 0.3), to: p * 1.1, at: at + i * 0.12, duration: 0.09 });
      }
    },
    woozy: (wave, p, at) => {
      tone({ wave, from: p * 1.2, to: p * 0.6, at, duration: 1.6, gain: 0.18, vibrato: p * 0.25, rate: 3 });
    },
  };

  let snoreTimer = null;
  function snoreOnce() {
    hiss({ duration: 1.1, gain: 0.22, freq: 180, q: 2 });
    tone({ from: 95, to: 70, at: 1.3, duration: 1.0, gain: 0.18 });
  }

  const TUNE = [523, 659, 784, 659, 880, 784, 659, 523];

  return {
    call(pet, mood, at = 0) {
      calls[mood](pet.voice.wave, pet.voice.pitch, at);
    },
    munch() {
      for (let i = 0; i < 6; i++) hiss({ at: 0.5 + i * 0.31, duration: 0.12, gain: 0.3, freq: 900, q: 1.5 });
    },
    slurp() {
      for (let i = 0; i < 4; i++) {
        tone({ from: 280, to: 620, at: 0.2 + i * 0.45, duration: 0.24, gain: 0.16 });
        hiss({ at: 0.2 + i * 0.45, duration: 0.24, gain: 0.08, freq: 1800, q: 3 });
      }
    },
    burp(at = 0) {
      tone({ wave: 'sawtooth', from: 170, to: 95, at, duration: 0.5, gain: 0.4, vibrato: 35, rate: 38 });
      hiss({ at, duration: 0.45, gain: 0.1, freq: 500, q: 1 });
    },
    toot(at = 0) {
      tone({ wave: 'sawtooth', from: 120, to: 62, at, duration: 0.7, gain: 0.45, vibrato: 30, rate: 55 });
      tone({ wave: 'square', from: 240, to: 130, at, duration: 0.5, gain: 0.08, vibrato: 40, rate: 55 });
    },
    whoosh(at = 0) {
      hiss({ at, duration: 0.35, gain: 0.25, freq: 700, q: 0.7 });
    },
    splat(at = 0) {
      hiss({ at, duration: 0.28, gain: 0.55, freq: 320, q: 0.8 });
      tone({ from: 130, to: 45, at, duration: 0.22, gain: 0.4 });
    },
    boing(at = 0) {
      tone({ from: 240, to: 720, at, duration: 0.1, gain: 0.3 });
      tone({ from: 720, to: 300, at: at + 0.1, duration: 0.45, gain: 0.3, vibrato: 70, rate: 18 });
    },
    twinkle() {
      for (let i = 0; i < 9; i++) {
        tone({ from: 1400 + ((i * 577) % 1100), at: 0.15 + i * 0.26, duration: 0.18, gain: 0.08 });
      }
    },
    // Five seconds of beat and tune to dance to.
    dance() {
      for (let i = 0; i < 10; i++) {
        tone({ from: 150, to: 50, at: i * 0.5, duration: 0.16, gain: 0.5 });
        hiss({ at: i * 0.5 + 0.25, duration: 0.05, gain: 0.12, freq: 6000, q: 1 });
      }
      for (let i = 0; i < 20; i++) {
        tone({ wave: 'square', from: TUNE[i % TUNE.length], at: i * 0.25, duration: 0.2, gain: 0.07 });
      }
    },
    // A soft rush of air each time the swing passes the bottom.
    swing(period) {
      for (let i = 0; i < 4; i++) hiss({ at: 0.5 + i * (period / 2), duration: 0.5, gain: 0.14, freq: 500, q: 0.6 });
    },
    // One thud per punch.
    punches(interval, count) {
      for (let i = 0; i < count; i++) {
        const at = interval * (i + 0.5);
        hiss({ at, duration: 0.09, gain: 0.5, freq: 260, q: 1 });
        tone({ from: 160, to: 60, at, duration: 0.12, gain: 0.45 });
      }
    },
    // Bloops as bubbles are blown, then little pops.
    bubbles() {
      for (let i = 0; i < 7; i++) {
        tone({ from: 420 + i * 40, to: 760 + i * 40, at: 0.2 + i * 0.35, duration: 0.14, gain: 0.14 });
        tone({ from: 1900, to: 900, at: 2.3 + i * 0.3, duration: 0.05, gain: 0.16 });
      }
    },
    // A springy boing on every landing.
    bounces(interval, count) {
      for (let i = 0; i < count; i++) {
        const at = i * interval;
        tone({ from: 180, to: 520, at, duration: 0.12, gain: 0.3 });
        tone({ from: 520, to: 260, at: at + 0.12, duration: 0.3, gain: 0.25, vibrato: 50, rate: 20 });
      }
    },
    startSnoring() {
      snoreOnce();
      snoreTimer = setInterval(snoreOnce, 2800);
    },
    // Cut off everything that is playing or scheduled.
    stopAll() {
      clearInterval(snoreTimer);
      snoreTimer = null;
      bus.disconnect();
      bus = newBus();
    },
  };
}
