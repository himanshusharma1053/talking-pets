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

// Compare a finished game's score with the best so far.
export function newRecord(score, best) {
  return score > 0 && score > (best ?? 0);
}
