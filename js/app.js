import { PETS, findPet } from './pets.js';
import { nextState, micOpen } from './state.js';
import { ACTIONS, REACTIONS, GAMES, GAME_LINES, GREETINGS, ACCESSORIES, CUES, headPoke, pickLine, scoreLine } from './actions.js';
import {
  POP, PENALTY, SCALE, PALETTE, createBoxing, createSwing, createCatch, createPop, createPenalty,
  createPiano, createHide, createSimon, createMatch, createPaint, newRecord,
} from './games.js';
import { createSounds } from './sounds.js';
import { createVoice, playSamples } from './voice.js';
import { createPetView, renderThumbnails } from './pet3d.js';
import { canSpeak, say, hush, isSpeaking } from './speech.js';

const MIC_REOPEN_MS = 350; // keep the mic shut briefly after the pet makes a sound

// The pet's wordless cries. When the device can speak, the pet says a line
// instead, so only the giggle (which no speech voice does well) is kept.
function cry(s, pet, mood, at = 0) {
  if (!canSpeak || mood === 'giggle') s.call(pet, mood, at);
}

// The sound effects that go with each poke and each button.
const SOUNDS = {
  head: (s, pet) => cry(s, pet, 'ouch'),
  belly: (s, pet) => cry(s, pet, 'giggle', 0.9),
  tail: (s, pet) => cry(s, pet, 'yowl'),
  feet: (s, pet) => cry(s, pet, 'happy'),
  dizzy: (s, pet) => {
    s.twinkle();
    cry(s, pet, 'woozy');
  },
  feed: (s) => s.munch(CUES.bites, CUES.gulp),
  milk: (s) => {
    s.slurp();
    s.burp(CUES.burp);
  },
  ball: (s, pet) => {
    s.boing(CUES.ballHit);
    cry(s, pet, 'ouch', CUES.ballHit + 0.1);
  },
  pie: (s, pet) => {
    s.whoosh();
    s.splat(CUES.pieHit);
    cry(s, pet, 'giggle', CUES.pieHit + 1.3);
  },
  dance: (s) => s.dance(),
  toot: (s, pet) => {
    s.toot(CUES.toot);
    cry(s, pet, 'giggle', CUES.toot + 0.9);
  },
  cheer: (s) => s.fanfare(),
  trampoline: (s) => s.bounces(CUES.bounce, Math.round(ACTIONS.trampoline.ms / 1000 / CUES.bounce)),
};

const $ = (id) => document.getElementById(id);
const picker = $('picker');
const stage = $('stage');
const holder = $('pet-holder');
const micNotice = $('mic-notice');
const actionButtons = [...document.querySelectorAll('.controls button')];
const NEW_GAME = {
  boxing: createBoxing, swing: createSwing, catch: createCatch, pop: createPop,
  penalty: createPenalty, piano: createPiano, hide: createHide, simon: createSimon,
  match: createMatch, paint: createPaint,
};
// In Simon says: the part of the pet you tap, the move it stands for, and its note.
const SIMON_MOVE = { head: 'head', belly: 'tummy', feet: 'feet' };
const SIMON_NOTE = { head: SCALE[7], tummy: SCALE[4], feet: SCALE[0] };
const pianoKeys = [...document.querySelectorAll('.piano button')];

let pet = null;
let view = null;
let state = 'idle';
let detail = null; // the part poked or the button pressed
let headTaps = [];
let accessory = 0;
let ctx = null;
let sounds = null;
let voice = null;
let playback = null;
let timer = null;
let micTimer = null;
let game = null; // the mini-game being played, if any
let fx = null; // a short flourish inside a game: { kind, t, slot }

// ---------- Pet picker ----------

const CARD_COLORS = {
  cat: '#ffe3bd',
  dog: '#f6dcc4',
  bunny: '#ffdfe6',
  panda: '#dff0e4',
  fox: '#ffd9c2',
  monkey: '#f3e3cf',
  penguin: '#d9e8fb',
  unicorn: '#eedcff',
};

let thumbnails = {};
try {
  thumbnails = renderThumbnails(PETS);
} catch {
  // No 3D on this device: the cards fall back to emoji.
}

$('pet-grid').innerHTML = PETS.map((p) => {
  const picture = thumbnails[p.id]
    ? `<img src="${thumbnails[p.id]}" alt="${p.kind}" width="240" height="300">`
    : `<span class="pet-emoji">${p.emoji}</span>`;
  return `
  <button class="pet-card" type="button" data-pet="${p.id}" style="--card:${CARD_COLORS[p.id]}">
    ${picture}
    <strong>${p.name}</strong>
  </button>`;
}).join('');

$('pet-grid').addEventListener('click', (e) => {
  const card = e.target.closest('[data-pet]');
  if (card) choosePet(card.dataset.pet);
});

$('change-pet').addEventListener('click', () => {
  quiet();
  clearInterval(micTimer);
  voice?.setEnabled(false);
  view?.dispose();
  view = null;
  stage.hidden = true;
  picker.hidden = false;
});

// Used when the device cannot draw 3D: a big emoji that still reacts to taps.
function emojiView() {
  holder.innerHTML = `<span class="pet-emoji big">${pet.emoji}</span>`;
  const nothing = () => {};
  // Without a 3D view there are no frames, so keep games running on a timer.
  let clock = null;
  return {
    setState: nothing,
    setMouth: nothing,
    setLook: nothing,
    setAccessory: nothing,
    setGame: nothing,
    worldX: () => 0,
    aim: () => ({ x: 0, y: 0 }),
    paint: () => null,
    getPaint: () => ({}),
    setPaint: nothing,
    clearPaint: nothing,
    setTicker: (fn) => (clock = setInterval(() => fn(0.05), 50)),
    dispose: () => clearInterval(clock),
    pick: () => 'belly',
  };
}

function choosePet(id) {
  pet = findPet(id);
  $('pet-name').textContent = pet.name;
  $('feed-emoji').textContent = pet.food;
  picker.hidden = true;
  stage.hidden = false;
  try {
    view = createPetView(holder, pet);
  } catch {
    view = emojiView();
  }
  view.setAccessory(ACCESSORIES[accessory]);
  view.setPaint(savedPaint(pet.id));
  view.setTicker(tick);
  enter('idle', GREETINGS.hello);
  startAudio();
}

// ---------- Audio ----------

// Browsers only allow audio after a tap, so this runs when a pet is picked.
async function startAudio() {
  if (!ctx) {
    ctx = new AudioContext();
    sounds = createSounds(ctx);
  }
  await ctx.resume();
  if (!voice) await connectMic();
}

async function connectMic() {
  try {
    voice = await createVoice(ctx, {
      onStart: () => dispatch('heard'),
      onEnd: (samples) => dispatch('speechEnd', samples),
      onDiscard: () => dispatch('speechDiscard'),
    });
    micNotice.hidden = true;
    if (!stage.hidden) openMic();
  } catch {
    micNotice.hidden = false;
  }
  render();
}

$('mic-retry').addEventListener('click', connectMic);

// Open or close the mic for the current activity. It stays shut while the pet
// is speaking a line, so the pet never hears and repeats itself.
function openMic() {
  clearInterval(micTimer);
  if (!micOpen(state)) {
    voice?.setEnabled(false);
  } else if (isSpeaking()) {
    voice?.setEnabled(false);
    micTimer = setInterval(() => {
      if (!isSpeaking()) openMic();
    }, 200);
  } else {
    voice?.setEnabled(true, MIC_REOPEN_MS);
  }
}

// ---------- Pet behaviour ----------

function dispatch(event, payload, line) {
  const from = state;
  const to = nextState(state, event);
  if (!to) return;
  if (event === 'sleep') payload = to === 'sleeping' ? GREETINGS.sleep : GREETINGS.wake;
  if (event === 'tap' && from === 'sleeping') payload = GREETINGS.wake;
  enter(to, payload, line);
}

// Stop whatever the pet is doing right now.
function quiet() {
  clearTimeout(timer);
  playback?.stop();
  playback = null;
  sounds?.stopAll();
  hush();
  game = null;
  fx = null;
  view?.setGame(null);
  for (const key of pianoKeys) key.classList.remove('next');
}

// `payload` depends on the activity: the part poked, the button pressed, the
// game chosen, the recording to play back, or lines to say when going to sleep
// or waking. `line` replaces what the pet would normally say.
function enter(to, payload, line) {
  quiet();
  state = to;
  detail = ['reacting', 'acting', 'playing'].includes(to) ? payload : null;
  view.setMouth(0);
  view.setState(to, detail);

  const finish = () => dispatch('done');
  let lines = null;
  switch (to) {
    case 'talking':
      playback = playSamples(ctx, payload, pet.pitch, { onLevel: view.setMouth, onDone: finish });
      break;
    case 'reacting':
    case 'acting': {
      const entry = (to === 'acting' ? ACTIONS : REACTIONS)[detail];
      lines = line ? [line] : entry.say;
      if (sounds) SOUNDS[detail](sounds, pet);
      timer = setTimeout(finish, entry.ms);
      break;
    }
    case 'playing':
      game = NEW_GAME[detail]();
      view.setGame(game.state);
      lines = GAMES[detail].say;
      boardShown = '';
      showColor();
      break;
    case 'sleeping':
      lines = payload;
      sounds?.startSnoring();
      break;
    case 'idle':
      lines = Array.isArray(payload) ? payload : null;
      break;
  }
  if (lines) say(pickLine(lines), pet);
  openMic();
  render();
}

function render() {
  if (!pet) return;
  const asleep = state === 'sleeping';
  stage.dataset.state = state;
  stage.dataset.detail = detail ?? '';
  $('mic-dot').hidden = state !== 'listening';
  $('hud').hidden = state !== 'playing';
  renderHud();
  $('sleep-emoji').textContent = asleep ? '☀️' : '🌙';
  $('sleep').setAttribute('aria-label', asleep ? 'Wake' : 'Sleep');
  for (const button of actionButtons) button.disabled = asleep && button.id !== 'sleep';
}

// ---------- Mini-games ----------

// Called before every frame while a pet is on screen.
function tick(dt) {
  if (!game) return;
  if (fx && (fx.t += dt) > 0.6) fx = null;
  for (const event of game.update(dt)) {
    if (event === 'spawn') sounds?.blip();
    else if (event === 'miss') {
      sounds?.miss();
      fx = { kind: 'miss', t: 0 };
    } else if (event === 'star') {
      sounds?.ding();
      fx = { kind: 'star', t: 0 };
    } else if (event === 'bell') {
      sounds?.bell();
      fx = { kind: 'bell', t: 0 };
    } else if (event === 'catch') {
      sounds?.chomp();
      fx = { kind: 'catch', t: 0 };
    } else if (event === 'yuck') {
      sounds?.yuck();
      fx = { kind: 'yuck', t: 0 };
    } else if (event === 'blow') sounds?.bloop();
    else if (event === 'goal') {
      sounds?.cheer();
      say('Goal!', pet);
    } else if (event === 'save') sounds?.boing();
    else if (event === 'deal') sounds?.flourish();
    else if (event === 'hidden') say(pickLine(GAME_LINES.hidden), pet);
    else if (event === 'peek') sounds?.call(pet, 'giggle');
    else if (event === 'show') {
      sounds?.note(SIMON_NOTE[game.state.showing], pet);
      say(GAME_LINES.parts[game.state.showing], pet);
    } else if (event === 'go') sounds?.blip();
    else if (event === 'end') {
      endGame();
      return;
    }
  }
  view.setGame({ ...game.state, fx });
  renderHud();
}

function gameTap(zone, clientX, clientY) {
  const { kind } = game.state;
  if (kind === 'boxing') {
    if (!zone?.startsWith('pad')) return;
    const slot = Number(zone.slice(3));
    if (!game.hit(slot)) return;
    fx = { kind: 'hit', slot, t: 0 };
    sounds?.thud();
  } else if (kind === 'catch') {
    game.steer(view.worldX(clientX));
  } else if (kind === 'penalty') {
    const target = view.aim(clientX, clientY, PENALTY.goalZ);
    if (game.shoot(target.x, target.y)) sounds?.kick();
  } else if (kind === 'hide') {
    if (!zone?.startsWith('spot')) return;
    const result = game.guess(Number(zone.slice(4)));
    if (result === 'found') {
      sounds?.ding();
      say(pickLine(GAME_LINES.found), pet);
    } else if (result === 'wrong') sounds?.miss();
  } else if (kind === 'simon') {
    const part = SIMON_MOVE[zone];
    const result = part && game.tap(part);
    if (!result) return;
    if (result === 'wrong') {
      sounds?.miss();
      say(pickLine(GAME_LINES.wrong), pet);
      return;
    }
    sounds?.note(SIMON_NOTE[part], pet);
    fx = { kind: 'touch', part, t: 0 };
    if (result === 'round') {
      sounds?.ding();
      say(pickLine(GAME_LINES.round), pet);
    }
  } else if (kind === 'paint') {
    if (!view.paint(clientX, clientY, game.state.color)) return;
    game.stroke();
    sounds?.pop();
    fx = { kind: 'paint', t: 0 };
    if (game.state.strokes % 4 === 1) say(pickLine(GAME_LINES.painted), pet);
    savePaint();
  } else if (kind === 'piano' || kind === 'match') {
    // These are played on their own keys and cards, not on the pet.
  } else if (kind === 'pop') {
    if (!zone?.startsWith('bubble')) return;
    // Each bubble on screen is drawn in the slot given by its id.
    const slot = Number(zone.slice(6));
    const bubble = game.state.bubbles.find((b) => b.id % POP.pool === slot);
    if (!bubble || !game.pop(bubble.id)) return;
    fx = { kind: 'pop', x: bubble.x, y: bubble.y, t: 0 };
    sounds?.pop();
  } else {
    const push = game.push();
    if (!push) return;
    sounds?.whoosh();
    if (push === 'perfect') fx = { kind: 'perfect', t: 0 };
  }
}

function renderHud() {
  if (!game) return;
  $('hud-score').textContent = game.state.score;
  if (game.state.kind === 'match') renderBoard();
  pianoKeys.forEach((key, i) => key.classList.toggle('next', game.state.kind === 'piano' && i === game.state.next));
  $('hud-time').style.transform = `scaleX(${game.state.left / game.state.seconds})`;
}

// Best scores are kept on this device only.
const bestKey = (kind) => `talking-pets:best:${kind}`;

function bestScore(kind) {
  try {
    return Number(localStorage.getItem(bestKey(kind))) || 0;
  } catch {
    return 0;
  }
}

function endGame() {
  const { kind, score } = game.state;
  const record = newRecord(score, bestScore(kind));
  if (record) {
    try {
      localStorage.setItem(bestKey(kind), String(score));
    } catch {
      // Private browsing: the record just isn't remembered.
    }
  }
  dispatch('gameOver', 'cheer', scoreLine(score, record));
}

$('hud-quit').addEventListener('click', () => dispatch('quit'));

// ----- Memory match: the cards -----

const board = $('board');
let boardShown = '';

// Redraw the cards, but only when something about them has changed.
function renderBoard() {
  const { cards } = game.state;
  const now = cards.map((card) => (card.matched ? 'm' : card.up ? 'u' : 'd') + card.face).join('');
  if (now === boardShown) return;
  boardShown = now;
  board.style.setProperty('--columns', cards.length <= 6 ? 3 : cards.length === 10 ? 5 : 4);
  board.innerHTML = cards.map((card, i) => {
    const state = card.matched ? 'matched' : card.up ? 'up' : 'down';
    return `<button type="button" class="card ${state}" data-card="${i}" aria-label="Card ${i + 1}">${card.up || card.matched ? card.face : '🐾'}</button>`;
  }).join('');
}

board.addEventListener('pointerdown', (e) => {
  const card = e.target.closest('[data-card]');
  if (!card || game?.state.kind !== 'match') return;
  const result = game.flip(Number(card.dataset.card));
  if (!result) return;
  if (result === 'flip') sounds?.blip();
  else if (result === 'miss') {
    sounds?.miss();
    fx = { kind: 'miss', t: 0 };
  } else {
    sounds?.ding();
    fx = { kind: 'match', t: 0 };
    say(pickLine(GAME_LINES.match), pet);
  }
  renderBoard();
});

// ----- Painting: the colours -----

const palette = $('palette');
palette.innerHTML =
  PALETTE.map((color) => `<button type="button" class="swatch" data-color="${color}" style="--color:${color}" aria-label="Colour"></button>`).join('') +
  '<button type="button" class="swatch wash" id="wash" aria-label="Wash the paint off">🧽</button>';

function showColor() {
  for (const swatch of palette.querySelectorAll('[data-color]')) swatch.classList.toggle('on', swatch.dataset.color === game?.state.color);
}

palette.addEventListener('click', (e) => {
  const swatch = e.target.closest('.swatch');
  if (!swatch || game?.state.kind !== 'paint') return;
  if (swatch.id === 'wash') {
    view.clearPaint();
    savePaint();
    sounds?.whoosh();
  } else {
    game.choose(swatch.dataset.color);
    sounds?.blip();
    showColor();
  }
});

// Each pet's paint is kept on this device, so it stays painted next time.
const paintKey = (id) => `talking-pets:paint:${id}`;

function savedPaint(id) {
  try {
    return JSON.parse(localStorage.getItem(paintKey(id))) ?? {};
  } catch {
    return {};
  }
}

function savePaint() {
  try {
    localStorage.setItem(paintKey(pet.id), JSON.stringify(view.getPaint()));
  } catch {
    // Private browsing: the paint just isn't remembered.
  }
}

pianoKeys.forEach((key, i) => {
  key.addEventListener('pointerdown', () => {
    if (game?.state.kind !== 'piano') return;
    const result = game.press(i);
    if (!result) return;
    sounds?.note(SCALE[i], pet);
    if (result === 'tune') sounds?.flourish();
    fx = { kind: 'note', key: i, right: result !== 'free', t: 0 };
  });
});

// ---------- Taps and buttons ----------

holder.addEventListener('pointerdown', (e) => {
  let zone = view.pick(e.clientX, e.clientY);
  if (state === 'playing') {
    gameTap(zone, e.clientX, e.clientY);
    return;
  }
  if (!zone) return;
  if (state === 'reacting' && detail === 'dizzy') return; // too dizzy to notice
  if (zone === 'head' && state !== 'sleeping') {
    ({ taps: headTaps, zone } = headPoke(headTaps, performance.now()));
  }
  dispatch('tap', zone);
});

// The pet watches your finger or mouse, and in the catching game runs after it.
holder.addEventListener('pointermove', (e) => {
  if (game?.state.kind === 'catch') game.steer(view.worldX(e.clientX));
  const rect = holder.getBoundingClientRect();
  view.setLook(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
});
holder.addEventListener('pointerleave', () => view.setLook(0, 0));

for (const button of actionButtons) {
  button.addEventListener('click', () => {
    if (button.id === 'sleep') dispatch('sleep');
    else if (button.id === 'dress') {
      accessory = (accessory + 1) % ACCESSORIES.length;
      view.setAccessory(ACCESSORIES[accessory]);
    } else if (button.dataset.game) dispatch('play', button.dataset.game);
    else dispatch('act', button.dataset.action);
  });
}

// Stop listening and go quiet while the app is in the background.
document.addEventListener('visibilitychange', () => {
  if (stage.hidden) return;
  if (document.hidden) {
    if (state !== 'sleeping') enter('idle');
    else quiet();
    clearInterval(micTimer);
    voice?.setEnabled(false);
  } else {
    openMic();
    if (state === 'sleeping') sounds?.startSnoring();
  }
});

// iPhones ignore the "no zoom" page setting, so block pinch and double-tap zoom here.
for (const type of ['gesturestart', 'gesturechange', 'dblclick']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
