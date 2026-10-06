// The 3D pet: builds a plush-toy model for each pet and animates it.

import * as THREE from '../vendor/three.module.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { ACTIONS, CUES } from './actions.js';
import { FOODS, YUCKS, POP } from './games.js';

const CLOSED = 0.08; // eye height when shut
const TWO_PI = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const arc = (p) => (p <= 0 || p >= 1 ? 0 : 4 * p * (1 - p)); // 0 → 1 → 0, for jumps

// How each moving part chases the pose it is asked for: [speed, bounce].
// Speed is how quickly it gets there. Bounce below 1 lets it overshoot a little
// and settle, which is what makes the pet feel soft instead of mechanical.
const FOLLOW = [40, 1]; // keeps up closely with no bounce, for things driven by exact paths
const SPRINGS = {
  headRx: [22, 0.5],
  headRy: [22, 0.5],
  headRz: [22, 0.5],
  armL: [20, 0.5],
  armR: [20, 0.5],
  armLx: [26, 0.6],
  armRx: [26, 0.6],
  squash: [24, 0.35],
  rz: [16, 0.5],
  eyeSize: [24, 0.5],
  cheek: [22, 0.45],
  eyes: [50, 1],
  mouth: [45, 0.85],
  pupilX: [30, 0.8],
  pupilY: [30, 0.8],
  wag: [8, 1],
  ears: [13, 0.25], // floppy
};
const limit = (value, most) => Math.max(-most, Math.min(most, value));

// Move every spring a step closer to its target. Small sub-steps keep it stable.
function chase(springs, targets, dt) {
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / steps;
  for (const key in targets) {
    const [speed, bounce] = SPRINGS[key] ?? FOLLOW;
    const spring = springs[key];
    for (let i = 0; i < steps; i++) {
      spring.v += (speed * speed * (targets[key] - spring.x) - 2 * bounce * speed * spring.v) * h;
      spring.x += spring.v * h;
    }
  }
}

// The arm angle at which food and drink are held up to the face.
const HOLD_ANGLE = 2.0;
const ACTIONS_MILK_END = ACTIONS.milk.ms / 1000;

// The swing hangs from a point above the top of the screen.
const SWING_TOP = 6.3;
const SWING_LENGTH = 6;

// Where boxing pads appear around the pet: [x, y], all a little in front of it.
const PAD_SLOTS = [[-1.2, 3.6], [1.2, 3.6], [-1.3, 2.4], [1.3, 2.4], [-1.15, 1.1], [1.15, 1.1]];

// How far the camera pulls back for each game (0 = the normal view).
const GAME_ZOOM = { swing: 1, catch: 0.6, pop: 0.35 };

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

// A flat picture that always faces the camera, drawn from an emoji or a letter.
function textSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.font = color ? '900 100px system-ui, sans-serif' : `96px ${EMOJI_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (color) g.fillStyle = color;
  g.fillText(text, 64, 70);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
  sprite.visible = false;
  return sprite;
}

function buildPet(pet) {
  const c = pet.colors;
  // Soft, matte fur. Kept simple so it draws quickly on phones and tablets.
  const plush = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
  const glossy = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.06 });
  const matte = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const flat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
  const M = {
    fur: plush(c.fur),
    dark: plush(c.dark),
    belly: plush(c.belly),
    limb: plush(c.limb),
    inner: plush(c.inner),
    nose: glossy(c.nose),
    eye: glossy('#ffffff'),
    iris: glossy(c.iris),
    pupil: glossy('#120c0a'),
    mouth: matte('#5a1a26'),
    tongue: matte('#ff8fa0'),
    line: matte('#3b2b28'),
    white: matte('#ffffff'),
    feet: c.feet ? plush(c.feet) : null,
    red: matte('#e63946'),
    gold: new THREE.MeshStandardMaterial({ color: '#ffc531', roughness: 0.3, metalness: 0.35, emissive: '#6b4a00' }),
  };

  const sphere = new THREE.SphereGeometry(1, 32, 22);
  const add = (parent, mesh, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.castShadow = !mesh.material.isMeshBasicMaterial;
    parent.add(mesh);
    return mesh;
  };
  const blob = (parent, material, radius, pos, scale = [1, 1, 1], rot) => {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.scale.set(radius * scale[0], radius * scale[1], radius * scale[2]);
    return add(parent, mesh, pos, rot);
  };
  const cone = (parent, material, radius, height, pos, rot) =>
    add(parent, new THREE.Mesh(new THREE.ConeGeometry(radius, height, 28), material), pos, rot);
  const group = (parent, pos = [0, 0, 0], zone) => {
    const g = new THREE.Group();
    g.position.set(...pos);
    if (zone) g.userData.zone = zone;
    parent.add(g);
    return g;
  };
  const sides = (fn) => [-1, 1].map(fn);

  const root = new THREE.Group();

  // ----- Body -----
  const feet = group(root, [0, 0, 0], 'feet');
  sides((s) => {
    blob(feet, M.feet ?? M.limb, 0.34, [s * 0.42, 0.2, 0.3], [1, 0.6, 1.35]);
    for (const toe of [-0.16, 0, 0.16]) blob(feet, M.feet ?? M.limb, 0.11, [s * 0.42 + toe, 0.2, 0.72 - Math.abs(toe) * 0.4], [1, 0.9, 1]);
  });

  const tail = group(root, [0, 0.75, -0.65], 'tail');
  const tube = (points, radius, material = M.fur) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    add(tail, new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 12), material));
    blob(tail, material, radius, points.at(-1));
  };
  if (pet.id === 'cat') tube([[0, 0, 0], [0.55, 0.05, -0.3], [1.0, 0.5, -0.35], [1.0, 1.1, -0.25], [0.75, 1.45, -0.15]], 0.13);
  if (pet.id === 'dog') tube([[0, 0, 0], [0.5, 0.3, -0.25], [0.85, 0.9, -0.2]], 0.12);
  if (pet.id === 'bunny') blob(tail, M.belly, 0.3, [0.6, 0.05, 0.25]);
  if (pet.id === 'panda') blob(tail, M.dark, 0.22, [0.64, 0, 0.3]);
  if (pet.id === 'fox') {
    tube([[0, 0, 0], [0.6, 0.1, -0.3], [1.1, 0.6, -0.3], [1.15, 1.2, -0.2]], 0.22);
    blob(tail, M.belly, 0.27, [1.15, 1.32, -0.2]);
  }
  if (pet.id === 'monkey') tube([[0, 0, 0], [0.6, 0, -0.3], [1.1, 0.4, -0.3], [1.25, 1.0, -0.2], [0.95, 1.4, -0.1], [0.7, 1.15, -0.1]], 0.09);
  if (pet.id === 'penguin') blob(tail, M.dark, 0.2, [0.5, -0.2, 0.2]);
  if (pet.id === 'unicorn') tube([[0, 0, 0], [0.6, 0.3, -0.3], [1.05, 0.2, -0.2], [1.25, -0.3, -0.1]], 0.17, M.dark);

  const torso = group(root, [0, 0, 0], 'belly');
  const outline = [[0.02, 0.3], [0.5, 0.33], [0.8, 0.62], [0.88, 1.0], [0.8, 1.45], [0.62, 1.85], [0.45, 2.08], [0.02, 2.2]];
  const profile = new THREE.SplineCurve(outline.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(36);
  for (const point of profile) point.x = Math.max(0.01, point.x);
  add(torso, new THREE.Mesh(new THREE.LatheGeometry(profile, 36), M.fur)).scale.z = 0.92; // narrow shoulders, round tummy
  blob(torso, M.belly, 0.62, [0, 1.02, 0.36], [1.08, 1.2, 0.74]);
  const gloves = [];
  const [armL, armR] = sides((s) => {
    const pivot = group(torso, [s * 0.74, 1.72, 0.05]);
    const arm = add(pivot, new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.5, 8, 16), M.limb), [0, -0.42, 0]);
    if (pet.id === 'penguin') arm.scale.z = 0.45; // flippers
    blob(pivot, M.limb, 0.22, [0, -0.72, 0], [1, 1, pet.id === 'penguin' ? 0.5 : 1]); // paw
    gloves.push(blob(pivot, M.red, 0.3, [0, -0.76, 0])); // boxing gloves, hidden until needed
    return pivot;
  });

  // ----- Head -----
  const head = group(root, [0, 2.0, 0], 'head');
  head.scale.setScalar(1.15); // a big head reads as young and friendly
  const ears = []; // the ones loose enough to flop about
  blob(head, M.fur, 0.95, [0, 0.8, 0], [1.08, 0.95, 0.95]);

  if (pet.id === 'cat') {
    sides((s) => {
      cone(head, M.fur, 0.34, 0.66, [s * 0.58, 1.58, 0], [0, 0, -s * 0.35]);
      cone(head, M.inner, 0.2, 0.44, [s * 0.57, 1.55, 0.13], [0, 0, -s * 0.35]);
    });
    for (const x of [-0.2, 0, 0.2]) blob(head, M.dark, 0.05, [x, 1.5 - Math.abs(x) * 0.2, 0.6], [0.9, 3.2, 1], [-0.85, 0, 0]);
  }
  if (pet.id === 'dog') {
    sides((s) => ears.push(blob(head, M.dark, 0.3, [s * 1.0, 0.72, 0.05], [0.5, 1.5, 0.9], [0, 0, s * 0.22])));
    blob(head, M.dark, 0.41, [0.42, 0.98, 0.56], [1, 1.1, 0.5]);
  }
  if (pet.id === 'bunny') {
    sides((s) => {
      const ear = group(head, [s * 0.34, 1.45, 0]);
      ear.rotation.z = -s * 0.13;
      ears.push(ear);
      add(ear, new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.95, 8, 20), M.fur), [0, 0.62, 0]).scale.z = 0.55;
      add(ear, new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.8, 8, 20), M.inner), [0, 0.62, 0.08]).scale.z = 0.4;
    });
  }
  if (pet.id === 'panda') {
    sides((s) => {
      blob(head, M.dark, 0.32, [s * 0.72, 1.5, 0], [1, 1, 0.6]);
      blob(head, M.dark, 0.45, [s * 0.43, 0.94, 0.56], [1, 1.22, 0.5], [0, 0, -s * 0.35]);
    });
  }

  if (pet.id === 'fox') {
    sides((s) => {
      cone(head, M.fur, 0.36, 0.8, [s * 0.6, 1.62, 0], [0, 0, -s * 0.3]);
      cone(head, M.dark, 0.2, 0.5, [s * 0.59, 1.62, 0.14], [0, 0, -s * 0.3]);
      blob(head, M.belly, 0.36, [s * 0.5, 0.48, 0.5], [1.15, 0.75, 0.7]); // white cheeks
    });
  }
  if (pet.id === 'monkey') {
    sides((s) => {
      blob(head, M.fur, 0.32, [s * 1.02, 0.85, 0], [1, 1, 0.5]);
      blob(head, M.inner, 0.2, [s * 1.04, 0.85, 0.1], [1, 1, 0.4]);
    });
    blob(head, M.belly, 0.66, [0, 0.78, 0.36], [1.08, 0.95, 0.85]); // pale face
    blob(head, M.fur, 0.2, [0, 1.64, 0.2], [1, 1.2, 1]); // tuft of hair
  }
  if (pet.id === 'penguin') {
    blob(head, M.belly, 0.6, [0, 0.74, 0.44], [1.1, 0.95, 0.8]); // white face
    cone(head, M.nose, 0.17, 0.42, [0, 0.62, 1.02], [Math.PI / 2, 0, 0]); // beak
  }
  if (pet.id === 'unicorn') {
    sides((s) => {
      cone(head, M.fur, 0.2, 0.5, [s * 0.55, 1.6, 0], [0, 0, -s * 0.3]);
      cone(head, M.inner, 0.11, 0.32, [s * 0.54, 1.58, 0.09], [0, 0, -s * 0.3]);
    });
    cone(head, M.gold, 0.13, 0.8, [0, 1.95, 0.3], [0.3, 0, 0]); // horn
    const mane = ['#ff8ad4', '#b28dff', '#7cc6fe', '#ff8ad4', '#b28dff'];
    [[0.2, 1.6, 0.3], [0, 1.68, -0.1], [-0.1, 1.5, -0.5], [0.05, 1.15, -0.8], [-0.05, 0.75, -0.9]].forEach((spot, i) => {
      blob(head, plush(mane[i]), 0.27, spot);
    });
  }

  const hasBeak = pet.id === 'penguin';
  const big = { dog: 1.2, fox: 1.08, unicorn: 1.12 }[pet.id] ?? 1; // muzzle size
  if (!hasBeak) {
    blob(head, M.belly, 0.36 * big, [0, 0.55, 0.72], [1.25, 0.85, 0.8]);
    blob(head, M.nose, 0.1 * big, [0, 0.69, 0.72 + 0.28 * big], [1.35, 0.9, 0.8]);
  }
  const cheeks = sides((s) => blob(head, flat('#ff8fa0', 0.38), 0.15, [s * 0.66, 0.52, 0.6], [1, 0.8, 0.35], [0, s * 0.6, 0]));

  if (pet.id === 'cat' || pet.id === 'bunny') {
    const whisker = new THREE.CylinderGeometry(0.008, 0.008, 0.62);
    sides((s) => {
      for (const tilt of [-0.18, 0, 0.18]) {
        add(head, new THREE.Mesh(whisker, M.line), [s * 0.72, 0.56 + tilt * 0.5, 0.78], [0, s * 0.35, Math.PI / 2 + s * tilt]);
      }
    });
  }

  const eyeZ = pet.id === 'monkey' || pet.id === 'penguin' ? 0.84 : 0.74; // sit on top of the face patch
  const pupils = [];
  const eyes = sides((s) => {
    const eye = group(head, [s * 0.4, 0.98, eyeZ]);
    blob(eye, M.eye, 0.26, [0, 0, 0], [1, 1.12, 0.5]);
    const pupil = group(eye, [0, 0, 0.09]);
    blob(pupil, M.iris, 0.17, [0, 0, 0], [1, 1.05, 0.42]);
    blob(pupil, M.pupil, 0.1, [0, 0, 0.035], [1, 1.05, 0.42]);
    blob(pupil, flat('#ffffff'), 0.05, [0.06, 0.07, 0.075]);
    blob(pupil, flat('#ffffff'), 0.025, [-0.05, -0.06, 0.075]);
    pupils.push(pupil);
    return eye;
  });

  // Eyebrows, except where they would vanish into dark fur.
  if (pet.id !== 'panda' && pet.id !== 'penguin') {
    sides((s) => blob(head, M.dark, 0.04, [s * 0.42, 1.37, 0.61], [3.4, 1, 1], [-0.6, 0, -s * 0.2]));
  }

  const mouthZ = hasBeak ? 0.86 : 0.7 + 0.27 * big;
  const mouth = group(head, [0, 0.4, mouthZ]);
  blob(mouth, M.mouth, 0.15, [0, 0, 0], [1.15, 1, 0.5]);
  blob(mouth, M.tongue, 0.09, [0, -0.05, 0.04], [1, 0.6, 0.5]);
  // A closed-mouth smile, swapped for the open mouth when the pet speaks.
  const smile = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.017, 8, 24, Math.PI), M.line), [0, 0.47, mouthZ + 0.02], [0, 0, Math.PI]);
  if (pet.id === 'bunny') add(head, new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.04), M.white), [0, 0.5, mouthZ + 0.06]);

  // Pie cream, hidden until a pie lands.
  const cream = group(head, [0, 0.8, 0.8]);
  blob(cream, M.white, 0.5, [0, 0, 0], [1.15, 1, 0.5]);
  blob(cream, M.white, 0.16, [-0.32, -0.45, 0.05]);
  blob(cream, M.white, 0.13, [0.36, -0.4, 0.05]);
  blob(cream, M.white, 0.14, [0.05, 0.42, -0.05]);

  // ----- Dress-up -----
  const accessories = {};
  const hat = (accessories.partyhat = group(head, [0.12, 1.58, 0]));
  hat.rotation.z = -0.18;
  cone(hat, matte('#ff4f8b'), 0.4, 0.9, [0, 0.45, 0]);
  blob(hat, matte('#ffd23f'), 0.12, [0, 0.93, 0]);
  add(hat, new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.05, 10, 32), matte('#ffd23f')), [0, 0.02, 0], [Math.PI / 2, 0, 0]);

  const gold = M.gold;
  const crown = (accessories.crown = group(head, [0, 1.6, 0]));
  add(crown, new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.28, 28), gold), [0, 0.14, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TWO_PI;
    cone(crown, gold, 0.1, 0.24, [Math.sin(a) * 0.37, 0.39, Math.cos(a) * 0.37]);
    blob(crown, glossy(i % 2 ? '#e63946' : '#3a86ff'), 0.05, [Math.sin(a) * 0.43, 0.14, Math.cos(a) * 0.43]);
  }

  const shades = (accessories.shades = group(head, [0, 0.98, 0.9]));
  sides((s) => blob(shades, glossy('#16161c'), 0.32, [s * 0.4, 0, 0], [1, 0.85, 0.3]));
  add(shades, new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.05), glossy('#16161c')), [0, 0.06, 0.03]);

  const red = M.red;
  const bow = (accessories.bow = group(root, [0, 1.93, 0.56], 'belly'));
  sides((s) => cone(bow, red, 0.2, 0.36, [s * 0.2, 0, 0], [0, 0, (s * Math.PI) / 2]));
  blob(bow, red, 0.1, [0, 0, 0.02]);

  for (const item of Object.values(accessories)) item.visible = false;

  // ----- What the pet eats and drinks, held in its right paw -----
  // Built upright for the angle the arm is held at while eating.
  const cylinder = (parent, material, radius, height, pos, rot) =>
    add(parent, new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material), pos, rot);
  const meal = group(armR, [0, -1.02, 0.08]);
  meal.rotation.x = HOLD_ANGLE;
  const fish = (color) => {
    const skin = matte(color);
    blob(meal, skin, 0.2, [0.04, 0, 0], [1.5, 0.8, 0.5]);
    cone(meal, skin, 0.15, 0.22, [-0.34, 0, 0], [0, 0, -Math.PI / 2]);
    blob(meal, M.pupil, 0.03, [0.22, 0.04, 0.09]);
    return color;
  };
  const menu = {
    cat: () => fish('#6fb3d9'),
    penguin: () => fish('#ff9e80'),
    dog: () => {
      const white = matte('#fff4dc');
      cylinder(meal, white, 0.055, 0.4, [0, 0, 0], [0, 0, Math.PI / 2]);
      for (const x of [-0.2, 0.2]) for (const y of [-0.06, 0.06]) blob(meal, white, 0.09, [x, y, 0]);
      return '#fff4dc';
    },
    bunny: () => {
      cone(meal, matte('#ff8a1f'), 0.12, 0.46, [0, -0.04, 0], [Math.PI, 0, 0]);
      for (const x of [-0.07, 0, 0.07]) cone(meal, matte('#4caf50'), 0.045, 0.2, [x, 0.28, 0], [0, 0, -x * 4]);
      return '#ff8a1f';
    },
    panda: () => {
      const cane = matte('#7bc043');
      cylinder(meal, cane, 0.07, 0.5, [0, 0, 0]);
      for (const y of [-0.1, 0.1]) add(meal, new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.014, 6, 16), matte('#4f8f1f')), [0, y, 0], [Math.PI / 2, 0, 0]);
      blob(meal, cane, 0.1, [0.14, 0.2, 0], [1.6, 0.3, 0.6], [0, 0, 0.6]);
      return '#7bc043';
    },
    fox: () => {
      const grape = glossy('#7e3ff2');
      [[0, 0.1, 0], [-0.09, 0.08, 0.03], [0.09, 0.08, 0.03], [-0.05, -0.03, 0.05], [0.05, -0.03, 0.05], [0, -0.13, 0.03], [0, 0.02, 0.1]].forEach((spot) => blob(meal, grape, 0.085, spot));
      cylinder(meal, matte('#6b4a2b'), 0.015, 0.12, [0, 0.22, 0]);
      return '#7e3ff2';
    },
    monkey: () => {
      add(meal, new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 10, 20, Math.PI * 0.75), matte('#ffd633')), [0, -0.12, 0], [0, 0, 0.4]);
      return '#ffd633';
    },
    unicorn: () => {
      cylinder(meal, M.white, 0.02, 0.4, [0, -0.16, 0]);
      blob(meal, glossy('#ff5fa8'), 0.2, [0, 0.14, 0], [1, 1, 0.35]);
      add(meal, new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 20), M.white), [0, 0.14, 0.06]);
      return '#ff5fa8';
    },
  };
  const crumbColor = menu[pet.id]();
  const crumbs = Array.from({ length: 6 }, () => blob(root, matte(crumbColor), 0.04, [0, 0, 0]));

  const glass = group(armR, [0, -1.0, 0.08]);
  glass.rotation.x = HOLD_ANGLE;
  glass.scale.setScalar(1.3);
  const tumbler = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.14, 0.42, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide }),
  );
  add(glass, tumbler, [0, 0.05, 0]).castShadow = false;
  const milkShape = new THREE.CylinderGeometry(0.15, 0.13, 0.34, 24);
  milkShape.translate(0, 0.17, 0); // so the milk drains from the top down
  const milk = add(glass, new THREE.Mesh(milkShape, M.white), [0, -0.15, 0]);
  const moustache = blob(head, M.white, 0.13, [0, 0.5, mouthZ + 0.03], [1.6, 0.45, 0.5]);

  // ----- Props -----
  const stars = [0, 1, 2].map(() => textSprite('⭐'));
  root.add(...stars);

  const props = new THREE.Group();
  const ball = new THREE.Mesh(sphere, glossy('#e63946'));
  ball.castShadow = true;
  const P = {
    cloud: textSprite('💨'),
    pie: textSprite('🥧'),
    notes: [textSprite('🎵'), textSprite('🎶')],
    zzz: [0, 1, 2].map(() => textSprite('Z', '#ffffff')),
    stars,
    ball,
  };

  const wood = matte('#b5793f');
  P.swing = group(props, [0, SWING_TOP, 0]);
  const rope = new THREE.CylinderGeometry(0.03, 0.03, SWING_LENGTH);
  sides((s) => add(P.swing, new THREE.Mesh(rope, wood), [s * 0.98, -SWING_LENGTH / 2, 0]));
  add(P.swing, new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.85), wood), [0, -SWING_LENGTH, 0]);

  // Boxing pads: round targets facing the player, one per slot.
  const disc = (radius, depth) => new THREE.CylinderGeometry(radius, radius, depth, 36);
  P.pads = PAD_SLOTS.map((_, i) => {
    const pad = group(props, [0, 0, 0], `pad${i}`);
    add(pad, new THREE.Mesh(disc(0.38, 0.12), M.red), [0, 0, 0], [Math.PI / 2, 0, 0]);
    add(pad, new THREE.Mesh(disc(0.25, 0.14), M.white), [0, 0, 0], [Math.PI / 2, 0, 0]);
    add(pad, new THREE.Mesh(disc(0.12, 0.16), M.red), [0, 0, 0], [Math.PI / 2, 0, 0]);
    return pad;
  });
  P.pow = textSprite('💥');
  P.sparkle = textSprite('✨');
  P.star = textSprite('⭐');
  P.bell = textSprite('🔔');
  P.confetti = [textSprite('🎉'), textSprite('🎊')];

  P.trampoline = group(props);
  add(P.trampoline, new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 40), matte('#3a86ff')), [0, 0.3, 0]).receiveShadow = true;
  add(P.trampoline, new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 10, 40), M.line), [0, 0.3, 0], [Math.PI / 2, 0, 0]);

  // Bubbles for the popping game. Each one is tappable.
  P.soap = new THREE.MeshStandardMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.5, roughness: 0.05 });
  P.goldSoap = new THREE.MeshStandardMaterial({ color: '#ffcf33', transparent: true, opacity: 0.75, roughness: 0.05, emissive: '#7a5200' });
  P.bubbles = Array.from({ length: POP.pool }, (_, i) => {
    const bubble = new THREE.Mesh(sphere, P.soap);
    bubble.userData.zone = `bubble${i}`;
    return bubble;
  });
  P.gloves = gloves;

  // Things that fall in the catching game: one picture per kind, shared by a few sprites.
  P.icons = Object.fromEntries([...FOODS, ...YUCKS].map((icon) => [icon, textSprite(icon).material]));
  P.falling = Array.from({ length: 8 }, () => {
    const sprite = new THREE.Sprite(P.icons[FOODS[0]]);
    sprite.visible = false;
    return sprite;
  });
  P.yuck = textSprite('🤢');

  props.add(P.cloud, P.pie, ...P.notes, ...P.zzz, ball, ...P.bubbles, ...P.falling, P.yuck, P.pow, P.sparkle, P.star, P.bell, ...P.confetti);

  for (const ear of ears) ear.userData.rest = ear.rotation.z;
  for (const cheek of cheeks) cheek.userData.rest = cheek.scale.clone();

  return {
    root, props, head, armL, armR, tail, eyes, pupils, mouth, smile, cream, accessories, P,
    ears, cheeks, meal, crumbs, glass, milk, moustache,
    hideable: [...props.children, ...stars, ...gloves, ...crumbs, cream, meal, glass, moustache],
  };
}

// Work out where every part should be for the current activity, then ease towards it.
function pose(m, v, dt, snap) {
  const { t, time } = v;
  const P = m.P;
  const calm = v.state === 'idle';

  // Blinks come at uneven intervals, now and then two in a row.
  if (time >= v.blinkAt + 0.13) v.blinkAt = time + (Math.random() < 0.2 ? 0.2 : 2 + Math.random() * 3.5);
  // Every so often the eyes dart somewhere else for a moment.
  if (time >= v.glanceUntil) {
    const away = Math.random() < 0.5;
    v.glance = { x: away ? (Math.random() * 2 - 1) * 0.045 : 0, y: away ? (Math.random() * 2 - 1) * 0.02 : 0 };
    v.glanceUntil = time + 0.7 + Math.random() * 2.5;
  }
  const T = {
    x: 0,
    y: 0,
    ry: 0,
    rz: calm ? Math.sin(time * 0.7) * 0.012 : 0, // shifting its weight
    squash: Math.sin(time * 2.2) * 0.014, // breathing
    headRx: -v.look.y * 0.2,
    headRy: v.look.x * 0.4 + (calm ? Math.sin(time * 0.53) * 0.06 + Math.sin(time * 1.31) * 0.025 : 0),
    headRz: calm ? Math.sin(time * 0.41) * 0.03 : 0,
    z: 0,
    rx: 0,
    armL: -0.35,
    armR: 0.35,
    armLx: 0, // arms swinging forwards, for punches
    armRx: 0,
    eyes: time >= v.blinkAt ? CLOSED : 1,
    eyeSize: 1,
    cheek: 1,
    mouth: 0,
    wag: 1,
    pupilX: v.look.x * 0.05 + (calm ? v.glance.x : 0),
    pupilY: v.look.y * 0.04 + (calm ? v.glance.y : 0),
    // Loose ears swing the opposite way to whatever the head just did.
    ears: v.cur ? limit(-(v.cur.headRz.v * 0.06 + v.cur.headRy.v * 0.04 + v.cur.x.v * 0.05), 0.5) : 0,
  };

  for (const item of m.hideable) item.visible = false;
  const show = (item, x, y, z, scale, opacity = 1) => {
    item.visible = true;
    item.position.set(x, y, z);
    item.scale.setScalar(scale);
    if (item.isSprite) item.material.opacity = opacity;
  };
  const giggle = () => {
    T.eyes = CLOSED;
    T.mouth = 0.8;
    T.squash = Math.sin(t * 30) * 0.05;
  };

  const busy = v.state === 'reacting' || v.state === 'acting';
  switch (v.state === 'playing' ? `${v.detail}-game` : busy ? v.detail : v.state) {
    case 'listening':
      T.headRz = -0.22;
      T.headRy = 0.15;
      T.armR = 2.5;
      break;

    case 'talking':
      T.mouth = v.mouth;
      T.headRx += Math.sin(t * 9) * 0.05;
      T.armL = -0.6 + Math.sin(t * 5) * 0.2;
      T.armR = 0.6 + Math.sin(t * 5 + 1) * 0.2;
      break;

    case 'sleeping':
      T.eyes = CLOSED;
      T.headRx = 0.28;
      T.headRy = 0;
      T.headRz = 0.1;
      T.wag = 0.15;
      T.squash = Math.sin(time * 1.2) * 0.03;
      P.zzz.forEach((z, i) => {
        const p = (time * 0.4 + i / 3) % 1;
        show(z, 1.1 + p * 0.9, 3.7 + p * 1.3, 0.4, 0.3 + p * 0.45, Math.sin(p * Math.PI));
      });
      break;

    // ----- Pokes -----
    case 'head':
      T.headRy = Math.sin(t * 28) * 0.6 * Math.max(0, 1 - t);
      T.eyes = CLOSED;
      T.mouth = 0.6;
      break;

    case 'belly':
      giggle();
      T.armL = -1.1;
      T.armR = 1.1;
      break;

    case 'tail':
      T.y = arc(t / 0.9) * 0.9;
      T.eyeSize = 1.35;
      T.mouth = 1;
      T.armL = -2.4;
      T.armR = 2.4;
      T.wag = 4;
      break;

    case 'feet':
      T.y = Math.abs(Math.sin((t * Math.PI) / 0.4)) * 0.5;
      T.mouth = 0.4;
      break;

    case 'dizzy':
      T.headRx = Math.sin(t * 6) * 0.22;
      T.headRz = Math.cos(t * 6) * 0.28;
      T.rz = Math.sin(t * 3) * 0.09;
      T.pupilX = Math.cos(t * 10) * 0.07;
      T.pupilY = Math.sin(t * 10) * 0.07;
      T.eyes = 1;
      T.mouth = 0.35;
      T.armL = -0.9;
      T.armR = 0.9;
      P.stars.forEach((star, i) => {
        const a = t * 4 + (i * TWO_PI) / 3;
        show(star, Math.cos(a) * 1.05, 4.45 + Math.sin(t * 5 + i) * 0.08, Math.sin(a) * 1.05, 0.5);
      });
      break;

    // ----- Buttons -----
    case 'feed': {
      const bites = CUES.bites;
      const taken = bites.filter((at) => t >= at).length;
      const next = bites[taken]; // undefined once it has all gone
      const sinceBite = taken ? t - bites[taken - 1] : Infinity;

      // The paw brings the food up, and the pet can't take its eyes off it.
      m.meal.visible = taken < bites.length;
      m.meal.scale.setScalar(([1.6, 1.15, 0.7][taken] ?? 0) * Math.min(1, t / 0.25)); // smaller with every bite
      if (t < bites.at(-1) + 0.3) {
        T.armRx = -HOLD_ANGLE;
        T.armR = -0.2;
      }
      T.headRy = 0.3;
      T.headRx = 0.12;
      T.pupilX = 0.04;
      T.pupilY = -0.03;

      if (next !== undefined && next - t < 0.3) {
        // Lean in with the mouth opening wide; it snaps shut on the bite.
        const lunge = 1 - (next - t) / 0.3;
        T.mouth = lunge;
        T.headRx = 0.12 + 0.22 * lunge;
        T.headRy = 0.3 + 0.08 * lunge;
        T.eyeSize = 1.15;
      } else if (sinceBite < 0.55) {
        // Chew: cheeks full, jaw working, eyes shut with pleasure.
        T.cheek = 1.5;
        T.headRx = 0.08 + Math.sin(sinceBite * 22) * 0.05;
        T.squash = Math.sin(sinceBite * 22) * 0.02;
        T.eyes = CLOSED;
      }
      if (taken === bites.length) {
        if (t < CUES.gulp + 0.25) {
          if (t > CUES.gulp - 0.15) T.headRx = -0.22; // gulp
          T.eyes = CLOSED;
        } else {
          // A happy little hop once it has gone down.
          T.eyes = CLOSED;
          T.mouth = 0.5;
          T.headRy = 0;
          T.y = arc((t - CUES.gulp - 0.25) / 0.45) * 0.3;
          T.armL = -1.3;
          T.armR = 1.3;
        }
      }

      // Crumbs fly from each bite.
      m.crumbs.forEach((crumb, i) => {
        const since = sinceBite - (i % 2) * 0.03;
        if (since < 0 || since > 0.5) return;
        const angle = i * 1.1 + taken;
        crumb.visible = true;
        crumb.position.set(0.45 + Math.cos(angle) * since * 1.4, 2.25 + Math.sin(angle) * since * 0.6 + since * 1.5 - since * since * 7, 1.2 + since * 0.5);
      });
      break;
    }

    case 'milk': {
      const drinkEnd = CUES.burp - 0.45;
      if (t < drinkEnd) {
        // Glass up, head back, gulping while the milk goes down.
        const drunk = clamp01((t - 0.35) / (drinkEnd - 0.45));
        m.glass.visible = true;
        m.milk.scale.y = Math.max(0.02, 1 - drunk);
        T.armRx = -HOLD_ANGLE - 0.45 * drunk; // tips further as it empties
        T.armR = -0.3;
        T.headRy = 0.25;
        T.headRx = -0.1 - 0.22 * drunk + Math.sin(t * 14) * 0.03;
        T.squash = Math.sin(t * 14) * 0.015;
        T.eyes = t > 0.4 ? CLOSED : 1;
        T.mouth = 0.2;
      } else {
        const since = t - CUES.burp;
        m.moustache.visible = true;
        m.moustache.scale.x = 0.208 * clamp01((ACTIONS_MILK_END - t) / 0.4); // licked away at the end
        if (since < 0) {
          // Uh oh, something is coming…
          T.squash = -0.06;
          T.eyeSize = 1.25;
          T.headRx = -0.12;
        } else if (since < 0.5) {
          T.mouth = 1;
          T.eyeSize = 1.3;
          T.headRx = 0.2;
          T.squash = 0.1 * Math.exp(-since * 8);
        } else {
          // Embarrassed: paw over the mouth.
          T.eyes = CLOSED;
          T.mouth = 0.5;
          T.armRx = -1.9;
          T.armR = -0.55;
          T.squash = Math.sin(t * 30) * 0.03;
        }
      }
      break;
    }

    case 'ball': {
      const u = t - CUES.ballHit;
      if (u < 0) {
        const p = t / CUES.ballHit;
        show(P.ball, -4.2 + p * 3.5, 4.9 - p * p * 0.8, 0.3, 0.3);
        T.headRy = -0.35;
        T.pupilX = -0.05;
        T.pupilY = 0.04;
      } else {
        show(P.ball, -0.7 + u * 3.2, Math.max(0.3, 4.1 + 3 * u - 7 * u * u), 0.3, 0.3);
        T.headRz = -0.5 * Math.exp(-u * 3) * Math.cos(u * 10);
        T.squash = 0.07 * Math.exp(-u * 5);
        if (u < 0.5) T.eyes = CLOSED;
        if (u < 0.7) T.mouth = 0.5;
      }
      break;
    }

    case 'pie': {
      const u = t - CUES.pieHit;
      if (u < 0) {
        const away = 1 - t / CUES.pieHit;
        show(P.pie, 0, 2.9 + away * 0.6, 1.5 + away * 7, 1.4);
        T.eyeSize = 1.35;
        T.mouth = 0.5;
      } else {
        const melt = clamp01((u - 1.6) / 0.9);
        m.cream.visible = melt < 1;
        m.cream.scale.setScalar(1 - melt * 0.9);
        T.headRx = -0.4 * Math.exp(-u * 3);
        T.eyes = melt < 0.6 ? CLOSED : 1;
        T.mouth = u > 1.2 ? 0.7 : 0.1;
      }
      break;
    }

    case 'dance':
      T.y = Math.abs(Math.sin(t * TWO_PI)) * 0.28;
      T.ry = t > 4 ? (t - 4) * TWO_PI : Math.sin(t * Math.PI) * 0.6;
      T.headRz = Math.sin(t * TWO_PI) * 0.22;
      T.armL = -2.2 + Math.sin(t * TWO_PI * 2) * 0.5;
      T.armR = 2.2 + Math.sin(t * TWO_PI * 2 + Math.PI) * 0.5;
      T.mouth = 0.5;
      T.wag = 3;
      P.notes.forEach((note, i) => {
        const p = (t * 0.6 + i * 0.5) % 1;
        show(note, (i ? 1 : -1) * (1.5 + p * 0.3), 2.6 + p * 1.6, 0.5, 0.6, Math.sin(p * Math.PI));
      });
      break;

    case 'cheer':
      T.y = Math.abs(Math.sin(t * 8)) * 0.35;
      T.armL = -2.6;
      T.armR = 2.6;
      T.mouth = 0.9;
      T.eyes = CLOSED;
      T.wag = 4;
      P.confetti.forEach((item, i) => {
        const p = (t * 0.7 + i * 0.5) % 1;
        show(item, (i ? 1 : -1) * 1.5, 2.2 + p * 2.2, 0.8, 0.9, Math.sin(p * Math.PI));
      });
      break;

    // ----- Games -----
    case 'boxing-game': {
      const g = v.game;
      for (const glove of P.gloves) glove.visible = true;
      // Guard up, bouncing on the spot.
      T.armL = -0.45;
      T.armR = 0.45;
      T.armLx = -1;
      T.armRx = -1;
      T.y = Math.abs(Math.sin(time * 7)) * 0.07;
      if (g?.target) {
        const { slot, age, life } = g.target;
        const [x, y] = PAD_SLOTS[slot];
        const pad = P.pads[slot];
        pad.visible = true;
        pad.position.set(x, y, 1);
        pad.scale.setScalar(Math.min(1, age / 0.12) * (1 - 0.35 * (age / life))); // pops in, then shrinks away
        T.headRy = Math.sign(x) * 0.15;
        T.pupilX = Math.sign(x) * 0.05;
        T.pupilY = (y - 2.6) * 0.03;
      }
      const fx = g?.fx;
      if (fx?.kind === 'hit' && fx.t < 0.3) {
        const [x, y] = PAD_SLOTS[fx.slot];
        const reach = Math.sin((fx.t / 0.3) * Math.PI);
        const lift = -1.5 - (y - 2.4) * 0.55; // higher pads need the arm raised further
        if (x < 0) {
          T.armLx = -1 + (lift + 1) * reach;
          T.armL = -0.45 - 0.35 * reach;
        } else {
          T.armRx = -1 + (lift + 1) * reach;
          T.armR = 0.45 + 0.35 * reach;
        }
        T.ry = Math.sign(x) * 0.45 * reach;
        T.mouth = 0.6;
        show(P.pow, x, y, 1.2, 0.6 + fx.t * 3, 1 - fx.t / 0.3);
      }
      if (fx?.kind === 'miss' && fx.t < 0.4) T.headRx = 0.2;
      break;
    }

    case 'swing-game': {
      const angle = v.game?.angle ?? 0;
      const fx = v.game?.fx;
      P.swing.visible = true;
      P.swing.rotation.x = -angle;
      T.rx = -angle;
      T.z = Math.sin(angle) * SWING_LENGTH;
      T.y = SWING_TOP - Math.cos(angle) * SWING_LENGTH + 0.06;
      T.armL = -2.75;
      T.armR = 2.75;
      T.mouth = 0.25 + Math.min(0.7, Math.abs(angle));
      T.eyeSize = 1 + Math.min(0.3, Math.abs(angle) * 0.3);
      T.headRx = angle * 0.3;
      T.wag = 3;
      show(P.bell, 0, 6.3, 1.6, 0.9);
      P.bell.material.rotation = fx?.kind === 'bell' ? Math.sin(fx.t * 40) * 0.5 * (1 - fx.t / 0.6) : 0;
      if (fx?.kind === 'bell' || fx?.kind === 'star') show(P.star, 1.5, 4.2 + fx.t * 2.5, 2.2, 0.9 + fx.t, 1 - fx.t / 0.6);
      if (fx?.kind === 'perfect') show(P.sparkle, -1.4, 1.6 + fx.t, 1.5, 0.9, 1 - fx.t / 0.6);
      break;
    }

    case 'catch-game': {
      const g = v.game;
      if (!g) break;
      const fx = g.fx;
      T.x = g.petX;
      T.rz = (g.petX - g.targetX) * 0.12; // lean into the run
      T.armL = -2.3;
      T.armR = 2.3;
      T.mouth = 0.7;
      T.headRx = -0.25;
      T.pupilY = 0.05;
      T.wag = 3;
      g.items.slice(0, P.falling.length).forEach((item, i) => {
        P.falling[i].material = P.icons[item.icon];
        show(P.falling[i], item.x, item.y, 0.7, 0.85);
      });
      if (fx?.kind === 'catch' && fx.t < 0.4) {
        T.mouth = Math.abs(Math.sin(fx.t * 25));
        T.eyes = CLOSED;
        show(P.sparkle, g.petX, 4.3 + fx.t, 1.2, 0.8, 1 - fx.t / 0.4);
      }
      if (fx?.kind === 'yuck') {
        T.eyes = CLOSED;
        T.mouth = 0.5;
        T.headRy = Math.sin(fx.t * 30) * 0.4;
        show(P.yuck, g.petX, 4.9, 0.8, 0.9, 1 - fx.t / 0.6);
      }
      break;
    }

    case 'pop-game': {
      const g = v.game;
      if (!g) break;
      const fx = g.fx;
      T.mouth = 0.25 + 0.25 * Math.sin(time * 6) ** 2; // puffing
      T.headRx = -0.1;
      T.armR = 1.7;
      for (const bubble of g.bubbles) {
        const mesh = P.bubbles[bubble.id % P.bubbles.length];
        mesh.material = bubble.golden ? P.goldSoap : P.soap;
        show(mesh, bubble.x, bubble.y, 1.2, bubble.size * Math.min(1, 0.3 + bubble.age * 2));
      }
      const newest = g.bubbles.at(-1);
      if (newest) {
        T.pupilX = Math.max(-0.06, Math.min(0.06, newest.x * 0.04));
        T.pupilY = 0.04;
      }
      if (fx?.kind === 'pop' && fx.t < 0.3) {
        show(P.pow, fx.x, fx.y, 1.4, 0.5 + fx.t * 2.5, 1 - fx.t / 0.3);
        T.eyes = CLOSED;
        T.mouth = 0.8;
      }
      break;
    }

    case 'trampoline': {
      const count = Math.floor(t / CUES.bounce);
      const p = (t / CUES.bounce) % 1;
      P.trampoline.visible = true;
      T.y = 0.36 + arc(p) * 0.75;
      T.squash = p < 0.12 || p > 0.88 ? 0.12 : -0.04;
      T.ry = (Math.floor(count / 2) + (count % 2 ? p : 0)) * TWO_PI; // a full spin on every other bounce
      T.armL = -2.3;
      T.armR = 2.3;
      T.mouth = 0.7;
      T.eyeSize = 1.1;
      break;
    }

    case 'toot': {
      const u = t - CUES.toot;
      if (u < 0) {
        T.squash = 0.1;
        T.eyes = CLOSED;
        T.headRx = 0.15;
      } else {
        const puff = clamp01(u / 1.2);
        show(P.cloud, 1.0 + puff * 1.2, 0.7 + puff * 0.7, -0.2, 0.6 + puff * 1.2, 1 - puff);
        T.y = arc(u / 0.35) * 0.4;
        if (u < 0.6) {
          T.eyeSize = 1.35;
          T.mouth = 0.5;
        } else giggle();
      }
      break;
    }
  }

  const S = v.cur ?? (v.cur = Object.fromEntries(Object.keys(T).map((key) => [key, { x: T[key], v: 0 }])));
  if (snap) for (const key in T) Object.assign(S[key], { x: T[key], v: 0 });
  else chase(S, T, dt);

  // Follow-through: the body stretches when it moves fast and squashes when it
  // lands; the head, arms, ears and tail trail a little behind the body.
  const rise = S.y.v;
  const slide = S.x.v;
  if (v.airborne && S.y.x < 0.03 && rise < -1.5) S.squash.v += Math.min(4, -rise * 0.6);
  v.airborne = S.y.x > 0.05;
  const squash = S.squash.x - Math.min(0.14, Math.abs(rise) * 0.03);
  const armLift = limit(-rise * 0.05, 0.4);

  m.root.position.set(S.x.x, S.y.x, S.z.x);
  m.root.rotation.set(S.rx.x, S.ry.x, S.rz.x);
  m.root.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
  m.head.rotation.set(S.headRx.x + limit(rise * 0.03, 0.15), S.headRy.x, S.headRz.x - limit(slide * 0.05, 0.2));
  m.armL.rotation.set(S.armLx.x, 0, S.armL.x - armLift);
  m.armR.rotation.set(S.armRx.x, 0, S.armR.x + armLift);
  v.wagPhase += dt * 6 * S.wag.x;
  m.tail.rotation.set(limit(-rise * 0.06, 0.5), 0, Math.sin(v.wagPhase) * 0.16 - limit(slide * 0.06, 0.3));
  for (const ear of m.ears) ear.rotation.z = ear.userData.rest + S.ears.x;
  for (const eye of m.eyes) eye.scale.set(S.eyeSize.x, S.eyes.x * S.eyeSize.x, 1);
  for (const pupil of m.pupils) pupil.position.set(S.pupilX.x, S.pupilY.x, 0.09);
  for (const cheek of m.cheeks) cheek.scale.copy(cheek.userData.rest).multiplyScalar(S.cheek.x);
  const open = Math.max(0, S.mouth.x);
  m.mouth.visible = open > 0.08;
  m.smile.visible = !m.mouth.visible;
  m.mouth.scale.set(1 + open * 0.15, open, 1);
}

// A soft dark patch under the pet, so it looks planted on the floor.
function contactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  const fade = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  fade.addColorStop(0, 'rgba(60, 35, 20, 0.45)');
  fade.addColorStop(1, 'rgba(60, 35, 20, 0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 128, 128);
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(0, 0.02, 0.1);
  return patch;
}

// Light bouncing in from all around, as in a photo studio. This is what makes
// the eyes glint and the fur look soft rather than flat. It is costly to make,
// so each renderer makes it once and every scene shares it.
function studioLight(renderer) {
  const studio = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const light = pmrem.fromScene(studio, 0.04).texture;
  pmrem.dispose();
  disposeScene(studio);
  return light;
}

function createScene(pet, light) {
  const scene = new THREE.Scene();
  scene.environment = light;
  scene.environmentIntensity = 0.6;

  const key = new THREE.DirectionalLight('#fff1dd', 2.0);
  key.position.set(2.5, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  key.shadow.radius = 6;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const rim = new THREE.DirectionalLight('#cfe6ff', 1.4);
  rim.position.set(-4, 4, -5);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor, contactShadow());

  const model = buildPet(pet);
  scene.add(model.root, model.props);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  return { scene, camera, model };
}

// Pull the camera back far enough to fit the pet, ears and all, at any screen shape.
// `far` (0 to 1) pulls back further still, for games that need more room.
function frame(camera, aspect, far = 0) {
  const distance = 11.2 * Math.max(1, 0.62 / aspect) * (1 + far * 0.7);
  camera.aspect = aspect;
  camera.position.set(0, 3.1 + far, distance);
  camera.lookAt(0, 2.45 + far * 1.3, 0);
  camera.updateProjectionMatrix();
}

function newRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps bright colours true instead of washing them out
  return renderer;
}

const newViewState = () => ({
  state: 'idle', detail: null, game: null, t: 0, time: 0, mouth: 0, look: { x: 0, y: 0 },
  wagPhase: 0, far: 0, cur: null, airborne: false, blinkAt: 2.5, glance: { x: 0, y: 0 }, glanceUntil: 1.5,
});

function disposeScene(scene) {
  scene.traverse((item) => {
    item.geometry?.dispose();
    item.material?.map?.dispose();
    item.material?.dispose();
  });
}

// Still pictures of each pet for the picker, as { id: dataURL }.
export function renderThumbnails(pets, width = 240, height = 300) {
  const renderer = newRenderer();
  renderer.setSize(width, height, false);
  const images = {};
  const light = studioLight(renderer);
  for (const pet of pets) {
    const { scene, camera, model } = createScene(pet, light);
    frame(camera, width / height);
    pose(model, newViewState(), 0, true);
    renderer.render(scene, camera);
    images[pet.id] = renderer.domElement.toDataURL('image/png');
    disposeScene(scene);
  }
  light.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return images;
}

// Put a live, animated pet inside `container`. Throws if 3D is unavailable.
export function createPetView(container, pet) {
  const renderer = newRenderer();
  let sharpness = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(sharpness);
  const light = studioLight(renderer);
  const { scene, camera, model } = createScene(pet, light);
  const canvas = renderer.domElement;
  container.replaceChildren(canvas);

  const v = newViewState();
  const raycaster = new THREE.Raycaster();

  let ticker = null;

  function step(dt, snap = false) {
    if (dt > 0) ticker?.(dt);
    v.t += dt;
    v.time += dt;
    pose(model, v, dt, snap);
    const far = v.state === 'playing' ? (GAME_ZOOM[v.detail] ?? 0) : 0;
    if (far !== v.far) {
      const next = v.far + (far - v.far) * (1 - Math.exp(-dt * 4));
      v.far = Math.abs(far - next) < 0.002 ? far : next;
      frame(camera, camera.aspect, v.far);
    }
    renderer.render(scene, camera);
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    frame(camera, width / height, v.far);
    step(0);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  step(0, true);

  // Smooth motion matters more than sharp edges: if frames are taking too long,
  // draw at a lower resolution. Checked once a second; it never goes back up.
  let last = performance.now();
  let frames = 0;
  let since = last;
  renderer.setAnimationLoop((now) => {
    step(Math.min(0.05, (now - last) / 1000));
    last = now;
    if (++frames === 60) {
      const average = (now - since) / frames;
      if (average > 22 && sharpness > 1) {
        sharpness = Math.max(1, sharpness - 0.25);
        renderer.setPixelRatio(sharpness);
        resize();
      }
      frames = 0;
      since = now;
    }
  });

  return {
    // `detail` is the part poked (reacting) or the button pressed (acting).
    setState(state, detail = null) {
      Object.assign(v, { state, detail, t: 0 });
      // Forget whole turns left over from a spin, so the pet doesn't unwind them.
      v.cur.ry.x = ((((v.cur.ry.x + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
      step(0);
    },
    setMouth(level) {
      v.mouth = level;
    },
    // The current mini-game's state, for the pet to act out.
    setGame(game) {
      v.game = game;
    },
    // Call `fn(dt)` before every frame is drawn.
    setTicker(fn) {
      ticker = fn;
    },
    // How far left or right of the pet's home spot this screen point is, in the pet's own units.
    worldX(clientX) {
      const rect = canvas.getBoundingClientRect();
      const across = ((clientX - rect.left) / rect.width) * 2 - 1;
      return across * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    },
    // Where the pet should look: x and y from -1 to 1, y up.
    setLook(x, y) {
      v.look = { x, y };
    },
    setAccessory(id) {
      for (const [name, item] of Object.entries(model.accessories)) item.visible = name === id;
      step(0);
    },
    // What is under this screen point: 'head', 'belly', 'tail', 'feet', a boxing pad ('pad0'…), a bubble ('bubble0'…) or null.
    pick(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const point = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(point, camera);
      for (const hit of raycaster.intersectObjects([model.root, model.props], true)) {
        let zone = null;
        let shown = true;
        for (let item = hit.object; item; item = item.parent) {
          zone ??= item.userData.zone;
          shown &&= item.visible;
        }
        if (zone && shown) return zone;
      }
      return null;
    },
    step,
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      disposeScene(scene);
      light.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
