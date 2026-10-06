import test from 'node:test';
import assert from 'node:assert/strict';
import { PETS, ZONES, findPet, renderPet } from '../js/pets.js';

test('there are several pets with unique ids and names', () => {
  assert.ok(PETS.length >= 4);
  assert.equal(new Set(PETS.map((p) => p.id)).size, PETS.length);
  assert.equal(new Set(PETS.map((p) => p.name)).size, PETS.length);
});

test('every pet has a voice, a pitch and a food', () => {
  for (const pet of PETS) {
    assert.ok(pet.pitch > 0.5 && pet.pitch < 2.5, pet.id);
    assert.ok(pet.voice.pitch > 0, pet.id);
    assert.ok(pet.food, pet.id);
  }
});

test('every pet drawing has all the tappable zones and animated parts', () => {
  for (const pet of PETS) {
    const svg = renderPet(pet);
    for (const zone of ZONES) assert.ok(svg.includes(`data-zone="${zone}"`), `${pet.id} ${zone}`);
    for (const part of ['mouth-open', 'eyes-open', 'eyes-closed', 'arm-right', 'prop-food', 'prop-milk', 'prop-zzz']) {
      assert.ok(svg.includes(part), `${pet.id} ${part}`);
    }
    assert.ok(!svg.includes('undefined'), pet.id);
  }
});

test('findPet falls back to the first pet', () => {
  assert.equal(findPet('dog').id, 'dog');
  assert.equal(findPet('dragon'), PETS[0]);
});
