// The pet speaking its own lines out loud, using the device's built-in speech voice.

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;

export const canSpeak = Boolean(synth);

// Say a line in this pet's voice, replacing anything it was already saying.
export function say(text, pet) {
  if (!synth) return;
  synth.cancel();
  const line = new SpeechSynthesisUtterance(text);
  line.lang = 'en-US';
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
