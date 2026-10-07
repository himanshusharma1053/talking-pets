import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCH, FACES, PALETTE, createMatch, createPaint } from '../js/games.js';

const STEP = 1 / 60;

function run(game, seconds) {
  const events = [];
  for (let t = 0; t < seconds; t += STEP) events.push(...game.update(STEP));
  return events;
}

// The positions of the two cards showing each face.
function pairsOf(game) {
  const where = {};
  game.state.cards.forEach((card, i) => (where[card.face] ??= []).push(i));
  return Object.values(where);
}

test('match: the first board has every face exactly twice, all face down', () => {
  for (const random of [() => 0, () => 0.5, () => 0.999, Math.random]) {
    const game = createMatch(random);
    assert.equal(game.state.cards.length, MATCH.firstPairs * 2);
    for (const pair of pairsOf(game)) assert.equal(pair.length, 2);
    for (const card of game.state.cards) {
      assert.ok(FACES.includes(card.face));
      assert.equal(card.up || card.matched, false);
    }
  }
});

test('match: two cards the same stay up and score', () => {
  const game = createMatch();
  const [[a, b]] = pairsOf(game);
  assert.equal(game.flip(a), 'flip');
  assert.equal(game.flip(b), 'match');
  assert.equal(game.state.score, 1);
  assert.ok(game.state.cards[a].matched && game.state.cards[b].matched);
  assert.equal(game.flip(a), null); // already matched
});

test('match: two different cards turn back after a moment', () => {
  const game = createMatch();
  const [[a], [b]] = pairsOf(game);
  game.flip(a);
  assert.equal(game.flip(b), 'miss');
  assert.ok(game.state.cards[a].up && game.state.cards[b].up);
  run(game, MATCH.showTime + 0.1);
  assert.ok(!game.state.cards[a].up && !game.state.cards[b].up);
  assert.equal(game.state.score, 0);
});

test('match: tapping on straight after a miss turns the old pair back at once', () => {
  const game = createMatch();
  const [[a, a2], [b]] = pairsOf(game);
  game.flip(a);
  game.flip(b);
  assert.equal(game.flip(a2), 'flip');
  assert.ok(!game.state.cards[a].up && !game.state.cards[b].up);
  assert.equal(game.flip(a), 'match');
});

test('match: the same card twice is not a pair', () => {
  const game = createMatch();
  game.flip(0);
  assert.equal(game.flip(0), null);
  assert.equal(game.state.score, 0);
});

test('match: clearing a board deals a bigger one, up to a limit', () => {
  const game = createMatch();
  for (let boardNumber = 0; boardNumber < 5; boardNumber++) {
    const expected = Math.min(MATCH.maxPairs, MATCH.firstPairs + boardNumber);
    assert.equal(game.state.cards.length, expected * 2);
    for (const [a, b] of pairsOf(game)) {
      game.flip(a);
      game.flip(b);
    }
    assert.deepEqual(run(game, MATCH.clearTime + 0.1), ['deal']);
  }
});

test('match: it ends once, after its time, and then cards do nothing', () => {
  const game = createMatch();
  assert.equal(run(game, MATCH.seconds + 2).filter((e) => e === 'end').length, 1);
  assert.equal(game.flip(0), null);
});

test('paint: it never ends and only offers colours from the palette', () => {
  const game = createPaint();
  assert.deepEqual(run(game, 300), []);
  assert.equal(game.state.over, false);
  assert.equal(game.state.color, PALETTE[0]);
  game.choose(PALETTE[3]);
  assert.equal(game.state.color, PALETTE[3]);
  game.choose('#123456');
  assert.equal(game.state.color, PALETTE[3]);
  game.stroke();
  assert.equal(game.state.strokes, 1);
});
