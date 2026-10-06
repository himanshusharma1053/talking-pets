import test from 'node:test';
import assert from 'node:assert/strict';
import { PENALTY, PIANO, SCALE, TUNES, createPenalty, createPiano } from '../js/games.js';

const STEP = 1 / 60;

function run(game, seconds) {
  const events = [];
  for (let t = 0; t < seconds; t += STEP) events.push(...game.update(STEP));
  return events;
}

// A repeatable stand-in for Math.random.
function sequence(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('penalty: a shot away from the keeper is a goal', () => {
  // First roll (0.9) means the keeper guesses wrong; second (0) sends it far left.
  const game = createPenalty(sequence(0.9, 0));
  assert.equal(game.shoot(2, 1), true);
  assert.deepEqual(run(game, 1), ['goal']);
  assert.equal(game.state.score, 1);
});

test('penalty: a shot the keeper guesses is saved', () => {
  const game = createPenalty(() => 0); // always guesses right
  game.shoot(1, 1);
  assert.deepEqual(run(game, 1), ['save']);
  assert.equal(game.state.score, 0);
});

test('penalty: the top corner beats the keeper even when it guesses right', () => {
  const game = createPenalty(() => 0);
  game.shoot(2.2, PENALTY.reachY + 0.3);
  assert.deepEqual(run(game, 1), ['goal']);
});

test('penalty: a shot wide of the posts or over the bar is a miss', () => {
  for (const [x, y] of [[PENALTY.halfWidth + 1, 1], [0, PENALTY.height + 1], [0, -0.5]]) {
    const game = createPenalty(sequence(0.9, 0));
    game.shoot(x, y);
    assert.deepEqual(run(game, 1), ['miss'], `${x},${y}`);
    assert.equal(game.state.score, 0);
  }
});

test('penalty: the keeper never dives beyond its range', () => {
  const game = createPenalty(() => 0);
  game.shoot(99, 1);
  assert.equal(game.state.keeperX, PENALTY.keeperRange);
});

test('penalty: one ball at a time, and a new one after a pause', () => {
  const game = createPenalty(sequence(0.9, 0));
  assert.equal(game.shoot(2, 1), true);
  assert.equal(game.shoot(2, 1), false);
  run(game, PENALTY.flight + 0.1);
  assert.equal(game.state.phase, 'result');
  assert.equal(game.shoot(2, 1), false);
  run(game, PENALTY.recover + 0.1);
  assert.equal(game.state.phase, 'ready');
  assert.equal(game.state.shot, null);
  assert.equal(game.shoot(2, 1), true);
});

test('penalty and piano: each ends once, after its time', () => {
  for (const [create, seconds] of [[createPenalty, PENALTY.seconds], [createPiano, PIANO.seconds]]) {
    const game = create();
    const events = run(game, seconds + 2);
    assert.equal(events.filter((e) => e === 'end').length, 1);
    assert.equal(game.state.over, true);
  }
});

test('penalty: no shots after the whistle', () => {
  const game = createPenalty();
  run(game, PENALTY.seconds + 1);
  assert.equal(game.shoot(0, 1), false);
});

test('piano: the lit key scores, any other key just plays', () => {
  const game = createPiano();
  const lit = game.state.next;
  assert.equal(game.press((lit + 1) % PIANO.keys), 'free');
  assert.equal(game.state.score, 0);
  assert.equal(game.press(lit), 'right');
  assert.equal(game.state.score, 1);
});

test('piano: following the lit keys plays each tune in turn', () => {
  const game = createPiano();
  for (const tune of TUNES) {
    tune.forEach((key, i) => {
      assert.equal(game.state.next, key);
      assert.equal(game.press(key), i === tune.length - 1 ? 'tune' : 'right');
    });
  }
  assert.equal(game.state.tune, 0); // back to the first tune
  assert.equal(game.state.score, TUNES.flat().length);
});

test('piano: every tune only uses keys that exist, and each key has a pitch', () => {
  assert.equal(SCALE.length, PIANO.keys);
  for (const key of TUNES.flat()) assert.ok(Number.isInteger(key) && key >= 0 && key < PIANO.keys);
  for (let i = 1; i < SCALE.length; i++) assert.ok(SCALE[i] > SCALE[i - 1]);
});

test('piano: keys do nothing once the game is over', () => {
  const game = createPiano();
  run(game, PIANO.seconds + 1);
  assert.equal(game.press(game.state.next), null);
});
