import test from 'node:test';
import assert from 'node:assert/strict';
import { CATCH, POP, FOODS, YUCKS, createCatch, createPop } from '../js/games.js';

const STEP = 1 / 60;

function run(game, seconds, eachStep = () => {}) {
  const events = [];
  for (let t = 0; t < seconds; t += STEP) {
    eachStep(game);
    events.push(...game.update(STEP));
  }
  return events;
}

// A repeatable stand-in for Math.random.
function sequence(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('catch: standing under falling food catches it', () => {
  const game = createCatch(() => 0.5); // everything falls in the middle
  const events = run(game, 5);
  assert.ok(events.includes('catch'));
  assert.ok(game.state.score >= 1);
  assert.ok(!events.includes('drop'));
});

test('catch: food that lands away from the pet is dropped', () => {
  const game = createCatch(() => 0.99); // everything falls far right, nothing is yucky
  const events = run(game, 5);
  assert.ok(events.includes('drop'));
  assert.equal(game.state.score, 0);
});

test('catch: the pet runs to where it is steered, but not past the edge', () => {
  const game = createCatch(() => 0.5);
  game.steer(99);
  run(game, 0.1);
  assert.ok(game.state.petX > 0 && game.state.petX < CATCH.range);
  run(game, 2);
  assert.equal(game.state.petX, CATCH.range);
  game.steer(-99);
  run(game, 2);
  assert.equal(game.state.petX, -CATCH.range);
});

test('catch: steering under food on the far side catches it', () => {
  const game = createCatch(() => 0.99);
  const events = run(game, 6, (g) => {
    const lowest = g.state.items[0];
    if (lowest) g.steer(lowest.x);
  });
  assert.ok(events.includes('catch'));
});

test('catch: the first thing is always food, and yucky things cost a star', () => {
  // random() order per item: yuck roll (skipped for the first), x, icon.
  const game = createCatch(sequence(0.5, 0.5, 0, 0.5, 0.5));
  const events = run(game, 8);
  assert.equal(events[0], 'catch');
  assert.ok(events.includes('yuck'));
  assert.ok(game.state.score >= 0);
});

test('catch: the score never goes below zero', () => {
  const game = createCatch(() => 0.5);
  game.state.items.push({ id: 99, x: 0, y: CATCH.catchY, yuck: true, icon: YUCKS[0] });
  assert.deepEqual(game.update(STEP), ['yuck']);
  assert.equal(game.state.score, 0);
});

test('catch: every falling thing has a known picture', () => {
  const game = createCatch(Math.random);
  run(game, 20, (g) => {
    for (const item of g.state.items) assert.ok([...FOODS, ...YUCKS].includes(item.icon));
  });
});

test('catch and pop: each ends once, after its time', () => {
  for (const create of [createCatch, createPop]) {
    const game = create(() => 0.5);
    const events = run(game, 32);
    assert.equal(events.filter((e) => e === 'end').length, 1);
    assert.equal(game.state.over, true);
    assert.deepEqual(game.update(STEP), []);
  }
});

test('pop: bubbles are blown, rise, and float away if left alone', () => {
  const game = createPop(() => 0.5);
  const events = run(game, 8);
  assert.ok(events.includes('blow'));
  assert.ok(events.includes('escape'));
  assert.equal(game.state.score, 0);
  for (const bubble of game.state.bubbles) assert.ok(bubble.y >= POP.mouthY && bubble.y < POP.top);
});

test('pop: popping a bubble scores once and removes it', () => {
  const game = createPop(() => 0.5);
  run(game, 1);
  const [bubble] = game.state.bubbles;
  assert.equal(game.pop(bubble.id), 'pop');
  assert.equal(game.state.score, 1);
  assert.equal(game.pop(bubble.id), null);
  assert.equal(game.state.score, 1);
});

test('pop: golden bubbles are worth three', () => {
  const game = createPop(() => 0.01); // every bubble is golden
  run(game, 1);
  assert.equal(game.pop(game.state.bubbles[0].id), 'gold');
  assert.equal(game.state.score, 3);
});

test('pop: there are never more bubbles than can be drawn, each in its own slot', () => {
  const game = createPop(Math.random);
  run(game, 29, (g) => {
    const slots = g.state.bubbles.map((b) => b.id % POP.pool);
    assert.ok(slots.length <= POP.pool);
    assert.equal(new Set(slots).size, slots.length);
  });
});
