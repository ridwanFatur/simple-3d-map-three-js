import * as THREE from 'three';
import { CAR } from '../../constants';
import type { CarState } from '../../types';
import { disposeObject } from '../utils';

type CreateCarModelArgs = {
  scene: THREE.Scene;
};

export function createCarModel({ scene }: CreateCarModelArgs) {
  const carGroup = new THREE.Group();
  const wheels: THREE.Group[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe53935, metalness: 0.3, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x222a35, metalness: 0.6, roughness: 0.2 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });

  const wheelR = 5;

  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.length, CAR.height * 0.6, CAR.width), bodyMat);
  body.position.y = wheelR + CAR.height * 0.3;
  carGroup.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(CAR.length * 0.5, CAR.height * 0.5, CAR.width * 0.85),
    glassMat,
  );
  cabin.position.set(-CAR.length * 0.05, wheelR + CAR.height * 0.6 + CAR.height * 0.25, 0);
  carGroup.add(cabin);

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
  for (const s of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 4), lightMat);
    light.position.set(CAR.length / 2, wheelR + CAR.height * 0.35, s * CAR.width * 0.3);
    carGroup.add(light);
  }

  const wx = CAR.length * 0.32;
  const wz = CAR.width / 2 + 1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * wx, wheelR, sz * wz);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 4, 16), wheelMat);
      tire.rotation.x = Math.PI / 2;
      pivot.add(tire);

      const hub = new THREE.Mesh(new THREE.BoxGeometry(wheelR * 1.4, 1, 4.2), hubMat);
      pivot.add(hub);

      carGroup.add(pivot);
      wheels.push(pivot);
    }
  }

  scene.add(carGroup);

  const applyCarTransform = (car: CarState) => {
    carGroup.position.set(car.x, 0, -car.y);
    carGroup.rotation.y = car.heading;
  };

  const spinWheels = (car: CarState, dt: number) => {
    for (const wheel of wheels) {
      wheel.rotation.z -= (car.speed * dt) / 5;
    }
  };

  const dispose = () => {
    scene.remove(carGroup);
    disposeObject(carGroup);
  };

  return {
    carGroup,
    wheels,
    applyCarTransform,
    spinWheels,
    dispose,
  };
}
