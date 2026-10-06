import test from 'node:test';
import assert from 'node:assert/strict';
import { BOXING, SWING, createBoxing, createSwing, newRecord } from '../js/games.js';

const STEP = 1 / 60;

// Run a game forward, collecting everything that happened.
function run(game, seconds, eachStep = () => {}) {
  const events = [];
  for (let t = 0; t < seconds; t += STEP) {
    eachStep(game);
    events.push(...game.update(STEP));
  }
  return events;
}

test('boxing: a pad appears, and tapping it scores', () => {
  const game = createBoxing(() => 0.5);
  assert.deepEqual(run(game, 1), ['spawn']);
  const { slot } = game.state.target;
  assert.equal(game.hit(slot), true);
  assert.equal(game.state.score, 1);
  assert.equal(game.state.target, null);
});

test('boxing: tapping the wrong place or nothing does not score', () => {
  const game = createBoxing(() => 0.5);
  assert.equal(game.hit(0), false);
  run(game, 1);
  const wrong = (game.state.target.slot + 1) % BOXING.slots;
  assert.equal(game.hit(wrong), false);
  assert.equal(game.state.score, 0);
});

test('boxing: a pad left alone is missed and the streak resets', () => {
  const game = createBoxing(() => 0.5);
  run(game, 1);
  game.hit(game.state.target.slot);
  assert.equal(game.state.streak, 1);
  const events = run(game, 3);
  assert.ok(events.includes('miss'));
  assert.equal(game.state.streak, 0);
});

test('boxing: pads never appear in the same place twice running', () => {
  for (const value of [0, 0.3, 0.999]) {
    const game = createBoxing(() => value);
    let last = -1;
    run(game, 10, (g) => {
      const slot = g.state.target?.slot;
      if (slot === undefined) return;
      assert.ok(slot >= 0 && slot < BOXING.slots);
      if (g.state.target.age === 0) {
        assert.notEqual(slot, last);
        last = slot;
      }
      g.hit(slot);
    });
    assert.ok(game.state.score > 5);
  }
});

test('boxing: pads get quicker as the score rises, down to a limit', () => {
  const game = createBoxing(() => 0.5);
  const lives = [];
  run(game, BOXING.seconds - 1, (g) => {
    if (g.state.target) {
      lives.push(g.state.target.life);
      g.hit(g.state.target.slot);
    }
  });
  assert.equal(lives[0], BOXING.startLife);
  assert.equal(Math.min(...lives), BOXING.minLife);
});

test('boxing: the game ends once, after its time, and then ignores taps', () => {
  const game = createBoxing(() => 0.5);
  const events = run(game, BOXING.seconds + 2);
  assert.equal(events.filter((e) => e === 'end').length, 1);
  assert.equal(game.state.over, true);
  assert.equal(game.hit(0), false);
});

test('swing: left alone it does not move or score', () => {
  const game = createSwing();
  const events = run(game, 10);
  assert.deepEqual(events, []);
  assert.equal(game.state.angle, 0);
});

test('swing: one push sets it swinging, and it slows down by itself', () => {
  const game = createSwing();
  assert.equal(game.push(), 'perfect');
  let highest = 0;
  run(game, 2, (g) => (highest = Math.max(highest, g.state.angle)));
  assert.ok(highest > 0.15);
  let later = 0;
  run(game, 10);
  run(game, 4, (g) => (later = Math.max(later, Math.abs(g.state.angle))));
  assert.ok(later < highest / 2);
});

test('swing: pushes are limited by a cooldown and by reach', () => {
  const game = createSwing();
  assert.ok(game.push());
  assert.equal(game.push(), null); // too soon
  const far = createSwing();
  far.state.angle = SWING.reach + 0.1;
  assert.equal(far.push(), null); // out of reach
});

test('swing: a push goes the way the swing is already moving', () => {
  const game = createSwing();
  game.state.speed = -0.5;
  game.push();
  assert.ok(game.state.speed < -0.5);
});

test('swing: steady pushing builds up to ringing the bell', () => {
  const game = createSwing();
  const events = run(game, 20, (g) => g.push());
  assert.notEqual(events[0], undefined);
  assert.ok(events.includes('bell'));
  assert.ok(game.state.score >= 3);
  assert.ok(Math.abs(game.state.angle) <= SWING.maxAngle);
});

test('swing: the game ends once, after its time', () => {
  const game = createSwing();
  const events = run(game, SWING.seconds + 2, (g) => g.push());
  assert.equal(events.filter((e) => e === 'end').length, 1);
  assert.equal(game.push(), null);
});

test('swing: a long late frame does not break the physics', () => {
  const game = createSwing();
  game.push();
  game.update(0.5);
  assert.ok(Number.isFinite(game.state.angle));
  assert.ok(Math.abs(game.state.angle) <= SWING.maxAngle);
});

test('newRecord needs a real score that beats the best', () => {
  assert.equal(newRecord(5, 3), true);
  assert.equal(newRecord(5, undefined), true);
  assert.equal(newRecord(3, 3), false);
  assert.equal(newRecord(0, undefined), false);
});
