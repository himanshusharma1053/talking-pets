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
  for (const state of STATES.filter((s) => s !== 'sleeping' && s !== 'playing')) {
    assert.equal(nextState(state, 'tap'), 'reacting', state);
  }
  assert.equal(nextState('sleeping', 'tap'), 'idle');
});

test('buttons start an action unless the pet is asleep', () => {
  assert.equal(nextState('idle', 'act'), 'acting');
  assert.equal(nextState('talking', 'act'), 'acting');
  assert.equal(nextState('acting', 'act'), 'acting');
  assert.equal(nextState('sleeping', 'act'), null);
});

test('a game starts unless the pet is asleep, and owns the taps while it runs', () => {
  assert.equal(nextState('idle', 'play'), 'playing');
  assert.equal(nextState('acting', 'play'), 'playing');
  assert.equal(nextState('sleeping', 'play'), null);
  assert.equal(nextState('playing', 'tap'), null);
  assert.equal(nextState('playing', 'heard'), null);
});

test('a game ends in a cheer, or straight back to idle if stopped', () => {
  assert.equal(nextState('playing', 'gameOver'), 'reacting');
  assert.equal(nextState('playing', 'quit'), 'idle');
  assert.equal(nextState('idle', 'gameOver'), null);
  assert.equal(nextState('idle', 'quit'), null);
  assert.equal(nextState('playing', 'done'), null);
});

test('sleep toggles', () => {
  assert.equal(nextState('idle', 'sleep'), 'sleeping');
  assert.equal(nextState('acting', 'sleep'), 'sleeping');
  assert.equal(nextState('sleeping', 'sleep'), 'idle');
});

test('done only ends timed activities', () => {
  assert.equal(nextState('acting', 'done'), 'idle');
  assert.equal(nextState('reacting', 'done'), 'idle');
  assert.equal(nextState('sleeping', 'done'), null);
  assert.equal(nextState('idle', 'done'), null);
});

test('the microphone is only open while idle or listening', () => {
  assert.deepEqual(STATES.filter(micOpen), ['idle', 'listening']);
});
