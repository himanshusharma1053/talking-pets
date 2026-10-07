# Talking Pets

A 3D pet that listens and repeats what you say in a funny voice. Pick a cat, dog, bunny, panda, fox, monkey, penguin or unicorn. No ads, no tracking, and nothing you say leaves the device.

What comes next is in [ROADMAP.md](ROADMAP.md).

## What the pet does

- **Talks back:** say something and it repeats it in its own voice.
- **Reacts to pokes:** head, belly, tail and feet each do something different. Poke the head three times quickly and it gets dizzy.
- **Games:** eight short games, each with a star score and a best score kept on the device.
  - Boxing: tap the pads as they pop up and the pet punches them.
  - Swing: tap to push, and swing high enough to ring the bell.
  - Catch: drag the pet left and right to catch falling food, and dodge the socks.
  - Bubbles: the pet blows bubbles; tap to pop them. Golden ones are worth three.
  - Football: take penalties against the pet in goal. Tap where you want to shoot.
  - Piano: eight coloured keys. The next key of a well-known tune lights up; press it for a star.
  - Hide and seek: the pet hides behind a crate, a bush or a present and peeks out now and then. Tap where it is.
  - Copy me (Simon says): the pet touches its head, tummy and feet in some order. Tap them back in the same order; each round is one move longer.
- **Buttons:** feed, milk (with a burp), ball, pie in the face, trampoline, dance, toot, dress up (party hat, crown, sunglasses, bow tie) and sleep.
- **Speaks:** it says its reactions aloud using the device's speech voice, so there is nothing to read. Voices are kept gentle and a little slow so young children can follow them.
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
- `js/sounds.js` — sound effects and instruments. Taps, pops, punches, bells and jingles are recordings; the piano, music and silly noises are made in the browser.
- `sounds/` — the recordings, from Kenney's free CC0 asset packs (see `sounds/LICENSE.txt`). Replace a file to change that sound.
- `js/app.js` — wires the screen to everything above.
- `vendor/` — a copy of [three.js](https://threejs.org) (MIT licence), so the app needs no build step and works offline.
