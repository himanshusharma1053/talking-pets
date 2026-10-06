import { PETS, findPet } from './pets.js';
import { nextState, micOpen } from './state.js';
import { ACTIONS, REACTIONS, ACCESSORIES, CUES, headPoke } from './actions.js';
import { createSounds } from './sounds.js';
import { createVoice, playSamples } from './voice.js';
import { createPetView, renderThumbnails } from './pet3d.js';

const MIC_REOPEN_MS = 350; // keep the mic shut briefly after the pet makes a sound

// The sound that goes with each poke and each button.
const SOUNDS = {
  head: (s, pet) => s.call(pet, 'ouch'),
  belly: (s, pet) => s.call(pet, 'giggle'),
  tail: (s, pet) => s.call(pet, 'yowl'),
  feet: (s, pet) => s.call(pet, 'happy'),
  dizzy: (s, pet) => {
    s.twinkle();
    s.call(pet, 'woozy');
  },
  feed: (s) => s.munch(),
  milk: (s) => {
    s.slurp();
    s.burp(CUES.burp);
  },
  ball: (s, pet) => {
    s.boing(CUES.ballHit);
    s.call(pet, 'ouch', CUES.ballHit + 0.1);
  },
  pie: (s, pet) => {
    s.whoosh();
    s.splat(CUES.pieHit);
    s.call(pet, 'giggle', CUES.pieHit + 1.3);
  },
  dance: (s) => s.dance(),
  toot: (s, pet) => {
    s.toot(CUES.toot);
    s.call(pet, 'giggle', CUES.toot + 0.7);
  },
};

const $ = (id) => document.getElementById(id);
const picker = $('picker');
const stage = $('stage');
const holder = $('pet-holder');
const statusEl = $('status');
const micNotice = $('mic-notice');
const actionButtons = [...document.querySelectorAll('.actions button')];

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

// ---------- Pet picker ----------

const CARD_COLORS = { cat: '#ffe3bd', dog: '#f6dcc4', bunny: '#ffdfe6', panda: '#dff0e4' };

let thumbnails = {};
try {
  thumbnails = renderThumbnails(PETS);
} catch {
  // No 3D on this device: the cards fall back to emoji.
}

$('pet-grid').innerHTML = PETS.map((p) => {
  const picture = thumbnails[p.id]
    ? `<img src="${thumbnails[p.id]}" alt="" width="240" height="300">`
    : `<span class="pet-emoji">${p.emoji}</span>`;
  return `
  <button class="pet-card" type="button" data-pet="${p.id}" style="--card:${CARD_COLORS[p.id]}">
    ${picture}
    <strong>${p.name}</strong>
    <small>${p.kind} · ${p.blurb}</small>
  </button>`;
}).join('');

$('pet-grid').addEventListener('click', (e) => {
  const card = e.target.closest('[data-pet]');
  if (card) choosePet(card.dataset.pet);
});

$('change-pet').addEventListener('click', () => {
  quiet();
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
  return { setState: nothing, setMouth: nothing, setLook: nothing, setAccessory: nothing, dispose: nothing, pick: () => 'belly' };
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
  enter('idle');
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
    voice.setEnabled(!stage.hidden && micOpen(state));
    micNotice.hidden = true;
  } catch {
    micNotice.hidden = false;
  }
  render();
}

$('mic-retry').addEventListener('click', connectMic);

// ---------- Pet behaviour ----------

function dispatch(event, payload) {
  const to = nextState(state, event);
  if (to) enter(to, payload);
}

// Stop whatever the pet is doing right now.
function quiet() {
  clearTimeout(timer);
  playback?.stop();
  playback = null;
  sounds?.stopAll();
}

function enter(to, payload) {
  quiet();
  state = to;
  detail = to === 'reacting' || to === 'acting' ? payload : null;
  voice?.setEnabled(micOpen(to), MIC_REOPEN_MS);
  view.setMouth(0);
  view.setState(to, detail);

  const finish = () => dispatch('done');
  switch (to) {
    case 'talking':
      playback = playSamples(ctx, payload, pet.pitch, { onLevel: view.setMouth, onDone: finish });
      break;
    case 'reacting':
    case 'acting':
      if (sounds) SOUNDS[detail](sounds, pet);
      timer = setTimeout(finish, (to === 'acting' ? ACTIONS : REACTIONS)[detail].ms);
      break;
    case 'sleeping':
      sounds?.startSnoring();
      break;
  }
  render();
}

function statusText() {
  switch (state) {
    case 'listening': return 'Listening…';
    case 'talking': return `${pet.name} says…`;
    case 'reacting': return REACTIONS[detail].text;
    case 'acting': return ACTIONS[detail].text;
    case 'sleeping': return 'Zzz… tap to wake';
    default: return voice ? 'Say something!' : `Tap ${pet.name}!`;
  }
}

function render() {
  if (!pet) return;
  const asleep = state === 'sleeping';
  stage.dataset.state = state;
  statusEl.textContent = statusText();
  $('sleep-label').textContent = asleep ? 'Wake' : 'Sleep';
  $('sleep-emoji').textContent = asleep ? '☀️' : '🌙';
  for (const button of actionButtons) button.disabled = asleep && button.id !== 'sleep';
}

holder.addEventListener('pointerdown', (e) => {
  let zone = view.pick(e.clientX, e.clientY);
  if (!zone) return;
  if (state === 'reacting' && detail === 'dizzy') return; // too dizzy to notice
  if (zone === 'head' && state !== 'sleeping') {
    ({ taps: headTaps, zone } = headPoke(headTaps, performance.now()));
  }
  dispatch('tap', zone);
});

// The pet watches your finger or mouse.
holder.addEventListener('pointermove', (e) => {
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
    } else dispatch('act', button.dataset.action);
  });
}

// Stop listening and go quiet while the app is in the background.
document.addEventListener('visibilitychange', () => {
  if (stage.hidden) return;
  if (document.hidden) {
    if (state !== 'sleeping') enter('idle');
    else sounds?.stopAll();
    voice?.setEnabled(false);
  } else {
    voice?.setEnabled(micOpen(state), MIC_REOPEN_MS);
    if (state === 'sleeping') sounds?.startSnoring();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
