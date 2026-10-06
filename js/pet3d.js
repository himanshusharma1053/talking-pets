// The 3D pet: builds a plush-toy model for each pet and animates it.

import * as THREE from '../vendor/three.module.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { ACTIONS, CUES } from './actions.js';

const CLOSED = 0.08; // eye height when shut
const TWO_PI = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const arc = (p) => (p <= 0 || p >= 1 ? 0 : 4 * p * (1 - p)); // 0 → 1 → 0, for jumps

// The swing hangs from a point above the top of the screen.
const SWING_TOP = 6.3;
const SWING_LENGTH = 6;

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
  // Sheen gives the soft, velvety edge of a plush toy without washing out its colour.
  const plush = (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.7,
      sheen: 0.35,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.15),
    });
  const glossy = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05 });
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

  const sphere = new THREE.SphereGeometry(1, 48, 32);
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
  add(torso, new THREE.Mesh(new THREE.LatheGeometry(profile, 48), M.fur)).scale.z = 0.92; // narrow shoulders, round tummy
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
  blob(head, M.fur, 0.95, [0, 0.8, 0], [1.08, 0.95, 0.95]);

  if (pet.id === 'cat') {
    sides((s) => {
      cone(head, M.fur, 0.34, 0.66, [s * 0.58, 1.58, 0], [0, 0, -s * 0.35]);
      cone(head, M.inner, 0.2, 0.44, [s * 0.57, 1.55, 0.13], [0, 0, -s * 0.35]);
    });
    for (const x of [-0.2, 0, 0.2]) blob(head, M.dark, 0.05, [x, 1.5 - Math.abs(x) * 0.2, 0.6], [0.9, 3.2, 1], [-0.85, 0, 0]);
  }
  if (pet.id === 'dog') {
    sides((s) => blob(head, M.dark, 0.3, [s * 1.0, 0.72, 0.05], [0.5, 1.5, 0.9], [0, 0, s * 0.22]));
    blob(head, M.dark, 0.41, [0.42, 0.98, 0.56], [1, 1.1, 0.5]);
  }
  if (pet.id === 'bunny') {
    sides((s) => {
      const ear = group(head, [s * 0.34, 1.45, 0]);
      ear.rotation.z = -s * 0.13;
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
  sides((s) => blob(head, flat('#ff8fa0', 0.38), 0.15, [s * 0.66, 0.52, 0.6], [1, 0.8, 0.35], [0, s * 0.6, 0]));

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

  // ----- Props -----
  const stars = [0, 1, 2].map(() => textSprite('⭐'));
  root.add(...stars);

  const props = new THREE.Group();
  const ball = new THREE.Mesh(sphere, glossy('#e63946'));
  ball.castShadow = true;
  const P = {
    food: textSprite(pet.food),
    milk: textSprite('🥛'),
    cloud: textSprite('💨'),
    pie: textSprite('🥧'),
    notes: [textSprite('🎵'), textSprite('🎶')],
    zzz: [0, 1, 2].map(() => textSprite('Z', '#ffffff')),
    stars,
    ball,
  };
  P.milk.material.rotation = 0.6;

  const wood = matte('#b5793f');
  P.swing = group(props, [0, SWING_TOP, 0]);
  const rope = new THREE.CylinderGeometry(0.03, 0.03, SWING_LENGTH);
  sides((s) => add(P.swing, new THREE.Mesh(rope, wood), [s * 0.98, -SWING_LENGTH / 2, 0]));
  add(P.swing, new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.85), wood), [0, -SWING_LENGTH, 0]);

  P.bag = group(props, [1.35, 5.4, 0.75]);
  add(P.bag, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4), M.line), [0, -1.2, 0]);
  add(P.bag, new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.2, 8, 24), matte('#c1272d')), [0, -3.3, 0]);
  add(P.bag, new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 28), M.white), [0, -3.3, 0], [Math.PI / 2, 0, 0]);

  P.trampoline = group(props);
  add(P.trampoline, new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 40), matte('#3a86ff')), [0, 0.3, 0]).receiveShadow = true;
  add(P.trampoline, new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 10, 40), M.line), [0, 0.3, 0], [Math.PI / 2, 0, 0]);

  const soap = new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.45, roughness: 0.05 });
  P.bubbles = Array.from({ length: 7 }, () => new THREE.Mesh(sphere, soap));
  P.gloves = gloves;

  props.add(P.food, P.milk, P.cloud, P.pie, ...P.notes, ...P.zzz, ball, ...P.bubbles);

  return { root, props, head, armL, armR, tail, eyes, pupils, mouth, smile, cream, accessories, P, hideable: [...props.children, ...stars, ...gloves, cream] };
}

// Work out where every part should be for the current activity, then ease towards it.
function pose(m, v, dt, snap) {
  const { t, time } = v;
  const P = m.P;
  const T = {
    y: 0,
    ry: 0,
    rz: 0,
    squash: Math.sin(time * 2.2) * 0.012, // breathing
    headRx: -v.look.y * 0.2,
    headRy: v.look.x * 0.4,
    headRz: 0,
    z: 0,
    rx: 0,
    armL: -0.35,
    armR: 0.35,
    armLx: 0, // arms swinging forwards, for punches
    armRx: 0,
    eyes: time % 4.2 > 4.05 ? CLOSED : 1, // blink
    eyeSize: 1,
    mouth: 0,
    wag: 1,
    pupilX: v.look.x * 0.05,
    pupilY: v.look.y * 0.04,
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

  switch (v.state === 'reacting' || v.state === 'acting' ? v.detail : v.state) {
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
      const eaten = clamp01((t - 0.5) / 1.8);
      show(P.food, 0, 0.9 + clamp01(t / 0.5) * 1.2, 1.4, 0.85 * (1 - eaten * 0.85));
      if (t > 0.5 && t < 2.4) T.mouth = 0.25 + 0.75 * Math.abs(Math.sin(t * 10));
      if (t >= 2.4) T.eyes = CLOSED;
      break;
    }

    case 'milk':
      if (t < CUES.burp) {
        show(P.milk, 0.42, 2.45, 1.35, 0.8);
        T.headRx = -0.28;
        T.mouth = 0.35;
        T.armR = 1.9;
      } else {
        T.mouth = 1;
        T.eyeSize = 1.25;
        T.headRx = 0.12;
        T.squash = -0.05 * Math.exp(-(t - CUES.burp) * 4);
      }
      break;

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

    case 'swing': {
      const ramp = Math.min(1, t / 0.8, Math.max(0, (ACTIONS.swing.ms / 1000 - t) / 0.8));
      const angle = Math.sin((t * TWO_PI) / CUES.swing) * 0.42 * ramp;
      P.swing.visible = true;
      P.swing.rotation.x = -angle;
      T.rx = -angle;
      T.z = Math.sin(angle) * SWING_LENGTH;
      T.y = SWING_TOP - Math.cos(angle) * SWING_LENGTH + 0.06;
      T.armL = -2.75;
      T.armR = 2.75;
      T.mouth = 0.6 + 0.3 * Math.abs(Math.sin(angle * 3));
      T.eyeSize = 1.15;
      T.headRx = angle * 0.3;
      T.wag = 3;
      break;
    }

    case 'boxing': {
      const victory = t - (ACTIONS.boxing.ms / 1000 - 0.9);
      P.bag.visible = true;
      for (const glove of P.gloves) glove.visible = true;
      if (victory < 0) {
        const beat = t / CUES.jab; // one punch per beat, arms taking turns
        const punch = Math.sin((beat % 1) * Math.PI);
        const left = Math.floor(beat) % 2 === 0;
        T.ry = 0.9;
        T.armL = -0.15;
        T.armR = 0.15;
        T.armLx = left ? -1.5 * punch : -0.5;
        T.armRx = left ? -0.5 : -1.5 * punch;
        T.y = Math.abs(Math.sin(t * 9)) * 0.08;
        T.headRx = 0.1;
        T.mouth = punch > 0.6 ? 0.5 : 0.1;
        P.bag.rotation.z = Math.sin(((beat + 0.6) % 1) * Math.PI) ** 2 * 0.2;
      } else {
        T.armL = -2.6;
        T.armR = 2.6;
        T.y = arc(victory / 0.6) * 0.6;
        T.mouth = 0.9;
        T.eyes = CLOSED;
        P.bag.rotation.z = Math.sin(t * 6) * 0.05;
      }
      break;
    }

    case 'bubbles':
      T.mouth = 0.3;
      T.headRx = -0.12;
      T.armR = 1.6;
      P.bubbles.forEach((bubble, i) => {
        const p = (t - 0.2 - i * 0.35) / 2.1;
        if (p <= 0 || p >= 1) return;
        show(bubble, Math.sin(i * 2.3) * 1.3 * p + Math.sin(t * 3 + i) * 0.08, 2.45 + p * 2.4, 1.3 + Math.cos(i * 1.7) * 0.4 * p, 0.1 + p * 0.22 + (i % 3) * 0.03);
      });
      break;

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

  const C = v.cur ?? (v.cur = { ...T });
  const ease = snap ? 1 : 1 - Math.exp(-dt * 22);
  for (const key in T) C[key] += (T[key] - C[key]) * ease;

  m.root.position.set(0, C.y, C.z);
  m.root.rotation.set(C.rx, C.ry, C.rz);
  m.root.scale.set(1 + C.squash * 0.5, 1 - C.squash, 1 + C.squash * 0.5);
  m.head.rotation.set(C.headRx, C.headRy, C.headRz);
  m.armL.rotation.set(C.armLx, 0, C.armL);
  m.armR.rotation.set(C.armRx, 0, C.armR);
  v.wagPhase += dt * 6 * C.wag;
  m.tail.rotation.z = Math.sin(v.wagPhase) * 0.16;
  for (const eye of m.eyes) eye.scale.set(C.eyeSize, C.eyes * C.eyeSize, 1);
  for (const pupil of m.pupils) pupil.position.set(C.pupilX, C.pupilY, 0.09);
  m.mouth.visible = C.mouth > 0.08;
  m.smile.visible = !m.mouth.visible;
  m.mouth.scale.set(1 + C.mouth * 0.15, C.mouth, 1);
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

function createScene(pet, renderer) {
  const scene = new THREE.Scene();

  // Light bouncing in from all around, as in a photo studio. This is what makes
  // the eyes glint and the fur look soft rather than flat.
  const studio = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio, 0.04).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
  disposeScene(studio);

  const key = new THREE.DirectionalLight('#fff1dd', 2.0);
  key.position.set(2.5, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
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
function frame(camera, aspect) {
  const distance = 11.2 * Math.max(1, 0.62 / aspect);
  camera.aspect = aspect;
  camera.position.set(0, 3.1, distance);
  camera.lookAt(0, 2.45, 0);
  camera.updateProjectionMatrix();
}

function newRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps bright colours true instead of washing them out
  return renderer;
}

const newViewState = () => ({ state: 'idle', detail: null, t: 0, time: 0, mouth: 0, look: { x: 0, y: 0 }, wagPhase: 0, cur: null });

function disposeScene(scene) {
  scene.traverse((item) => {
    item.geometry?.dispose();
    item.material?.map?.dispose();
    item.material?.dispose();
  });
  scene.environment?.dispose();
}

// Still pictures of each pet for the picker, as { id: dataURL }.
export function renderThumbnails(pets, width = 240, height = 300) {
  const renderer = newRenderer();
  renderer.setSize(width, height, false);
  const images = {};
  for (const pet of pets) {
    const { scene, camera, model } = createScene(pet, renderer);
    frame(camera, width / height);
    pose(model, newViewState(), 0, true);
    renderer.render(scene, camera);
    images[pet.id] = renderer.domElement.toDataURL('image/png');
    disposeScene(scene);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return images;
}

// Put a live, animated pet inside `container`. Throws if 3D is unavailable.
export function createPetView(container, pet) {
  const renderer = newRenderer();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const { scene, camera, model } = createScene(pet, renderer);
  const canvas = renderer.domElement;
  container.replaceChildren(canvas);

  const v = newViewState();
  const raycaster = new THREE.Raycaster();

  function step(dt, snap = false) {
    v.t += dt;
    v.time += dt;
    pose(model, v, dt, snap);
    renderer.render(scene, camera);
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    frame(camera, width / height);
    step(0);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  step(0, true);

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    step(Math.min(0.1, (now - last) / 1000));
    last = now;
  });

  return {
    // `detail` is the part poked (reacting) or the button pressed (acting).
    setState(state, detail = null) {
      Object.assign(v, { state, detail, t: 0 });
      // Forget whole turns left over from a spin, so the pet doesn't unwind them.
      v.cur.ry = ((((v.cur.ry + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
      step(0);
    },
    setMouth(level) {
      v.mouth = level;
    },
    // Where the pet should look: x and y from -1 to 1, y up.
    setLook(x, y) {
      v.look = { x, y };
    },
    setAccessory(id) {
      for (const [name, item] of Object.entries(model.accessories)) item.visible = name === id;
      step(0);
    },
    // Which part of the pet is under this screen point: 'head', 'belly', 'tail', 'feet' or null.
    pick(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const point = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(point, camera);
      for (const hit of raycaster.intersectObject(model.root, true)) {
        for (let item = hit.object; item; item = item.parent) {
          if (item.userData.zone) return item.userData.zone;
        }
      }
      return null;
    },
    step,
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
