// The rules of the mini-games. Pure logic, no browser APIs: the app feeds in
// time and taps, and draws whatever `state` says.

export const BOXING = {
  seconds: 30,
  slots: 6, // places a pad can appear
  startLife: 1.7, // seconds a pad stays up at the start
  minLife: 0.8, // ...and at its fastest
  speedUp: 0.04, // seconds shaved off per hit
  gap: 0.25, // pause between pads
};

// Pads pop up one at a time; tap one before it vanishes to score.
export function createBoxing(random = Math.random) {
  const g = { kind: 'boxing', seconds: BOXING.seconds, time: 0, left: BOXING.seconds, score: 0, streak: 0, target: null, wait: 0.6, lastSlot: -1, over: false };

  function spawn() {
    // Never the same place twice in a row.
    const step = g.lastSlot < 0 ? Math.floor(random() * BOXING.slots) : 1 + Math.floor(random() * (BOXING.slots - 1));
    const slot = (Math.max(0, g.lastSlot) + step) % BOXING.slots;
    g.lastSlot = slot;
    g.target = { slot, age: 0, life: Math.max(BOXING.minLife, BOXING.startLife - g.score * BOXING.speedUp) };
  }

  return {
    state: g,
    // Move time on by dt seconds. Returns what happened: 'spawn', 'miss', 'end'.
    update(dt) {
      const events = [];
      if (g.over) return events;
      g.time += dt;
      g.left = Math.max(0, BOXING.seconds - g.time);
      if (g.left === 0) {
        g.over = true;
        g.target = null;
        events.push('end');
      } else if (g.target) {
        g.target.age += dt;
        if (g.target.age >= g.target.life) {
          g.target = null;
          g.streak = 0;
          g.wait = BOXING.gap;
          events.push('miss');
        }
      } else {
        g.wait -= dt;
        if (g.wait <= 0) {
          spawn();
          events.push('spawn');
        }
      }
      return events;
    },
    // The pad in this slot was tapped. Returns whether it counted.
    hit(slot) {
      if (g.over || g.target?.slot !== slot) return false;
      g.score += 1;
      g.streak += 1;
      g.target = null;
      g.wait = BOXING.gap;
      return true;
    },
  };
}

export const SWING = {
  seconds: 30,
  gravity: 4.2, // how hard the swing is pulled back to the middle
  damping: 0.25, // how quickly it slows on its own
  push: 0.3, // speed added by an ordinary push
  perfect: 0.55, // ...and by one timed right at the bottom
  perfectZone: 0.2, // how close to the bottom counts as perfect (radians)
  reach: 0.55, // further out than this, your hand can't reach to push
  cooldown: 0.6, // seconds between pushes, so mashing the screen doesn't win
  maxAngle: 1.0,
  starAngle: 0.45, // swing this high for one star
  bellAngle: 0.85, // ...and this high to ring the bell for two
};

// A pendulum you push. Each forward swing that goes high enough scores.
export function createSwing() {
  const g = { kind: 'swing', seconds: SWING.seconds, time: 0, left: SWING.seconds, angle: 0, speed: 0, score: 0, cooldown: 0, over: false };

  function advance(dt, events) {
    const before = g.speed;
    g.speed += (-SWING.gravity * Math.sin(g.angle) - SWING.damping * g.speed) * dt;
    g.angle += g.speed * dt;
    if (Math.abs(g.angle) > SWING.maxAngle) {
      g.angle = Math.sign(g.angle) * SWING.maxAngle;
      g.speed = 0;
    }
    // The top of a forward swing: it was going forwards and now it isn't.
    if (before > 0 && g.speed <= 0 && g.angle > 0) {
      if (g.angle >= SWING.bellAngle) {
        g.score += 2;
        events.push('bell');
      } else if (g.angle >= SWING.starAngle) {
        g.score += 1;
        events.push('star');
      }
    }
  }

  return {
    state: g,
    // Move time on by dt seconds. Returns what happened: 'star', 'bell', 'end'.
    update(dt) {
      const events = [];
      if (g.over) return events;
      g.time += dt;
      g.left = Math.max(0, SWING.seconds - g.time);
      g.cooldown = Math.max(0, g.cooldown - dt);
      // Small steps keep the swing steady even when frames arrive late.
      for (let remaining = dt; remaining > 0; remaining -= 0.01) advance(Math.min(0.01, remaining), events);
      if (g.left === 0) {
        g.over = true;
        events.push('end');
      }
      return events;
    },
    // Give the swing a push the way it is already going.
    // Returns 'perfect', 'push', or null if it was too soon or out of reach.
    push() {
      if (g.over || g.cooldown > 0 || Math.abs(g.angle) > SWING.reach) return null;
      const perfect = Math.abs(g.angle) < SWING.perfectZone;
      g.speed += (g.speed < 0 ? -1 : 1) * (perfect ? SWING.perfect : SWING.push);
      g.cooldown = SWING.cooldown;
      return perfect ? 'perfect' : 'push';
    },
  };
}

export const CATCH = {
  seconds: 30,
  range: 1.5, // how far the pet can run to either side
  spread: 1.7, // how far to either side things can fall
  top: 7.5, // height things fall from
  catchY: 3.0, // height of the pet's paws
  catchDepth: 0.7, // how far below the paws a catch still counts
  reach: 0.95, // how close sideways the pet must be
  petSpeed: 6,
  startFall: 2.3, // falling speed at the start
  endFall: 4, // ...and by the end
  startGap: 1.2, // seconds between things at the start
  endGap: 0.6, // ...and by the end
  yuckChance: 0.22,
};
export const FOODS = ['🍎', '🍌', '🍓', '🍪', '🧁', '🍉'];
export const YUCKS = ['🧦', '🥾', '🐛'];

// Food falls from the sky; steer the pet under it. Yucky things cost a star.
export function createCatch(random = Math.random) {
  const g = { kind: 'catch', seconds: CATCH.seconds, time: 0, left: CATCH.seconds, score: 0, petX: 0, targetX: 0, items: [], wait: 0.8, nextId: 0, over: false };
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

  return {
    state: g,
    // Move time on by dt seconds. Returns what happened: 'catch', 'yuck', 'drop', 'end'.
    update(dt) {
      const events = [];
      if (g.over) return events;
      g.time += dt;
      g.left = Math.max(0, CATCH.seconds - g.time);
      if (g.left === 0) {
        g.over = true;
        g.items = [];
        events.push('end');
        return events;
      }
      const progress = g.time / CATCH.seconds;

      const step = CATCH.petSpeed * dt;
      g.petX += Math.max(-step, Math.min(step, g.targetX - g.petX));

      g.wait -= dt;
      if (g.wait <= 0) {
        // The very first thing is always food, so nobody starts with a sock.
        const yuck = g.nextId > 0 && random() < CATCH.yuckChance;
        g.items.push({ id: g.nextId++, x: (random() * 2 - 1) * CATCH.spread, y: CATCH.top, yuck, icon: pick(yuck ? YUCKS : FOODS) });
        g.wait = CATCH.startGap + (CATCH.endGap - CATCH.startGap) * progress;
      }

      const fall = (CATCH.startFall + (CATCH.endFall - CATCH.startFall) * progress) * dt;
      g.items = g.items.filter((item) => {
        item.y -= fall;
        const atPaws = item.y <= CATCH.catchY && item.y > CATCH.catchY - CATCH.catchDepth;
        if (atPaws && Math.abs(item.x - g.petX) < CATCH.reach) {
          g.score = Math.max(0, g.score + (item.yuck ? -1 : 1));
          events.push(item.yuck ? 'yuck' : 'catch');
          return false;
        }
        if (item.y <= 0) {
          if (!item.yuck) events.push('drop');
          return false;
        }
        return true;
      });
      return events;
    },
    // Send the pet towards this sideways position.
    steer(x) {
      g.targetX = Math.max(-CATCH.range, Math.min(CATCH.range, x));
    },
  };
}

export const POP = {
  seconds: 30,
  startGap: 0.75, // seconds between bubbles at the start
  endGap: 0.4, // ...and by the end
  rise: 1.25, // how fast bubbles float up
  mouthY: 2.6, // where they come out
  top: 6.6, // where they float away
  spread: 1.6, // how far sideways they drift
  goldenChance: 0.12, // golden bubbles are faster and worth three
  pool: 16, // the most bubbles ever on screen at once
};

// The pet blows bubbles; tap them before they float away.
export function createPop(random = Math.random) {
  const g = { kind: 'pop', seconds: POP.seconds, time: 0, left: POP.seconds, score: 0, bubbles: [], wait: 0.5, nextId: 0, over: false };

  function place(bubble) {
    bubble.y = POP.mouthY + POP.rise * (bubble.golden ? 1.4 : 1) * bubble.age;
    bubble.x = bubble.drift * Math.min(1, bubble.age / 1.2) + Math.sin(bubble.age * 2 + bubble.phase) * 0.15;
  }

  return {
    state: g,
    // Move time on by dt seconds. Returns what happened: 'blow', 'escape', 'end'.
    update(dt) {
      const events = [];
      if (g.over) return events;
      g.time += dt;
      g.left = Math.max(0, POP.seconds - g.time);
      if (g.left === 0) {
        g.over = true;
        g.bubbles = [];
        events.push('end');
        return events;
      }

      g.wait -= dt;
      if (g.wait <= 0 && g.bubbles.length < POP.pool) {
        const bubble = {
          id: g.nextId++,
          drift: (random() * 2 - 1) * POP.spread,
          phase: random() * 6.28,
          size: 0.38 + random() * 0.17,
          golden: random() < POP.goldenChance,
          age: 0,
        };
        place(bubble);
        g.bubbles.push(bubble);
        g.wait = POP.startGap + (POP.endGap - POP.startGap) * (g.time / POP.seconds);
        events.push('blow');
      }

      g.bubbles = g.bubbles.filter((bubble) => {
        bubble.age += dt;
        place(bubble);
        if (bubble.y < POP.top) return true;
        events.push('escape');
        return false;
      });
      return events;
    },
    // Pop the bubble with this id. Returns 'gold', 'pop', or null if it has gone.
    pop(id) {
      const bubble = g.bubbles.find((b) => b.id === id);
      if (g.over || !bubble) return null;
      g.bubbles = g.bubbles.filter((b) => b !== bubble);
      g.score += bubble.golden ? 3 : 1;
      return bubble.golden ? 'gold' : 'pop';
    },
  };
}

export const PENALTY = {
  seconds: 30,
  halfWidth: 2.4, // the goal, in the pet's own units
  height: 3.6,
  margin: 0.3, // shots this close to a post still count as on target
  goalZ: -1.6, // how far back the goal line is
  ballZ: 6, // where the ball waits, close to the player
  flight: 0.55, // seconds from kick to goal line
  recover: 1.0, // seconds before the next ball
  guess: 0.4, // how often the keeper dives the right way
  keeperRange: 1.3, // how far to either side the keeper can dive
  reachX: 0.9, // how close the keeper must be to save it
  reachY: 3.0, // shots above this are out of the keeper's reach
};

// You take penalties; the pet is in goal.
export function createPenalty(random = Math.random) {
  const g = {
    kind: 'penalty', seconds: PENALTY.seconds, time: 0, left: PENALTY.seconds, score: 0,
    phase: 'ready', shot: null, keeperX: 0, outcome: null, result: null, over: false,
  };
  const within = (value, most) => Math.max(-most, Math.min(most, value));

  return {
    state: g,
    // Move time on by dt seconds. Returns what happened: 'goal', 'save', 'miss', 'end'.
    update(dt) {
      const events = [];
      if (g.over) return events;
      g.time += dt;
      g.left = Math.max(0, PENALTY.seconds - g.time);
      if (g.left === 0) {
        g.over = true;
        events.push('end');
        return events;
      }
      if (!g.shot) return events;
      g.shot.t += dt;
      if (g.phase === 'flying' && g.shot.t >= PENALTY.flight) {
        g.phase = 'result';
        g.result = g.outcome;
        if (g.result === 'goal') g.score += 1;
        events.push(g.result);
      } else if (g.phase === 'result' && g.shot.t >= PENALTY.flight + PENALTY.recover) {
        Object.assign(g, { phase: 'ready', shot: null, result: null, outcome: null, keeperX: 0 });
      }
      return events;
    },
    // Kick the ball at this point of the goal mouth. Returns whether a shot was taken.
    shoot(x, y) {
      if (g.over || g.phase !== 'ready') return false;
      const onTarget = Math.abs(x) <= PENALTY.halfWidth + PENALTY.margin && y >= 0 && y <= PENALTY.height + PENALTY.margin;
      // The keeper guesses: sometimes right, sometimes not.
      g.keeperX = random() < PENALTY.guess ? within(x, PENALTY.keeperRange) : (random() * 2 - 1) * PENALTY.keeperRange;
      const reached = Math.abs(x - g.keeperX) < PENALTY.reachX && y < PENALTY.reachY;
      g.outcome = !onTarget ? 'miss' : reached ? 'save' : 'goal';
      g.shot = { x, y, t: 0 };
      g.phase = 'flying';
      return true;
    },
  };
}

export const PIANO = { seconds: 45, keys: 8 };
// The eight keys are one octave of a major scale, numbered 0 (low) to 7 (high).
export const SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
// Old tunes everyone knows, as key numbers.
export const TUNES = [
  [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0], // Twinkle, Twinkle, Little Star
  [2, 1, 0, 1, 2, 2, 2, 1, 1, 1, 2, 4, 4], // Mary Had a Little Lamb
  [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1], // Ode to Joy
];

// Any key plays a note. The key that comes next in the tune is lit up, and
// pressing it scores a star.
export function createPiano() {
  const g = { kind: 'piano', seconds: PIANO.seconds, time: 0, left: PIANO.seconds, score: 0, tune: 0, at: 0, next: TUNES[0][0], over: false };

  return {
    state: g,
    update(dt) {
      if (g.over) return [];
      g.time += dt;
      g.left = Math.max(0, PIANO.seconds - g.time);
      if (g.left > 0) return [];
      g.over = true;
      return ['end'];
    },
    // Returns 'right' for the lit key, 'tune' when that finished a tune,
    // 'free' for any other key, or null once the game is over.
    press(key) {
      if (g.over) return null;
      if (key !== g.next) return 'free';
      g.score += 1;
      g.at += 1;
      const finished = g.at === TUNES[g.tune].length;
      if (finished) {
        g.tune = (g.tune + 1) % TUNES.length;
        g.at = 0;
      }
      g.next = TUNES[g.tune][g.at];
      return finished ? 'tune' : 'right';
    },
  };
}

export const HIDE = {
  seconds: 45,
  spotX: [-1.75, 0, 1.75], // where the three hiding places stand
  hideTime: 0.9, // seconds the pet takes to hide, unseen
  foundTime: 1.5, // seconds of celebrating before it hides again
  peekEvery: 1.8, // how often it peeks out
  peekLength: 0.8, // how long each peek lasts
  wrongTime: 0.6, // how long a wrong guess wobbles
};

// The pet hides behind one of three things and peeks out now and then.
export function createHide(random = Math.random) {
  const spots = HIDE.spotX.length;
  // Never the same hiding place twice in a row.
  const choose = (last) => (Math.max(0, last) + (last < 0 ? Math.floor(random() * spots) : 1 + Math.floor(random() * (spots - 1)))) % spots;
  const g = { kind: 'hide', seconds: HIDE.seconds, time: 0, left: HIDE.seconds, score: 0, phase: 'hiding', t: 0, spot: choose(-1), peek: 0, wrong: null, over: false };

  return {
    state: g,
    // Move time on by dt seconds. Returns what happened: 'hidden', 'peek', 'end'.
    update(dt) {
      const events = [];
      if (g.over) return events;
      g.time += dt;
      g.left = Math.max(0, HIDE.seconds - g.time);
      if (g.left === 0) {
        g.over = true;
        events.push('end');
        return events;
      }
      g.t += dt;
      if (g.wrong && (g.wrong.t += dt) > HIDE.wrongTime) g.wrong = null;

      if (g.phase === 'hiding' && g.t >= HIDE.hideTime) {
        Object.assign(g, { phase: 'hidden', t: 0 });
        events.push('hidden');
      } else if (g.phase === 'hidden') {
        const cycle = g.t % HIDE.peekEvery;
        const wasOut = g.peek > 0;
        g.peek = cycle < HIDE.peekLength ? Math.sin((cycle / HIDE.peekLength) * Math.PI) : 0; // out and back in
        if (!wasOut && g.peek > 0) events.push('peek');
      } else if (g.phase === 'found' && g.t >= HIDE.foundTime) {
        Object.assign(g, { phase: 'hiding', t: 0, spot: choose(g.spot) });
      }
      return events;
    },
    // Look behind this hiding place. Returns 'found', 'wrong', or null if it isn't hiding yet.
    guess(spot) {
      if (g.over || g.phase !== 'hidden') return null;
      if (spot !== g.spot) {
        g.wrong = { spot, t: 0 };
        return 'wrong';
      }
      g.score += 1;
      Object.assign(g, { phase: 'found', t: 0, peek: 0, wrong: null });
      return 'found';
    },
  };
}

export const SIMON = {
  seconds: 60,
  parts: ['head', 'tummy', 'feet'],
  startLength: 2, // how many moves the first round has
  showTime: 0.85, // seconds given to each move when the pet shows them
  pause: 0.7, // a breath before the pet starts showing
  rightTime: 1.0, // celebrating a finished round
  wrongTime: 1.3, // shaking its head before showing again
};

// The pet touches its head, tummy and feet in some order; copy it. Each
// finished round earns a star and the next round is one move longer.
export function createSimon(random = Math.random) {
  const part = () => SIMON.parts[Math.min(SIMON.parts.length - 1, Math.floor(random() * SIMON.parts.length))];
  const g = {
    kind: 'simon', seconds: SIMON.seconds, time: 0, left: SIMON.seconds, score: 0,
    sequence: Array.from({ length: SIMON.startLength }, part),
    phase: 'ready', t: 0, index: 0, showing: null, shown: -1, over: false,
  };
  const enter = (phase) => Object.assign(g, { phase, t: 0, index: 0, showing: null, shown: -1 });

  return {
    state: g,
    // Move time on by dt seconds. Returns what happened: 'show' (see state.showing), 'go', 'end'.
    update(dt) {
      const events = [];
      if (g.over) return events;
      g.time += dt;
      g.left = Math.max(0, SIMON.seconds - g.time);
      if (g.left === 0) {
        g.over = true;
        g.showing = null;
        events.push('end');
        return events;
      }
      g.t += dt;

      if (g.phase === 'ready' && g.t >= SIMON.pause) enter('show');
      else if (g.phase === 'show') {
        const move = Math.floor(g.t / SIMON.showTime);
        if (move >= g.sequence.length) {
          enter('copy');
          events.push('go');
        } else {
          // Each move is held for most of its time, then dropped, so that two
          // of the same in a row read as two.
          const held = g.t % SIMON.showTime < SIMON.showTime * 0.75;
          g.showing = held ? g.sequence[move] : null;
          if (held && g.shown !== move) {
            g.shown = move;
            events.push('show');
          }
        }
      } else if (g.phase === 'right' && g.t >= SIMON.rightTime) {
        g.sequence.push(part());
        enter('ready');
      } else if (g.phase === 'wrong' && g.t >= SIMON.wrongTime) enter('ready');
      return events;
    },
    // The player touched this part. Returns 'right', 'round' when that finished
    // the sequence, 'wrong', or null if it isn't the player's turn.
    tap(touched) {
      if (g.over || g.phase !== 'copy') return null;
      if (touched !== g.sequence[g.index]) {
        enter('wrong');
        return 'wrong';
      }
      g.index += 1;
      if (g.index < g.sequence.length) return 'right';
      g.score += 1;
      enter('right');
      return 'round';
    },
  };
}

export const MATCH = {
  seconds: 60,
  firstPairs: 3, // the first board is small; each one after has a pair more
  maxPairs: 6,
  showTime: 0.9, // seconds two cards that don't match stay face up
  clearTime: 1.0, // seconds to admire a finished board before the next
};
export const FACES = ['🐱', '🐶', '🐰', '🐼', '🦊', '🐵', '🐧', '🦄'];

// Cards lie face down. Turn over two; if they match they stay.
export function createMatch(random = Math.random) {
  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(random() * (i + 1)));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  const deal = (pairs) => {
    const faces = shuffle([...FACES]).slice(0, pairs);
    return shuffle([...faces, ...faces]).map((face) => ({ face, up: false, matched: false }));
  };
  const g = { kind: 'match', seconds: MATCH.seconds, time: 0, left: MATCH.seconds, score: 0, pairs: MATCH.firstPairs, cards: deal(MATCH.firstPairs), open: [], wait: 0, cleared: 0, over: false };

  function turnBack() {
    for (const i of g.open) g.cards[i].up = false;
    g.open = [];
    g.wait = 0;
  }

  return {
    state: g,
    // Move time on by dt seconds. Returns what happened: 'deal', 'end'.
    update(dt) {
      const events = [];
      if (g.over) return events;
      g.time += dt;
      g.left = Math.max(0, MATCH.seconds - g.time);
      if (g.left === 0) {
        g.over = true;
        events.push('end');
        return events;
      }
      if (g.wait > 0 && (g.wait -= dt) <= 0) turnBack();
      if (g.cleared > 0 && (g.cleared -= dt) <= 0) {
        g.pairs = Math.min(MATCH.maxPairs, g.pairs + 1);
        g.cards = deal(g.pairs);
        g.cleared = 0;
        events.push('deal');
      }
      return events;
    },
    // Turn over card `i`. Returns 'flip' for the first of a pair, 'match' or
    // 'miss' for the second, or null if that card can't be turned.
    flip(i) {
      const card = g.cards[i];
      if (g.over || !card || card.matched) return null;
      if (g.wait > 0) turnBack(); // no need to wait for the last two to turn back
      if (card.up) return null;
      card.up = true;
      g.open.push(i);
      if (g.open.length === 1) return 'flip';
      const [first, second] = g.open.map((index) => g.cards[index]);
      if (first.face !== second.face) {
        g.wait = MATCH.showTime;
        return 'miss';
      }
      first.matched = second.matched = true;
      g.open = [];
      g.score += 1;
      if (g.cards.every((each) => each.matched)) g.cleared = MATCH.clearTime;
      return 'match';
    },
  };
}

export const PALETTE = ['#ff5d5d', '#ff9f43', '#ffd93d', '#6bcb77', '#4dd4c0', '#4d96ff', '#9b72f2', '#ff7ac3', '#ffffff', '#8d5a3b', '#3a3a44'];

// Painting the pet: no clock and no score, it goes on until you stop.
export function createPaint() {
  const g = { kind: 'paint', seconds: 1, time: 0, left: 1, score: 0, color: PALETTE[0], strokes: 0, over: false };
  return {
    state: g,
    update() {
      return [];
    },
    choose(color) {
      if (PALETTE.includes(color)) g.color = color;
    },
    stroke() {
      g.strokes += 1;
    },
  };
}

// Everything in the wardrobe, by where it is worn. One thing per place.
export const WARDROBE = {
  head: [
    { id: 'partyhat', icon: '🎉' },
    { id: 'crown', icon: '👑' },
    { id: 'tophat', icon: '🎩' },
    { id: 'cap', icon: '🧢' },
    { id: 'wizard', icon: '🧙' },
    { id: 'flower', icon: '🌸' },
  ],
  eyes: [
    { id: 'shades', icon: '🕶️' },
    { id: 'round', icon: '👓' },
    { id: 'rosy', icon: '💗' },
  ],
  neck: [
    { id: 'bow', icon: '🎀' },
    { id: 'scarf', icon: '🧣' },
    { id: 'beads', icon: '📿' },
    { id: 'cape', icon: '🦸' },
    { id: 'medal', icon: '🏅' },
  ],
};
export const SLOTS = [['head', '🎩'], ['eyes', '👓'], ['neck', '🧣']];

// Keep only real clothes in real places, e.g. from an outfit saved long ago.
export function cleanOutfit(saved) {
  const outfit = {};
  for (const [slot] of SLOTS) {
    const id = saved?.[slot];
    outfit[slot] = WARDROBE[slot].some((item) => item.id === id) ? id : null;
  }
  return outfit;
}

// Dressing up: no clock and no score.
export function createDress(wearing) {
  const g = { kind: 'dress', seconds: 1, time: 0, left: 1, score: 0, slot: 'head', outfit: cleanOutfit(wearing), changes: 0, over: false };
  return {
    state: g,
    update() {
      return [];
    },
    // Look at another part of the wardrobe.
    choose(slot) {
      if (slot in WARDROBE) g.slot = slot;
    },
    // Put this on, or take it off if it is already on. Returns 'on', 'off' or null.
    wear(id) {
      if (!WARDROBE[g.slot].some((item) => item.id === id)) return null;
      const taking = g.outfit[g.slot] === id;
      g.outfit[g.slot] = taking ? null : id;
      g.changes += 1;
      return taking ? 'off' : 'on';
    },
  };
}

export const BATH = {
  zones: ['head', 'belly'], // the parts that need washing
  tools: ['soap', 'shower', 'towel'],
  rubTime: 1.2, // seconds of rubbing each part needs with each tool
  finishTime: 3, // seconds of being pleased with itself before the bath ends
};

// Bath time: soap the mud off, shower the suds away, towel dry. Each part of
// the pet tracks how muddy, sudsy and wet it is, from 0 to 1.
export function createBath() {
  const part = () => ({ dirt: 1, foam: 0, wet: 0, soaped: false, rinsed: false });
  const g = {
    kind: 'bath', seconds: 1, time: 0, left: 0, score: 0, tool: 'soap', next: 'soap',
    zones: Object.fromEntries(BATH.zones.map((zone) => [zone, part()])),
    rubbing: null, clean: false, t: 0, over: false,
  };
  const parts = () => Object.values(g.zones);

  return {
    state: g,
    // Move time on by dt seconds. Returns what happened: 'clean', 'end'.
    update(dt) {
      const events = [];
      if (g.over) return events;
      g.time += dt;
      // How far through the whole bath we are, for the progress bar.
      g.left = parts().reduce((sum, p) => sum + (1 - p.dirt) + (p.soaped ? 1 - p.foam : 0) + (p.rinsed ? 1 - p.wet : 0), 0) / (parts().length * 3);
      // What would help most right now, so the right tool can be pointed out.
      g.next = parts().some((p) => p.dirt > 0) ? 'soap' : parts().some((p) => p.foam > 0 || !p.rinsed) ? 'shower' : 'towel';
      if (!g.clean && parts().every((p) => p.rinsed && p.dirt === 0 && p.foam === 0 && p.wet === 0)) {
        g.clean = true;
        g.t = 0;
        events.push('clean');
      } else if (g.clean && (g.t += dt) >= BATH.finishTime) {
        g.over = true;
        events.push('end');
      }
      return events;
    },
    choose(tool) {
      if (BATH.tools.includes(tool)) g.tool = tool;
    },
    // Use the chosen tool on this part for dt seconds. The shower falls on
    // everything, so it needs no part. Returns whether it did anything.
    rub(zone, dt) {
      if (g.clean || g.over) return false;
      const amount = dt / BATH.rubTime;
      const p = g.zones[zone];
      if (g.tool === 'shower') {
        for (const each of parts()) {
          each.foam = Math.max(0, each.foam - amount);
          each.wet = 1;
          if (each.soaped && each.foam === 0) each.rinsed = true;
        }
      } else if (!p) {
        return false;
      } else if (g.tool === 'soap') {
        p.dirt = Math.max(0, p.dirt - amount);
        p.foam = Math.min(1, p.foam + amount);
        p.soaped = true;
        p.rinsed = false;
      } else {
        if (p.foam > 0) return false; // a towel only smears the suds about
        p.wet = Math.max(0, p.wet - amount);
      }
      g.rubbing = { zone, tool: g.tool, at: g.time };
      return true;
    },
  };
}

// Compare a finished game's score with the best so far.
export function newRecord(score, best) {
  return score > 0 && score > (best ?? 0);
}
