// Runs on the audio thread: collects microphone samples into ~20ms chunks
// and posts them to the page.

const CHUNK = 1024;

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(CHUNK);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    let read = 0;
    while (read < channel.length) {
      const count = Math.min(CHUNK - this.filled, channel.length - read);
      this.buffer.set(channel.subarray(read, read + count), this.filled);
      this.filled += count;
      read += count;
      if (this.filled === CHUNK) {
        this.port.postMessage(this.buffer.slice());
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('recorder', RecorderProcessor);
