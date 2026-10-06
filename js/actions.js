// What the pet can do, how long each thing lasts, and what the status bubble says.
// Pure data, shared by the app (sounds, timers) and the 3D view (animation).

// Moments inside an action, in seconds, where sound and animation must line up.
export const CUES = {
  burp: 2.1,
  toot: 0.4,
  pieHit: 0.35,
  ballHit: 0.45,
};

// Things you start with a button.
export const ACTIONS = {
  feed: { ms: 2800, text: 'Yum!' },
  milk: { ms: 3000, text: 'Slurp… BURP!' },
  ball: { ms: 2000, text: 'Bonk!' },
  pie: { ms: 3000, text: 'Splat!' },
  dance: { ms: 5000, text: 'Dance party!' },
  toot: { ms: 1900, text: 'Oops… excuse me!' },
};

// What happens when you poke each part of the pet.
export const REACTIONS = {
  head: { ms: 1100, text: 'Ouch!' },
  belly: { ms: 1200, text: 'Hee hee, that tickles!' },
  tail: { ms: 1000, text: 'Yeow!' },
  feet: { ms: 800, text: 'Boing!' },
  dizzy: { ms: 2800, text: 'Whoa… so dizzy!' },
};

// Poke the head this many times in a row and the pet gets dizzy.
export const DIZZY_TAPS = 3;
export const DIZZY_WINDOW_MS = 2500;

export const ACCESSORIES = ['none', 'partyhat', 'crown', 'shades', 'bow'];

// Given the times of recent head pokes, decide whether this one makes the pet dizzy.
// Returns the pokes to remember for next time and the reaction to play.
export function headPoke(recent, now) {
  const taps = [...recent.filter((time) => now - time < DIZZY_WINDOW_MS), now];
  if (taps.length >= DIZZY_TAPS) return { taps: [], zone: 'dizzy' };
  return { taps, zone: 'head' };
}
