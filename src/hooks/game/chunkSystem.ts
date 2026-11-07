import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAR_TOP, CHUNK_CHECK_INTERVAL, CHUNK_LOAD_DISTANCE, MAP_DIR, RENDER_FLOOR, SPAWN, first_chunk, last_chunk } from '../../constants';
import type { CarState, MapMeta, Obstacle, RuntimeChunk } from '../../types';
import { disposeObject, distToSegment, makeGrid, pointInPolygon, rectDistance, unloadDistance } from '../utils';

type CreateChunkSystemArgs = {
  car: CarState;
  scene: THREE.Scene;
  spawnMarker: THREE.Mesh;
  onSpawnApplied: () => void;
};

export function createChunkSystem({ car, scene, spawnMarker, onSpawnApplied }: CreateChunkSystemArgs) {
  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();

  let mapMeta: MapMeta | null = null;
  let chunks: RuntimeChunk[] = [];
  let obstacles: Obstacle[] = [];
  let mapBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let chunkTimer = 0;

  const loadChunk = async (chunk: RuntimeChunk) => {
    chunk.state = 'loading';
    const token = ++chunk.token;

    const img = new Image();
    img.onload = () => {
      if (chunk.token === token && chunk.state !== 'idle') {
        chunk.img = img;
        chunk.imgReady = true;
      }
    };
    img.src = `${MAP_DIR}/${chunk.image}`;

    try {
      const gltf = await loader.loadAsync(`${MAP_DIR}/${chunk.glb}`);

      if (chunk.token !== token || chunk.state !== 'loading') {
        disposeObject(gltf.scene);
        return;
      }

      const group = new THREE.Group();

      const groundMaterial = RENDER_FLOOR
        ? new THREE.MeshStandardMaterial({
            map: textureLoader.load(`${MAP_DIR}/${chunk.image}`),
          })
        : new THREE.MeshStandardMaterial({ color: 0xdddddd });

      if (RENDER_FLOOR && groundMaterial.map) {
        groundMaterial.map.colorSpace = THREE.SRGBColorSpace;
        groundMaterial.map.repeat.y = -1;
        groundMaterial.map.offset.y = 1;
      }

      const ground = new THREE.Mesh(new THREE.PlaneGeometry(chunk.width, chunk.height), groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(chunk.x + chunk.width / 2, -0.1, -(chunk.y + chunk.height / 2));
      group.add(ground);

      group.add(makeGrid(chunk));

      const object = gltf.scene;
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(mesh.geometry, 30),
            new THREE.LineBasicMaterial({ color: 0x000000 }),
          );
          mesh.add(edges);
        }
      });
      group.add(object);

      scene.add(group);
      chunk.group = group;
      chunk.state = 'loaded';
    } catch (error) {
      console.error(`Gagal load chunk ${chunk.id}`, error);
      chunk.state = 'idle';
      chunk.retryAt = performance.now() + 3000;
    }
  };

  const unloadChunk = (chunk: RuntimeChunk) => {
    chunk.token++;
    if (chunk.group) {
      scene.remove(chunk.group);
      disposeObject(chunk.group);
      chunk.group = null;
    }
    chunk.img = null;
    chunk.imgReady = false;
    chunk.state = 'idle';
  };

  const updateChunks = (dt: number, force = false) => {
    chunkTimer -= dt;
    if (!force && chunkTimer > 0) return;
    chunkTimer = CHUNK_CHECK_INTERVAL;

    const now = performance.now();
    for (const chunk of chunks) {
      const distance = rectDistance(car.x, car.y, chunk);

      if (chunk.state === 'idle') {
        if (distance <= CHUNK_LOAD_DISTANCE && now >= chunk.retryAt) {
          void loadChunk(chunk);
        }
      } else if (distance > unloadDistance()) {
        unloadChunk(chunk);
      }
    }
  };

  const loadMapData = async () => {
    mapMeta = (await fetch(`${MAP_DIR}/map.json`).then((res) => res.json())) as MapMeta;

    if (mapMeta.spawn) {
      SPAWN.x = mapMeta.spawn.x;
      SPAWN.y = mapMeta.spawn.y;
      SPAWN.heading = mapMeta.spawn.heading ?? SPAWN.heading;
      car.x = SPAWN.x;
      car.y = SPAWN.y;
      car.heading = SPAWN.heading;
      car.speed = 0;
      spawnMarker.position.set(SPAWN.x, 0.2, -SPAWN.y);
      onSpawnApplied();
    }

    chunks = (mapMeta.chunks ?? []).map((chunk) => ({
      ...chunk,
      state: 'idle',
      token: 0,
      group: null,
      img: null,
      imgReady: false,
      retryAt: 0,
    }));

    if (chunks.length > 0) {
      const minX = Math.min(...chunks.map((chunk) => chunk.x));
      const maxX = Math.max(...chunks.map((chunk) => chunk.x + chunk.width));
      const minY = Math.min(...chunks.map((chunk) => chunk.y));
      const maxY = Math.max(...chunks.map((chunk) => chunk.y + chunk.height));
      mapBounds = { minX, maxX, minY, maxY };
    }

    obstacles = (mapMeta.shapes ?? [])
      .filter((shape) => (shape.y_value ?? 0) < CAR_TOP)
      .map((shape) => {
        const xs = shape.pos.map((point) => point[0]);
        const ys = shape.pos.map((point) => point[1]);
        return {
          poly: shape.pos,
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
        };
      });

    updateChunks(0, true);
  };

  const hitsObstacle = (px: number, py: number, r: number) => {
    for (const obstacle of obstacles) {
      if (px < obstacle.minX - r || px > obstacle.maxX + r || py < obstacle.minY - r || py > obstacle.maxY + r) {
        continue;
      }

      const poly = obstacle.poly;
      if (pointInPolygon(px, py, poly)) return true;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        if (distToSegment(px, py, a[0], a[1], b[0], b[1]) < r) return true;
      }
    }
    return false;
  };

  const outOfBounds = (px: number, py: number) => {
    if (!mapMeta) return false;
    return !chunks.some((chunk) => px >= chunk.x && px <= chunk.x + chunk.width && py >= chunk.y && py <= chunk.y + chunk.height);
  };

  const blocked = (px: number, py: number, radius: number) => {
    return hitsObstacle(px, py, radius) || outOfBounds(px, py);
  };

  const getGeoPosition = () => {
    const mapWidth = mapBounds.maxX - mapBounds.minX;
    const mapHeight = mapBounds.maxY - mapBounds.minY;
    const tX = mapWidth === 0 ? 0 : Math.max(0, Math.min(1, (car.x - mapBounds.minX) / mapWidth));
    const tY = mapHeight === 0 ? 0 : Math.max(0, Math.min(1, (car.y - mapBounds.minY) / mapHeight));

    const latitude = first_chunk.latitude + tY * (last_chunk.latitude - first_chunk.latitude);
    const longitude = first_chunk.longitude + tX * (last_chunk.longitude - first_chunk.longitude);

    return { latitude, longitude };
  };

  const resetCarToSpawn = () => {
    car.x = SPAWN.x;
    car.y = SPAWN.y;
    car.heading = SPAWN.heading;
    car.speed = 0;
    updateChunks(0, true);
  };

  const cleanup = () => {
    for (const chunk of chunks) {
      unloadChunk(chunk);
    }
  };

  return {
    loadMapData,
    updateChunks,
    blocked,
    getGeoPosition,
    getChunks: () => chunks,
    resetCarToSpawn,
    cleanup,
  };
}
