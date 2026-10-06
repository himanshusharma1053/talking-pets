import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceDetector, rms, joinChunks } from '../js/vad.js';

const QUIET = 0.001;
const LOUD = 0.2;
const STEP = 20;

// Feed the same level for a duration and collect the events it produced.
function feed(detector, level, ms) {
  const events = [];
  for (let t = 0; t < ms; t += STEP) {
    const event = detector.process(level, STEP);
    if (event) events.push(event);
  }
  return events;
}

test('silence produces no events', () => {
  assert.deepEqual(feed(new VoiceDetector(), QUIET, 3000), []);
});

test('speech followed by silence starts then ends', () => {
  const detector = new VoiceDetector();
  assert.deepEqual(feed(detector, LOUD, 1000), ['start']);
  assert.deepEqual(feed(detector, QUIET, 1000), ['end']);
});

test('a brief click never starts an utterance', () => {
  const detector = new VoiceDetector();
  assert.deepEqual(feed(detector, LOUD, 40), []);
  assert.deepEqual(feed(detector, QUIET, 1000), []);
});

test('a very short burst is discarded', () => {
  const detector = new VoiceDetector();
  assert.deepEqual(feed(detector, LOUD, 120), ['start']);
  assert.deepEqual(feed(detector, QUIET, 1000), ['discard']);
});

test('a short pause does not end the utterance', () => {
  const detector = new VoiceDetector();
  feed(detector, LOUD, 500);
  assert.deepEqual(feed(detector, QUIET, 400), []);
  assert.deepEqual(feed(detector, LOUD, 500), []);
  assert.deepEqual(feed(detector, QUIET, 1000), ['end']);
});

test('non-stop talking is cut off at the maximum length', () => {
  const detector = new VoiceDetector({ maxSpeechMs: 2000 });
  assert.deepEqual(feed(detector, LOUD, 3000).slice(0, 2), ['start', 'end']);
});

test('the threshold rises in a noisy room', () => {
  const detector = new VoiceDetector();
  feed(detector, 0.015, 5000);
  assert.ok(detector.threshold > 0.04);
  assert.deepEqual(feed(detector, 0.03, 1000), []);
});

test('reset abandons an utterance in progress', () => {
  const detector = new VoiceDetector();
  feed(detector, LOUD, 500);
  detector.reset();
  assert.deepEqual(feed(detector, QUIET, 1000), []);
});

test('rms measures loudness', () => {
  assert.equal(rms(new Float32Array(0)), 0);
  assert.equal(rms(new Float32Array([0.5, -0.5, 0.5, -0.5])), 0.5);
});

test('joinChunks joins chunks and trims the tail', () => {
  const chunks = [new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])];
  assert.deepEqual([...joinChunks(chunks, 1000)], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...joinChunks(chunks, 1000, 2)], [1, 2, 3, 4]);
  assert.deepEqual([...joinChunks(chunks, 1000, 4)], [1, 2]);
  assert.deepEqual([...joinChunks(chunks, 1000, 50)], []);
});
