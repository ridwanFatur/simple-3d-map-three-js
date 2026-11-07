import * as THREE from 'three';
import { CHUNK_LOAD_DISTANCE, RESOLUTION, SKY, SPAWN } from '../../constants';

type ThreeSetupArgs = {
  box: HTMLDivElement;
};

export function createThreeSetup({ box }: ThreeSetupArgs) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);

  const fog = new THREE.Fog(SKY, CHUNK_LOAD_DISTANCE * 0.5, Math.max(CHUNK_LOAD_DISTANCE, 200));

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(300, 800, 200);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(70, RESOLUTION.width / RESOLUTION.height, 0.1, 10000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(RESOLUTION.width, RESOLUTION.height);
  box.appendChild(renderer.domElement);

  const spawnMarker = new THREE.Mesh(
    new THREE.RingGeometry(18, 26, 32),
    new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide }),
  );
  spawnMarker.rotation.x = -Math.PI / 2;
  spawnMarker.position.set(SPAWN.x, 0.2, -SPAWN.y);
  scene.add(spawnMarker);

  const dispose = () => {
    scene.remove(spawnMarker);
    spawnMarker.geometry.dispose();
    (spawnMarker.material as THREE.Material).dispose();

    renderer.dispose();
    if (renderer.domElement.parentNode === box) {
      box.removeChild(renderer.domElement);
    }
  };

  return {
    scene,
    fog,
    camera,
    renderer,
    spawnMarker,
    dispose,
  };
}
