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
  const g = { kind: 'boxing', time: 0, left: BOXING.seconds, score: 0, streak: 0, target: null, wait: 0.6, lastSlot: -1, over: false };

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
  const g = { kind: 'swing', time: 0, left: SWING.seconds, angle: 0, speed: 0, score: 0, cooldown: 0, over: false };

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

// Compare a finished game's score with the best so far.
export function newRecord(score, best) {
  return score > 0 && score > (best ?? 0);
}
