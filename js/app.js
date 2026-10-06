import { PETS, findPet, renderPet } from './pets.js';
import { nextState, micOpen } from './state.js';
import { createSounds } from './sounds.js';
import { createVoice, playSamples } from './voice.js';

const REACTIONS = {
  head: { sound: 'ouch', ms: 1200, text: 'Ouch!' },
  belly: { sound: 'giggle', ms: 1200, text: 'Hee hee!' },
  tail: { sound: 'yowl', ms: 1000, text: 'Yeow!' },
  feet: { sound: 'happy', ms: 800, text: 'Boing!' },
};
const CARE_MS = 2600;
const MIC_REOPEN_MS = 350; // keep the mic shut briefly after the pet makes a sound

const $ = (id) => document.getElementById(id);
const picker = $('picker');
const stage = $('stage');
const holder = $('pet-holder');
const statusEl = $('status');
const micNotice = $('mic-notice');
const actionButtons = [...document.querySelectorAll('.actions button')];

let pet = null;
let petEl = null;
let state = 'idle';
let zone = null;
let ctx = null;
let sounds = null;
let voice = null;
let playback = null;
let timer = null;

// ---------- Pet picker ----------

const CARD_COLORS = { cat: '#ffe3bd', dog: '#f6dcc4', bunny: '#ffdfe6', panda: '#dff0e4' };

$('pet-grid').innerHTML = PETS.map(
  (p) => `
  <button class="pet-card" type="button" data-pet="${p.id}" style="--card:${CARD_COLORS[p.id]}">
    ${renderPet(p)}
    <strong>${p.name}</strong>
    <small>${p.kind} · ${p.blurb}</small>
  </button>`,
).join('');

$('pet-grid').addEventListener('click', (e) => {
  const card = e.target.closest('[data-pet]');
  if (card) choosePet(card.dataset.pet);
});

$('change-pet').addEventListener('click', () => {
  quiet();
  voice?.setEnabled(false);
  stage.hidden = true;
  picker.hidden = false;
});

function choosePet(id) {
  pet = findPet(id);
  holder.innerHTML = renderPet(pet);
  petEl = holder.firstElementChild;
  $('pet-name').textContent = pet.name;
  $('feed-emoji').textContent = pet.food;
  picker.hidden = true;
  stage.hidden = false;
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

function dispatch(event, detail) {
  const to = nextState(state, event);
  if (to) enter(to, detail);
}

// Stop whatever the pet is doing right now.
function quiet() {
  clearTimeout(timer);
  playback?.stop();
  playback = null;
  sounds?.stopAll();
}

function enter(to, detail) {
  quiet();
  state = to;
  zone = to === 'reacting' ? detail : null;
  voice?.setEnabled(micOpen(to), MIC_REOPEN_MS);

  // Reset the classes and force a reflow so a repeated animation restarts.
  petEl.setAttribute('class', `pet pet-${pet.id}`);
  petEl.getBoundingClientRect();
  petEl.classList.add(`is-${to}`);
  setMouth(0);

  const finish = () => dispatch('done');
  switch (to) {
    case 'talking':
      playback = playSamples(ctx, detail, pet.pitch, { onLevel: setMouth, onDone: finish });
      break;
    case 'reacting':
      petEl.classList.add(`react-${zone}`);
      sounds?.call(pet, REACTIONS[zone].sound);
      timer = setTimeout(finish, REACTIONS[zone].ms);
      break;
    case 'eating':
      sounds?.munch();
      timer = setTimeout(finish, CARE_MS);
      break;
    case 'drinking':
      sounds?.slurp();
      timer = setTimeout(finish, CARE_MS);
      break;
    case 'sleeping':
      sounds?.startSnoring();
      break;
  }
  render();
}

function setMouth(level) {
  petEl.style.setProperty('--mouth', level.toFixed(2));
}

function statusText() {
  switch (state) {
    case 'listening': return 'Listening…';
    case 'talking': return `${pet.name} says…`;
    case 'reacting': return REACTIONS[zone].text;
    case 'eating': return 'Yum!';
    case 'drinking': return 'Slurp!';
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
  for (const button of actionButtons) {
    button.disabled = asleep && button.dataset.event !== 'sleep';
  }
}

holder.addEventListener('pointerdown', (e) => {
  const tapped = e.target.closest('[data-zone]');
  if (tapped) dispatch('tap', tapped.dataset.zone);
});

for (const button of actionButtons) {
  button.addEventListener('click', () => dispatch(button.dataset.event));
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
