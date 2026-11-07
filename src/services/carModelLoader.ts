import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAR_MODEL_CONFIG } from '../constants';

export interface LoadedCar {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  steerPivots: THREE.Group[];
  update: (dt: number, speed: number, steerInput: number, isBraking: boolean) => void;
  dispose: () => void;
}

function disposeHierarchy(root: THREE.Object3D) {
  root.traverse((object3D) => {
    const mesh = object3D as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        for (const key in material) {
          const value = (material as unknown as Record<string, unknown>)[key] as {
            isTexture?: boolean;
            dispose?: () => void;
          };
          if (value?.isTexture) value.dispose?.();
        }
        material.dispose();
      }
    }
  });
}

/**
 * Loads and initializes the realistic 3D car model.
 * Configures materials, ground contact shadow, steering pivots, wheel rotation, and headlights.
 */
export async function loadCarModel(parentGroup: THREE.Group): Promise<LoadedCar> {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(CAR_MODEL_CONFIG.dracoPath);

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  const textureLoader = new THREE.TextureLoader();

  try {
    const gltf = await gltfLoader.loadAsync(CAR_MODEL_CONFIG.modelPath);
    const carModel = gltf.scene;

    // Realistic PBR materials
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd40000, // Ferrari Rosso Corsa
      metalness: 0.8,
      roughness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });

    const detailsMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.9,
      roughness: 0.25,
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x101520,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.65,
      transparent: true,
      opacity: 0.85,
    });

    const tireMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.85,
      metalness: 0.05,
    });

    // Apply materials to car parts
    const bodyMesh = carModel.getObjectByName('body') as THREE.Mesh | undefined;
    if (bodyMesh) bodyMesh.material = bodyMaterial;

    const trimMesh = carModel.getObjectByName('trim') as THREE.Mesh | undefined;
    if (trimMesh) trimMesh.material = detailsMaterial;

    const glassMesh = carModel.getObjectByName('glass') as THREE.Mesh | undefined;
    if (glassMesh) glassMesh.material = glassMaterial;

    for (const rimName of ['rim_fl', 'rim_fr', 'rim_rl', 'rim_rr']) {
      const rim = carModel.getObjectByName(rimName) as THREE.Mesh | undefined;
      if (rim) rim.material = detailsMaterial;
    }

    carModel.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.name === 'tire') {
        mesh.material = tireMaterial;
      }
    });

    // Headlights projector emissive
    const lights = carModel.getObjectByName('lights') as THREE.Mesh | undefined;
    if (lights && lights.material) {
      const mat = (
        Array.isArray(lights.material) ? lights.material[0] : lights.material
      ) as THREE.MeshStandardMaterial;
      if (mat.isMeshStandardMaterial) {
        mat.emissive = new THREE.Color(0xfffaea);
        mat.emissiveIntensity = 2.0;
      }
    }

    // Daytime LED strips
    const leds = carModel.getObjectByName('leds') as THREE.Mesh | undefined;
    if (leds && leds.material) {
      const mat = (Array.isArray(leds.material) ? leds.material[0] : leds.material) as THREE.MeshStandardMaterial;
      if (mat.isMeshStandardMaterial) {
        mat.emissive = new THREE.Color(0xffffff);
        mat.emissiveIntensity = 2.5;
      }
    }

    // Taillights with dynamic brake illumination
    let taillightsMat: THREE.MeshStandardMaterial | null = null;
    const taillights = carModel.getObjectByName('lights_red') as THREE.Mesh | undefined;
    if (taillights && taillights.material) {
      const mat = (
        Array.isArray(taillights.material) ? taillights.material[0] : taillights.material
      ) as THREE.MeshStandardMaterial;
      if (mat.isMeshStandardMaterial) {
        mat.emissive = new THREE.Color(0xff1100);
        mat.emissiveIntensity = 0.8;
        taillightsMat = mat;
      }
    }

    // Ground contact shadow plane
    let shadowMesh: THREE.Mesh | null = null;
    try {
      const shadowTexture = await textureLoader.loadAsync(CAR_MODEL_CONFIG.shadowPath);
      shadowTexture.colorSpace = THREE.SRGBColorSpace;
      shadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
        new THREE.MeshBasicMaterial({
          map: shadowTexture,
          blending: THREE.MultiplyBlending,
          toneMapped: false,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
      );
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.y = 0.01;
      shadowMesh.renderOrder = 2;
      carModel.add(shadowMesh);
    } catch (shadowErr) {
      console.warn('Could not load car contact shadow texture:', shadowErr);
    }

    // Locate wheel nodes
    const wheelFL = carModel.getObjectByName('wheel_fl');
    const wheelFR = carModel.getObjectByName('wheel_fr');
    const wheelRL = carModel.getObjectByName('wheel_rl');
    const wheelRR = carModel.getObjectByName('wheel_rr');

    const steerPivots: THREE.Group[] = [];
    const wheels: THREE.Object3D[] = [];

    // Create independent steering pivots for the front wheels
    if (wheelFL && wheelFL.parent) {
      const steerFL = new THREE.Group();
      steerFL.name = 'steer_fl_pivot';
      steerFL.position.copy(wheelFL.position);
      steerFL.rotation.set(0, 0, 0);
      wheelFL.parent.add(steerFL);
      wheelFL.position.set(0, 0, 0);
      steerFL.add(wheelFL);
      steerPivots.push(steerFL);
      wheels.push(wheelFL);
    }

    if (wheelFR && wheelFR.parent) {
      const steerFR = new THREE.Group();
      steerFR.name = 'steer_fr_pivot';
      steerFR.position.copy(wheelFR.position);
      steerFR.rotation.set(0, 0, 0);
      wheelFR.parent.add(steerFR);
      wheelFR.position.set(0, 0, 0);
      steerFR.add(wheelFR);
      steerPivots.push(steerFR);
      wheels.push(wheelFR);
    }

    if (wheelRL) wheels.push(wheelRL);
    if (wheelRR) wheels.push(wheelRR);

    // Align with game coordinate system:
    // Model forward is -Z, game forward is +X => rotate by -PI/2 around Y
    carModel.rotation.y = -Math.PI / 2;
    carModel.scale.setScalar(CAR_MODEL_CONFIG.scale);
    carModel.position.set(0, 0, 0);

    // Front headlights spotlights for visual fidelity on the road
    const headlights: THREE.SpotLight[] = [];
    for (const offsetZ of [-6.5, 6.5]) {
      const spot = new THREE.SpotLight(0xfffaec, 2.5, 140, Math.PI / 6, 0.45, 1.2);
      spot.position.set(19, 3.8, offsetZ);
      spot.target.position.set(90, 0, offsetZ * 0.85);
      parentGroup.add(spot);
      parentGroup.add(spot.target);
      headlights.push(spot);
    }

    parentGroup.add(carModel);

    let currentSteerAngle = 0;

    const update = (dt: number, speed: number, steerInput: number, isBraking: boolean) => {
      // Steer front wheels smoothly
      const targetSteerAngle = steerInput * CAR_MODEL_CONFIG.maxSteerAngle;
      currentSteerAngle = THREE.MathUtils.lerp(
        currentSteerAngle,
        targetSteerAngle,
        Math.min(1, dt * CAR_MODEL_CONFIG.steerLerpSpeed),
      );

      for (const pivot of steerPivots) {
        pivot.rotation.y = currentSteerAngle;
      }

      // Roll wheels based on distance travelled
      const rollDelta = (speed * dt) / CAR_MODEL_CONFIG.wheelRadius;
      for (const wheel of wheels) {
        wheel.rotation.x -= rollDelta;
      }

      // Dynamic brake lights
      if (taillightsMat) {
        const targetEmissive = isBraking ? 3.5 : 0.8;
        taillightsMat.emissiveIntensity = THREE.MathUtils.lerp(
          taillightsMat.emissiveIntensity,
          targetEmissive,
          Math.min(1, dt * 18),
        );
      }
    };

    const dispose = () => {
      for (const spot of headlights) {
        parentGroup.remove(spot);
        parentGroup.remove(spot.target);
        spot.dispose();
      }
      parentGroup.remove(carModel);
      disposeHierarchy(carModel);
      dracoLoader.dispose();
    };

    return {
      root: carModel,
      wheels,
      steerPivots,
      update,
      dispose,
    };
  } catch (error) {
    dracoLoader.dispose();
    throw error;
  }
}
