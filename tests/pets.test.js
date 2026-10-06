import test from 'node:test';
import assert from 'node:assert/strict';
import { PETS, findPet } from '../js/pets.js';
import { ACTIONS, REACTIONS, GAMES, GREETINGS, CUES, ACCESSORIES, DIZZY_WINDOW_MS, headPoke, pickLine, scoreLine } from '../js/actions.js';

test('there are eight pets with unique ids and names', () => {
  assert.equal(PETS.length, 8);
  assert.equal(new Set(PETS.map((p) => p.id)).size, PETS.length);
  assert.equal(new Set(PETS.map((p) => p.name)).size, PETS.length);
});

test('every pet has a voice, a food and all its colours', () => {
  for (const pet of PETS) {
    // Voices stay in a range young children can understand.
    assert.ok(pet.pitch >= 0.8 && pet.pitch <= 1.6, pet.id);
    assert.ok(pet.speech.pitch >= 0.8 && pet.speech.pitch <= 1.5, pet.id);
    assert.ok(pet.speech.rate >= 0.8 && pet.speech.rate <= 1, pet.id);
    assert.ok(pet.voice.pitch > 0, pet.id);
    assert.ok(pet.food && pet.emoji, pet.id);
    for (const part of ['fur', 'dark', 'belly', 'limb', 'inner', 'nose', 'iris']) {
      assert.match(pet.colors[part], /^#[0-9a-f]{6}$/, `${pet.id} ${part}`);
    }
  }
});

test('findPet falls back to the first pet', () => {
  assert.equal(findPet('dog').id, 'dog');
  assert.equal(findPet('dragon'), PETS[0]);
});

test('every action and reaction has a duration and something to say', () => {
  for (const [name, entry] of Object.entries({ ...ACTIONS, ...REACTIONS })) {
    assert.ok(entry.ms > 0, name);
    assert.ok(entry.say.length > 0 && entry.say.every((line) => line.length > 0), name);
  }
  for (const lines of Object.values(GREETINGS)) assert.ok(lines.length > 0);
});

test('sound cues happen before their action ends', () => {
  assert.ok(CUES.burp * 1000 < ACTIONS.milk.ms);
  assert.ok(CUES.toot * 1000 < ACTIONS.toot.ms);
  assert.ok(CUES.pieHit * 1000 < ACTIONS.pie.ms);
  assert.ok(CUES.ballHit * 1000 < ACTIONS.ball.ms);
});

test('every game has an opening line', () => {
  for (const [name, entry] of Object.entries(GAMES)) assert.ok(entry.say.length > 0, name);
});

test('the pet reads out the score when a game ends', () => {
  assert.equal(scoreLine(0, false), "Let's try again!");
  assert.equal(scoreLine(1, false), 'You got 1 star! Great job!');
  assert.equal(scoreLine(7, false), 'You got 7 stars! Great job!');
  assert.equal(scoreLine(7, true), '7 stars! A new record!');
});

test('the trampoline action is a whole number of bounces', () => {
  const bounces = ACTIONS.trampoline.ms / 1000 / CUES.bounce;
  assert.ok(Math.abs(bounces - Math.round(bounces)) < 1e-9);
});

test('dress-up starts with nothing on', () => {
  assert.equal(ACCESSORIES[0], 'none');
  assert.equal(new Set(ACCESSORIES).size, ACCESSORIES.length);
});

test('pickLine covers every line and never runs off the end', () => {
  const lines = ['a', 'b', 'c'];
  assert.equal(pickLine(lines, 0), 'a');
  assert.equal(pickLine(lines, 0.5), 'b');
  assert.equal(pickLine(lines, 0.999), 'c');
  assert.equal(pickLine(lines, 1), 'c');
});

test('three quick head pokes make the pet dizzy', () => {
  let taps = [];
  let zone;
  ({ taps, zone } = headPoke(taps, 0));
  assert.equal(zone, 'head');
  ({ taps, zone } = headPoke(taps, 400));
  assert.equal(zone, 'head');
  ({ taps, zone } = headPoke(taps, 800));
  assert.equal(zone, 'dizzy');
  assert.deepEqual(taps, []);
});

test('slow head pokes never make the pet dizzy', () => {
  let taps = [];
  let zone;
  for (let i = 0; i < 6; i++) {
    ({ taps, zone } = headPoke(taps, i * DIZZY_WINDOW_MS));
    assert.equal(zone, 'head');
  }
});
