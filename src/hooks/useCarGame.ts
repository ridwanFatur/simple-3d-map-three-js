import { type RefObject, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadCarModel, type LoadedCar } from '../services/carModelLoader';
import {
  CAR,
  CAR_TOP,
  CHASE,
  CHUNK_CHECK_INTERVAL,
  CHUNK_LOAD_DISTANCE,
  CHUNK_UNLOAD_MARGIN,
  FIRST_CHUNK,
  LAST_CHUNK,
  MAP_DIR,
  MINI_MAP_HEIGHT,
  MINI_MAP_ROTATE,
  MINI_MAP_SCALE,
  MINI_MAP_WIDTH,
  MINI_ZOOM,
  MINI_ZOOM_MAX,
  MINI_ZOOM_MIN,
  MINI_ZOOM_SPEED,
  RENDER_FLOOR,
  RESOLUTION,
  SKY,
  SPAWN,
  TOP_HEIGHT,
  USE_FOG,
} from '../constants';
import type { CarState, MapMeta, Obstacle, RuntimeChunk } from '../types';

/**
 * KONVENSI KOORDINAT
 *
 * Data map (chunk.x/y, shapes, spawn, posisi mobil) memakai konvensi gambar:
 * x ke kanan, y ke BAWAH (y kecil = bagian atas gambar).
 *
 * Dulu dunia 3D dipetakan z = -y lalu tekstur lantai di-flip supaya "pas".
 * Itu me-mirror seluruh dunia, makanya tulisan di gambar (mis. "Ridwan")
 * kebalik. Sekarang dunia 3D dipetakan z = +y, jadi:
 *   - tekstur lantai TIDAK perlu di-flip, gambar tegak,
 *   - minimap tidak perlu scale(S, -S), gambar langsung di-draw apa adanya.
 *
 * GLB sebelumnya cocok dengan z = -y, jadi sekarang di-mirror di sumbu z
 * supaya tetap pas dengan data map. Kalau GLB kamu ternyata sudah cocok
 * dengan z = +y, set flag ini ke false.
 */
const GLB_MIRROR_Z = true;

function unloadDistance() {
  return CHUNK_LOAD_DISTANCE + CHUNK_UNLOAD_MARGIN;
}

function rectDistance(px: number, py: number, c: RuntimeChunk) {
  const dx = Math.max(c.x - px, 0, px - (c.x + c.width));
  const dy = Math.max(c.y - py, 0, py - (c.y + c.height));
  return Math.hypot(dx, dy);
}

function disposeObject(root: THREE.Object3D) {
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

function makeGrid(c: RuntimeChunk, step = 50) {
  const points: number[] = [];
  const y = 0.05;
  for (let gx = 0; gx <= c.width; gx += step) {
    points.push(c.x + gx, y, c.y, c.x + gx, y, c.y + c.height);
  }
  for (let gy = 0; gy <= c.height; gy += step) {
    points.push(c.x, y, c.y + gy, c.x + c.width, y, c.y + gy);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xaaaaaa }));
}

function pointInPolygon(px: number, py: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

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
    spawnMarker.position.set(SPAWN.x, 0.2, SPAWN.y);
    scene.add(spawnMarker);

    const carGroup = new THREE.Group();
    let loadedCar: LoadedCar | null = null;
    let isDisposed = false;

    // Load realistic 3D car model with PBR materials and wheel rigs
    void loadCarModel(carGroup)
      .then((car) => {
        if (isDisposed) {
          car.dispose();
          return;
        }
        loadedCar = car;
      })
      .catch((error) => {
        console.error('Failed to load 3D car model:', error);
      });

    scene.add(carGroup);

    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    let mapMeta: MapMeta | null = null;
    let chunks: RuntimeChunk[] = [];
    let obstacles: Obstacle[] = [];
    let mapBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    let chunkTimer = 0;

    const loadChunk = async (c: RuntimeChunk) => {
      c.state = 'loading';
      const token = ++c.token;

      const img = new Image();
      img.onload = () => {
        if (c.token === token && c.state !== 'idle') {
          c.img = img;
          c.imgReady = true;
        }
      };
      img.src = `${MAP_DIR}/${c.image}`;

      try {
        const gltf = await loader.loadAsync(`${MAP_DIR}/${c.glb}`);

        if (c.token !== token || c.state !== 'loading') {
          disposeObject(gltf.scene);
          return;
        }

        const group = new THREE.Group();

        const groundMaterial = RENDER_FLOOR
          ? new THREE.MeshStandardMaterial({
              map: textureLoader.load(`${MAP_DIR}/${c.image}`),
            })
          : new THREE.MeshStandardMaterial({ color: 0xdddddd });

        if (RENDER_FLOOR && groundMaterial.map) {
          // Tidak ada flip lagi: bagian atas gambar = y kecil = -z, tegak.
          groundMaterial.map.colorSpace = THREE.SRGBColorSpace;
        }

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(c.width, c.height), groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(c.x + c.width / 2, -0.1, c.y + c.height / 2);
        group.add(ground);

        group.add(makeGrid(c));

        const obj = gltf.scene;
        if (GLB_MIRROR_Z) obj.scale.z = -1;
        obj.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            const edges = new THREE.LineSegments(
              new THREE.EdgesGeometry(mesh.geometry, 30),
              new THREE.LineBasicMaterial({ color: 0x000000 }),
            );
            mesh.add(edges);
          }
        });
        group.add(obj);

        scene.add(group);
        c.group = group;
        c.state = 'loaded';
      } catch (error) {
        console.error(`Gagal load chunk ${c.id}`, error);
        c.state = 'idle';
        c.retryAt = performance.now() + 3000;
      }
    };

    const unloadChunk = (c: RuntimeChunk) => {
      c.token++;
      if (c.group) {
        scene.remove(c.group);
        disposeObject(c.group);
        c.group = null;
      }
      c.img = null;
      c.imgReady = false;
      c.state = 'idle';
    };

    const updateChunks = (dt: number, force = false) => {
      chunkTimer -= dt;
      if (!force && chunkTimer > 0) return;
      chunkTimer = CHUNK_CHECK_INTERVAL;

      const now = performance.now();
      for (const c of chunks) {
        const d = rectDistance(car.x, car.y, c);

        if (c.state === 'idle') {
          if (d <= CHUNK_LOAD_DISTANCE && now >= c.retryAt) loadChunk(c);
        } else if (d > unloadDistance()) {
          unloadChunk(c);
        }
      }
    };

    let camInit = false;

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
        spawnMarker.position.set(SPAWN.x, 0.2, SPAWN.y);
        camInit = false;
      }

      chunks = (mapMeta.chunks ?? []).map((c) => ({
        ...c,
        state: 'idle',
        token: 0,
        group: null,
        img: null,
        imgReady: false,
        retryAt: 0,
      }));

      if (chunks.length > 0) {
        const minX = Math.min(...chunks.map((c) => c.x));
        const maxX = Math.max(...chunks.map((c) => c.x + c.width));
        const minY = Math.min(...chunks.map((c) => c.y));
        const maxY = Math.max(...chunks.map((c) => c.y + c.height));
        mapBounds = { minX, maxX, minY, maxY };
      }

      obstacles = (mapMeta.shapes ?? [])
        .filter((shape) => (shape.y_value ?? 0) < CAR_TOP)
        .map((shape) => {
          const xs = shape.pos.map((p) => p[0]);
          const ys = shape.pos.map((p) => p[1]);
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

    void loadMapData();

    minimap.width = MINI_MAP_WIDTH * MINI_MAP_SCALE;
    minimap.height = MINI_MAP_HEIGHT * MINI_MAP_SCALE;
    minimap.style.width = `${minimap.width}px`;
    minimap.style.height = `${minimap.height}px`;
    const miniCtx = minimap.getContext('2d');
    if (!miniCtx) return;

    let miniZoom = MINI_ZOOM;

    const keys = new Set<string>();
    let topView = false;

    const down = (...names: string[]) => names.some((name) => keys.has(name));

    const updateMiniZoom = (dt: number) => {
      const zoomIn = down('+', '=');
      const zoomOut = down('-', '_');
      if (zoomIn === zoomOut) return;

      const dir = zoomIn ? 1 : -1;
      miniZoom *= Math.exp(dir * MINI_ZOOM_SPEED * dt);
      miniZoom = Math.max(MINI_ZOOM_MIN, Math.min(MINI_ZOOM_MAX, miniZoom));
    };

    const drawMiniMap = () => {
      const w = minimap.width;
      const h = minimap.height;
      const S = miniZoom;

      miniCtx.setTransform(1, 0, 0, 1, 0, 0);
      miniCtx.fillStyle = '#222';
      miniCtx.fillRect(0, 0, w, h);

      miniCtx.save();
      miniCtx.translate(w / 2, h / 2);
      // Canvas y-down sama dengan konvensi data map (y ke bawah),
      // jadi tidak ada flip dan gambar langsung tegak.
      miniCtx.scale(S, S);

      // Heading mobil di sistem y-down: arah = (cos h, sin h).
      // Supaya mobil menghadap atas layar (-y), putar sebesar -90° - heading.
      if (MINI_MAP_ROTATE) miniCtx.rotate(-Math.PI / 2 - car.heading);

      miniCtx.translate(-car.x, -car.y);
      miniCtx.imageSmoothingEnabled = true;

      for (const c of chunks) {
        if (!c.imgReady || !c.img) continue;
        miniCtx.drawImage(c.img, c.x, c.y, c.width, c.height);

        miniCtx.lineWidth = 2 / S;
        miniCtx.strokeStyle = '#ff3b3b';
        miniCtx.strokeRect(c.x, c.y, c.width, c.height);
      }

      miniCtx.restore();

      const zoomText = `${(miniZoom / MINI_MAP_SCALE).toFixed(1)}x`;
      miniCtx.font = 'bold 14px monospace';
      miniCtx.textBaseline = 'bottom';
      miniCtx.lineWidth = 3;
      miniCtx.strokeStyle = 'rgba(0,0,0,0.8)';
      miniCtx.fillStyle = '#fff';
      miniCtx.strokeText(zoomText, 8, h - 6);
      miniCtx.fillText(zoomText, 8, h - 6);

      miniCtx.save();
      miniCtx.translate(w / 2, h / 2);
      // Panah digambar menghadap atas. Kalau map tidak ikut berputar,
      // putar panahnya sebesar heading + 90°.
      if (!MINI_MAP_ROTATE) miniCtx.rotate(car.heading + Math.PI / 2);
      miniCtx.beginPath();
      miniCtx.moveTo(0, -10);
      miniCtx.lineTo(7, 8);
      miniCtx.lineTo(0, 4);
      miniCtx.lineTo(-7, 8);
      miniCtx.closePath();
      miniCtx.fillStyle = '#e53935';
      miniCtx.strokeStyle = '#fff';
      miniCtx.lineWidth = 2;
      miniCtx.fill();
      miniCtx.stroke();
      miniCtx.restore();
    };

    const hitsObstacle = (px: number, py: number, r: number) => {
      for (const obstacle of obstacles) {
        if (
          px < obstacle.minX - r ||
          px > obstacle.maxX + r ||
          py < obstacle.minY - r ||
          py > obstacle.maxY + r
        ) {
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
      return !chunks.some((c) => px >= c.x && px <= c.x + c.width && py >= c.y && py <= c.y + c.height);
    };

    const blocked = (px: number, py: number) => hitsObstacle(px, py, CAR.radius) || outOfBounds(px, py);

    const getGeoPosition = () => {
      const mapWidth = mapBounds.maxX - mapBounds.minX;
      const mapHeight = mapBounds.maxY - mapBounds.minY;
      const tX = mapWidth === 0 ? 0 : Math.max(0, Math.min(1, (car.x - mapBounds.minX) / mapWidth));
      const tY = mapHeight === 0 ? 0 : Math.max(0, Math.min(1, (car.y - mapBounds.minY) / mapHeight));

      const latitude = FIRST_CHUNK.latitude + tY * (LAST_CHUNK.latitude - FIRST_CHUNK.latitude);
      const longitude = FIRST_CHUNK.longitude + tX * (LAST_CHUNK.longitude - FIRST_CHUNK.longitude);

      return { latitude, longitude };
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const k = event.key.toLowerCase();
      keys.add(k);
      if (event.key.startsWith('Arrow') || k === ' ') event.preventDefault();

      if (k === 'c') topView = !topView;
      if (k === '0') miniZoom = MINI_MAP_SCALE;
      if (k === 'r') {
        car.x = SPAWN.x;
        car.y = SPAWN.y;
        car.heading = SPAWN.heading;
        car.speed = 0;
        updateChunks(0, true);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    const updateCar = (dt: number) => {
      const gas = down('w', 'arrowup');
      const rev = down('s', 'arrowdown');
      const left = down('a', 'arrowleft');
      const right = down('d', 'arrowright');
      const hand = down(' ');

      if (gas) {
        car.speed += (car.speed < 0 ? CAR.brake : CAR.accel) * dt;
      } else if (rev) {
        car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.7) * dt;
      } else {
        const f = CAR.friction * dt;
        if (Math.abs(car.speed) <= f) car.speed = 0;
        else car.speed -= Math.sign(car.speed) * f;
      }

      if (hand) {
        const f = CAR.handbrake * dt;
        if (Math.abs(car.speed) <= f) car.speed = 0;
        else car.speed -= Math.sign(car.speed) * f;
      }

      car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));

      // Di sistem y-down, heading naik = putar ke kanan (searah jarum jam),
      // jadi tanda steer dibalik supaya A/← tetap belok kiri.
      const steer = (right ? 1 : 0) - (left ? 1 : 0);
      const grip = Math.min(1, Math.abs(car.speed) / 80);
      car.heading += steer * CAR.turnRate * grip * Math.sign(car.speed) * dt;

      const dx = Math.cos(car.heading) * car.speed * dt;
      const dy = Math.sin(car.heading) * car.speed * dt;

      let hit = false;
      if (!blocked(car.x + dx, car.y)) car.x += dx;
      else hit = true;
      if (!blocked(car.x, car.y + dy)) car.y += dy;
      else hit = true;

      if (hit) car.speed *= -0.25;

      carGroup.position.set(car.x, 0, car.y);
      // Maju mobil = +x lokal; di dunia arahnya (cos h, 0, sin h) => rotation.y = -heading.
      carGroup.rotation.y = -car.heading;

      // Update 3D car model animation (front wheel steering, 4-wheel rotation, dynamic brake lights)
      const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
      const isBraking = Boolean(rev || hand);
      loadedCar?.update(dt, car.speed, steerInput, isBraking);
    };

    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();

    const updateCamera = (dt: number) => {
      const fx = Math.cos(car.heading);
      const fz = Math.sin(car.heading);
      const cx = car.x;
      const cz = car.y;

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

    const updateHud = () => {
      const loaded = chunks.filter((c) => c.state === 'loaded').length;
      const loading = chunks.filter((c) => c.state === 'loading').length;
      const geo = getGeoPosition();

      hud.innerHTML = `
				<strong>CAR DEBUG</strong><br>
				Map X: ${car.x.toFixed(1)}<br>
				Map Y: ${car.y.toFixed(1)}<br>
				Latitude: ${geo.latitude.toFixed(8)}<br>
				Longitude: ${geo.longitude.toFixed(8)}<br>
				Heading: ${THREE.MathUtils.radToDeg(car.heading % (Math.PI * 2)).toFixed(0)}°<br>
				Chunk: ${loaded}/${chunks.length} aktif${loading ? ` (+${loading} loading)` : ''}<br>
				<small>W/↑ gas, S/↓ rem/mundur, A/D atau ←/→ belok<br>
				Space handbrake, C ganti kamera, R reset<br>
				+ / - zoom minimap (tahan), 0 reset zoom</small>
			`;
      speedo.innerHTML = `${Math.abs(Math.round(car.speed * 0.5))} <small>km/h</small>`;
    };

    const clock = new THREE.Clock();
    let animationId = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      updateCar(dt);
      updateChunks(dt);
      updateMiniZoom(dt);
      updateCamera(dt);
      updateHud();
      drawMiniMap();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);

      for (const c of chunks) {
        unloadChunk(c);
      }

      isDisposed = true;
      if (loadedCar) {
        loadedCar.dispose();
        loadedCar = null;
      }
      scene.remove(carGroup);
      disposeObject(carGroup);
      scene.remove(spawnMarker);
      spawnMarker.geometry.dispose();
      (spawnMarker.material as THREE.Material).dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === box) {
        box.removeChild(renderer.domElement);
      }
    };
  }, [boxRef, hudRef, speedoRef, minimapRef]);
}