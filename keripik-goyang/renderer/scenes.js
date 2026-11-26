// Shot library for "In this town" x Keripik Goyang.
// Each scene: (ctx, p, dur) => update(t) ; t = seconds since shot start.
import * as THREE from 'three';
import {
  rng, clamp, lerp, ease, easeOut, v3, lerpV, box, mesh, mat, glow, rbox, canvasTex, textPlane,
  makeChar, setFace, pose, PALETTE, crowdLook, partyHat, basketball, pouch, chip, hoop, tree, house,
  streetLamp, stringLights, bunting, balloon, fishbowl, discoBall, crumbs, confetti, tex, FONT,
} from './world.js';

// ---------------- environment ----------------
function gradientBg(top, bottom) {
  return canvasTex(4, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  });
}

function env(ctx, mode, o = {}) {
  const { scene } = ctx;
  const center = o.center || [0, 0, 0];
  const area = o.area || 30;
  let sun;
  if (mode === 'day') {
    scene.background = gradientBg('#5fb4f5', '#d4efff');
    scene.fog = new THREE.Fog('#cfe9ff', 60, 220);
    scene.add(new THREE.HemisphereLight('#eaf6ff', '#8fb36b', 1.5));
    sun = new THREE.DirectionalLight('#fff4e0', 2.6);
    sun.position.set(center[0] + 25, 45, center[2] + 30);
  } else if (mode === 'night') {
    scene.background = gradientBg('#070d26', '#25366b');
    scene.fog = new THREE.Fog('#16204a', 45, 170);
    scene.add(new THREE.HemisphereLight('#7f96d8', '#1b2236', 0.75));
    sun = new THREE.DirectionalLight('#a9bcff', 1.0);
    sun.position.set(center[0] - 20, 40, center[2] + 20);
  } else { // interior
    scene.background = new THREE.Color(o.bg || '#1a1030');
    scene.add(new THREE.HemisphereLight('#fff0dd', '#3a2a40', o.hemi ?? 0.9));
    sun = new THREE.DirectionalLight('#ffe7c4', o.key ?? 1.2);
    sun.position.set(center[0] + 6, 14, center[2] + 12);
  }
  sun.target.position.set(...center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -area; sc.right = area; sc.top = area; sc.bottom = -area; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  return sun;
}

function ground(ctx, color = '#6dbb5a', size = 400) {
  const g = mesh(new THREE.PlaneGeometry(size, size), mat(color), 0, 0, 0, ctx.scene);
  g.rotation.x = -Math.PI / 2;
  g.castShadow = false;
  return g;
}

function sky(ctx, r, { moon = true, stars = true, clouds = false } = {}) {
  if (stars) {
    const pts = [];
    for (let i = 0; i < 500; i++) {
      const a = r() * Math.PI * 2, e = 0.15 + r() * 1.2;
      pts.push(Math.cos(a) * Math.cos(e) * 150, Math.sin(e) * 150, Math.sin(a) * Math.cos(e) * 150);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    ctx.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.7, fog: false })));
  }
  let moonM = null;
  if (moon) {
    moonM = mesh(new THREE.SphereGeometry(5, 24, 18), new THREE.MeshBasicMaterial({ color: '#fff7d6', fog: false }), -25, 60, -120, ctx.scene);
    moonM.castShadow = false;
  }
  if (clouds) {
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group(); g.position.set(-80 + i * 22 + r() * 8, 35 + r() * 15, -110 - r() * 20);
      for (let j = 0; j < 5; j++) mesh(new THREE.SphereGeometry(4 + r() * 3, 12, 10), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35 }), j * 4 - 8, r() * 2, r() * 3, g);
      ctx.scene.add(g);
    }
  }
  return moonM;
}

function pointLight(ctx, color, intensity, x, y, z, dist = 30) {
  const l = new THREE.PointLight(color, intensity, dist, 1.6);
  l.position.set(x, y, z); ctx.scene.add(l);
  return l;
}

function add(ctx, look, x, z, ry = 0, parent) {
  const ch = makeChar(look);
  ch.root.position.set(x, 0, z); ch.root.rotation.y = ry;
  (parent || ctx.scene).add(ch.root);
  return ch;
}

function hero(ctx, x = 0, z = 0, ry = 0, extra = {}) { return add(ctx, { ...PALETTE.hero, ...extra }, x, z, ry); }

function partyColors(r) {
  const c = ['#ff4d6d', '#4d96ff', '#6bcb77', '#c77dff', '#ff922b', '#ffd93d'];
  return [c[Math.floor(r() * c.length)], c[Math.floor(r() * c.length)]];
}

// camera helper with gentle handheld drift
function camMove(ctx, t, dur, from, to, lookFrom, lookTo, { shake = 0.02, e = ease, fov } = {}) {
  const u = e(clamp(t / dur));
  const p = lerpV(from, to, u);
  const l = lerpV(lookFrom, lookTo || lookFrom, u);
  p.x += Math.sin(t * 1.7) * shake + Math.sin(t * 3.1) * shake * 0.4;
  p.y += Math.sin(t * 2.3 + 1) * shake;
  ctx.camera.position.copy(p);
  ctx.camera.lookAt(l);
  if (fov) { ctx.camera.fov = typeof fov === 'number' ? fov : lerp(fov[0], fov[1], u); ctx.camera.updateProjectionMatrix(); }
}

// ---------------- held items ----------------
function holdPouch(ch, flavor = 'pedas', side = 0) {
  const p = pouch(flavor, 0.86);
  p.position.set(side ? 0.5 : -0.5, 0.95, 0.98);
  p.rotation.set(-0.05, side ? -0.2 : 0.2, side ? -0.06 : 0.06);
  ch.body.add(p);
  ch.arms[side].rotation.set(-1.05, 0, side ? -0.25 : 0.25);
  ch.heldPouch = p;
  return p;
}

// right hand brings a chip to the mouth; returns update(t, biteAt)
function eatRig(ch, seed = 1) {
  const c = chip('#f2a33a');
  c.position.set(0, 0.05, 0.15);
  ch.arms[1].userData.grip.add(c);
  const cr = crumbs(null, 16, seed);
  cr.position.set(0, 1.85, 0.75);
  ch.body.add(cr);
  return (t, bite = 0.05) => {
    const up = ease(clamp((t + 0.3) / 0.3));
    ch.arms[1].rotation.set(lerp(-0.3, -2.0, up), 0, lerp(0, -0.72, up));
    const after = t - bite;
    c.visible = after < 0;
    cr.userData.update(Math.max(0, after));
    cr.visible = after >= 0;
    if (after < 0) setFace(ch, 'tongue');
    else setFace(ch, Math.floor(after / 0.11) % 2 ? 'chew2' : 'chew1');
    ch.head.rotation.x = after >= 0 && after < 0.15 ? -0.12 : 0;
  };
}

// ---------------- sets ----------------
function setTown(ctx, { night = true, party = false, grind = false, dark = false, seed = 11 } = {}) {
  const r = rng(seed);
  env(ctx, night ? 'night' : 'day', { center: [0, 0, -20], area: 60 });
  ground(ctx, '#5fa64f');
  sky(ctx, r, { moon: night, stars: night, clouds: !night });
  box(11, 0.06, 260, '#3b3f4a', 0, 0.03, -60, ctx.scene, 0.01);
  for (let z = -180; z < 40; z += 6) box(0.25, 0.07, 2.6, '#f2c94c', 0, 0.06, z, ctx.scene, 0.01);
  for (const x of [-7.2, 7.2]) box(3.4, 0.25, 260, '#c9c9cf', x, 0.12, -60, ctx.scene, 0.02);
  const lit = grind ? 1 : dark ? 0.12 : 0.55;
  const houses = [];
  for (let i = 0; i < 9; i++) {
    const z = 20 - i * 16;
    const partyHere = party && i === 2;
    houses.push(house(r, { x: -16, z, rot: Math.PI / 2, night, lit, party: partyHere }, ctx.scene));
    houses.push(house(r, { x: 16, z: z - 6, rot: -Math.PI / 2, night, lit }, ctx.scene));
    tree(r, -11, z - 8, ctx.scene, 0.9 + r() * 0.3);
    tree(r, 11, z - 1, ctx.scene, 0.9 + r() * 0.3);
  }
  for (let z = 14; z > -140; z -= 26) { streetLamp(-9.2, z, ctx.scene, night); streetLamp(9.2, z - 13, ctx.scene, night); }
  if (night && !dark) { pointLight(ctx, '#ffd9a0', 30, -8, 6.5, 14 - 26); pointLight(ctx, '#ffd9a0', 30, 8, 6.5, 1 - 26); }
  if (party) {
    for (let k = 0; k < 6; k++) stringLights(v3(-9, 6.8, 10 - k * 18), v3(9, 6.8, 4 - k * 18), 14, ctx.scene, { sag: 1.4 });
    pointLight(ctx, '#ff3fbf', 60, -12, 4, -12, 28);
    pointLight(ctx, '#3fd0ff', 50, -12, 4, -22, 28);
    const pr = rng(seed + 5);
    for (let k = 0; k < 6; k++) balloon(['#ff4d6d', '#ffd93d', '#4d96ff', '#c77dff'][k % 4], -11 + pr() * 2, 3 + pr() * 2, -14 - k * 1.5, ctx.scene);
  }
  return { houses };
}

function setBackyard(ctx, { seed = 21, lights = true } = {}) {
  const r = rng(seed);
  env(ctx, 'night', { center: [0, 0, -3], area: 22 });
  ground(ctx, '#4f8a45');
  const moon = sky(ctx, r, {});
  moon.position.set(14, 48, -90);
  const courtT = canvasTex(512, 512, (g) => {
    g.fillStyle = '#9aa0aa'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3); }
    g.strokeStyle = '#ffffff'; g.lineWidth = 8;
    g.strokeRect(176, 0, 160, 220); g.beginPath(); g.arc(256, 220, 80, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(256, 30, 210, 0.05 * Math.PI, 0.95 * Math.PI); g.stroke();
  });
  const pad = mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshStandardMaterial({ map: courtT, roughness: 0.9 }), 0, 0.02, -3, ctx.scene);
  pad.rotation.x = -Math.PI / 2; pad.castShadow = false;
  const h = hoop(8.2); h.position.set(0, 0, -11.2); ctx.scene.add(h);
  for (let x = -10; x <= 10; x += 1.05) box(0.95, 4, 0.25, x % 2 ? '#8b5e3c' : '#94663f', x, 2, -13.5, ctx.scene, 0.03);
  for (let z = -13; z <= 5; z += 1.05) { box(0.25, 4, 0.95, '#8b5e3c', -10.3, 2, z, ctx.scene, 0.03); box(0.25, 4, 0.95, '#94663f', 10.3, 2, z, ctx.scene, 0.03); }
  house(r, { x: 8, z: -24, night: true, lit: 0.8 }, ctx.scene);
  house(r, { x: -9, z: -26, night: true, lit: 0.6 }, ctx.scene);
  tree(r, -4, -18, ctx.scene, 1.1);
  if (lights) stringLights(v3(-10, 6.5, -13.3), v3(10, 6.5, -13.3), 16, ctx.scene, { sag: 1.0 });
  streetLamp(-8.5, -9, ctx.scene, true);
  pointLight(ctx, '#ffd9a0', 45, -7.6, 6.4, -8, 30);
  pointLight(ctx, '#ffe2b0', 25, 3, 7, 4, 25);
  // bench with the bag
  const bench = new THREE.Group(); bench.position.set(6.2, 0, -2); bench.rotation.y = -0.4; ctx.scene.add(bench);
  box(3.4, 0.22, 1.1, '#a0703f', 0, 1.3, 0, bench); box(3.4, 0.9, 0.18, '#a0703f', 0, 2.0, -0.5, bench);
  for (const x of [-1.4, 1.4]) box(0.18, 1.3, 0.9, '#3a3f4a', x, 0.65, 0, bench);
  const bag = pouch('pedas', 1.0); bag.position.set(0.5, 2.2, 0.05); bag.rotation.set(-0.12, 0, 0); bench.add(bag);
  const b2 = basketball(); b2.position.set(-1.0, 1.85, 0.1); bench.add(b2);
  return { hoop: h, rim: v3(0, 8.2, -11.2 + 0.85), bench, bag, moon };
}

function courtTex() {
  return canvasTex(1024, 560, (g) => {
    g.fillStyle = '#3d7be0'; g.fillRect(0, 0, 1024, 560);
    g.fillStyle = '#f08c12'; g.fillRect(0, 190, 170, 180); g.fillRect(854, 190, 170, 180);
    g.strokeStyle = '#fff'; g.lineWidth = 7;
    g.strokeRect(6, 6, 1012, 548); g.beginPath(); g.moveTo(512, 6); g.lineTo(512, 554); g.stroke();
    g.beginPath(); g.arc(512, 280, 70, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffd93d'; g.beginPath(); g.arc(512, 280, 60, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(170, 280, 90, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.beginPath(); g.arc(854, 280, 90, Math.PI / 2, Math.PI * 1.5); g.stroke();
    g.beginPath(); g.arc(30, 280, 300, -1.2, 1.2); g.stroke();
    g.beginPath(); g.arc(994, 280, 300, Math.PI - 1.2, Math.PI + 1.2); g.stroke();
  });
}

function setDayCourt(ctx, { mood = 'cheer', seed = 31, crowdN = 30, score = [50, 0] } = {}) {
  const r = rng(seed);
  env(ctx, 'day', { center: [0, 0, -4], area: 26 });
  ground(ctx, '#74c05f');
  sky(ctx, r, { moon: false, stars: false, clouds: true });
  const c = mesh(new THREE.PlaneGeometry(30, 16.4), new THREE.MeshStandardMaterial({ map: courtTex(), roughness: 0.6 }), 0, 0.03, 0, ctx.scene);
  c.rotation.x = -Math.PI / 2; c.castShadow = false;
  const hL = hoop(8.2); hL.position.set(-15.5, 0, 0); hL.rotation.y = Math.PI / 2; ctx.scene.add(hL);
  const hR = hoop(8.2); hR.position.set(15.5, 0, 0); hR.rotation.y = -Math.PI / 2; ctx.scene.add(hR);
  // bleachers + crowd
  const crowd = [];
  for (let s = 0; s < 4; s++) box(30, 0.9 + s * 1.0, 1.4, s % 2 ? '#c4c8d2' : '#b2b7c3', 0, (0.9 + s * 1.0) / 2, -10 - s * 1.4, ctx.scene, 0.05);
  for (let i = 0; i < crowdN; i++) {
    const row = i % 4, col = Math.floor(i / 4);
    const x = -13 + col * (26 / (crowdN / 4)) + (row % 2) * 1.4 + (r() - 0.5) * 0.4;
    const look = { ...crowdLook(r), party: partyColors(r) };
    const ch = add(ctx, look, x, -10 - row * 1.4, 0);
    ch.root.position.y = 0.9 + row * 1.0;
    ch.phase = r() * 3;
    crowd.push(ch);
  }
  const banner = textPlane('SUMMER PARTY', 12, 3.6, { bg: '#ffcf33', fg: '#c0392b', size: 0.5, sub: 'BASKETBALL GAME' });
  banner.position.set(0, 9.6, -16.2); ctx.scene.add(banner);
  box(0.3, 10, 0.3, '#666', -6.1, 5, -16.4, ctx.scene); box(0.3, 10, 0.3, '#666', 6.1, 5, -16.4, ctx.scene);
  bunting(v3(-15, 8, -8), v3(15, 8, -8), 22, ctx.scene, 1.0);
  bunting(v3(-15, 9.5, 9), v3(15, 9.5, 9), 22, ctx.scene, 1.2);
  // scoreboard
  const sb = new THREE.Group(); sb.position.set(11, 0, -15); ctx.scene.add(sb);
  box(0.4, 9, 0.4, '#444', 0, 4.5, 0, sb);
  const sbFace = scoreTex(score);
  const sbM = mesh(new THREE.BoxGeometry(6, 3.2, 0.5), [mat('#222'), mat('#222'), mat('#222'), mat('#222'), new THREE.MeshStandardMaterial({ map: sbFace, emissive: '#fff', emissiveMap: sbFace, emissiveIntensity: 0.8 }), mat('#222')], 0, 9.4, 0.3, sb);
  // houses + trees around
  for (let i = 0; i < 6; i++) house(r, { x: -40 + i * 16, z: -34 - r() * 6, night: false }, ctx.scene);
  for (let i = 0; i < 8; i++) tree(r, -34 + i * 10, -24 - r() * 4, ctx.scene, 1.1 + r() * 0.4);
  // speakers
  const spk = speakerStack(ctx, -13.5, -6.5, 0.4);
  return { crowd, banner, scoreboard: sb, sbMesh: sbM, hL, hR, rimR: v3(15.5 - 0.85, 8.2, 0), speakers: spk };
}

function scoreTex([home, guest]) {
  return canvasTex(600, 320, (g) => {
    g.fillStyle = '#141418'; g.fillRect(0, 0, 600, 320);
    g.font = `800 46px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#f5f5f5';
    g.fillText('HOME', 150, 70); g.fillText('GUEST', 450, 70);
    g.font = `900 170px ${FONT}`; g.fillStyle = '#ffb020';
    g.fillText(String(home), 150, 260); g.fillStyle = '#ff4d4d'; g.fillText(String(guest), 450, 260);
  });
}

function speakerStack(ctx, x, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; ctx.scene.add(g);
  const cones = [];
  for (let i = 0; i < 2; i++) {
    box(2.4, 2.6, 1.8, '#26262c', 0, 1.3 + i * 2.65, 0, g, 0.08);
    for (const y of [0.6, -0.55]) {
      const cn = mesh(new THREE.CylinderGeometry(y > 0 ? 0.5 : 0.8, y > 0 ? 0.5 : 0.8, 0.12, 24), mat('#4a4a55', { roughness: 0.4 }), 0, 1.3 + i * 2.65 + y, 0.92, g);
      cn.rotation.x = Math.PI / 2; cones.push(cn);
      const dot = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 16), mat('#111'), 0, 1.3 + i * 2.65 + y, 0.96, g); dot.rotation.x = Math.PI / 2;
    }
  }
  g.userData.cones = cones;
  return g;
}

function setPartyRoom(ctx, { wall = '#2a1446', seed = 41, sign = null, dancers = 5 } = {}) {
  const r = rng(seed);
  env(ctx, 'interior', { bg: '#120a20', center: [0, 0, -2], area: 14, hemi: 0.55, key: 0.5 });
  const floorT = canvasTex(512, 512, (g) => {
    const cols = ['#ff4dd2', '#4dd2ff', '#ffe14d', '#7cff6b', '#ff7a4d', '#a56bff'];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = cols[(i * 3 + j * 5) % cols.length]; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
  });
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
  const floor = mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: floorT, emissive: '#ffffff', emissiveMap: floorT, emissiveIntensity: 0.16, roughness: 0.5 }), 0, 0, -2, ctx.scene);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  box(24, 14, 0.4, wall, 0, 7, -12, ctx.scene); box(0.4, 14, 24, wall, -12, 7, -2, ctx.scene); box(0.4, 14, 24, wall, 12, 7, -2, ctx.scene);
  const disco = discoBall(ctx.scene, 10.5);
  const lights = [pointLight(ctx, '#ff3fbf', 70, -5, 8, -2, 30), pointLight(ctx, '#3fd0ff', 70, 5, 8, -5, 30), pointLight(ctx, '#ffe14d', 30, 0, 9, -5, 26)];
  stringLights(v3(-11.5, 11, -11.5), v3(11.5, 11, -11.5), 20, ctx.scene, { sag: 1.5 });
  if (sign) { const s = textPlane(sign, 6.4, 1.3, { bg: null, fg: '#ff5cd6', size: 0.7, emissive: 1.4, stroke: '#ffffff' }); s.material.transparent = true; s.position.set(0, 8.4, -11.7); ctx.scene.add(s); }
  for (let k = 0; k < 5; k++) balloon(['#ff4d6d', '#ffd93d', '#4d96ff', '#c77dff', '#6bcb77'][k], -10 + k * 0.6, 6 + r() * 2, -10.5 + r(), ctx.scene);
  const crowd = [];
  for (let i = 0; i < dancers; i++) {
    const ch = add(ctx, { ...crowdLook(r), party: partyColors(r) }, -7 + i * (14 / Math.max(1, dancers - 1)) + (r() - 0.5), -7 - r() * 2, (r() - 0.5) * 0.6);
    ch.phase = r() * 3; crowd.push(ch);
  }
  const conf = confetti(ctx.scene, 80, seed, [20, 14, 10]); conf.position.set(0, 0, -3);
  return {
    disco, lights, crowd, conf, floorT,
    update(t) {
      disco.rotation.y = t * 1.2;
      lights[0].position.x = -5 + Math.sin(t * 2.1) * 4; lights[1].position.x = 5 + Math.cos(t * 1.7) * 4;
      lights[2].intensity = 20 + Math.abs(Math.sin(t * 6)) * 25;
      floorT.offset.x = Math.floor(t * 4) * 0.125;
      for (const ch of crowd) { pose.dance(ch, t, ch.phase); setFace(ch, 'laugh'); }
      conf.userData.update(t);
    },
  };
}

function setRoom(ctx, { wall = '#f3d9b1', floor = '#b07a4f', night = true, seed = 51, windowView = true } = {}) {
  const r = rng(seed);
  env(ctx, 'interior', { bg: '#0d1022', center: [0, 0, -2], area: 12, hemi: 0.85, key: 1.1 });
  const f = mesh(new THREE.PlaneGeometry(20, 20), mat(floor, { roughness: 0.6 }), 0, 0, -2, ctx.scene); f.rotation.x = -Math.PI / 2; f.castShadow = false;
  // back wall with window opening
  const wz = -7;
  box(5.5, 12, 0.4, wall, -6.75, 6, wz, ctx.scene); box(5.5, 12, 0.4, wall, 6.75, 6, wz, ctx.scene);
  box(8, 4.5, 0.4, wall, 0, 2.25, wz, ctx.scene); box(8, 3.5, 0.4, wall, 0, 10.25, wz, ctx.scene);
  box(0.4, 12, 16, wall, -9.5, 6, 0, ctx.scene); box(0.4, 12, 16, wall, 9.5, 6, 0, ctx.scene);
  // window frame
  box(8.2, 0.3, 0.6, '#ffffff', 0, 4.6, wz, ctx.scene); box(8.2, 0.3, 0.6, '#ffffff', 0, 8.4, wz, ctx.scene);
  box(0.3, 4, 0.6, '#ffffff', 0, 6.5, wz, ctx.scene);
  if (windowView) {
    const view = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: gradientBg('#060a1f', '#1e2d5c') }));
    view.position.set(0, 6, -25); ctx.scene.add(view);
    for (let i = 0; i < 5; i++) house(r, { x: -16 + i * 8, z: -34, night: true, lit: 0.9 }, ctx.scene);
    const mn = mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff7d6' }), 2.5, 9.5, -24, ctx.scene); mn.castShadow = false;
  }
  // rug, poster, lamp
  const rug = mesh(new THREE.CircleGeometry(4, 32), mat('#e86a4a'), 0, 0.03, -1, ctx.scene); rug.rotation.x = -Math.PI / 2; rug.castShadow = false;
  const lamp = pointLight(ctx, '#ffd59a', 60, -4, 7, 1, 24);
  return { wz, lamp };
}

// ---------------- scenes ----------------
export const SCENES = {
  town_aerial(ctx, p, dur) {
    setTown(ctx, { night: true, party: !!p.party, grind: !!p.grind, dark: !!p.dark });
    if (p.grind || p.dark) return (t) => camMove(ctx, t, dur, [-5, 10, 24], [-3, 8.5, 14], [16, 3, -20], [16, 3.5, -26], { shake: 0.04 });
    return (t) => camMove(ctx, t, dur, [7, 20, 34], [4, 15, 20], [0, 3, -30], [0, 3, -40], { shake: 0.05 });
  },

  street_night(ctx, p, dur) {
    setTown(ctx, { night: true, party: !!p.party, dark: !p.party && !!p.hero, seed: 12 });
    let h = null;
    if (p.hero) { h = hero(ctx, 0, 0, 0); ctx.fill = pointLight(ctx, '#c8d4ff', 30, 2, 7, 4, 26); }
    else {
      const r = rng(9);
      for (let i = 0; i < 3; i++) { const ch = add(ctx, { ...crowdLook(r), party: partyColors(r) }, -9.5 + i * 1.6, -14 - i, 0.6); ch.phase = i; ctx.dancers = (ctx.dancers || []).concat(ch); }
    }
    return (t) => {
      if (h) {
        const z = lerp(-6, 0, t / dur);
        h.root.position.z = z; if (ctx.fill) ctx.fill.position.z = z + 5; pose.walk(h, t); setFace(h, 'worried'); h.head.rotation.y = Math.sin(t * 1.4) * 0.35;
        camMove(ctx, t, dur, [0.5, 5, z + 11], [0.5, 4.6, z + 9], [0, 3.4, z - 2], null, { shake: 0.03 });
        ctx.camera.position.z = z + 10.5; ctx.camera.lookAt(0, 3.3, z - 2);
      } else {
        for (const ch of ctx.dancers) { pose.dance(ch, t, ch.phase); setFace(ch, 'laugh'); }
        camMove(ctx, t, dur, [3, 5.5, 24], [2, 5, 12], [-3, 4, -10], [-5, 4, -16]);
      }
    };
  },

  party_house(ctx, p, dur) {
    const off = !!p.off;
    setTown(ctx, { night: true, party: !off, dark: off, seed: 13 });
    const r = rng(4);
    const dancers = [];
    if (!off) for (let i = 0; i < 5; i++) { const ch = add(ctx, { ...crowdLook(r), party: partyColors(r) }, -11.5 + (i % 2) * 2, -9 - i * 2.2, Math.PI / 2 + (r() - 0.5) * 0.5); ch.phase = r() * 3; dancers.push(ch); }
    else { const b = balloon('#888', -10, 0.6, -12, ctx.scene); b.scale.setScalar(0.7); }
    return (t) => {
      for (const ch of dancers) { pose.dance(ch, t, ch.phase); setFace(ch, 'laugh'); }
      camMove(ctx, t, dur, [6, 4.5, -4], [3.5, 4.2, -8], [-14, 3.5, -14], [-14, 3.8, -16], { shake: 0.03 });
    };
  },

  lights_off(ctx, p, dur) {
    setTown(ctx, { night: true, party: false, dark: true, seed: 14 });
    stringLights(v3(-9, 6.8, 2), v3(9, 6.8, -2), 14, ctx.scene, { sag: 1.4, on: false });
    pointLight(ctx, '#9fb4ff', 18, 0, 3, 6, 20);
    const spk = speakerStack(ctx, -10, -4, 0.8);
    return (t) => camMove(ctx, t, dur, [0, 3.5, 11], [0, 3.8, 9.5], [-3, 5.2, -6], [-4, 5.0, -6]);
  },

  house_windows(ctx, p, dur) {
    setTown(ctx, { night: true, grind: true, seed: 15 });
    return (t) => camMove(ctx, t, dur, [2, 4, -10.5], [4.5, 4.5, -7.5], [16, 4.6, -2], [16, 4.8, -2], { e: easeOut });
  },

  window_kriuk(ctx, p, dur) {
    const who = ['bayu', 'sari', 'grandma'][p.house || 0];
    const wallC = ['#cfe3f0', '#f6c6c6', '#fff1b8'][p.house || 0];
    env(ctx, 'night', { center: [0, 0, -2], area: 12 });
    // facade with window opening, room behind
    const z0 = 0;
    box(6, 12, 0.5, wallC, -5.5, 6, z0, ctx.scene); box(6, 12, 0.5, wallC, 5.5, 6, z0, ctx.scene);
    box(5, 2.8, 0.5, wallC, 0, 1.4, z0, ctx.scene); box(5, 4, 0.5, wallC, 0, 9.8, z0, ctx.scene);
    box(5.4, 0.3, 1.0, '#fff', 0, 2.9, z0 + 0.2, ctx.scene);
    box(0.25, 5, 0.6, '#fff', -2.5, 5.3, z0, ctx.scene); box(0.25, 5, 0.6, '#fff', 2.5, 5.3, z0, ctx.scene);
    box(5, 0.25, 0.6, '#fff', 0, 7.8, z0, ctx.scene);
    box(14, 12, 0.3, '#d9a46a', 0, 6, -6, ctx.scene);
    const ch = add(ctx, { ...PALETTE[who] }, 0, -1.3, 0);
    ch.root.position.y = 0.7;
    holdPouch(ch, who === 'sari' ? 'manis' : 'pedas', 0);
    const eat = eatRig(ch, 7 + (p.house || 0));
    pointLight(ctx, '#ffcf8a', 22, 1.5, 7, -2.5, 14);
    return (t) => {
      pose.idle(ch, t); ch.arms[0].rotation.set(-1.05, 0, 0.25);
      eat(t, 0.06);
      camMove(ctx, t, dur, [0.5, 5.4, 8.4], [0.3, 5.4, 7.6], [0, 5.2, -2], null, { shake: 0.04 });
    };
  },

  hero_close_night(ctx, p, dur) {
    let set;
    if (p.street) { setTown(ctx, { night: true, dark: true, seed: 16 }); pointLight(ctx, '#c8d4ff', 25, 1.5, 6, 5, 20); } else set = setBackyard(ctx);
    const h = hero(ctx, 0, 0, 0);
    let ball = null;
    if (p.ball) { ball = basketball(); h.body.add(ball); ball.position.set(0, 0.7, 1.15); }
    return (t) => {
      pose.idle(h, t);
      if (ball) { h.arms[0].rotation.set(-0.85, 0, 0.5); h.arms[1].rotation.set(-0.85, 0, -0.5); }
      setFace(h, p.face || 'neutral');
      const base = p.street ? [0, 3.9, 4.2] : [0.2, 3.9, 3.9];
      camMove(ctx, t, dur, base, [base[0], base[1], base[2] - 0.8], [0, 3.75, 0], null, { shake: 0.02 });
    };
  },

  hero_eat_chip(ctx, p, dur) {
    const bg = p.bg || 'court';
    if (bg === 'court') setBackyard(ctx); else if (bg === 'day') setDayCourt(ctx, { crowdN: 20 }); else { setRoom(ctx); }
    const h = hero(ctx, 0, 0, 0);
    holdPouch(h, p.flavor || 'pedas', 0);
    const eat = eatRig(h, 5);
    return (t) => {
      pose.idle(h, t); h.arms[0].rotation.set(-1.05, 0, 0.25);
      const bite = p.wink ? 0.12 : 0.04;
      eat(t, bite);
      if (p.wink && t > bite + 0.5) setFace(h, 'wink');
      const zoom = t < bite + 0.1 ? 0 : Math.max(0, 0.25 - (t - bite - 0.1)) * 1.2;
      camMove(ctx, t, dur, [0.2, 3.5, 5.3 - zoom], [0.2, 3.5, 5.0 - zoom], [-0.1, 3.15, 0], null, { shake: 0.03 });
    };
  },

  hero_dribble_night(ctx, p, dur) {
    setBackyard(ctx);
    return dribbleScene(ctx, p, dur, 'night');
  },
  hero_dribble_day(ctx, p, dur) {
    const s = setDayCourt(ctx, {});
    for (const ch of s.crowd) ch.mood = 'cheer';
    return dribbleScene(ctx, p, dur, 'day', s);
  },

  hoop_swish_night(ctx, p, dur) {
    const s = setBackyard(ctx);
    return swishScene(ctx, p, dur, s.rim, v3(0, 0, 1));
  },
  hoop_swish_day(ctx, p, dur) {
    const s = setDayCourt(ctx, {});
    const conf = confetti(ctx.scene, 120, 8, [16, 14, 8]); conf.position.set(10, 0, 0);
    const up = swishScene(ctx, { angle: 3 }, dur, s.rimR, v3(-1, 0, 0));
    return (t) => { up(t); conf.userData.update(t + 2); for (const ch of s.crowd) { pose.cheer(ch, t, ch.phase); setFace(ch, 'laugh'); } };
  },

  pouch_bench_night(ctx, p, dur) {
    const s = setBackyard(ctx);
    const wp = new THREE.Vector3(); s.bag.getWorldPosition(wp);
    const c = chip('#f2a33a'); ctx.scene.add(c);
    return (t) => {
      const u = clamp((t - 0.35) / 0.7);
      c.visible = t > 0.35;
      c.position.set(wp.x, wp.y + 1.0 + easeOut(u) * 1.4, wp.z + 0.2);
      c.rotation.set(t * 3, t * 5, 0.4);
      camMove(ctx, t, dur, [wp.x - 1.2, wp.y + 0.9, wp.z + 4.6], [wp.x - 0.8, wp.y + 0.7, wp.z + 3.7], [wp.x, wp.y - 0.55, wp.z], [wp.x, wp.y - 0.2, wp.z], { shake: 0.015 });
    };
  },

  moon_timelapse(ctx, p, dur) {
    const s = setBackyard(ctx);
    const h = hero(ctx, 0, -2, Math.PI);
    const ball = basketball(); ctx.scene.add(ball);
    return (t) => {
      const T = t * 2.2;
      s.moon.position.set(lerp(-60, 60, t / dur), 30 + Math.sin(t / dur * Math.PI) * 30, -100);
      pose.idle(h, T);
      const ph = (T % 0.9) / 0.9;
      h.arms[0].rotation.set(-2.9 * ease(ph < 0.5 ? ph * 2 : 1), 0, 0); h.arms[1].rotation.set(-2.9 * ease(ph < 0.5 ? ph * 2 : 1), 0, 0);
      h.root.position.y = ph > 0.4 && ph < 0.7 ? Math.sin((ph - 0.4) / 0.3 * Math.PI) * 1.0 : 0;
      const bu = clamp((ph - 0.5) / 0.5);
      const start = v3(0, 5.2, -2.6), end = s.rim;
      ball.position.set(lerp(start.x, end.x, bu), lerp(start.y, end.y, bu) + Math.sin(bu * Math.PI) * 3, lerp(start.z, end.z, bu));
      camMove(ctx, t, dur, [7, 5, 13], [6, 5.5, 12], [0, 6, -6], [0, 6.5, -6], { shake: 0.01 });
    };
  },

  court_day_wide(ctx, p, dur) {
    const s = setDayCourt(ctx, {});
    return (t) => {
      for (const ch of s.crowd) { pose.cheer(ch, t, ch.phase); setFace(ch, 'laugh'); }
      camMove(ctx, t, dur, [-14, 18, 26], [-4, 14, 22], [0, 2, -6], [2, 3, -8], { shake: 0.04 });
    };
  },

  court_banner(ctx, p, dur) {
    const s = setDayCourt(ctx, {});
    const conf = confetti(ctx.scene, 140, 5, [18, 14, 8]); conf.position.set(0, 2, -10);
    return (t) => {
      for (const ch of s.crowd) { pose.cheer(ch, t, ch.phase); setFace(ch, 'laugh'); }
      conf.userData.update(t);
      camMove(ctx, t, dur, [0, 4, 8], [0, 6.5, 5], [0, 6, -14], [0, 9.2, -16], { shake: 0.03 });
    };
  },

  crowd(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 32 + (p.angle || 0) });
    const cams = [
      [[-6, 4.2, 0], [-3, 4.6, -1], [-3, 3.5, -12], [0, 3.8, -12]],
      [[4, 4, -1.5], [3, 4.2, -3], [2, 3.6, -12], [3, 3.8, -12]],
      [[-1, 4.6, -2.5], [-0.5, 4.6, -3.8], [0, 4.2, -12], [0, 4.3, -12]],
    ][p.angle || 0];
    return (t) => {
      for (const ch of s.crowd) {
        if (p.mood === 'laugh') { pose.laugh(ch, t, ch.phase); setFace(ch, 'laugh'); }
        else if (p.mood === 'shock') { pose.idle(ch, t * 0.2, ch.phase); ch.arms[0].rotation.z = -0.3; ch.arms[1].rotation.z = 0.3; setFace(ch, 'shock'); }
        else { pose.cheer(ch, t, ch.phase); setFace(ch, 'laugh'); }
      }
      camMove(ctx, t, dur, ...cams, { shake: 0.03 });
    };
  },

  hero_walk_court(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 33 });
    const h = hero(ctx, 0, 0, 0);
    holdPouch(h, 'manis', 0);
    return (t) => {
      for (const ch of s.crowd) { pose.laugh(ch, t, ch.phase); setFace(ch, 'laugh'); }
      const z = lerp(-4, 0.5, t / dur);
      h.root.position.z = z; pose.walk(h, t, 0, 0.8); h.arms[0].rotation.set(-1.05, 0, 0.25); setFace(h, 'neutral');
      ctx.camera.position.set(0.8 + Math.sin(t * 1.6) * 0.03, 4.0, z + 7.5); ctx.camera.lookAt(0, 3.2, z - 3);
    };
  },

  bayu_point_laugh(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 34 });
    const b = add(ctx, { ...PALETTE.bayu, party: ['#ff4d6d', '#ffd93d'] }, 0, -7.6, 0);
    return (t) => {
      for (const ch of s.crowd) { pose.laugh(ch, t, ch.phase); setFace(ch, 'laugh'); }
      pose.point(b, t); setFace(b, 'laugh');
      camMove(ctx, t, dur, [0.6, 3.9, -3.2], [0.4, 3.9, -3.8], [0, 3.6, -7.6], null, { shake: 0.025 });
    };
  },

  hero_catch_day(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 35 });
    const h = hero(ctx, 0, 0, 0);
    const ball = basketball(); ctx.scene.add(ball);
    return (t) => {
      for (const ch of s.crowd) { pose.idle(ch, t, ch.phase); setFace(ch, 'surprised'); }
      pose.idle(h, t);
      const u = clamp(t / 0.45);
      ball.position.set(lerp(-7, 0, easeOut(u)), lerp(4.5, 2.6, u) + Math.sin(u * Math.PI) * 0.8, lerp(2, 1.3, u));
      const catchU = ease(clamp((t - 0.25) / 0.25));
      h.arms[0].rotation.set(-1.1 * catchU, 0, 0.45 * catchU); h.arms[1].rotation.set(-1.1 * catchU, 0, -0.45 * catchU);
      setFace(h, t > 0.45 ? 'determined' : 'neutral');
      camMove(ctx, t, dur, [-1.2, 3.6, 5.4], [-0.6, 3.7, 4.4], [0, 3.1, 0], [0, 3.4, 0], { shake: 0.02 });
    };
  },

  scoreboard(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 36 });
    return (t) => {
      for (const ch of s.crowd) { pose.idle(ch, t, ch.phase); setFace(ch, 'shock'); }
      camMove(ctx, t, dur, [10.4, 8.6, -2.2], [11, 9.2, -4.0], [11, 9.4, -15], null, { shake: 0.02 });
    };
  },

  hero_proud_day(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 37 });
    const h = hero(ctx, 0, 0, 0);
    const ball = basketball(); h.arms[1].userData.grip.add(ball); ball.position.set(0, -0.2, 0.1);
    const conf = confetti(ctx.scene, 90, 9, [10, 9, 6]); conf.position.set(0, 0, 0);
    return (t) => {
      for (const ch of s.crowd) { pose.idle(ch, t, ch.phase); setFace(ch, 'shock'); }
      pose.idle(h, t); h.arms[1].rotation.set(-2.6, 0, 0.2); h.arms[0].rotation.set(0, 0, -0.1);
      setFace(h, t > 0.3 ? 'wink' : 'proud');
      conf.userData.update(t + 1);
      camMove(ctx, t, dur, [0.3, 3.9, 5.2], [0.3, 3.9, 4.6], [0, 3.9, 0], null, { shake: 0.02 });
    };
  },

  speaker_stop(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 38 });
    const cones = s.speakers.userData.cones;
    const stopAt = 0.35;
    return (t) => {
      for (const ch of s.crowd) { pose.idle(ch, t, ch.phase); setFace(ch, t > stopAt ? 'surprised' : 'laugh'); }
      for (const [i, c] of cones.entries()) { const k = t < stopAt ? 1 + Math.abs(Math.sin(t * 22 + i)) * 0.18 : 1; c.scale.set(k, 1, k); }
      camMove(ctx, t, dur, [-9, 4.2, -1], [-10, 4, -2.2], [-13.5, 3, -6.5], null, { shake: t < stopAt ? 0.06 : 0.0 });
    };
  },

  bayu_walkup(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 39 });
    const h = hero(ctx, 0, 2, Math.PI);
    const b = add(ctx, { ...PALETTE.bayu, party: ['#ff4d6d', '#ffd93d'] }, 0, -6, 0);
    return (t) => {
      for (const ch of s.crowd) { pose.idle(ch, t, ch.phase); setFace(ch, 'shock'); }
      pose.idle(h, t);
      const z = lerp(-6, -2.2, ease(clamp(t / (dur * 0.9))));
      b.root.position.z = z; pose.walk(b, t, 0, 0.7); setFace(b, 'surprised');
      camMove(ctx, t, dur, [1.6, 4.6, 5.8], [1.4, 4.5, 5.0], [0, 3.6, -3], null, { shake: 0.02 });
    };
  },

  bayu_ask(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 40 });
    const b = add(ctx, { ...PALETTE.bayu, party: ['#ff4d6d', '#ffd93d'] }, 0, -2, 0);
    return (t) => {
      for (const ch of s.crowd) { pose.idle(ch, t, ch.phase); setFace(ch, 'shock'); }
      pose.idle(b, t); b.arms[0].rotation.set(-0.5, 0, -0.6); b.arms[1].rotation.set(-0.5, 0, 0.6);
      setFace(b, Math.floor(t / 0.13) % 2 ? 'surprised' : 'shock');
      camMove(ctx, t, dur, [0.2, 3.9, 1.6], [0.2, 3.9, 1.2], [0, 3.8, -2], null, { shake: 0.02 });
    };
  },

  hero_truth(ctx, p, dur) {
    const s = setDayCourt(ctx, { seed: 41 });
    const h = hero(ctx, 0, 0, 0);
    holdPouch(h, 'manis', 0);
    return (t) => {
      for (const ch of s.crowd) { pose.idle(ch, t, ch.phase); setFace(ch, 'shock'); }
      pose.idle(h, t); h.arms[0].rotation.set(-1.05, 0, 0.25);
      setFace(h, 'proud');
      camMove(ctx, t, dur, [0.3, 3.9, 3.8], [0.3, 3.9, 3.3], [0, 3.8, 0], null, { shake: 0.02 });
    };
  },

  hero_wink_chip(ctx, p, dur) {
    return SCENES.hero_eat_chip(ctx, { bg: 'day', wink: true, flavor: 'manis' }, dur);
  },

  grind_room(ctx, p, dur) {
    const who = p.who;
    const walls = { bayu: '#cfe3f0', sari: '#f6d6e0', grandma: '#efe2c4' };
    setRoom(ctx, { wall: walls[who], seed: 60 + who.length });
    const look = { ...PALETTE[who] };
    if (who === 'sari') { look.shirt = '#ffffff'; look.pants = '#ffffff'; }
    const ch = add(ctx, look, 0, -1.5, 0);
    let extra = () => {};
    // desk/table with bag(s)
    box(3.2, 2.4, 1.8, '#8a5a3c', 4.4, 1.2, -2.5, ctx.scene);
    const bags = [];
    if (who === 'grandma') {
      const a = pouch('manis', 0.95); a.position.set(-1.9, 0.75, 1.9); a.rotation.y = 0.75; ctx.scene.add(a); bags.push(a);
      const b = pouch('pedas', 0.95); b.position.set(-2.6, 0.75, -1.0); b.rotation.y = 0.95; ctx.scene.add(b); bags.push(b);
    } else {
      const a = pouch(who === 'sari' ? 'manis' : 'pedas', 0.95); a.position.set(3.9, 3.15, -2.2); a.rotation.y = -0.35; ctx.scene.add(a); bags.push(a);
    }
    if (who === 'bayu') {
      const g = new THREE.Group(); ch.body.add(g); g.position.set(0.05, 0.75, 0.75); g.rotation.z = 0.55;
      const bodyG = mesh(rbox(1.3, 1.6, 0.35, 0.3), mat('#c4692c', { roughness: 0.5 }), 0, -0.2, 0, g);
      mesh(new THREE.CircleGeometry(0.25, 20), mat('#2a1a10'), 0, 0.1, 0.18, g);
      box(0.24, 2.2, 0.16, '#5a3a22', 0, 1.6, 0, g, 0.04);
      box(0.4, 0.5, 0.2, '#3a2416', 0, 2.8, 0, g, 0.05);
      extra = (t) => {
        ch.arms[0].rotation.set(-1.9, 0, 0.75);
        ch.arms[1].rotation.set(-0.9 + Math.sin(t * 18) * 0.25, 0, -0.55);
        ch.head.rotation.x = 0.25 + Math.abs(Math.sin(t * 9)) * 0.08;
        setFace(ch, 'focus');
      };
    }
    if (who === 'sari') {
      const belt = box(1.7, 0.2, 0.9, '#111', 0, 0.35, 0, ch.body, 0.05);
      const mat2 = mesh(new THREE.BoxGeometry(6, 0.12, 4), mat('#3e7cb1'), 0, 0.06, -1.5, ctx.scene);
      const board = box(1.4, 0.15, 0.9, '#d9a066', 2.4, 3.2, -1.5, ctx.scene);
      const board2 = box(1.4, 0.15, 0.9, '#d9a066', 2.4, 3.2, -1.5, ctx.scene);
      box(0.3, 3.1, 0.3, '#666', 2.4, 1.55, -1.5, ctx.scene);
      ch.root.rotation.y = 0.5;
      extra = (t) => {
        const ph = (t % 0.9) / 0.9;
        const chop = ph < 0.35 ? ease(ph / 0.35) : 1 - ease((ph - 0.35) / 0.65) * 0.0;
        ch.arms[1].rotation.set(lerp(-2.8, -1.3, chop), 0, -0.2);
        ch.arms[0].rotation.set(-0.8, 0, 0.6);
        ch.legs[0].rotation.x = -0.3; ch.legs[1].rotation.x = 0.3;
        const broke = t > 0.6;
        board.rotation.z = broke ? 0.5 : 0; board.position.x = broke ? 2.0 : 2.4; board.position.y = broke ? 2.9 : 3.2; board.scale.x = broke ? 0.5 : 1;
        board2.visible = broke; board2.rotation.z = -0.5; board2.position.set(2.85, 2.9, -1.5); board2.scale.x = 0.5;
        setFace(ch, 'determined');
      };
    }
    if (who === 'grandma') {
      extra = (t) => {
        const ph = Math.sin(t * 6.5) * 0.5 + 0.5;
        ch.root.rotation.set(Math.PI / 2 - 0.15 - ph * 0.25, 0, 0);
        ch.root.position.set(0, 0.55 + ph * 0.75, -3.2);
        ch.arms[0].rotation.set(-(Math.PI / 2 - 0.15 - ph * 0.25) + 0.1, 0, 0.05);
        ch.arms[1].rotation.set(-(Math.PI / 2 - 0.15 - ph * 0.25) + 0.1, 0, -0.05);
        ch.head.rotation.x = -0.9;
        setFace(ch, 'determined');
      };
    }
    const cams = {
      bayu: [[-0.8, 4.2, 6.8], [-0.4, 4.0, 5.8], [0.6, 3.2, -1.5]],
      sari: [[-2.0, 4.0, 7.0], [-1.5, 4.0, 6.0], [0.8, 3.2, -1.5]],
      grandma: [[6.8, 3.8, 5.2], [6.0, 3.5, 4.6], [-0.4, 1.3, -0.6]],
    }[who];
    return (t) => {
      pose.idle(ch, t);
      extra(t);
      camMove(ctx, t, dur, cams[0], cams[1], cams[2], null, { shake: 0.02 });
    };
  },

  hero_secret(ctx, p, dur) {
    setRoom(ctx, { wall: '#ffd8a8' });
    const h = hero(ctx, 0, 0, 0);
    const bag = pouch('pedas', 0.8); h.body.add(bag); bag.position.set(1.05, 2.2, 0.9); bag.rotation.set(0, -0.25, -0.12);
    return (t) => {
      pose.idle(h, t);
      h.arms[1].rotation.set(-2.55, 0, -0.05);
      h.head.rotation.y = -0.12;
      setFace(h, 'smile');
      camMove(ctx, t, dur, [0.2, 4.3, 6.2], [0.3, 4.2, 5.4], [0.4, 4.0, 0], null, { shake: 0.02 });
    };
  },

  store_sold_out(ctx, p, dur) {
    const r = rng(70);
    env(ctx, 'interior', { bg: '#202630', center: [0, 0, -3], area: 14, hemi: 1.2, key: 1.0 });
    const f = mesh(new THREE.PlaneGeometry(30, 30), mat('#e7e2d8'), 0, 0, -3, ctx.scene); f.rotation.x = -Math.PI / 2; f.castShadow = false;
    box(30, 12, 0.4, '#bfe3d0', 0, 6, -9, ctx.scene);
    const shelf = (x, empty) => {
      const g = new THREE.Group(); g.position.set(x, 0, -7.5); ctx.scene.add(g);
      box(4.4, 7.5, 0.3, '#9aa3ad', 0, 3.75, -0.6, g);
      for (let k = 0; k < 4; k++) {
        box(4.4, 0.15, 1.3, '#c7ced6', 0, 0.8 + k * 1.8, 0, g);
        if (!empty) for (let j = 0; j < 5; j++) box(0.7, 1.1, 0.7, ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#b197fc'][Math.floor(r() * 5)], -1.6 + j * 0.8, 1.45 + k * 1.8, 0, g, 0.06);
      }
      return g;
    };
    shelf(-4.8, false); shelf(0, true); shelf(4.8, false);
    const lbl = textPlane('KERIPIK GOYANG', 4.2, 0.6, { bg: '#f08c12', fg: '#ffffff', size: 0.62 }); lbl.position.set(0, 7.9, -7.6); ctx.scene.add(lbl);
    const sign = textPlane('SOLD OUT!', 3.6, 1.6, { bg: '#e03131', fg: '#ffffff', size: 0.6, stroke: '#a51111' });
    sign.position.set(0, 4.4, -6.4); sign.rotation.z = -0.12; ctx.scene.add(sign);
    const kr = add(ctx, { ...crowdLook(rng(5)), shirt: '#2f9e44' }, 3.5, -3.5, -0.5);
    return (t) => {
      pose.shrug(kr, t); setFace(kr, 'worried');
      sign.rotation.z = -0.12 + Math.sin(t * 6) * 0.03 * Math.max(0, 1 - t);
      camMove(ctx, t, dur, [-1.5, 4.6, 6], [-0.6, 4.6, 2.5], [0, 4.2, -7.5], null, { shake: 0.02 });
    };
  },

  hero_curb(ctx, p, dur) {
    setTown(ctx, { night: true, dark: true, seed: 17 });
    const h = hero(ctx, 6.2, -4, -Math.PI / 2 + 0.25);
    pointLight(ctx, '#ffd9a0', 45, 4, 6.5, -2, 22);
    return (t) => {
      pose.sit(h, t); h.root.position.y = 0.25; setFace(h, 'sad');
      camMove(ctx, t, dur, [-1.5, 3.6, 0], [0.5, 3.2, -1.5], [6.0, 2.4, -4.2], null, { shake: 0.015 });
    };
  },

  hero_party_room(ctx, p, dur) {
    const s = setPartyRoom(ctx, { dancers: 0, sign: 'PARTY!', seed: 45 });
    const h = hero(ctx, 0, -2, 0, { party: ['#ffd93d', '#ff4d6d'] });
    const table = box(3.4, 2.2, 2, '#8a5a3c', 5, 1.1, -4, ctx.scene);
    const bowl = fishbowl(ctx.scene); bowl.position.set(5, 2.2, -4); bowl.scale.setScalar(0.8);
    return (t) => {
      s.update(t);
      pose.dance(h, t, 0, 0.6); setFace(h, 'smile');
      camMove(ctx, t, dur, [0, 6, 12], [0, 5.5, 10.5], [1.5, 3.2, -3], null, { shake: 0.02 });
    };
  },

  fishbowl_guest(ctx, p, dur) {
    const s = setPartyRoom(ctx, { dancers: 0, seed: 46 });
    box(4, 2.2, 2.4, '#8a5a3c', 0, 1.1, 0, ctx.scene);
    const bowl = fishbowl(ctx.scene); bowl.position.set(0, 2.2, 0);
    const fish = bowl.userData.fish;
    return (t) => {
      s.update(t);
      fish.position.set(Math.sin(t * 1.5) * 0.25, 0.95 + Math.sin(t * 2.2) * 0.06, 0);
      fish.rotation.y = -Math.PI / 2 + Math.sin(t * 1.5) * 0.4;
      bowl.userData.tail.rotation.y = Math.sin(t * 12) * 0.4;
      camMove(ctx, t, dur, [0.2, 3.6, 3.6], [0.1, 3.4, 3.0], [0, 3.2, 0], null, { shake: 0.015 });
    };
  },

  fishbowl_pouch(ctx, p, dur) {
    const s = setPartyRoom(ctx, { dancers: 0, seed: 47 });
    box(5, 2.2, 2.4, '#8a5a3c', 0.6, 1.1, 0, ctx.scene);
    const bowl = fishbowl(ctx.scene); bowl.position.set(-0.4, 2.2, 0);
    const fish = bowl.userData.fish;
    const bag = pouch('pedas', 1.05); bag.position.set(1.55, 3.0, 0.1); bag.rotation.y = -0.25; ctx.scene.add(bag);
    const spot = new THREE.SpotLight('#ffffff', 35, 20, 0.35, 0.5); spot.position.set(1.5, 8, 4); spot.target = bag; ctx.scene.add(spot);
    return (t) => {
      s.update(t);
      fish.position.set(0.15 + Math.sin(t * 2) * 0.1, 0.95, 0.1);
      fish.rotation.y = -0.4 + Math.sin(t * 2) * 0.2;
      bowl.userData.tail.rotation.y = Math.sin(t * 12) * 0.4;
      bag.rotation.y = -0.25 + Math.sin(t * 1.5) * 0.05;
      camMove(ctx, t, dur, [0.2, 3.6, 5.2], [1.1, 3.4, 3.6], [0.3, 3.0, 0], [1.3, 3.1, 0], { shake: 0.015 });
    };
  },

  fish_dance(ctx, p, dur) {
    const s = setPartyRoom(ctx, { dancers: 0, seed: 48 });
    box(3, 2.2, 2.4, '#8a5a3c', -1.6, 1.1, 1.2, ctx.scene);
    const bowl = fishbowl(ctx.scene); bowl.position.set(-1.6, 2.2, 1.2);
    const fish = bowl.userData.fish;
    const h = hero(ctx, 1.0, -2.0, -0.25, { party: ['#ffd93d', '#ff4d6d'] });
    holdPouch(h, 'pedas', 0);
    return (t) => {
      s.update(t);
      fish.position.set(Math.sin(t * 7) * 0.2, 0.95 + Math.abs(Math.sin(t * 7)) * 0.15, 0.1);
      fish.rotation.set(0, -Math.PI / 2, Math.sin(t * 7) * 0.5);
      bowl.userData.tail.rotation.y = Math.sin(t * 20) * 0.6;
      pose.dance(h, t, 0, 1); h.arms[0].rotation.set(-1.05, 0, 0.25); setFace(h, 'laugh');
      camMove(ctx, t, dur, [-0.3, 4.9, 10.2], [-0.3, 4.7, 9.2], [-0.3, 3.3, -0.5], null, { shake: 0.03 });
    };
  },

  pool_party(ctx, p, dur) {
    const r = rng(80);
    env(ctx, 'night', { center: [0, 0, -4], area: 18 });
    ground(ctx, '#4f8a45'); sky(ctx, r, {});
    box(16, 0.2, 12, '#d9d4c8', 0, 0.1, -4, ctx.scene);
    const waterT = canvasTex(256, 256, (g) => { g.fillStyle = '#1fb6ff'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 4; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 20 + Math.random() * 40, 0, Math.PI); g.stroke(); } });
    waterT.wrapS = waterT.wrapT = THREE.RepeatWrapping; waterT.repeat.set(2, 2);
    const water = mesh(new THREE.PlaneGeometry(11, 7), new THREE.MeshStandardMaterial({ map: waterT, emissive: '#1fb6ff', emissiveMap: waterT, emissiveIntensity: 0.9, roughness: 0.1 }), 0, 0.22, -4.5, ctx.scene); water.rotation.x = -Math.PI / 2;
    const donut = mesh(new THREE.TorusGeometry(0.9, 0.38, 14, 28), mat('#ff7eb6', { roughness: 0.3 }), -1.5, 0.45, -3.5, ctx.scene); donut.rotation.x = Math.PI / 2;
    const duck = mesh(new THREE.SphereGeometry(0.5, 14, 12), mat('#ffd43b'), 2.4, 0.55, -5.5, ctx.scene);
    pointLight(ctx, '#3fd0ff', 22, 0, 4.5, -4, 18);
    stringLights(v3(-8, 6, -10), v3(8, 6, -10), 14, ctx.scene); stringLights(v3(-8, 6, 1), v3(8, 6, 1), 14, ctx.scene);
    const dancers = [];
    for (let i = 0; i < 6; i++) { const ch = add(ctx, { ...crowdLook(r), party: partyColors(r) }, -7 + i * 2.8, i % 2 ? -11 : -12.6, 0); ch.phase = r() * 3; dancers.push(ch); }
    house(r, { x: 0, z: -20, night: true, lit: 0.9, party: true }, ctx.scene);
    for (let k = 0; k < 4; k++) balloon(['#ff4d6d', '#ffd93d', '#4d96ff', '#c77dff'][k], -6 + k * 4, 5, -12, ctx.scene);
    return (t) => {
      waterT.offset.set(t * 0.05, t * 0.03);
      donut.position.y = 0.45 + Math.sin(t * 2) * 0.05; donut.rotation.z = t * 0.3;
      for (const ch of dancers) { pose.dance(ch, t, ch.phase); setFace(ch, 'laugh'); }
      camMove(ctx, t, dur, [-6, 7.5, 9], [-3.5, 7, 8], [0, 2.5, -6], null, { shake: 0.03 });
    };
  },

  karaoke_party(ctx, p, dur) {
    const s = setPartyRoom(ctx, { sign: 'KARAOKE NIGHT', dancers: 4, seed: 49 });
    box(10, 1.0, 4, '#2b2b35', 0, 0.5, -9, ctx.scene);
    const singer = add(ctx, { ...crowdLook(rng(12)), party: ['#4d96ff', '#ffd93d'], shirt: '#ffd43b' }, 0, -9, 0);
    singer.root.position.y = 1.0;
    const mic = mesh(new THREE.SphereGeometry(0.22, 12, 10), mat('#333', { metalness: 0.6, roughness: 0.3 }), 0, 0.35, 0.1);
    singer.arms[1].userData.grip.add(mic);
    return (t) => {
      s.update(t);
      pose.idle(singer, t); singer.arms[1].rotation.set(-2.2, 0, -0.65); singer.arms[0].rotation.set(-0.3, 0, -1.6 - Math.sin(t * 4) * 0.4);
      singer.body.rotation.x = -0.15; singer.head.rotation.x = -0.25;
      setFace(singer, 'sing');
      camMove(ctx, t, dur, [0.5, 5.2, 4], [0.2, 5.2, 2.2], [0, 5.0, -9], null, { shake: 0.03 });
    };
  },

  goldfish_birthday(ctx, p, dur) {
    const s = setPartyRoom(ctx, { sign: 'HAPPY BIRTHDAY BUBBLES!', dancers: 0, wall: '#3b2a5c', seed: 50 });
    box(6, 2.2, 3, '#e8d9c0', 0, 1.1, -3, ctx.scene);
    const bowl = fishbowl(ctx.scene); bowl.position.set(-1.0, 2.2, -3);
    const cake = new THREE.Group(); cake.position.set(1.4, 2.2, -3); ctx.scene.add(cake);
    mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 24), mat('#ffb3c6'), 0, 0.35, 0, cake);
    mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 24), mat('#fff0f5'), 0, 0.95, 0, cake);
    for (let i = 0; i < 3; i++) { mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), mat('#4d96ff'), -0.25 + i * 0.25, 1.4, 0, cake); const fl = mesh(new THREE.SphereGeometry(0.08, 8, 8), glow('#ffb020', 3), -0.25 + i * 0.25, 1.66, 0, cake); fl.castShadow = false; }
    const r = rng(51);
    const guests = [];
    for (let i = 0; i < 4; i++) { const ch = add(ctx, { ...crowdLook(r), party: partyColors(r) }, -4.5 + i * 3, -6, 0); ch.phase = r() * 3; guests.push(ch); }
    const mayor = add(ctx, { skin: '#f1c27d', shirt: '#22223b', pants: '#22223b', shoes: '#111', hair: 'short', hairColor: '#ccc' }, 4.5, -3.5, -0.6);
    const top = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.0, 20), mat('#111'), 0, 0.5, 0, top); mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 20), mat('#111'), 0, 0.02, 0, top); mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.18, 20), mat('#c9a227'), 0, 0.12, 0, top);
    top.position.y = 1.1; mayor.head.add(top);
    return (t) => {
      s.update(t);
      for (const ch of guests) { pose.cheer(ch, t, ch.phase); setFace(ch, 'laugh'); }
      pose.idle(mayor, t); mayor.arms[1].rotation.set(-0.3, 0, 2.6 + Math.sin(t * 8) * 0.3); setFace(mayor, 'grin');
      const fish = bowl.userData.fish; fish.position.x = Math.sin(t * 1.5) * 0.25; fish.rotation.y = -Math.PI / 2 + Math.sin(t * 1.5) * 0.5;
      camMove(ctx, t, dur, [0, 5.0, 6.5], [0.3, 4.6, 5.0], [0, 3.6, -3.5], null, { shake: 0.02 });
    };
  },

  empty_court_day(ctx, p, dur) {
    const r = rng(90);
    env(ctx, 'day', { center: [0, 0, -4], area: 20 });
    ground(ctx, '#86b862'); sky(ctx, r, { moon: false, stars: false, clouds: true });
    const c = mesh(new THREE.PlaneGeometry(16, 14), new THREE.MeshStandardMaterial({ map: courtTex(), roughness: 0.9, color: '#d8d8d8' }), 0, 0.03, -4, ctx.scene); c.rotation.x = -Math.PI / 2; c.castShadow = false;
    const h = hoop(8.2); h.position.set(0, 0, -11); ctx.scene.add(h);
    const sign = textPlane('PRACTICE COURT', 5, 1.1, { bg: '#e9ecef', fg: '#868e96', size: 0.5 }); sign.position.set(-5, 3, -10.8); sign.rotation.z = 0.08; ctx.scene.add(sign);
    box(0.2, 2.6, 0.2, '#666', -5, 1.3, -11, ctx.scene);
    const ball = basketball(); ball.position.set(2, 0.45, -3); ctx.scene.add(ball);
    const leaves = [];
    for (let i = 0; i < 10; i++) { const l = mesh(rbox(0.3, 0.04, 0.2, 0.01), mat(['#c97b2a', '#e0a040', '#8a5a2b'][i % 3]), 0, 0, 0, ctx.scene); leaves.push({ l, x: -6 + r() * 12, z: -8 + r() * 8, s: r() * 6 }); }
    for (let i = 0; i < 4; i++) house(r, { x: -18 + i * 12, z: -24, night: false }, ctx.scene);
    return (t) => {
      for (const it of leaves) { it.l.position.set(it.x + t * 1.5, 0.08 + Math.abs(Math.sin(t * 3 + it.s)) * 0.3, it.z); it.l.rotation.y = t * 2 + it.s; }
      ball.rotation.z = -t * 0.6; ball.position.x = 2 - t * 0.27;
      camMove(ctx, t, dur, [1, 4, 9], [0.5, 4.5, 6], [0, 4, -8], null, { shake: 0.01 });
    };
  },

  dancer_shrug(ctx, p, dur) {
    const s = setPartyRoom(ctx, { dancers: 4, seed: 52 });
    const ch = add(ctx, { ...crowdLook(rng(77)), party: ['#ff4d6d', '#ffd93d'], shades: true, shirt: '#ff922b' }, 0, -1, 0);
    return (t) => {
      s.update(t);
      pose.shrug(ch, t); setFace(ch, 'grin');
      camMove(ctx, t, dur, [0.3, 4.0, 3.4], [0.3, 4.0, 2.8], [0, 3.8, -1], null, { shake: 0.02 });
    };
  },

  friend_party(ctx, p, dur) {
    const signs = { bayu: 'PARTY TIME', sari: 'DANCE NIGHT', grandma: 'TUESDAY DISCO' };
    const s = setPartyRoom(ctx, { sign: signs[p.who], dancers: 4, seed: 53 + p.who.length });
    const look = { ...PALETTE[p.who], party: ['#ff4d6d', '#ffd93d'] };
    if (p.who === 'bayu') look.shades = true;
    const ch = add(ctx, look, 0, -1.5, 0);
    return (t) => {
      s.update(t);
      pose.dance(ch, t, 0.3, p.who === 'grandma' ? 1.2 : 1); setFace(ch, p.who === 'grandma' ? 'tongue' : 'laugh');
      camMove(ctx, t, dur, [0.4, 4.2, 6.2], [0.2, 4.0, 5.0], [0, 3.6, -1.5], null, { shake: 0.03 });
    };
  },

  endcard(ctx, p, dur) {
    ctx.scene.background = new THREE.Color('#1a0f08');
    ctx.scene.add(new THREE.AmbientLight('#ffffff', 2.2));
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(10.86 * 2.2, 14.48 * 2.2), new THREE.MeshBasicMaterial({ map: tex['pack-duo-blur'], toneMapped: false }));
    bg.position.z = -2; ctx.scene.add(bg);
    const img = new THREE.Mesh(new THREE.PlaneGeometry(10.86, 14.48), new THREE.MeshBasicMaterial({ map: tex['pack-duo'], toneMapped: false }));
    ctx.scene.add(img);
    const conf = confetti(ctx.scene, 140, 21, [12, 16, 4]); conf.position.set(0, -8, 3);
    return (t) => {
      conf.userData.update(t + 0.5);
      const u = ease(clamp(t / dur));
      ctx.camera.fov = 50; ctx.camera.updateProjectionMatrix();
      ctx.camera.position.set(0, lerp(-0.6, -0.2, u), lerp(21.5, 19.6, u));
      ctx.camera.lookAt(0, lerp(-0.6, -0.2, u), 0);
    };
  },
};

// ---------------- shared scene bodies ----------------
function dribbleScene(ctx, p, dur, mode, set) {
  const h = hero(ctx, 0, 0, mode === 'day' ? -0.4 : 0.3);
  const ball = basketball(); ctx.scene.add(ball);
  const T = 0.46; // one bounce per "Kriuk"
  const cams = mode === 'day'
    ? [[[2.8, 2.4, 7.8], [2.4, 2.2, 7.0], [0.6, 2.4, 0.3]], [[-4.8, 1.5, 5.2], [-4.2, 1.3, 4.6], [0.7, 2.2, 0.4]]]
    : [[[-0.8, 2.2, 8.4], [-0.6, 2.0, 7.6], [0.8, 2.4, 0.4]], [[6.4, 2.2, 5.0], [5.8, 2.0, 4.4], [0.9, 2.1, 0.6]]];
  const c = cams[p.angle || 0];
  return (t) => {
    if (set) for (const ch of set.crowd) { pose.cheer(ch, t, ch.phase); setFace(ch, 'laugh'); }
    pose.idle(h, t);
    h.hips.position.y = 1.45; h.body.rotation.x = 0.25;
    h.legs[0].rotation.x = -0.35; h.legs[1].rotation.x = 0.15;
    const ph = (t % T) / T;
    const handY = 2.25, floor = 0.45;
    const y = floor + (handY - floor) * Math.abs(Math.cos(Math.PI * ph));
    const wp = new THREE.Vector3(1.35, 0, 1.0).applyAxisAngle(v3(0, 1, 0), h.root.rotation.y);
    ball.position.set(wp.x, y, wp.z);
    ball.rotation.x = t * 8;
    h.arms[1].rotation.set(-0.55 - (1 - Math.abs(Math.cos(Math.PI * ph))) * 0.35, 0, 0.15);
    h.arms[0].rotation.set(-0.4, 0, -0.3);
    setFace(h, 'determined');
    camMove(ctx, t, dur, c[0], c[1], c[2], null, { shake: 0.04 });
  };
}

function swishScene(ctx, p, dur, rim, sideDir) {
  const balls = [];
  const n = p.balls ? 4 : 1;
  for (let i = 0; i < n; i++) { const b = basketball(); ctx.scene.add(b); balls.push(b); }
  const off = sideDir.clone();
  return (t) => {
    balls.forEach((b, i) => {
      const t0 = p.balls ? i * 0.45 : 0.0;
      const u = (t - t0) / 0.45;
      b.visible = u > -0.2;
      const start = rim.clone().add(off.clone().multiplyScalar(-1).add(v3(0, 0, 0)).multiplyScalar(0));
      const yy = u < 0 ? rim.y + 3.5 : u < 1 ? rim.y + 3.5 - 4.6 * u * u : rim.y - 1.1 - (u - 1) * 3;
      b.position.set(rim.x + (u < 0 ? 0.6 : Math.max(0, 0.6 - u * 0.6)) * (off.x || 1), yy, rim.z + (off.z ? 0 : 0));
      b.rotation.x = t * 6;
    });
    const cam = [rim.x + off.x * 4.2 + (off.z ? 1.2 : 0), rim.y - 0.3, rim.z + off.z * 4.2 + (off.x ? 1.2 : 0)];
    const cam2 = [cam[0] - off.x * 0.6, cam[1] + 0.2, cam[2] - off.z * 0.6];
    camMove(ctx, t, dur, cam, cam2, [rim.x, rim.y - 0.2, rim.z], null, { shake: 0.03 });
  };
}
