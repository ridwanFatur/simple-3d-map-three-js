import { type RefObject, useEffect } from 'react';
import * as THREE from 'three';
import { CAR, SPAWN } from '../constants';
import type { CarState } from '../types';
import { createCameraController } from './game/cameraController';
import { createCarModel } from './game/carModel';
import { createCarPhysics } from './game/carPhysics';
import { createChunkSystem } from './game/chunkSystem';
import { createHudSystem } from './game/hudSystem';
import { createKeyboardControls } from './game/keyboardControls';
import { createMinimapSystem } from './game/minimapSystem';
import { createThreeSetup } from './game/threeSetup';

type UseCarGameArgs = {
  boxRef: RefObject<HTMLDivElement>;
  hudRef: RefObject<HTMLDivElement>;
  speedoRef: RefObject<HTMLDivElement>;
  minimapRef: RefObject<HTMLCanvasElement>;
};

export function useCarGame({ boxRef, hudRef, speedoRef, minimapRef }: UseCarGameArgs) {
  useEffect(() => {
    const box = boxRef.current;
    const hud = hudRef.current;
    const speedo = speedoRef.current;
    const minimap = minimapRef.current;

    if (!box || !hud || !speedo || !minimap) return;

    const car: CarState = { x: SPAWN.x, y: SPAWN.y, heading: SPAWN.heading, speed: 0 };

    const threeSetup = createThreeSetup({ box });
    const carModel = createCarModel({ scene: threeSetup.scene });

    const cameraController = createCameraController({
      car,
      camera: threeSetup.camera,
      scene: threeSetup.scene,
      fog: threeSetup.fog,
    });

    const chunkSystem = createChunkSystem({
      car,
      scene: threeSetup.scene,
      spawnMarker: threeSetup.spawnMarker,
      onSpawnApplied: cameraController.resetInit,
    });

    const minimapSystem = createMinimapSystem({
      minimap,
      car,
      getChunks: chunkSystem.getChunks,
    });

    const keyboardControls = createKeyboardControls({
      onToggleCamera: cameraController.toggleView,
      onResetZoom: minimapSystem.resetZoom,
      onResetCar: chunkSystem.resetCarToSpawn,
    });

    const carPhysics = createCarPhysics({
      car,
      down: keyboardControls.down,
      blocked: (px, py) => chunkSystem.blocked(px, py, CAR.radius),
      applyCarTransform: carModel.applyCarTransform,
      spinWheels: carModel.spinWheels,
    });

    const hudSystem = createHudSystem({
      hud,
      speedo,
      car,
      getChunks: chunkSystem.getChunks,
      getGeoPosition: chunkSystem.getGeoPosition,
    });

    void chunkSystem.loadMapData();

    const clock = new THREE.Clock();
    let animationId = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      carPhysics.updateCar(dt);
      chunkSystem.updateChunks(dt);
      minimapSystem.updateMiniZoom(dt, keyboardControls.down);
      cameraController.updateCamera(dt);
      hudSystem.updateHud();
      minimapSystem.drawMiniMap();

      threeSetup.renderer.render(threeSetup.scene, threeSetup.camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      keyboardControls.dispose();
      chunkSystem.cleanup();
      carModel.dispose();
      threeSetup.dispose();
    };
  }, [boxRef, hudRef, speedoRef, minimapRef]);
}
