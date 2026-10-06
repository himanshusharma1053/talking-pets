// The pet speaking its own lines out loud, using the device's built-in speech voice.
// Clarity comes first: a warm voice, spoken a little slowly, with only a gentle
// change of pitch between pets so young children can follow every word.

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;

export const canSpeak = Boolean(synth);

// Clear, friendly voices found on common devices, best first.
const PREFERRED = [/Samantha/i, /Google US English/i, /Microsoft (Aria|Jenny|Ava)/i, /Karen/i, /Moira/i, /Google UK English Female/i, /Microsoft (Zira|Hazel|Susan|Sonia|Libby)/i];

let voice = null;
function chooseVoice() {
  const english = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  voice = PREFERRED.map((name) => english.find((v) => name.test(v.name))).find(Boolean) ?? english[0] ?? null;
}
if (synth) {
  chooseVoice();
  // Many browsers only have their list of voices ready a moment after the page loads.
  synth.addEventListener?.('voiceschanged', chooseVoice);
}

// Say a line in this pet's voice, replacing anything it was already saying.
export function say(text, pet) {
  if (!synth) return;
  synth.cancel();
  const line = new SpeechSynthesisUtterance(text);
  if (voice) line.voice = voice;
  line.lang = voice?.lang ?? 'en-US';
  line.pitch = pet.speech.pitch;
  line.rate = pet.speech.rate;
  synth.speak(line);
}

export function hush() {
  synth?.cancel();
}

export function isSpeaking() {
  return Boolean(synth?.speaking);
}
