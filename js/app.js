import { PETS, findPet } from './pets.js';
import { nextState, micOpen } from './state.js';
import { ACTIONS, REACTIONS, GREETINGS, ACCESSORIES, CUES, headPoke, pickLine } from './actions.js';
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
  feed: (s) => s.munch(),
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
  swing: (s) => s.swing(CUES.swing),
  boxing: (s) => s.punches(CUES.jab, Math.floor((ACTIONS.boxing.ms / 1000 - 0.9) / CUES.jab)),
  bubbles: (s) => s.bubbles(),
  trampoline: (s) => s.bounces(CUES.bounce, Math.round(ACTIONS.trampoline.ms / 1000 / CUES.bounce)),
};

const $ = (id) => document.getElementById(id);
const picker = $('picker');
const stage = $('stage');
const holder = $('pet-holder');
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
let micTimer = null;

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

function dispatch(event, payload) {
  const from = state;
  const to = nextState(state, event);
  if (!to) return;
  if (event === 'sleep') payload = to === 'sleeping' ? GREETINGS.sleep : GREETINGS.wake;
  if (event === 'tap' && from === 'sleeping') payload = GREETINGS.wake;
  enter(to, payload);
}

// Stop whatever the pet is doing right now.
function quiet() {
  clearTimeout(timer);
  playback?.stop();
  playback = null;
  sounds?.stopAll();
  hush();
}

// `payload` depends on the activity: the part poked, the button pressed,
// the recording to play back, or lines to say when going to sleep or waking.
function enter(to, payload) {
  quiet();
  state = to;
  detail = to === 'reacting' || to === 'acting' ? payload : null;
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
      lines = entry.say;
      if (sounds) SOUNDS[detail](sounds, pet);
      timer = setTimeout(finish, entry.ms);
      break;
    }
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
  $('sleep-emoji').textContent = asleep ? '☀️' : '🌙';
  $('sleep').setAttribute('aria-label', asleep ? 'Wake' : 'Sleep');
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
