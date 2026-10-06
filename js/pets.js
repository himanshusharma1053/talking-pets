// The pets you can choose, and the SVG drawing for each one.
// All pets share one body rig so every animation works for every pet.

export const ZONES = ['head', 'belly', 'tail', 'feet'];

export const PETS = [
  {
    id: 'cat',
    name: 'Miso',
    kind: 'Cat',
    blurb: 'Squeaky and sassy',
    pitch: 1.6,
    food: '🐟',
    voice: { wave: 'sawtooth', pitch: 700 },
    colors: { fur: '#f6a03c', dark: '#d97c1e', belly: '#fff1dc', limb: '#f6a03c', inner: '#ffc2c9', nose: '#e8707e' },
  },
  {
    id: 'dog',
    name: 'Biscuit',
    kind: 'Dog',
    blurb: 'Loud and loyal',
    pitch: 1.25,
    food: '🦴',
    voice: { wave: 'square', pitch: 280 },
    colors: { fur: '#d2955f', dark: '#8a5630', belly: '#f8e6cf', limb: '#d2955f', inner: '#8a5630', nose: '#3b2b28' },
  },
  {
    id: 'bunny',
    name: 'Clover',
    kind: 'Bunny',
    blurb: 'Tiny chipmunk voice',
    pitch: 1.9,
    food: '🥕',
    voice: { wave: 'sine', pitch: 1100 },
    colors: { fur: '#f7f1ea', dark: '#d9cdbf', belly: '#ffffff', limb: '#f7f1ea', inner: '#f7b6c4', nose: '#f08fa3' },
  },
  {
    id: 'panda',
    name: 'Dumpling',
    kind: 'Panda',
    blurb: 'Slow, deep rumble',
    pitch: 0.82,
    food: '🎋',
    voice: { wave: 'triangle', pitch: 200 },
    colors: { fur: '#fbfbf7', dark: '#2f2f35', belly: '#fbfbf7', limb: '#2f2f35', inner: '#2f2f35', nose: '#2f2f35' },
  },
];

export function findPet(id) {
  return PETS.find((pet) => pet.id === id) ?? PETS[0];
}

// Draw a shape on the left and mirror it onto the right.
const both = (svg) => `${svg}<g transform="translate(300 0) scale(-1 1)">${svg}</g>`;

const WHISKERS = both(
  '<path class="whisker" d="M104 146 L62 138 M104 153 L60 156 M106 160 L66 172"/>',
);

// The parts that differ between animals. Everything else is shared.
const PARTS = {
  cat: {
    tail: '<path class="tail-outline" d="M196 302 C262 304 268 232 240 198"/><path class="tail-fill" d="M196 302 C262 304 268 232 240 198"/>',
    earsBack: both('<polygon class="fur o" points="86,98 72,24 140,66"/><polygon class="inner" points="93,84 85,44 122,68"/>'),
    earsFront: '',
    face: `<path class="marking" d="M150 64 V84 M132 68 L136 84 M168 68 L164 84"/>${WHISKERS}`,
    teeth: '',
  },
  dog: {
    tail: '<path class="tail-outline" d="M196 292 C232 288 244 262 236 240"/><path class="tail-fill" d="M196 292 C232 288 244 262 236 240"/>',
    earsBack: '',
    earsFront: both('<ellipse class="dark o" cx="74" cy="124" rx="22" ry="50" transform="rotate(14 74 124)"/>'),
    face: '<ellipse class="dark soft" cx="182" cy="118" rx="27" ry="30"/><ellipse class="belly" cx="150" cy="156" rx="38" ry="28"/>',
    teeth: '',
  },
  bunny: {
    tail: '<circle class="belly o" cx="208" cy="304" r="18"/>',
    earsBack: both('<g transform="rotate(-7 118 92)"><ellipse class="fur o" cx="118" cy="36" rx="20" ry="58"/><ellipse class="inner" cx="118" cy="40" rx="9" ry="42"/></g>'),
    earsFront: '',
    face: WHISKERS,
    teeth: '<rect class="tooth" x="143" y="156" width="14" height="11" rx="2"/><path class="tooth-gap" d="M150 156 V167"/>',
  },
  panda: {
    tail: '<circle class="dark o" cx="206" cy="308" r="14"/>',
    earsBack: both('<circle class="dark o" cx="92" cy="72" r="27"/>'),
    earsFront: '',
    face: both('<ellipse class="dark" cx="118" cy="122" rx="23" ry="28" transform="rotate(18 118 122)"/>'),
    teeth: '',
  },
};

export function renderPet(pet) {
  const parts = PARTS[pet.id];
  const c = pet.colors;
  const vars = `--fur:${c.fur};--fur-dark:${c.dark};--belly:${c.belly};--limb:${c.limb};--inner:${c.inner};--nose:${c.nose}`;

  return `
<svg class="pet pet-${pet.id}" viewBox="0 -30 300 400" style="${vars}" role="img" aria-label="${pet.name} the ${pet.kind.toLowerCase()}">
  <ellipse class="shadow" cx="150" cy="352" rx="92" ry="12"/>
  <g class="whole">
    <g class="tail" data-zone="tail">${parts.tail}</g>
    <g class="feet" data-zone="feet">
      ${both('<ellipse class="limb o" cx="114" cy="340" rx="31" ry="17"/>')}
    </g>
    <g class="torso" data-zone="belly">
      <ellipse class="limb o arm arm-left" cx="88" cy="256" rx="16" ry="34" transform="rotate(14 88 256)"/>
      <ellipse class="fur o" cx="150" cy="270" rx="70" ry="80"/>
      <ellipse class="belly" cx="150" cy="286" rx="44" ry="54"/>
      <g class="arm-right"><ellipse class="limb o arm" cx="212" cy="256" rx="16" ry="34" transform="rotate(-14 212 256)"/></g>
    </g>
    <g class="head" data-zone="head">
      ${parts.earsBack}
      <ellipse class="fur o" cx="150" cy="130" rx="78" ry="68"/>
      ${parts.face}
      ${parts.earsFront}
      ${both('<circle class="cheek" cx="98" cy="150" r="10"/>')}
      <g class="eyes-open">
        ${both('<ellipse class="eye-white" cx="120" cy="120" rx="15" ry="18"/><circle class="pupil" cx="122" cy="122" r="9"/><circle class="glint" cx="125" cy="118" r="3"/>')}
      </g>
      <g class="eyes-closed">
        ${both('<path class="lid" d="M106 120 Q120 132 134 120"/>')}
      </g>
      <path class="nose" d="M141 140 Q150 135 159 140 Q150 153 141 140Z"/>
      <path class="smile" d="M136 154 Q143 164 150 154 Q157 164 164 154"/>
      <g class="mouth-open">
        <ellipse class="mouth-hole" cx="150" cy="167" rx="15" ry="14"/>
        <ellipse class="tongue" cx="150" cy="174" rx="9" ry="6"/>
      </g>
      ${parts.teeth}
    </g>
    <text class="prop prop-food" x="150" y="232" text-anchor="middle">${pet.food}</text>
    <text class="prop prop-milk" x="150" y="232" text-anchor="middle">🥛</text>
    <text class="prop prop-zzz" x="236" y="62" text-anchor="middle">z Z z</text>
  </g>
</svg>`;
}
