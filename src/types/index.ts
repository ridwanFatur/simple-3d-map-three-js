import type * as THREE from 'three';

export type Spawn = {
  x: number;
  y: number;
  heading: number;
};

export type CarState = {
  x: number;
  y: number;
  heading: number;
  speed: number;
};

export type MapChunkMeta = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  glb: string;
  image: string;
};

export type MapShape = {
  chunk: number;
  pos: [number, number][];
  height: number;
  y_value?: number;
};

export type MapMeta = {
  width: number;
  height: number;
  spawn?: Spawn;
  chunks?: MapChunkMeta[];
  shapes?: MapShape[];
};

export type Obstacle = {
  poly: [number, number][];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ChunkState = 'idle' | 'loading' | 'loaded';

export type RuntimeChunk = MapChunkMeta & {
  state: ChunkState;
  token: number;
  group: THREE.Group | null;
  img: HTMLImageElement | null;
  imgReady: boolean;
  retryAt: number;
};
