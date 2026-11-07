import * as THREE from 'three';
import {
  CHUNK_LOAD_DISTANCE,
  CHUNK_UNLOAD_MARGIN,
} from '../constants';
import type { RuntimeChunk } from '../types';

export function unloadDistance() {
  return CHUNK_LOAD_DISTANCE + CHUNK_UNLOAD_MARGIN;
}

export function rectDistance(px: number, py: number, c: RuntimeChunk) {
  const dx = Math.max(c.x - px, 0, px - (c.x + c.width));
  const dy = Math.max(c.y - py, 0, py - (c.y + c.height));
  return Math.hypot(dx, dy);
}

export function disposeObject(root: THREE.Object3D) {
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

export function makeGrid(c: RuntimeChunk, step = 50) {
  const points: number[] = [];
  const y = 0.05;
  for (let gx = 0; gx <= c.width; gx += step) {
	points.push(c.x + gx, y, -c.y, c.x + gx, y, -(c.y + c.height));
  }
  for (let gy = 0; gy <= c.height; gy += step) {
	points.push(c.x, y, -(c.y + gy), c.x + c.width, y, -(c.y + gy));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xaaaaaa }));
}

export function pointInPolygon(px: number, py: number, poly: [number, number][]) {
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

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}