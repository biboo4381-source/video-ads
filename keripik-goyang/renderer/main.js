import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadTextures } from './world.js';
import { SCENES } from './scenes.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 720), H = +(params.get('h') || 1280);
const BLOOM = params.get('bloom') !== '0';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

let cur = null;

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry && !o.geometry.parameters?.cached) o.geometry.dispose?.();
  });
}

window.loadShot = (shot) => {
  if (cur) disposeScene(cur.scene);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 600);
  const ctx = { scene, camera, renderer };
  const fn = SCENES[shot.scene];
  if (!fn) throw new Error('unknown scene ' + shot.scene);
  const update = fn(ctx, shot.p || {}, shot.dur);
  let composer = null;
  if (BLOOM) {
    composer = new EffectComposer(renderer);
    composer.setSize(W, H);
    composer.addPass(new RenderPass(scene, camera));
    const interior = /party|karaoke|goldfish|fish|dancer|friend/.test(shot.scene);
    const strength = shot.scene === 'endcard' ? 0.15 : interior ? 0.32 : 0.5;
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), strength, 0.45, interior ? 0.9 : 0.82));
    composer.addPass(new OutputPass());
  }
  cur = { scene, camera, update, composer };
  return true;
};

window.drawFrame = (t) => {
  cur.update(t);
  if (cur.composer) cur.composer.render(); else renderer.render(cur.scene, cur.camera);
  return true;
};

window.grab = (q = 0.92) => renderer.domElement.toDataURL('image/jpeg', q);

(async () => {
  await document.fonts.load('700 40px Fredoka');
  await document.fonts.load('600 40px Fredoka');
  await loadTextures();
  window.READY = true;
})();
