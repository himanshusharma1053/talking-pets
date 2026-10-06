// Voice activity detection: decides when someone started and stopped talking
// from a stream of loudness (RMS) readings. Pure logic, no browser APIs.

export const VAD_DEFAULTS = {
  minThreshold: 0.02, // never treat anything quieter than this as speech
  noiseMultiplier: 3, // speech must be this many times louder than the room
  noiseSmoothing: 0.05,
  startMs: 80, // loud for this long before it counts as speech
  silenceMs: 700, // quiet for this long ends the utterance
  minSpeechMs: 250, // shorter utterances are discarded as clicks and bumps
  maxSpeechMs: 10000,
};

export class VoiceDetector {
  constructor(options = {}) {
    this.options = { ...VAD_DEFAULTS, ...options };
    this.noiseFloor = 0;
    this.reset();
  }

  // Forget any utterance in progress. The learned noise floor is kept.
  reset() {
    this.speaking = false;
    this.loudMs = 0;
    this.quietMs = 0;
    this.speechMs = 0;
  }

  get threshold() {
    const { minThreshold, noiseMultiplier } = this.options;
    return Math.max(minThreshold, this.noiseFloor * noiseMultiplier);
  }

  // Feed one loudness reading covering dtMs of audio.
  // Returns 'start', 'end', 'discard' or null.
  process(rms, dtMs) {
    const { noiseSmoothing, startMs, silenceMs, minSpeechMs, maxSpeechMs } = this.options;
    const loud = rms >= this.threshold;

    if (!this.speaking) {
      if (!loud) {
        this.loudMs = 0;
        this.noiseFloor += (rms - this.noiseFloor) * noiseSmoothing;
        return null;
      }
      this.loudMs += dtMs;
      if (this.loudMs < startMs) return null;
      this.speaking = true;
      this.speechMs = this.loudMs;
      this.quietMs = 0;
      return 'start';
    }

    this.speechMs += dtMs;
    this.quietMs = loud ? 0 : this.quietMs + dtMs;
    if (this.quietMs < silenceMs && this.speechMs < maxSpeechMs) return null;

    const voicedMs = this.speechMs - this.quietMs;
    this.reset();
    return voicedMs >= minSpeechMs ? 'end' : 'discard';
  }
}

export function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}

// Join recorded chunks into one buffer, dropping trimMs from the end
// (the silence that told us the speaker had finished).
export function joinChunks(chunks, sampleRate, trimMs = 0) {
  const total = chunks.reduce((n, chunk) => n + chunk.length, 0);
  const keep = Math.max(0, total - Math.round((trimMs / 1000) * sampleRate));
  const out = new Float32Array(keep);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= keep) break;
    const part = chunk.subarray(0, Math.min(chunk.length, keep - offset));
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
