import test from 'node:test';
import assert from 'node:assert/strict';
import { BATH, WARDROBE, SLOTS, cleanOutfit, createBath, createDress } from '../js/games.js';

const STEP = 1 / 60;

// Use the chosen tool on a part for some seconds, the way the app does frame by frame.
function scrub(game, zone, seconds) {
  const events = [];
  for (let t = 0; t < seconds; t += STEP) {
    game.rub(zone, STEP);
    events.push(...game.update(STEP));
  }
  return events;
}

test('wardrobe: every drawer has clothes with unique names and a picture', () => {
  assert.deepEqual(SLOTS.map(([slot]) => slot), Object.keys(WARDROBE));
  const ids = Object.values(WARDROBE).flat().map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of Object.values(WARDROBE).flat()) assert.ok(item.icon);
});

test('dress: one thing can be worn in each place at once', () => {
  const game = createDress();
  assert.deepEqual(game.state.outfit, { head: null, eyes: null, neck: null });
  assert.equal(game.wear('crown'), 'on');
  assert.equal(game.wear('tophat'), 'on'); // swaps the crown for the top hat
  game.choose('eyes');
  assert.equal(game.wear('shades'), 'on');
  assert.deepEqual(game.state.outfit, { head: 'tophat', eyes: 'shades', neck: null });
});

test('dress: tapping what is already on takes it off', () => {
  const game = createDress();
  game.wear('crown');
  assert.equal(game.wear('crown'), 'off');
  assert.equal(game.state.outfit.head, null);
});

test('dress: clothes from another drawer, or made up, are refused', () => {
  const game = createDress();
  assert.equal(game.wear('shades'), null); // glasses, while looking at hats
  assert.equal(game.wear('spacesuit'), null);
  game.choose('pockets');
  assert.equal(game.state.slot, 'head');
});

test('dress: it starts in what the pet was already wearing, minus anything unknown', () => {
  const game = createDress({ head: 'cap', eyes: 'monocle', neck: 'scarf', tail: 'ribbon' });
  assert.deepEqual(game.state.outfit, { head: 'cap', eyes: null, neck: 'scarf' });
  assert.deepEqual(cleanOutfit(null), { head: null, eyes: null, neck: null });
  assert.deepEqual(cleanOutfit('nonsense'), { head: null, eyes: null, neck: null });
});

test('bath: the pet starts muddy all over and the soap is suggested', () => {
  const game = createBath();
  game.update(STEP);
  for (const zone of BATH.zones) assert.equal(game.state.zones[zone].dirt, 1);
  assert.equal(game.state.next, 'soap');
  assert.equal(game.state.left, 0);
});

test('bath: soap, shower, towel on every part gets it clean, in that order', () => {
  const game = createBath();
  const events = [];
  for (const zone of BATH.zones) events.push(...scrub(game, zone, BATH.rubTime + 0.1));
  assert.equal(game.state.next, 'shower');
  for (const zone of BATH.zones) {
    assert.equal(game.state.zones[zone].dirt, 0);
    assert.ok(game.state.zones[zone].foam > 0.9);
  }
  game.choose('shower');
  events.push(...scrub(game, null, BATH.rubTime + 0.1)); // the shower needs no aiming
  assert.equal(game.state.next, 'towel');
  game.choose('towel');
  for (const zone of BATH.zones) events.push(...scrub(game, zone, BATH.rubTime + 0.1));
  assert.deepEqual(events, ['clean']);
  assert.equal(game.state.clean, true);
  assert.ok(Math.abs(game.state.left - 1) < 1e-9);
});

test('bath: the progress bar only ever fills while doing the steps in order', () => {
  const game = createBath();
  let last = 0;
  const watch = (zone, seconds) => {
    for (let t = 0; t < seconds; t += STEP) {
      game.rub(zone, STEP);
      game.update(STEP);
      assert.ok(game.state.left >= last - 1e-9);
      last = game.state.left;
    }
  };
  for (const zone of BATH.zones) watch(zone, BATH.rubTime + 0.1);
  game.choose('shower');
  watch(null, BATH.rubTime + 0.1);
  game.choose('towel');
  for (const zone of BATH.zones) watch(zone, BATH.rubTime + 0.1);
  assert.ok(last > 0.99);
});

test('bath: a shower without soap leaves the mud, and a towel will not shift suds', () => {
  const game = createBath();
  game.choose('shower');
  scrub(game, null, 3);
  assert.equal(game.state.zones.head.dirt, 1);
  assert.equal(game.state.clean, false);
  game.choose('soap');
  scrub(game, 'head', 0.5);
  game.choose('towel');
  assert.equal(game.rub('head', STEP), false);
});

test('bath: soap and towel need a part of the pet to work on', () => {
  const game = createBath();
  assert.equal(game.rub(null, STEP), false);
  assert.equal(game.rub('tail', STEP), false);
  assert.equal(game.rub('head', STEP), true);
});

test('bath: once clean it celebrates for a moment and then ends', () => {
  const game = createBath();
  for (const zone of BATH.zones) scrub(game, zone, BATH.rubTime + 0.1);
  game.choose('shower');
  scrub(game, null, BATH.rubTime + 0.1);
  game.choose('towel');
  for (const zone of BATH.zones) scrub(game, zone, BATH.rubTime + 0.1);
  assert.equal(game.rub('head', STEP), false); // nothing left to wash
  const events = [];
  for (let t = 0; t < BATH.finishTime + 0.5; t += STEP) events.push(...game.update(STEP));
  assert.deepEqual(events, ['end']);
  assert.equal(game.state.over, true);
});
