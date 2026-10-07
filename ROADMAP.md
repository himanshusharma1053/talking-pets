# Talking Pets roadmap

The goal: a pet app kids come back to, shipped first as an installable web app (PWA) and then on Google Play. No ads, no accounts, nothing recorded leaves the device.

## Where it is now

- Eight pets: cat, dog, bunny, panda, fox, monkey, penguin, unicorn.
- Talk-back: the pet repeats what you say in its own voice.
- Pokes: head, belly, tail, feet, and a dizzy spell after three head pokes.
- Nine games with scores: boxing, the swing, catch the food, bubble pop, football penalties, piano, hide and seek, Simon says and memory match.
- Free play with no clock: painting the pet, a dress-up wardrobe and bath time.
- Eight buttons: feed, milk, ball, pie, trampoline, dance, toot, sleep.
- The pet speaks its reactions aloud; there are no captions to read.
- Installable, works offline.

## Next: make each visit a game (4 to 6 weeks of evenings)

These turn "press a button and watch" into things kids actually play.

1. **Boxing and the swing are built.** Still to add: streak bonuses in boxing, and swiping (not just tapping) to push the swing.
2. **Difficulty by age.** An easy mode with slower pads and a gentler swing for the youngest.
3. **Catch the food and bubble pop are built.** Still to add: surprises inside some bubbles.
5. **Football penalties and piano are built.** Still to add: swiping to shoot, drums, and more tunes.
7. **Hide and seek and Simon says are built.** Still to add: more hiding places as it gets harder, and more moves (wave, spin, clap).

## Then: reasons to come back tomorrow

1. **Looking after the pet.** Hunger, sleep, cleanliness and fun meters that fall slowly. Bath time (soap, shower, towel), tooth brushing, potty.
2. **Stars and a sticker book.** Every game earns stars; stars unlock stickers, outfits and room items. Never bought with money.
3. **Wardrobe.** Hats, glasses, outfits and shoes, chosen from a picture grid instead of cycling one button.
4. **Rooms.** Bedroom, kitchen, bathroom, garden and playground. The swing and trampoline live in the playground.
5. **Day and night.** The room follows the real clock; the pet yawns at bedtime.
6. **Daily surprise.** One wrapped present a day.
7. **Friends.** Two pets on screen who talk to each other and repeat what the other said.
8. **Record and share.** Save a short clip of the pet saying your message. Needs a grown-up gate (see below).

## The look

The pets are built in code from simple shapes. That gets to "nice plush toy" and no further. Characters like the ones in Talking Tom or an animated film are sculpted, textured and rigged by a 3D artist. To get there:

- **Commission** a character artist for one hero pet first (roughly 300 to 1,500 USD for a rigged, animated game character), then the rest once the style is right.
- **Or license** a ready-made animated animal pack from an asset store, checking the licence allows a published app.
- The app can load these as standard `.glb` files in place of the built-in models; the animation and game code stays.

Sound: taps, pops, punches, bells and jingles are now recordings (Kenney, CC0). Still generated in the app: the burp, toot, boing, munching, slurping and snoring, which need a cartoon sound pack. Also worth doing: a recorded child-friendly voice actor for the pet's lines in place of the device's speech voice. Any audio added needs a licence that allows publishing it in an app.

## Launching on Android

A PWA can be published on Google Play as a Trusted Web Activity, which wraps the hosted site in a thin Android app.

1. **Own domain.** Move from the GitHub address to a domain you control; the Android app is tied to it.
2. **Pass the install checks.** Icons, offline support and manifest are in place. Run Lighthouse and fix anything it flags.
3. **Build the Android package** with Bubblewrap or PWABuilder, and publish the `assetlinks.json` file that proves the site and app belong together.
4. **Play Console account.** One-off 25 USD fee and identity verification. New personal accounts must run a closed test with at least 12 testers for 14 days before going public.
5. **Kids' rules.** An app aimed at children must follow Google's Families policy:
   - A privacy policy page. Ours is simple: the microphone is used only to play your voice back; nothing is stored or sent.
   - The Data safety form, declaring that no data is collected.
   - A content rating questionnaire and a declared target age group.
   - No links out of the app, and a grown-up gate in front of anything that shares or leaves the app.
6. **Store listing.** Name, icon, screenshots, a short video. Check the name is not already a trademark; "Talking Pets" is generic and may be taken.

iPhone and iPad already work through "Add to Home Screen". The App Store proper needs a native wrapper and a paid Apple developer account, so it comes after Android.

## Known gaps to close before any launch

- Talk-back, sounds and spoken lines have not been tested on real phones across brands.
- No settings yet: volume, mute, and a way for a parent to switch the microphone off.
- The 3D library is large; first load on a slow connection needs a loading screen.
- No tests yet for the 3D code or the audio path.
