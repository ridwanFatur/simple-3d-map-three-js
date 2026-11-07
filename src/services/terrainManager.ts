import * as THREE from 'three';
import type { MapMeta, RuntimeChunk } from '../types';

export class TerrainManager {
  private mapMeta: MapMeta;
  private textureMap: number[][][][];
  private chunkLookup = new Map<string, RuntimeChunk>();
  private chunkWidth: number;
  private chunkHeight: number;
  private numCols: number;
  private numRows: number;

  constructor(mapMeta: MapMeta, runtimeChunks: RuntimeChunk[]) {
    this.mapMeta = mapMeta;
    this.textureMap = mapMeta.texture_map ?? [];

    this.chunkWidth = runtimeChunks[0]?.width || 900;
    this.chunkHeight = runtimeChunks[0]?.height || 900;

    this.numCols = Math.max(1, Math.round(mapMeta.width / this.chunkWidth));
    this.numRows = Math.max(1, Math.round(mapMeta.height / this.chunkHeight));

    for (const c of runtimeChunks) {
      const col = Math.round(c.x / this.chunkWidth);
      const row = Math.round(c.y / this.chunkHeight);
      this.chunkLookup.set(`${row},${col}`, c);
    }
  }

  private getChunkHeightData(row: number, col: number): number[][] | null {
    if (this.textureMap[row] && this.textureMap[row][col]) {
      return this.textureMap[row][col];
    }
    const c = this.chunkLookup.get(`${row},${col}`);
    if (c?.texture_map) return c.texture_map;
    return null;
  }

  private getRawSample(row: number, col: number, r: number, c: number): number {
    let targetRow = row;
    let targetCol = col;
    let targetR = r;
    let targetC = c;

    const data = this.getChunkHeightData(row, col);
    if (!data || data.length === 0 || data[0].length === 0) return 0;
    const resY = data.length;
    const resX = data[0].length;

    while (targetC < 0 && targetCol > 0) {
      targetCol--;
      const neighbor = this.getChunkHeightData(targetRow, targetCol);
      if (!neighbor) break;
      targetC += neighbor[0].length;
    }
    while (targetC >= resX && targetCol < this.numCols - 1) {
      targetC -= resX;
      targetCol++;
    }

    while (targetR < 0 && targetRow > 0) {
      targetRow--;
      const neighbor = this.getChunkHeightData(targetRow, targetCol);
      if (!neighbor) break;
      targetR += neighbor.length;
    }
    while (targetR >= resY && targetRow < this.numRows - 1) {
      targetR -= resY;
      targetRow++;
    }

    const targetData = this.getChunkHeightData(targetRow, targetCol);
    if (!targetData || targetData.length === 0 || targetData[0].length === 0) return 0;
    const tResY = targetData.length;
    const tResX = targetData[0].length;

    const clampedR = Math.max(0, Math.min(tResY - 1, targetR));
    const clampedC = Math.max(0, Math.min(tResX - 1, targetC));
    return targetData[clampedR][clampedC];
  }

  /**
   * Samples terrain height at world coordinates (worldX, worldZ / mapY).
   * Dynamically adapts to any texture_map resolution (e.g. 25x25, 40x40)
   * and uses C1 Hermite smoothstep interpolation for smooth, step-free terrain.
   */
  public getHeight(worldX: number, mapY: number): number {
    const clampedX = Math.max(0, Math.min(this.mapMeta.width - 0.001, worldX));
    const clampedY = Math.max(0, Math.min(this.mapMeta.height - 0.001, mapY));

    const chunkCol = Math.floor(clampedX / this.chunkWidth);
    const chunkRow = Math.floor(clampedY / this.chunkHeight);

    const data = this.getChunkHeightData(chunkRow, chunkCol);
    if (!data || data.length === 0 || data[0].length === 0) return 0;

    const resY = data.length;
    const resX = data[0].length;

    const localX = clampedX - chunkCol * this.chunkWidth;
    const localY = clampedY - chunkRow * this.chunkHeight;

    // Center-aligned continuous sample coordinates
    const u = (localX / this.chunkWidth) * resX - 0.5;
    const v = (localY / this.chunkHeight) * resY - 0.5;

    const x0 = Math.floor(u);
    const y0 = Math.floor(v);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    let fx = u - x0;
    let fy = v - y0;

    // Hermite smoothstep C1 continuous curve: 3*t^2 - 2*t^3
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);

    const h00 = this.getRawSample(chunkRow, chunkCol, y0, x0);
    const h10 = this.getRawSample(chunkRow, chunkCol, y0, x1);
    const h01 = this.getRawSample(chunkRow, chunkCol, y1, x0);
    const h11 = this.getRawSample(chunkRow, chunkCol, y1, x1);

    const hTop = h00 + (h10 - h00) * fx;
    const hBottom = h01 + (h11 - h01) * fx;

    return hTop + (hBottom - hTop) * fy;
  }

  /**
   * Computes vehicle pitch and roll angles on the terrain based on vehicle heading.
   * Forward in world coordinates is (cos heading, sin heading) in XZ plane.
   */
  public getVehicleSlope(worldX: number, mapY: number, heading: number): { pitch: number; roll: number } {
    const fx = Math.cos(heading);
    const fz = Math.sin(heading);
    const rx = -fz;
    const rz = fx;

    const probeLength = 8;
    const probeWidth = 5;

    const frontY = this.getHeight(worldX + fx * probeLength, mapY + fz * probeLength);
    const backY = this.getHeight(worldX - fx * probeLength, mapY - fz * probeLength);
    const rightY = this.getHeight(worldX + rx * probeWidth, mapY + rz * probeWidth);
    const leftY = this.getHeight(worldX - rx * probeWidth, mapY - rz * probeWidth);

    // In local car space (+X is forward):
    // Pitch tilts nose up/down (rotation around local Z)
    const pitch = Math.atan2(frontY - backY, probeLength * 2);
    // Roll tilts side-to-side (rotation around local X)
    const roll = Math.atan2(rightY - leftY, probeWidth * 2);

    return { pitch, roll };
  }

  /**
   * Builds an elevated PlaneGeometry for a chunk floor.
   * Applies terrain height values to local vertex Z (which rotates to world Y)
   * and recalculates normals for realistic light and shadow.
   */
  public buildChunkFloorGeometry(chunk: RuntimeChunk, segments = 48): THREE.PlaneGeometry {
    const geometry = new THREE.PlaneGeometry(chunk.width, chunk.height, segments, segments);
    const pos = geometry.attributes.position;

    // PlaneGeometry vertices row-by-row:
    // iy goes from 0 to segments (mapY from chunk.y to chunk.y + chunk.height)
    // ix goes from 0 to segments (worldX from chunk.x to chunk.x + chunk.width)
    for (let iy = 0; iy <= segments; iy++) {
      const vNorm = iy / segments;
      const worldY = chunk.y + vNorm * chunk.height;

      for (let ix = 0; ix <= segments; ix++) {
        const uNorm = ix / segments;
        const worldX = chunk.x + uNorm * chunk.width;

        const height = this.getHeight(worldX, worldY);
        const index = iy * (segments + 1) + ix;
        pos.setZ(index, height);
      }
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  /**
   * Elevates building mesh vertices in chunk GLTF object so they sit on top of the terrain.
   */
  public elevateObjectVertices(obj: THREE.Object3D, mirrorZ = true): void {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry && mesh.geometry.attributes.position) {
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vz = pos.getZ(i);
          const mapY = mirrorZ ? -vz : vz;
          const groundH = this.getHeight(vx, mapY);
          pos.setY(i, pos.getY(i) + groundH);
        }
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
      }
    });
  }

  /**
   * Builds visual line grid for a chunk, conforming to the terrain surface.
   */
  public buildChunkGrid(chunk: RuntimeChunk, step = 50): THREE.LineSegments {
    const points: number[] = [];
    const samplesPerLine = 18;

    // Grid lines along X
    for (let gy = 0; gy <= chunk.height; gy += step) {
      const mapY = chunk.y + gy;
      for (let s = 0; s < samplesPerLine; s++) {
        const x1 = chunk.x + (s / samplesPerLine) * chunk.width;
        const x2 = chunk.x + ((s + 1) / samplesPerLine) * chunk.width;
        const y1 = this.getHeight(x1, mapY) + 0.08;
        const y2 = this.getHeight(x2, mapY) + 0.08;
        points.push(x1, y1, mapY, x2, y2, mapY);
      }
    }

    // Grid lines along Y (Z in 3D)
    for (let gx = 0; gx <= chunk.width; gx += step) {
      const worldX = chunk.x + gx;
      for (let s = 0; s < samplesPerLine; s++) {
        const y1 = chunk.y + (s / samplesPerLine) * chunk.height;
        const y2 = chunk.y + ((s + 1) / samplesPerLine) * chunk.height;
        const h1 = this.getHeight(worldX, y1) + 0.08;
        const h2 = this.getHeight(worldX, y2) + 0.08;
        points.push(worldX, h1, y1, worldX, h2, y2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.35 }),
    );
  }
}
