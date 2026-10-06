import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// The sounds module only touches the browser inside createSounds, so its list
// of recordings can be read here.
const { RECORDINGS } = await import('../js/sounds.js');

const files = Object.entries(RECORDINGS).flatMap(([name, takes]) =>
  Array.from({ length: takes }, (_, i) => `sounds/${name}${i + 1}.wav`),
);

test('every recording the app asks for is in the sounds folder', () => {
  for (const file of files) assert.ok(existsSync(file), file);
});

test('every recording is a WAV file, which all phones and tablets can play', () => {
  for (const file of files) {
    const header = readFileSync(file).subarray(0, 12).toString('latin1');
    assert.ok(header.startsWith('RIFF') && header.endsWith('WAVE'), file);
  }
});

test('every recording is saved for offline use', () => {
  const worker = readFileSync('sw.js', 'utf8');
  for (const file of files) assert.ok(worker.includes(`'${file}'`), file);
});

test('the licence travels with the recordings', () => {
  assert.match(readFileSync('sounds/LICENSE.txt', 'utf8'), /Creative Commons Zero/);
});
