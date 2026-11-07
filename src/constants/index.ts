export const RESOLUTION = { width: 1920, height: 1080 };
export const MAX_SIZE = 100;

export const CHUNK_LOAD_DISTANCE = 1100;
export const CHUNK_UNLOAD_MARGIN = 150;
export const CHUNK_CHECK_INTERVAL = 0.2;
export const USE_FOG = true;

export const MINI_MAP_WIDTH = 60;
export const MINI_MAP_HEIGHT = 60;
export const MINI_MAP_SCALE = 3;
export const MINI_ZOOM = 0.2;
export const MINI_ZOOM_MIN = 0.1;
export const MINI_ZOOM_MAX = 1;
export const MINI_ZOOM_SPEED = 1.2;
export const MINI_MAP_ROTATE = true;

export const MAP_DIR = '/map_objects';

export const FIRST_CHUNK = {
  latitude: -6.920973741554146,
  longitude: 107.58499145507812,
} as const;

export const LAST_CHUNK = {
  latitude: -6.925063576592028, 
  longitude: 107.589111328125,
} as const;

export const RENDER_FLOOR = true;

export const SPAWN = { x: 0, y: 0, heading: Math.PI / 4 };

export const CAR = {
  length: 40,
  width: 20,
  height: 10,
  radius: 14,
  maxSpeed: 320,
  maxReverse: 100,
  accel: 220,
  brake: 420,
  friction: 90,
  handbrake: 500,
  turnRate: 2.2,
} as const;

export const CAR_MODEL_CONFIG = {
  modelPath: '/models/car.glb',
  shadowPath: '/models/car_ao.png',
  dracoPath: '/draco/',
  scale: 8.85,
  wheelRadius: 3.17,
  maxSteerAngle: 0.38,
  steerLerpSpeed: 14,
} as const;

export const CHASE = { distance: 130, height: 70, lookAhead: 40, smooth: 5 } as const;
export const TOP_HEIGHT = 700;

export const SKY = 0xbfe3ff;
export const CAR_TOP = 16;
