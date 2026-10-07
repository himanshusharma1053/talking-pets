// What the pet can do, how long each thing lasts, and what the pet says out loud.
// Pure data, shared by the app (sounds, timers) and the 3D view (animation).

// Moments inside an action, in seconds, where sound and animation must line up.
export const CUES = {
  burp: 2.6,
  bites: [0.9, 1.7, 2.5], // when each bite of food is taken
  gulp: 3.2,
  toot: 0.4,
  pieHit: 0.35,
  ballHit: 0.45,
  bounce: 0.9, // one trampoline bounce
};

// Things you start with a button. `say` lists lines the pet may speak; one is picked at random.
export const ACTIONS = {
  feed: { ms: 4200, say: ['Yum yum yum!', 'Mmm, delicious!', 'More please!'] },
  milk: { ms: 4000, say: ['Mmm, milk!', 'Glug glug glug!'] },
  ball: { ms: 2000, say: ['Ooh, a ball!', 'Catch!'] },
  pie: { ms: 3000, say: ['Uh oh!', 'Oh no, a pie!'] },
  dance: { ms: 5000, say: ['Dance party!', "Let's dance!"] },
  toot: { ms: 1900, say: ['Oops! Excuse me!', 'That was not me!'] },
  trampoline: { ms: 5400, say: ['Boing! Boing!', 'Jump! Jump! Jump!'] },
};

// What happens when you poke each part of the pet.
export const REACTIONS = {
  head: { ms: 1100, say: ['Ouch!', 'Hey!', 'Owie!'] },
  belly: { ms: 1200, say: ['Hee hee, that tickles!', 'Stop it, that tickles!'] },
  tail: { ms: 1000, say: ['Yeow!', 'My tail!'] },
  feet: { ms: 800, say: ['Boing!', 'Hop hop!'] },
  dizzy: { ms: 2800, say: ['Whoa, I am so dizzy!', 'Everything is spinning!'] },
  cheer: { ms: 3000, say: ['Hooray!'] }, // after a game; the app says the score instead
};

// Mini-games: what the pet says as each one starts.
export const GAMES = {
  boxing: { say: ['Tap the pads! Pow, pow, pow!', 'Hit the pads as fast as you can!'] },
  swing: { say: ['Push me! Ring the bell!', 'Push me higher!'] },
  catch: { say: ['Catch the food! No socks, please!', 'I am hungry! Help me catch it!'] },
  pop: { say: ['Pop the bubbles!', 'Bubbles! Pop them all!'] },
  penalty: { say: ['Try to score past me!', 'I am the goalkeeper! Shoot!'] },
  piano: { say: ['Play the shiny key!', "Let's make music!"] },
  hide: { say: ['Hide and seek! Find me!', 'I am going to hide!'] },
  simon: { say: ['Watch me, then copy!', 'Copy what I do!'] },
  match: { say: ['Find the two that match!', 'Turn over the cards!'] },
  paint: { say: ['Paint me any colour you like!', 'Make me colourful!'] },
};

// The scenery each game is played in. Anything not listed happens at home.
export const SCENES = { swing: 'park', catch: 'park', hide: 'park', pop: 'park', penalty: 'pitch', boxing: 'gym', piano: 'show' };

// The ribbon on the card at the end of a game.
export function ribbonText(score, record) {
  if (score === 0) return 'Have another go!';
  return record ? 'New best score!' : 'Well played!';
}

// Short things the pet says inside the games.
export const GAME_LINES = {
  hidden: ['Where am I?', 'Find me!', 'Yoo hoo!'],
  found: ['You found me!', 'Here I am!', 'Peekaboo!'],
  round: ['Well done!', 'Clever you!', 'Yes!'],
  wrong: ['Oops! Watch again.', 'Not quite. Watch me!'],
  parts: { head: 'Head!', tummy: 'Tummy!', feet: 'Feet!' },
  match: ['A match!', 'You got it!', 'Yes!'],
  painted: ['Ooh, pretty!', 'I love it!', 'That tickles!', 'So colourful!'],
};

// What the pet says when a game ends.
export function scoreLine(score, record) {
  if (score === 0) return "Let's try again!";
  const stars = score === 1 ? '1 star' : `${score} stars`;
  return record ? `${stars}! A new record!` : `You got ${stars}! Great job!`;
}

// Spoken when the pet goes to sleep and wakes up.
export const GREETINGS = {
  sleep: ['Good night!', 'I am so sleepy.'],
  wake: ['Good morning!', 'I am awake!'],
  hello: ['Hello!', 'Hi there!', "Let's play!"],
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

// Pick one of the lines. `random` is a number from 0 up to (not including) 1.
export function pickLine(lines, random = Math.random()) {
  return lines[Math.min(lines.length - 1, Math.floor(random * lines.length))];
}
