# Talking Pets

A pet that listens and repeats what you say in a funny voice. Pick a cat, dog, bunny or panda, poke it, feed it, give it milk, or put it to sleep. No ads, no tracking, and nothing you say leaves the device.

## Run it

```bash
npm start
```

Then open http://localhost:5173 and allow the microphone when asked.

The microphone only works on `localhost` or over HTTPS, so to use the app on a phone it needs to be hosted on an HTTPS site (GitHub Pages works). Once open there, it can be added to the home screen and used offline.

## Test it

```bash
npm test
```

## Layout

- `js/pets.js` — the pets (name, voice pitch, colours) and their SVG drawings. Add a pet here.
- `js/state.js` — what the pet is doing and which events change it.
- `js/vad.js` — detects when you start and stop talking.
- `js/voice.js` — microphone capture and pitched playback.
- `js/sounds.js` — synthesised sound effects.
- `js/app.js` — wires the screen to everything above.
