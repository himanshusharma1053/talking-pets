// The pets you can choose. Their 3D models are built in pet3d.js from this data.

export const PETS = [
  {
    id: 'cat',
    name: 'Miso',
    kind: 'Cat',
    emoji: '🐱',
    blurb: 'Squeaky and sassy',
    pitch: 1.6,
    food: '🐟',
    voice: { wave: 'sawtooth', pitch: 700 },
    colors: { fur: '#f29a2e', dark: '#c96a12', belly: '#fff1dc', limb: '#f29a2e', inner: '#ffb3bd', nose: '#e8707e' },
  },
  {
    id: 'dog',
    name: 'Biscuit',
    kind: 'Dog',
    emoji: '🐶',
    blurb: 'Loud and loyal',
    pitch: 1.25,
    food: '🦴',
    voice: { wave: 'square', pitch: 280 },
    colors: { fur: '#c98a52', dark: '#7a4a28', belly: '#f8e6cf', limb: '#c98a52', inner: '#7a4a28', nose: '#2b2020' },
  },
  {
    id: 'bunny',
    name: 'Clover',
    kind: 'Bunny',
    emoji: '🐰',
    blurb: 'Tiny chipmunk voice',
    pitch: 1.9,
    food: '🥕',
    voice: { wave: 'sine', pitch: 1100 },
    colors: { fur: '#f3ece4', dark: '#d9cdbf', belly: '#ffffff', limb: '#f3ece4', inner: '#f7a8ba', nose: '#f08fa3' },
  },
  {
    id: 'panda',
    name: 'Dumpling',
    kind: 'Panda',
    emoji: '🐼',
    blurb: 'Slow, deep rumble',
    pitch: 0.82,
    food: '🎋',
    voice: { wave: 'triangle', pitch: 200 },
    colors: { fur: '#f6f5f0', dark: '#2a2a30', belly: '#f6f5f0', limb: '#2a2a30', inner: '#2a2a30', nose: '#2a2a30' },
  },
];

export function findPet(id) {
  return PETS.find((pet) => pet.id === id) ?? PETS[0];
}
