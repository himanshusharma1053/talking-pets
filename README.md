# Talking Pets

A 3D pet that listens and repeats what you say in a funny voice. Pick a cat, dog, bunny, panda, fox, monkey, penguin or unicorn. No ads, no tracking, and nothing you say leaves the device.

What comes next is in [ROADMAP.md](ROADMAP.md).

## What the pet does

- **Talks back:** say something and it repeats it in its own voice.
- **Reacts to pokes:** head, belly, tail and feet each do something different. Poke the head three times quickly and it gets dizzy.
- **Games:** two 30-second games with a star score and a best score kept on the device. In boxing, tap the pads as they pop up and the pet punches them. On the swing, tap to push and swing high enough to ring the bell.
- **Buttons:** feed, milk (with a burp), ball, pie in the face, trampoline, bubbles, dance, toot, dress up (party hat, crown, sunglasses, bow tie) and sleep.
- **Speaks:** it says its reactions aloud using the device's speech voice, so there is nothing to read.
- **Watches you:** its head and eyes follow your finger or mouse.

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

- `js/pets.js` — the pets: name, voice pitch, colours.
- `js/pet3d.js` — builds each pet's 3D model and animates it.
- `js/actions.js` — the buttons and pokes: how long each lasts and what the pet says.
- `js/speech.js` — the pet speaking its lines.
- `js/games.js` — the rules of the mini-games.
- `js/state.js` — what the pet is doing and which events change it.
- `js/vad.js` — detects when you start and stop talking.
- `js/voice.js` — microphone capture and pitched playback.
- `js/sounds.js` — synthesised sound effects.
- `js/app.js` — wires the screen to everything above.
- `vendor/` — a copy of [three.js](https://threejs.org) (MIT licence), so the app needs no build step and works offline.
