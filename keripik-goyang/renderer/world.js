// Blocky toy-town world kit: characters with face decals, props, sets.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const tex = {};
const loader = new THREE.TextureLoader();

export async function loadTextures() {
  for (const n of ['pouch-manis', 'pouch-pedas', 'pack-duo', 'pack-duo-blur']) {
    const t = await loader.loadAsync(`/renderer/tex/${n}.jpg`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    tex[n] = t;
  }
}

// ---------- deterministic random ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- easing / math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const arr = (a) => (a.isVector3 ? [a.x, a.y, a.z] : a);
export const lerpV = (a, b, t) => { a = arr(a); b = arr(b); return new THREE.Vector3(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)); };

// ---------- caches ----------
const geoCache = new Map();
export function rbox(w, h, d, r = 0.1) {
  const k = `rb${w}|${h}|${d}|${r}`;
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
  return geoCache.get(k);
}
const matCache = new Map();
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matCache.has(k)) {
    matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...o }));
  }
  return matCache.get(k);
}
export function glow(color, intensity = 1.5) {
  return mat(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
}
export function mesh(geo, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function box(w, h, d, color, x, y, z, parent, r = 0.04) {
  return mesh(rbox(w, h, d, r), typeof color === 'string' ? mat(color) : color, x, y, z, parent);
}

// ---------- canvas textures ----------
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export const FONT = '"Fredoka", "Baloo 2", "Arial Black", "DejaVu Sans", sans-serif';

export function textPlane(text, w, h, { bg = '#ffffff', fg = '#222', font = 900, size = 0.6, emissive = 0, stroke = null, sub = null } = {}) {
  const pw = 1024, ph = Math.round(1024 * h / w);
  const t = canvasTex(pw, ph, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, pw, ph); }
    g.fillStyle = fg;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = ph * size;
    g.font = `${font} ${fs}px ${FONT}`;
    while (g.measureText(text).width > pw * 0.92) { fs *= 0.92; g.font = `${font} ${fs}px ${FONT}`; }
    const y = sub ? ph * 0.4 : ph / 2;
    if (stroke) { g.lineWidth = fs * 0.12; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(text, pw / 2, y); }
    g.fillText(text, pw / 2, y);
    if (sub) { g.font = `700 ${ph * 0.2}px ${FONT}`; g.fillText(sub, pw / 2, ph * 0.78); }
  });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: emissive ? '#ffffff' : '#000000', emissiveMap: emissive ? t : null, emissiveIntensity: emissive });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.receiveShadow = true;
  return p;
}

// ---------- faces ----------
const faceCache = new Map();
export function faceTex(expr = 'smile', opt = {}) {
  const k = expr + JSON.stringify(opt);
  if (faceCache.has(k)) return faceCache.get(k);
  const t = canvasTex(256, 256, (g) => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const ink = '#1d1d1f';
    const L = [86, 112], R = [170, 112];
    const dotEye = ([x, y], s = 1) => {
      g.fillStyle = ink; g.beginPath(); g.ellipse(x, y, 13 * s, 19 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 4 * s, y - 7 * s, 5 * s, 0, Math.PI * 2); g.fill();
    };
    const happyEye = ([x, y]) => { g.strokeStyle = ink; g.lineWidth = 11; g.beginPath(); g.moveTo(x - 20, y + 8); g.lineTo(x, y - 10); g.lineTo(x + 20, y + 8); g.stroke(); };
    const closedEye = ([x, y]) => { g.strokeStyle = ink; g.lineWidth = 10; g.beginPath(); g.arc(x, y - 6, 18, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); };
    const wideEye = ([x, y]) => {
      g.fillStyle = '#fff'; g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = ink; g.beginPath(); g.arc(x, y + 2, 11, 0, Math.PI * 2); g.fill();
    };
    const brows = (kind) => {
      g.strokeStyle = ink; g.lineWidth = 10;
      const b = (x, y1, y2) => { g.beginPath(); g.moveTo(x - 22, y1); g.lineTo(x + 22, y2); g.stroke(); };
      if (kind === 'angry') { b(L[0], 70, 84); b(R[0], 84, 70); }
      if (kind === 'worried') { b(L[0], 82, 70); b(R[0], 70, 82); }
      if (kind === 'up') { b(L[0], 66, 62); b(R[0], 62, 66); }
    };
    const mouth = (kind) => {
      g.strokeStyle = ink; g.lineWidth = 10;
      const cx = 128, cy = 178;
      if (kind === 'smile') { g.beginPath(); g.arc(cx, cy - 22, 36, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke(); }
      if (kind === 'flat') { g.beginPath(); g.moveTo(cx - 26, cy); g.lineTo(cx + 26, cy); g.stroke(); }
      if (kind === 'smirk') { g.beginPath(); g.moveTo(cx - 28, cy + 2); g.quadraticCurveTo(cx + 5, cy + 10, cx + 30, cy - 8); g.stroke(); }
      if (kind === 'frown') { g.beginPath(); g.arc(cx, cy + 30, 30, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); }
      if (kind === 'wavy') { g.beginPath(); g.moveTo(cx - 32, cy); for (let i = 0; i <= 4; i++) g.lineTo(cx - 32 + i * 16, cy + (i % 2 ? -8 : 6)); g.stroke(); }
      if (kind === 'grin' || kind === 'laugh') {
        const r = kind === 'laugh' ? 46 : 38;
        g.fillStyle = '#a3171d'; g.beginPath(); g.moveTo(cx - r, cy - 16); g.lineTo(cx + r, cy - 16); g.arc(cx, cy - 16, r, 0, Math.PI); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.fillRect(cx - r + 8, cy - 16, 2 * r - 16, 11);
        g.fillStyle = '#f07a8a'; g.beginPath(); g.ellipse(cx, cy + r - 28, r * 0.5, 12, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.moveTo(cx - r, cy - 16); g.lineTo(cx + r, cy - 16); g.arc(cx, cy - 16, r, 0, Math.PI); g.closePath(); g.stroke();
      }
      if (kind === 'O') { g.fillStyle = '#a3171d'; g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.ellipse(cx, cy, 18, 24, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
      if (kind === 'o') { g.fillStyle = '#a3171d'; g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.ellipse(cx, cy, 10, 13, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
      if (kind === 'chew1') { g.beginPath(); g.moveTo(cx - 24, cy - 4); g.quadraticCurveTo(cx, cy + 14, cx + 24, cy - 4); g.stroke(); g.fillStyle = '#f0b072'; g.beginPath(); g.arc(cx + 40, cy - 10, 14, 0, Math.PI * 2); g.fill(); }
      if (kind === 'chew2') { g.fillStyle = '#a3171d'; g.beginPath(); g.ellipse(cx, cy - 2, 20, 12, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#f0b072'; g.beginPath(); g.arc(cx - 40, cy - 10, 14, 0, Math.PI * 2); g.fill(); }
      if (kind === 'tongue') {
        g.fillStyle = '#a3171d'; g.beginPath(); g.arc(cx, cy - 14, 36, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#f0607a'; g.beginPath(); g.ellipse(cx + 8, cy + 26, 17, 24, 0.2, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    };
    const E = {
      smile: ['dot', 'smile'], neutral: ['dot', 'flat'], grin: ['dot', 'grin'], laugh: ['happy', 'laugh'],
      shock: ['wide', 'O', 'up'], wink: ['wink', 'grin'], determined: ['dot', 'smirk', 'angry'],
      worried: ['dot', 'wavy', 'worried'], sad: ['dot', 'frown', 'worried', 'tear'], chew1: ['happy', 'chew1'],
      chew2: ['happy', 'chew2'], sing: ['closed', 'O'], focus: ['dot', 'flat', 'angry'], proud: ['closed', 'smirk'],
      tongue: ['happy', 'tongue'], surprised: ['dot', 'o', 'up'], happy: ['happy', 'smile'],
    }[expr] || ['dot', 'smile'];
    const [eyes, m, br, extra] = E;
    if (opt.blush !== false) {
      g.fillStyle = 'rgba(255,120,130,0.35)';
      g.beginPath(); g.ellipse(58, 160, 20, 12, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(198, 160, 20, 12, 0, 0, Math.PI * 2); g.fill();
    }
    if (eyes === 'dot') { dotEye(L); dotEye(R); }
    if (eyes === 'happy') { happyEye(L); happyEye(R); }
    if (eyes === 'closed') { closedEye(L); closedEye(R); }
    if (eyes === 'wide') { wideEye(L); wideEye(R); }
    if (eyes === 'wink') { dotEye(L); happyEye(R); }
    if (br) brows(br);
    mouth(m);
    if (extra === 'tear') { g.fillStyle = '#5ab0ff'; g.beginPath(); g.moveTo(R[0] + 4, 132); g.quadraticCurveTo(R[0] + 18, 160, R[0] + 4, 166); g.quadraticCurveTo(R[0] - 10, 160, R[0] + 4, 132); g.fill(); }
    if (opt.glasses) {
      g.strokeStyle = opt.glassesColor || '#222'; g.lineWidth = 8;
      for (const [x, y] of [L, R]) { g.beginPath(); g.roundRect(x - 30, y - 28, 60, 54, 14); g.stroke(); }
      g.beginPath(); g.moveTo(L[0] + 30, 108); g.lineTo(R[0] - 30, 108); g.stroke();
    }
    if (opt.shades) {
      g.fillStyle = '#111';
      for (const [x, y] of [L, R]) { g.beginPath(); g.roundRect(x - 34, y - 22, 68, 46, 16); g.fill(); }
      g.fillRect(L[0], 100, R[0] - L[0], 10);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(L[0] - 22, 98, 14, 8); g.fillRect(R[0] - 22, 98, 14, 8);
    }
  });
  faceCache.set(k, t);
  return t;
}

// ---------- characters ----------
export const PALETTE = {
  hero: { skin: '#f1c27d', shirt: '#f08a1c', pants: '#2d3a5e', shoes: '#e63232', hat: 'bandana', hatColor: '#d7262b', hair: 'spiky', hairColor: '#3b2416', hoodie: true },
  bayu: { skin: '#c68a5a', shirt: '#2fae6a', pants: '#3a3a48', shoes: '#ffffff', hair: 'curly', hairColor: '#1e1410' },
  sari: { skin: '#e8b98e', shirt: '#f48fb1', pants: '#6a4c93', shoes: '#ffffff', hair: 'long', hairColor: '#2a1a12', glasses: true },
  grandma: { skin: '#f0c9a4', shirt: '#9b7fd4', pants: '#6b6b80', shoes: '#ddd', hair: 'bun', hairColor: '#e6e6e6', glasses: true },
};
const CROWD_SHIRTS = ['#e85d75', '#4d96ff', '#ffd93d', '#6bcb77', '#c77dff', '#ff922b', '#20c997', '#f06595', '#74c0fc', '#ffa94d'];
const CROWD_SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d4a373'];
const CROWD_HAIR = ['short', 'curly', 'long', 'spiky', 'short', 'none'];
const HAIR_COLORS = ['#2b1d14', '#6b4226', '#111', '#c9a227', '#3b2416'];
export function crowdLook(r) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  return { skin: pick(CROWD_SKIN), shirt: pick(CROWD_SHIRTS), pants: pick(['#2d3a5e', '#444', '#5c4033', '#264653']), shoes: '#fff', hair: pick(CROWD_HAIR), hairColor: pick(HAIR_COLORS) };
}

export function partyHat(color = '#ff4d6d', color2 = '#ffd93d') {
  const t = canvasTex(128, 128, (g) => {
    g.fillStyle = color; g.fillRect(0, 0, 128, 128);
    g.fillStyle = color2;
    for (let i = -2; i < 8; i++) { g.save(); g.translate(i * 32, 0); g.rotate(0.5); g.fillRect(0, -50, 12, 260); g.restore(); }
  });
  const grp = new THREE.Group();
  const cone = mesh(new THREE.ConeGeometry(0.36, 0.95, 24), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), 0, 0.47, 0, grp);
  mesh(new THREE.SphereGeometry(0.12, 12, 12), mat(color2), 0, 0.97, 0, grp);
  cone.castShadow = true;
  return grp;
}

export function makeChar(look = {}) {
  const c = { skin: '#f1c27d', shirt: '#4d96ff', pants: '#2d3a5e', shoes: '#fff', face: 'smile', ...look };
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 1.6; root.add(hips);
  const legs = [];
  for (const x of [-0.41, 0.41]) {
    const p = new THREE.Group(); p.position.x = x; hips.add(p);
    box(0.8, 1.45, 0.8, c.pants, 0, -0.72, 0, p, 0.12);
    box(0.84, 0.32, 0.98, c.shoes, 0, -1.44, 0.07, p, 0.12);
    legs.push(p);
  }
  const body = new THREE.Group(); hips.add(body);
  box(1.66, 1.62, 0.84, c.shirt, 0, 0.8, 0, body, 0.16);
  if (c.hoodie) {
    box(0.06, 0.55, 0.05, '#ffd43b', -0.22, 1.0, 0.43, body, 0.02);
    box(0.06, 0.55, 0.05, '#ffd43b', 0.22, 1.0, 0.43, body, 0.02);
    box(1.0, 0.36, 0.06, '#e07a10', 0, 0.42, 0.43, body, 0.05); // pocket
    box(1.25, 0.42, 0.5, c.shirt, 0, 1.62, -0.3, body, 0.18); // hood
  }
  const arms = [];
  for (const [i, x] of [[0, -1.21], [1, 1.21]]) {
    const p = new THREE.Group(); p.position.set(x, 1.42, 0); body.add(p);
    box(0.74, 1.12, 0.76, c.sleeve || c.shirt, 0, -0.45, 0, p, 0.14);
    box(0.64, 0.44, 0.66, c.skin, 0, -1.22, 0, p, 0.14);
    const grip = new THREE.Group(); grip.position.set(0, -1.4, 0.1); p.add(grip);
    p.userData.grip = grip;
    arms.push(p);
  }
  const head = new THREE.Group(); head.position.y = 1.62; body.add(head);
  box(1.16, 1.1, 1.08, c.skin, 0, 0.58, 0, head, 0.3);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex(c.face, { glasses: c.glasses, shades: c.shades }), transparent: true, depthWrite: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), faceMat);
  face.position.set(0, 0.55, 0.545);
  head.add(face);
  // hair
  const hc = c.hairColor || '#2b1d14';
  if (c.hair === 'short') { box(1.22, 0.34, 1.14, hc, 0, 1.12, -0.02, head, 0.15); box(1.22, 0.6, 0.3, hc, 0, 0.85, -0.42, head, 0.12); }
  if (c.hair === 'spiky') {
    box(1.2, 0.26, 1.12, hc, 0, 1.12, 0, head, 0.1);
    for (let i = 0; i < 5; i++) { const s = box(0.3, 0.36, 0.3, hc, -0.45 + i * 0.22, 1.32, -0.1 + (i % 2) * 0.2, head, 0.06); s.rotation.z = (i - 2) * 0.2; }
  }
  if (c.hair === 'curly') { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mesh(new THREE.SphereGeometry(0.26, 10, 8), mat(hc), Math.cos(a) * 0.45, 1.18 + (i % 3) * 0.04, Math.sin(a) * 0.4 - 0.05, head); } mesh(new THREE.SphereGeometry(0.4, 12, 10), mat(hc), 0, 1.25, -0.05, head); }
  if (c.hair === 'long') { box(1.24, 0.32, 1.16, hc, 0, 1.12, 0, head, 0.14); box(1.26, 1.2, 0.34, hc, 0, 0.55, -0.42, head, 0.12); box(0.22, 0.9, 0.9, hc, -0.6, 0.65, -0.05, head, 0.08); box(0.22, 0.9, 0.9, hc, 0.6, 0.65, -0.05, head, 0.08); }
  if (c.hair === 'bun') { box(1.22, 0.3, 1.14, hc, 0, 1.12, 0, head, 0.14); mesh(new THREE.SphereGeometry(0.34, 14, 12), mat(hc), 0, 1.45, -0.15, head); }
  let hat = null;
  if (c.hat === 'bandana') {
    const hb = c.hatColor;
    box(1.24, 0.3, 1.16, hb, 0, 1.0, 0, head, 0.1);
    const k1 = box(0.16, 0.42, 0.12, hb, -0.12, 0.85, -0.62, head, 0.05); k1.rotation.z = 0.5;
    const k2 = box(0.16, 0.42, 0.12, hb, 0.14, 0.82, -0.62, head, 0.05); k2.rotation.z = -0.4;
    // white polka dots on band front
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.035, 6, 6), mat('#fff'), -0.4 + i * 0.27, 1.02, 0.585, head);
  }
  if (c.party) { hat = partyHat(c.party[0], c.party[1]); hat.position.set(0.12, 1.12, 0); hat.rotation.z = -0.18; head.add(hat); }
  const ch = { root, hips, body, head, arms, legs, face, faceMat, look: c, expr: c.face, hat };
  return ch;
}

export function setFace(ch, expr) {
  if (ch.expr === expr) return;
  ch.expr = expr;
  ch.faceMat.map = faceTex(expr, { glasses: ch.look.glasses, shades: ch.look.shades });
  ch.faceMat.needsUpdate = true;
}

export function resetPose(ch) {
  ch.root.rotation.set(0, ch.root.rotation.y, 0);
  ch.hips.position.y = 1.6;
  ch.body.rotation.set(0, 0, 0);
  ch.head.rotation.set(0, 0, 0);
  for (const a of ch.arms) a.rotation.set(0, 0, 0);
  for (const l of ch.legs) l.rotation.set(0, 0, 0);
}

// pose library; t = seconds, s = per-character phase offset
export const pose = {
  idle(ch, t, s = 0) {
    resetPose(ch);
    const b = Math.sin((t + s) * 2.2);
    ch.hips.position.y = 1.6 + b * 0.02;
    ch.arms[0].rotation.z = -0.08 - b * 0.03; ch.arms[1].rotation.z = 0.08 + b * 0.03;
    ch.head.rotation.y = Math.sin((t + s) * 0.7) * 0.08;
  },
  dance(ch, t, s = 0, energy = 1) {
    resetPose(ch);
    const w = (t + s) * 7.5;
    const bob = Math.abs(Math.sin(w / 2));
    ch.hips.position.y = 1.6 + bob * 0.22 * energy;
    ch.body.rotation.z = Math.sin(w / 2) * 0.12 * energy;
    ch.body.rotation.y = Math.sin(w / 4) * 0.25 * energy;
    ch.arms[0].rotation.z = -2.4 + Math.sin(w) * 0.5; ch.arms[0].rotation.x = Math.sin(w / 2) * 0.3;
    ch.arms[1].rotation.z = 2.4 + Math.sin(w + 1.5) * 0.5; ch.arms[1].rotation.x = Math.cos(w / 2) * 0.3;
    ch.legs[0].rotation.x = Math.max(0, Math.sin(w / 2)) * -0.5 * energy;
    ch.legs[1].rotation.x = Math.max(0, -Math.sin(w / 2)) * -0.5 * energy;
    ch.head.rotation.z = Math.sin(w / 2) * 0.15;
  },
  cheer(ch, t, s = 0) {
    resetPose(ch);
    const w = (t + s) * 9;
    ch.hips.position.y = 1.6 + Math.abs(Math.sin(w / 2)) * 0.25;
    ch.arms[0].rotation.z = -2.7 + Math.sin(w) * 0.25; ch.arms[1].rotation.z = 2.7 - Math.sin(w) * 0.25;
  },
  laugh(ch, t, s = 0) {
    resetPose(ch);
    const w = (t + s) * 16;
    ch.body.rotation.x = -0.15 + Math.sin(w) * 0.06;
    ch.head.rotation.x = -0.25 + Math.sin(w) * 0.08;
    ch.arms[0].rotation.set(-0.6, 0, -0.5 + Math.sin(w) * 0.1);
    ch.arms[1].rotation.set(-0.6, 0, 0.5 - Math.sin(w) * 0.1);
    ch.hips.position.y = 1.6 + Math.abs(Math.sin(w)) * 0.06;
  },
  point(ch, t, s = 0) {
    pose.laugh(ch, t, s);
    ch.arms[1].rotation.set(-1.45, 0, 0.1);
  },
  walk(ch, t, s = 0, speed = 1) {
    resetPose(ch);
    const w = (t + s) * 7 * speed;
    ch.legs[0].rotation.x = Math.sin(w) * 0.6; ch.legs[1].rotation.x = -Math.sin(w) * 0.6;
    ch.arms[0].rotation.x = -Math.sin(w) * 0.55; ch.arms[1].rotation.x = Math.sin(w) * 0.55;
    ch.hips.position.y = 1.6 + Math.abs(Math.cos(w)) * 0.1;
  },
  shrug(ch, t, s = 0) {
    resetPose(ch);
    const u = ease(clamp(t * 3));
    ch.arms[0].rotation.set(-0.5 * u, 0, -0.9 * u); ch.arms[1].rotation.set(-0.5 * u, 0, 0.9 * u);
    ch.head.rotation.z = 0.2 * u;
    ch.body.rotation.y = 0;
  },
  sit(ch, t, s = 0) {
    resetPose(ch);
    ch.hips.position.y = 0.9;
    ch.legs[0].rotation.x = -1.35; ch.legs[1].rotation.x = -1.35;
    ch.arms[0].rotation.set(-0.5, 0, -0.1); ch.arms[1].rotation.set(-0.5, 0, 0.1);
    ch.body.rotation.x = 0.15;
    ch.head.rotation.x = 0.25 + Math.sin(t * 1.5) * 0.03;
  },
};

// ---------- props ----------
export function basketball(r = 0.45) {
  const t = canvasTex(256, 128, (g) => {
    g.fillStyle = '#e8701a'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#2a1408'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); g.stroke();
    for (const x of [64, 192]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    g.beginPath(); g.ellipse(128, 64, 40, 70, 0, 0, Math.PI * 2); g.stroke();
  });
  return mesh(new THREE.SphereGeometry(r, 24, 18), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }));
}

const pouchGeoCache = {};
export function pouch(flavor = 'manis', scale = 1) {
  const W = 1, H = 1.56, D = 0.34;
  if (!pouchGeoCache.g) {
    const g = new THREE.BoxGeometry(W, H, D, 16, 24, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (W / 2), y = p.getY(i) / (H / 2);
      const f = Math.max(0.12, (1 - Math.pow(Math.abs(x), 6)) * (1 - Math.pow(Math.abs(y + 0.15 > 1 ? 1 : y), 6)));
      const top = y > 0.85 ? 0.15 : 1; // flat sealed top
      p.setZ(i, p.getZ(i) * f * top);
    }
    g.computeVertexNormals();
    pouchGeoCache.g = g;
  }
  const map = tex[flavor === 'pedas' ? 'pouch-pedas' : 'pouch-manis'];
  const side = flavor === 'pedas' ? '#b3121c' : '#f08c12';
  const front = new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.05 });
  const sideM = mat(side, { roughness: 0.4 });
  // BoxGeometry groups: px, nx, py, ny, pz, nz
  const m = new THREE.Mesh(pouchGeoCache.g, [sideM, sideM, sideM, sideM, front, front]);
  m.castShadow = true; m.receiveShadow = true;
  m.scale.setScalar(scale);
  return m;
}

export function chip(color = '#f0a030') {
  const g = new THREE.SphereGeometry(0.22, 12, 8);
  g.scale(1, 0.25, 0.8);
  const m = mesh(g, mat(color, { roughness: 0.6 }));
  return m;
}

export function hoop(height = 8.2) {
  const g = new THREE.Group();
  box(0.3, height + 1.2, 0.3, '#5b6170', 0, (height + 1.2) / 2, -1.2, g);
  box(0.3, 0.3, 1.2, '#5b6170', 0, height + 1.0, -0.6, g);
  const bbT = canvasTex(256, 170, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 170);
    c.strokeStyle = '#d62828'; c.lineWidth = 10; c.strokeRect(5, 5, 246, 160);
    c.strokeRect(88, 70, 80, 60);
  });
  const bb = mesh(new THREE.BoxGeometry(3.6, 2.4, 0.15), [mat('#ddd'), mat('#ddd'), mat('#ddd'), mat('#ddd'), new THREE.MeshStandardMaterial({ map: bbT, roughness: 0.5 }), mat('#ddd')], 0, height + 1.0, 0, g);
  const rim = mesh(new THREE.TorusGeometry(0.72, 0.06, 8, 32), mat('#ff6a00', { roughness: 0.4 }), 0, height, 0.85, g);
  rim.rotation.x = Math.PI / 2;
  const net = mesh(new THREE.CylinderGeometry(0.72, 0.45, 0.9, 16, 3, true), new THREE.MeshStandardMaterial({ color: '#ffffff', wireframe: true }), 0, height - 0.45, 0.85, g);
  net.castShadow = false;
  g.userData.rim = v3(0, height, 0.85);
  return g;
}

export function tree(r, x, z, parent, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  box(0.6, 3, 0.6, '#7a4e2d', 0, 1.5, 0, g);
  const greens = ['#4caf50', '#5cbf60', '#43a047'];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    mesh(new THREE.SphereGeometry(1.1 + r() * 0.4, 12, 10), mat(greens[i % 3]), Math.cos(a) * 0.9, 3.6 + r() * 0.8, Math.sin(a) * 0.9, g);
  }
  mesh(new THREE.SphereGeometry(1.4, 12, 10), mat('#4caf50'), 0, 4.6, 0, g);
  if (parent) parent.add(g);
  return g;
}

export function house(r, { x = 0, z = 0, rot = 0, w = 7, h = 5, d = 6, color, roof, night = false, lit = 0.6, party = false } = {}, parent) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  const walls = ['#f4e1c1', '#cfe3f0', '#f6c6c6', '#d8f0c8', '#fff1b8', '#e3d4f5', '#f9d5a7'];
  const roofs = ['#b5523b', '#4a5a8c', '#7c4a3a', '#3e6e5a', '#8c3b5a'];
  box(w, h, d, color || walls[Math.floor(r() * walls.length)], 0, h / 2, 0, g, 0.08);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.4, 0); shape.lineTo(w / 2 + 0.4, 0); shape.lineTo(0, h * 0.55); shape.closePath();
  const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.8, bevelEnabled: false });
  const roofM = mesh(rg, mat(roof || roofs[Math.floor(r() * roofs.length)]), 0, h, -d / 2 - 0.4, g);
  box(0.8, 1.6, 0.8, '#8a5a44', w * 0.25, h + 1.2, 0, g);
  // door + windows on +z face
  box(1.2, 2.2, 0.12, '#7a4a2a', -w * 0.25, 1.1, d / 2 + 0.03, g, 0.04);
  g.userData.windows = [];
  const wins = [[w * 0.18, 1.6], [w * 0.18, h * 0.72], [-w * 0.25, h * 0.72]];
  for (const [wx, wy] of wins) {
    const isLit = night && r() < lit;
    const wc = party ? ['#ff4dd2', '#4dd2ff', '#ffe14d'][Math.floor(r() * 3)] : '#ffd27a';
    const m = box(1.3, 1.1, 0.1, night ? (isLit ? glow(wc, 1.6) : mat('#26304a')) : mat('#9fd3f7', { roughness: 0.2 }), wx, wy, d / 2 + 0.03, g, 0.03);
    m.castShadow = false;
    box(1.5, 0.12, 0.2, '#ffffff', wx, wy - 0.62, d / 2 + 0.06, g, 0.02);
    g.userData.windows.push({ mesh: m, x: wx, y: wy, z: d / 2 + 0.03, lit: isLit });
  }
  if (parent) parent.add(g);
  return g;
}

export function streetLamp(x, z, parent, on = true) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  box(0.22, 7, 0.22, '#3a3f4a', 0, 3.5, 0, g);
  box(0.9, 0.35, 0.6, '#3a3f4a', 0, 7.1, 0, g);
  const bulb = box(0.6, 0.15, 0.4, on ? glow('#fff2c0', 3) : mat('#666'), 0, 6.9, 0, g, 0.03);
  bulb.castShadow = false;
  if (parent) parent.add(g);
  return g;
}

export function stringLights(p0, p1, n, parent, { sag = 1.2, on = true, colors = ['#ff5c8a', '#ffd93d', '#4dd2ff', '#7cff6b', '#ff9f43'] } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.13, 8, 6);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = lerpV(p0, p1, t); p.y -= Math.sin(t * Math.PI) * sag;
    const m = new THREE.Mesh(geo, on ? glow(colors[i % colors.length], 2.5) : mat('#b8b8c0', { roughness: 0.3 }));
    m.position.copy(p); g.add(m);
  }
  const pts = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; const p = lerpV(p0, p1, t); p.y -= Math.sin(t * Math.PI) * sag + 0.1; pts.push(p); }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#222' })));
  if (parent) parent.add(g);
  return g;
}

export function bunting(p0, p1, n, parent, sag = 0.8) {
  const g = new THREE.Group();
  const cols = ['#ff4d6d', '#ffd93d', '#4d96ff', '#6bcb77', '#c77dff', '#ff922b'];
  const tri = new THREE.BufferGeometry().setFromPoints([v3(-0.35, 0, 0), v3(0.35, 0, 0), v3(0, -0.7, 0)]);
  tri.computeVertexNormals();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = lerpV(p0, p1, t); p.y -= Math.sin(t * Math.PI) * sag;
    const m = new THREE.Mesh(tri, mat(cols[i % cols.length], { side: THREE.DoubleSide }));
    m.position.copy(p); m.lookAt(p.clone().add(v3(0, 0, 1)));
    g.add(m);
  }
  if (parent) parent.add(g);
  return g;
}

export function balloon(color, x, y, z, parent) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const b = mesh(new THREE.SphereGeometry(0.55, 16, 14), mat(color, { roughness: 0.3 }), 0, 0, 0, g);
  b.scale.set(1, 1.2, 1);
  const pts = [v3(0, -0.65, 0), v3(0.1, -1.6, 0.05), v3(-0.05, -2.8, 0)];
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#eee' })));
  if (parent) parent.add(g);
  return g;
}

export function fishbowl(parent) {
  const g = new THREE.Group();
  const glass = mesh(new THREE.SphereGeometry(1.0, 32, 24), new THREE.MeshStandardMaterial({ color: '#dff6ff', transparent: true, opacity: 0.13, roughness: 0.05, depthWrite: false }), 0, 1.0, 0, g);
  glass.castShadow = false;
  const water = mesh(new THREE.SphereGeometry(0.96, 32, 24, 0, Math.PI * 2, Math.PI * 0.28, Math.PI * 0.72), new THREE.MeshStandardMaterial({ color: '#5ac8fa', transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }), 0, 1.0, 0, g);
  water.castShadow = false;
  mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.15, 24), mat('#d9c7a0'), 0, 0.1, 0, g);
  // fish
  const fish = new THREE.Group(); fish.position.set(0, 0.95, 0); g.add(fish);
  const bodyG = new THREE.SphereGeometry(0.32, 20, 16); bodyG.scale(1.25, 0.95, 0.75);
  mesh(bodyG, mat('#ff7b1c', { roughness: 0.4 }), 0, 0, 0, fish);
  const tail = mesh(new THREE.ConeGeometry(0.24, 0.42, 4), mat('#ff9a3c', { roughness: 0.4 }), -0.48, 0, 0, fish);
  tail.rotation.z = Math.PI / 2; tail.scale.set(1, 1, 0.3);
  const fin = mesh(new THREE.ConeGeometry(0.12, 0.3, 3), mat('#ff9a3c'), 0.02, 0.3, 0, fish); fin.scale.set(1, 1, 0.3);
  for (const z of [-0.2, 0.2]) {
    mesh(new THREE.SphereGeometry(0.085, 12, 10), mat('#ffffff'), 0.22, 0.08, z, fish);
    mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('#111'), 0.27, 0.08, z * 1.18, fish);
  }
  const hatG = partyHat('#4d96ff', '#ffd93d'); hatG.scale.setScalar(0.35); hatG.position.set(0.05, 0.22, 0); hatG.rotation.z = -0.3; fish.add(hatG);
  g.userData.fish = fish; g.userData.tail = tail;
  if (parent) parent.add(g);
  return g;
}

export function discoBall(parent, y = 9) {
  const t = canvasTex(256, 128, (c) => {
    for (let i = 0; i < 32; i++) for (let j = 0; j < 16; j++) { const v = 150 + ((i * 7 + j * 13) % 105); c.fillStyle = `rgb(${v},${v},${v + 20})`; c.fillRect(i * 8, j * 8, 7, 7); }
  });
  const b = mesh(new THREE.SphereGeometry(0.9, 24, 16), new THREE.MeshStandardMaterial({ map: t, metalness: 0.8, roughness: 0.25, emissive: '#555', emissiveMap: t, emissiveIntensity: 0.5 }), 0, y, 0, parent);
  return b;
}

export function crumbs(parent, n = 14, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const items = [];
  for (let i = 0; i < n; i++) {
    const m = mesh(rbox(0.09 + r() * 0.06, 0.04, 0.08, 0.01), mat(['#f0a030', '#e5782a', '#c9461a'][i % 3]), 0, 0, 0, g);
    items.push({ m, v: v3((r() - 0.5) * 2.2, 0.8 + r() * 1.6, 0.6 + r() * 1.4), spin: r() * 10, delay: r() * 0.08 });
  }
  g.userData.update = (t) => {
    for (const it of items) {
      const tt = Math.max(0, t - it.delay);
      it.m.visible = t > it.delay && tt < 1.2;
      it.m.position.set(it.v.x * tt, it.v.y * tt - 4.9 * tt * tt, it.v.z * tt);
      it.m.rotation.set(it.spin * tt, it.spin * tt * 0.7, 0);
    }
  };
  if (parent) parent.add(g);
  return g;
}

export function confetti(parent, n = 120, seed = 3, area = [10, 12, 6]) {
  const r = rng(seed);
  const g = new THREE.Group();
  const cols = ['#ff4d6d', '#ffd93d', '#4d96ff', '#6bcb77', '#c77dff', '#ff922b'];
  const geo = new THREE.PlaneGeometry(0.16, 0.26);
  const items = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat(cols[i % cols.length], { side: THREE.DoubleSide, emissive: cols[i % cols.length], emissiveIntensity: 0.4 }));
    g.add(m);
    items.push({ m, x: (r() - 0.5) * area[0], y: r() * area[1], z: (r() - 0.5) * area[2], sp: 1.2 + r() * 1.5, ph: r() * 6, rs: 2 + r() * 4 });
  }
  g.userData.update = (t) => {
    for (const it of items) {
      const y = ((it.y - t * it.sp) % area[1] + area[1]) % area[1];
      it.m.position.set(it.x + Math.sin(t * 2 + it.ph) * 0.4, y, it.z);
      it.m.rotation.set(t * it.rs + it.ph, t * it.rs * 0.6, it.ph);
    }
  };
  if (parent) parent.add(g);
  return g;
}
