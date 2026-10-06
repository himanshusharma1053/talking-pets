// Microphone capture and pitched playback.

import { VoiceDetector, rms, joinChunks } from './vad.js';

const PREROLL_MS = 300; // audio kept from just before speech was detected
const TAIL_MS = 150; // silence left on the end of a recording

// Start listening on the microphone. Rejects if the mic is unavailable or denied.
export async function createVoice(ctx, { onStart, onEnd, onDiscard }) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access needs HTTPS or localhost.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  await ctx.audioWorklet.addModule('js/recorder-worklet.js');

  const source = ctx.createMediaStreamSource(stream);
  const recorder = new AudioWorkletNode(ctx, 'recorder');
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(recorder).connect(mute).connect(ctx.destination);

  const detector = new VoiceDetector();
  const chunkMs = (samples) => (samples.length / ctx.sampleRate) * 1000;
  let enabled = false;
  let ignoreUntil = 0;
  let preroll = [];
  let recording = null;

  recorder.port.onmessage = ({ data: chunk }) => {
    if (!enabled || performance.now() < ignoreUntil) return;

    if (recording) recording.push(chunk);
    else {
      preroll.push(chunk);
      while (preroll.length * chunkMs(chunk) > PREROLL_MS) preroll.shift();
    }

    const event = detector.process(rms(chunk), chunkMs(chunk));
    if (event === 'start') {
      recording = preroll;
      preroll = [];
      onStart();
    } else if (event === 'end') {
      const trimMs = Math.max(0, detector.options.silenceMs - TAIL_MS);
      const samples = joinChunks(recording, ctx.sampleRate, trimMs);
      recording = null;
      onEnd(samples);
    } else if (event === 'discard') {
      recording = null;
      onDiscard();
    }
  };

  return {
    // Open or close the mic. delayMs keeps it shut a little longer so the
    // tail of the pet's own sounds is not picked up.
    setEnabled(on, delayMs = 0) {
      if (on === enabled) return;
      enabled = on;
      if (on) {
        ignoreUntil = performance.now() + delayMs;
      } else {
        detector.reset();
        preroll = [];
        recording = null;
      }
    },
    stop() {
      enabled = false;
      stream.getTracks().forEach((track) => track.stop());
      source.disconnect();
      recorder.disconnect();
    },
  };
}

// Play recorded samples faster or slower, which also raises or lowers the pitch.
// onLevel is called every frame with the current loudness (0..1) to drive the mouth.
export function playSamples(ctx, samples, rate, { onLevel, onDone }) {
  const buffer = ctx.createBuffer(1, Math.max(1, samples.length), ctx.sampleRate);
  buffer.copyToChannel(samples, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser).connect(ctx.destination);

  const wave = new Float32Array(analyser.fftSize);
  let frame = requestAnimationFrame(function tick() {
    analyser.getFloatTimeDomainData(wave);
    onLevel(Math.min(1, rms(wave) * 6));
    frame = requestAnimationFrame(tick);
  });

  const cleanUp = () => {
    cancelAnimationFrame(frame);
    source.onended = null;
    source.disconnect();
    analyser.disconnect();
    onLevel(0);
  };
  source.onended = () => {
    cleanUp();
    onDone();
  };
  source.start();

  return {
    stop() {
      cleanUp();
      try {
        source.stop();
      } catch {
        // already stopped
      }
    },
  };
}
