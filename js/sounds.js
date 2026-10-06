// Sound effects and instruments, synthesised in the browser so there are no
// audio files. Every effect takes `at`: how many seconds from now it starts.

export function createSounds(ctx) {
  // Everything passes through a gentle limiter, so stacked sounds never get harsh.
  const master = ctx.createGain();
  master.gain.value = 0.7;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 6;
  master.connect(limiter).connect(ctx.destination);

  // A short room echo. A little of it makes thin beeps sound like real objects.
  const room = ctx.createConvolver();
  const tail = ctx.createBuffer(2, ctx.sampleRate * 1.3, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = tail.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  }
  room.buffer = tail;
  const roomLevel = ctx.createGain();
  roomLevel.gain.value = 0.22;
  room.connect(roomLevel).connect(master);

  // Every sound plays through the bus, so swapping it silences whatever is playing.
  let bus = newBus();
  function newBus() {
    const gain = ctx.createGain();
    gain.connect(master);
    gain.connect(room);
    return gain;
  }

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

  // Loudness over time: a quick rise, then a fade. `attack` softens the start.
  function envelope(at, duration, gain, attack = Math.min(0.03, duration / 3)) {
    const t = ctx.currentTime + at;
    const node = ctx.createGain();
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(gain, t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    node.connect(bus);
    return { node, t };
  }

  // A single pitched voice. `cutoff` takes the edge off bright waves.
  function tone({ wave = 'sine', from, to = from, at = 0, duration = 0.2, gain = 0.25, vibrato = 0, rate = 9, cutoff = 2600, attack }) {
    const { node, t } = envelope(at, duration, gain, attack);
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = cutoff;
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

  // A burst of filtered noise: crunches, whooshes, thuds.
  function hiss({ at = 0, duration = 0.1, gain = 0.2, freq = 1000, q = 1, attack }) {
    const { node, t } = envelope(at, duration, gain, attack);
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

  // Several pure tones sounded together, each fading at its own pace. The
  // recipe of [pitch multiple, loudness, length] decides what it sounds like.
  function strike(freq, recipe, { at = 0, gain = 0.2, length = 1 } = {}) {
    for (const [multiple, level, fade] of recipe) {
      tone({ from: freq * multiple, at, duration: fade * length, gain: gain * level, attack: 0.004, cutoff: 9000 });
    }
  }
  // A glockenspiel-like chime: bright, ringing, never shrill.
  const CHIME = [[1, 1, 0.9], [2.76, 0.35, 0.45], [5.4, 0.15, 0.2]];
  const chime = (freq, options) => strike(freq, CHIME, options);
  // A soft piano: the note and its overtones, the high ones dying away first.
  const PIANO = [[1, 1, 1.3], [2, 0.45, 0.9], [3, 0.2, 0.6], [4, 0.1, 0.4]];
  const piano = (freq, options) => strike(freq, PIANO, options);

  const C5 = 523.25;
  const E5 = 659.25;
  const G5 = 783.99;
  const A5 = 880;
  const C6 = 1046.5;

  // The pet's own wordless voice, shaped by its wave and pitch.
  const calls = {
    happy: (wave, p, at) => tone({ wave, from: p * 0.9, to: p * 1.4, at, duration: 0.22, gain: 0.18, cutoff: 1800 }),
    ouch: (wave, p, at) => tone({ wave, from: p * 1.6, to: p * 0.7, at, duration: 0.35, gain: 0.18, cutoff: 1800 }),
    yowl: (wave, p, at) => {
      tone({ wave, from: p * 1.1, to: p * 2, at, duration: 0.25, gain: 0.18, cutoff: 1800 });
      tone({ wave, from: p * 2, to: p * 0.9, at: at + 0.25, duration: 0.45, gain: 0.18, vibrato: p * 0.06, cutoff: 1800 });
    },
    giggle: (wave, p, at) => {
      for (let i = 0; i < 6; i++) {
        tone({ wave, from: p * (1.3 + (i % 2) * 0.3), to: p * 1.1, at: at + i * 0.12, duration: 0.09, gain: 0.16, cutoff: 1800 });
      }
    },
    woozy: (wave, p, at) => {
      tone({ wave, from: p * 1.2, to: p * 0.6, at, duration: 1.6, gain: 0.14, vibrato: p * 0.25, rate: 3, cutoff: 1500 });
    },
  };

  let snoreTimer = null;
  function snoreOnce() {
    hiss({ duration: 1.1, gain: 0.2, freq: 180, q: 2, attack: 0.4 });
    tone({ from: 95, to: 70, at: 1.3, duration: 1.0, gain: 0.16, attack: 0.2 });
  }

  const TUNE = [C5, E5, G5, E5, A5, G5, E5, C5];
  const BASS = [130.81, 130.81, 174.61, 196];

  return {
    call(pet, mood, at = 0) {
      calls[mood](pet.voice.wave, pet.voice.pitch, at);
    },

    // ----- Eating and drinking -----
    // A crunch on each bite, soft chewing after it, and a gulp at the end.
    munch(bites, gulp) {
      for (const at of bites) {
        hiss({ at, duration: 0.07, gain: 0.4, freq: 1400, q: 1.2 });
        hiss({ at: at + 0.05, duration: 0.09, gain: 0.28, freq: 800, q: 1.5 });
        for (let chew = 1; chew <= 2; chew++) hiss({ at: at + chew * 0.2, duration: 0.08, gain: 0.1, freq: 700, q: 2 });
      }
      tone({ from: 320, to: 150, at: gulp, duration: 0.16, gain: 0.22 });
    },
    slurp() {
      for (let i = 0; i < 4; i++) {
        tone({ from: 280, to: 620, at: 0.2 + i * 0.45, duration: 0.24, gain: 0.14 });
        hiss({ at: 0.2 + i * 0.45, duration: 0.24, gain: 0.06, freq: 1800, q: 3 });
      }
    },
    burp(at = 0) {
      tone({ wave: 'sawtooth', from: 170, to: 95, at, duration: 0.5, gain: 0.4, vibrato: 35, rate: 38, cutoff: 900 });
      hiss({ at, duration: 0.45, gain: 0.08, freq: 500, q: 1 });
    },
    chomp() {
      hiss({ duration: 0.08, gain: 0.3, freq: 900, q: 1.5 });
      hiss({ at: 0.12, duration: 0.08, gain: 0.3, freq: 900, q: 1.5 });
      chime(A5, { at: 0.05, gain: 0.1, length: 0.5 });
    },
    yuck() {
      tone({ wave: 'sawtooth', from: 260, to: 120, duration: 0.45, gain: 0.22, vibrato: 30, rate: 14, cutoff: 800 });
    },

    // ----- Silly things -----
    toot(at = 0) {
      tone({ wave: 'sawtooth', from: 120, to: 62, at, duration: 0.7, gain: 0.45, vibrato: 30, rate: 55, cutoff: 700 });
      tone({ wave: 'square', from: 240, to: 130, at, duration: 0.5, gain: 0.06, vibrato: 40, rate: 55, cutoff: 900 });
    },
    whoosh(at = 0) {
      hiss({ at, duration: 0.35, gain: 0.22, freq: 700, q: 0.7, attack: 0.15 });
    },
    splat(at = 0) {
      hiss({ at, duration: 0.28, gain: 0.5, freq: 320, q: 0.8 });
      tone({ from: 130, to: 45, at, duration: 0.22, gain: 0.4 });
    },
    boing(at = 0) {
      tone({ from: 240, to: 720, at, duration: 0.1, gain: 0.26 });
      tone({ from: 720, to: 300, at: at + 0.1, duration: 0.45, gain: 0.26, vibrato: 70, rate: 18 });
    },
    twinkle() {
      for (let i = 0; i < 9; i++) chime(1400 + ((i * 577) % 1100), { at: 0.15 + i * 0.26, gain: 0.07, length: 0.5 });
    },
    // A springy boing on every landing.
    bounces(interval, count) {
      for (let i = 0; i < count; i++) {
        const at = i * interval;
        tone({ from: 180, to: 520, at, duration: 0.12, gain: 0.26 });
        tone({ from: 520, to: 260, at: at + 0.12, duration: 0.3, gain: 0.2, vibrato: 50, rate: 20 });
      }
    },
    // Five seconds of beat, bass and tune to dance to.
    dance() {
      for (let i = 0; i < 10; i++) {
        tone({ from: 140, to: 48, at: i * 0.5, duration: 0.18, gain: 0.45 }); // drum
        hiss({ at: i * 0.5 + 0.25, duration: 0.05, gain: 0.08, freq: 6000, q: 1 }); // shaker
        tone({ wave: 'triangle', from: BASS[Math.floor(i / 2) % BASS.length], at: i * 0.5, duration: 0.4, gain: 0.2 });
      }
      for (let i = 0; i < 20; i++) piano(TUNE[i % TUNE.length], { at: i * 0.25, gain: 0.16, length: 0.5 });
    },

    // ----- Game sounds -----
    thud() {
      hiss({ duration: 0.09, gain: 0.45, freq: 260, q: 1 });
      tone({ from: 170, to: 60, duration: 0.12, gain: 0.45 });
    },
    kick() {
      hiss({ duration: 0.06, gain: 0.35, freq: 500, q: 1 });
      tone({ from: 150, to: 55, duration: 0.14, gain: 0.5 });
    },
    // A soft wooden tap as something appears.
    blip() {
      tone({ from: 520, to: 700, duration: 0.06, gain: 0.08 });
    },
    miss() {
      tone({ wave: 'triangle', from: 230, to: 150, duration: 0.2, gain: 0.14 });
    },
    ding() {
      chime(E5 * 2, { gain: 0.18 });
    },
    bell() {
      chime(C6, { gain: 0.2, length: 1.3 });
      chime(E5 * 2, { at: 0.09, gain: 0.16, length: 1.3 });
      chime(G5 * 2, { at: 0.18, gain: 0.14, length: 1.5 });
    },
    // A crowd going "yaaay", with a little rising chime on top.
    cheer() {
      hiss({ duration: 1.1, gain: 0.2, freq: 1300, q: 0.4, attack: 0.25 });
      hiss({ duration: 0.9, gain: 0.12, freq: 2600, q: 0.6, attack: 0.3 });
      [C5, E5, G5].forEach((note, i) => chime(note * 2, { at: i * 0.08, gain: 0.12 }));
    },
    fanfare() {
      [C5, E5, G5, C6].forEach((note, i) => piano(note, { at: i * 0.13, gain: 0.2, length: i === 3 ? 1.2 : 0.5 }));
      [C5, E5, G5].forEach((note) => chime(note * 2, { at: 0.52, gain: 0.08, length: 1.2 }));
    },
    bloop() {
      tone({ from: 420, to: 780, duration: 0.12, gain: 0.09 });
    },
    pop() {
      tone({ from: 1500, to: 600, duration: 0.06, gain: 0.2 });
      hiss({ duration: 0.04, gain: 0.15, freq: 2500, q: 1 });
    },
    // One piano key, with the pet humming along underneath.
    note(freq, pet) {
      piano(freq, { gain: 0.3 });
      tone({ wave: pet.voice.wave, from: freq, duration: 0.3, gain: 0.05, cutoff: 1200, attack: 0.05 });
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
