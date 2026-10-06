import test from 'node:test';
import assert from 'node:assert/strict';
import { STATES, nextState, micOpen } from '../js/state.js';

test('hearing speech leads to listening, then talking, then idle', () => {
  assert.equal(nextState('idle', 'heard'), 'listening');
  assert.equal(nextState('listening', 'speechEnd'), 'talking');
  assert.equal(nextState('talking', 'done'), 'idle');
});

test('a discarded recording returns to idle', () => {
  assert.equal(nextState('listening', 'speechDiscard'), 'idle');
});

test('speech events are ignored unless the pet is free to hear them', () => {
  for (const state of STATES.filter((s) => s !== 'idle')) {
    assert.equal(nextState(state, 'heard'), null, state);
  }
  assert.equal(nextState('reacting', 'speechEnd'), null);
  assert.equal(nextState('sleeping', 'speechEnd'), null);
});

test('a tap interrupts anything and wakes a sleeping pet', () => {
  for (const state of STATES.filter((s) => s !== 'sleeping')) {
    assert.equal(nextState(state, 'tap'), 'reacting', state);
  }
  assert.equal(nextState('sleeping', 'tap'), 'idle');
});

test('feeding and milk work unless the pet is asleep', () => {
  assert.equal(nextState('idle', 'feed'), 'eating');
  assert.equal(nextState('talking', 'milk'), 'drinking');
  assert.equal(nextState('sleeping', 'feed'), null);
  assert.equal(nextState('sleeping', 'milk'), null);
});

test('sleep toggles', () => {
  assert.equal(nextState('idle', 'sleep'), 'sleeping');
  assert.equal(nextState('eating', 'sleep'), 'sleeping');
  assert.equal(nextState('sleeping', 'sleep'), 'idle');
});

test('done only ends timed activities', () => {
  assert.equal(nextState('eating', 'done'), 'idle');
  assert.equal(nextState('sleeping', 'done'), null);
  assert.equal(nextState('idle', 'done'), null);
});

test('the microphone is only open while idle or listening', () => {
  assert.deepEqual(STATES.filter(micOpen), ['idle', 'listening']);
});
