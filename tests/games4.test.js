import test from 'node:test';
import assert from 'node:assert/strict';
import { HIDE, SIMON, createHide, createSimon } from '../js/games.js';

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

test('hide: nothing can be found until the pet has finished hiding', () => {
  const game = createHide(() => 0);
  assert.equal(game.guess(game.state.spot), null);
  assert.deepEqual(run(game, HIDE.hideTime + 0.1).slice(0, 1), ['hidden']);
  assert.equal(game.state.phase, 'hidden');
});

test('hide: looking in the right place finds it; the wrong place does not', () => {
  const game = createHide(() => 0);
  run(game, HIDE.hideTime + 0.1);
  const { spot } = game.state;
  const elsewhere = (spot + 1) % HIDE.spotX.length;
  assert.equal(game.guess(elsewhere), 'wrong');
  assert.equal(game.state.wrong.spot, elsewhere);
  assert.equal(game.state.score, 0);
  assert.equal(game.guess(spot), 'found');
  assert.equal(game.state.score, 1);
  assert.equal(game.guess(spot), null); // already found
});

test('hide: it peeks out again and again while hidden', () => {
  const game = createHide(() => 0);
  const events = run(game, HIDE.hideTime + HIDE.peekEvery * 3);
  assert.ok(events.filter((e) => e === 'peek').length >= 3);
  let highest = 0;
  run(game, HIDE.peekEvery, (g) => (highest = Math.max(highest, g.state.peek)));
  assert.ok(highest > 0.9 && highest <= 1);
});

test('hide: after being found it hides somewhere else', () => {
  for (const value of [0, 0.5, 0.999]) {
    const game = createHide(() => value);
    let last = -1;
    for (let round = 0; round < 6; round++) {
      run(game, HIDE.hideTime + 0.1);
      const { spot } = game.state;
      assert.ok(spot >= 0 && spot < HIDE.spotX.length);
      assert.notEqual(spot, last);
      last = spot;
      assert.equal(game.guess(spot), 'found');
      run(game, HIDE.foundTime + 0.1);
    }
    assert.equal(game.state.score, 6);
  }
});

test('hide: a wrong guess stops wobbling after a moment', () => {
  const game = createHide(() => 0);
  run(game, HIDE.hideTime + 0.1);
  game.guess((game.state.spot + 1) % HIDE.spotX.length);
  run(game, HIDE.wrongTime + 0.1);
  assert.equal(game.state.wrong, null);
});

// Let Simon finish showing, returning the moves it showed in order.
function watch(game) {
  const shown = [];
  for (let t = 0; t < 30 && game.state.phase !== 'copy'; t += STEP) {
    if (game.update(STEP).includes('show')) shown.push(game.state.showing);
  }
  return shown;
}

test('simon: it shows every move of the sequence, then it is your turn', () => {
  const game = createSimon(sequence(0, 0.5, 0.9));
  assert.equal(game.tap('head'), null); // not your turn yet
  const shown = watch(game);
  assert.deepEqual(shown, game.state.sequence);
  assert.equal(shown.length, SIMON.startLength);
  assert.equal(game.state.phase, 'copy');
});

test('simon: two of the same move in a row are shown as two', () => {
  const game = createSimon(() => 0); // every move is the head
  assert.deepEqual(watch(game), ['head', 'head']);
});

test('simon: copying the sequence earns a star and the next round is longer', () => {
  const game = createSimon(sequence(0, 0.5, 0.9));
  for (let round = 0; round < 4; round++) {
    const moves = watch(game);
    assert.equal(moves.length, SIMON.startLength + round);
    moves.forEach((move, i) => assert.equal(game.tap(move), i === moves.length - 1 ? 'round' : 'right'));
    assert.equal(game.state.score, round + 1);
    run(game, SIMON.rightTime + 0.1);
  }
});

test('simon: a wrong move costs nothing and the same sequence is shown again', () => {
  const game = createSimon(sequence(0, 0.5));
  const first = watch(game);
  const wrong = SIMON.parts.find((part) => part !== first[0]);
  assert.equal(game.tap(wrong), 'wrong');
  assert.equal(game.tap(first[0]), null); // must watch again first
  run(game, SIMON.wrongTime + 0.1);
  assert.deepEqual(watch(game), first);
  assert.equal(game.state.score, 0);
});

test('simon: only real moves are ever asked for', () => {
  const game = createSimon(Math.random);
  for (let round = 0; round < 8; round++) {
    const moves = watch(game);
    for (const move of moves) assert.ok(SIMON.parts.includes(move));
    moves.forEach((move) => game.tap(move));
    run(game, SIMON.rightTime + 0.1);
  }
});

test('hide and simon: each ends once, after its time, and then ignores taps', () => {
  const hide = createHide(() => 0);
  assert.equal(run(hide, HIDE.seconds + 2).filter((e) => e === 'end').length, 1);
  assert.equal(hide.guess(hide.state.spot), null);
  const simon = createSimon(() => 0);
  assert.equal(run(simon, SIMON.seconds + 2).filter((e) => e === 'end').length, 1);
  assert.equal(simon.tap('head'), null);
});
