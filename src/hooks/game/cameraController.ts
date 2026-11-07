import * as THREE from 'three';
import { CHASE, TOP_HEIGHT, USE_FOG } from '../../constants';
import type { CarState } from '../../types';

type CreateCameraControllerArgs = {
  car: CarState;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  fog: THREE.Fog;
};

export function createCameraController({ car, camera, scene, fog }: CreateCameraControllerArgs) {
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  let camInit = false;
  let topView = false;

  const toggleView = () => {
    topView = !topView;
  };

  const resetInit = () => {
    camInit = false;
  };

  const updateCamera = (dt: number) => {
    const fx = Math.cos(car.heading);
    const fz = -Math.sin(car.heading);
    const cx = car.x;
    const cz = -car.y;

    let targetPos: THREE.Vector3;
    let targetLook: THREE.Vector3;

    if (topView) {
      targetPos = new THREE.Vector3(cx, TOP_HEIGHT, cz + 0.01);
      targetLook = new THREE.Vector3(cx, 0, cz);
    } else {
      targetPos = new THREE.Vector3(cx - fx * CHASE.distance, CHASE.height, cz - fz * CHASE.distance);
      targetLook = new THREE.Vector3(cx + fx * CHASE.lookAhead, 10, cz + fz * CHASE.lookAhead);
    }

    if (!camInit) {
      camPos.copy(targetPos);
      camLook.copy(targetLook);
      camInit = true;
    } else {
      const t = 1 - Math.exp(-CHASE.smooth * dt);
      camPos.lerp(targetPos, t);
      camLook.lerp(targetLook, t);
    }

    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    if (topView) camera.up.set(fx, 0, fz);
    camera.lookAt(camLook);

    scene.fog = USE_FOG && !topView ? fog : null;
  };

  return {
    toggleView,
    resetInit,
    updateCamera,
  };
}
