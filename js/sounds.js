// Sound effects, synthesised in the browser so there are no audio files.

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

  function tone({ wave = 'sine', from, to = from, at = 0, duration = 0.2, gain = 0.25, vibrato = 0 }) {
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
      lfo.frequency.value = 9;
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
    happy: (wave, p) => tone({ wave, from: p * 0.9, to: p * 1.4, duration: 0.22 }),
    ouch: (wave, p) => tone({ wave, from: p * 1.6, to: p * 0.7, duration: 0.35 }),
    yowl: (wave, p) => {
      tone({ wave, from: p * 1.1, to: p * 2, duration: 0.25 });
      tone({ wave, from: p * 2, to: p * 0.9, at: 0.25, duration: 0.45, vibrato: p * 0.06 });
    },
    giggle: (wave, p) => {
      for (let i = 0; i < 6; i++) {
        tone({ wave, from: p * (1.3 + (i % 2) * 0.3), to: p * 1.1, at: i * 0.12, duration: 0.09 });
      }
    },
  };

  let snoreTimer = null;
  function snoreOnce() {
    hiss({ duration: 1.1, gain: 0.22, freq: 180, q: 2 });
    tone({ from: 95, to: 70, at: 1.3, duration: 1.0, gain: 0.18 });
  }

  return {
    call(pet, mood) {
      calls[mood](pet.voice.wave, pet.voice.pitch);
    },
    munch() {
      for (let i = 0; i < 6; i++) hiss({ at: 0.3 + i * 0.33, duration: 0.12, gain: 0.3, freq: 900, q: 1.5 });
    },
    slurp() {
      for (let i = 0; i < 4; i++) {
        tone({ from: 280, to: 620, at: 0.3 + i * 0.5, duration: 0.24, gain: 0.16 });
        hiss({ at: 0.3 + i * 0.5, duration: 0.24, gain: 0.08, freq: 1800, q: 3 });
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
