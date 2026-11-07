import * as THREE from 'three';
import type { CarState, RuntimeChunk } from '../../types';

type GeoPosition = {
  latitude: number;
  longitude: number;
};

type CreateHudSystemArgs = {
  hud: HTMLDivElement;
  speedo: HTMLDivElement;
  car: CarState;
  getChunks: () => RuntimeChunk[];
  getGeoPosition: () => GeoPosition;
};

export function createHudSystem({ hud, speedo, car, getChunks, getGeoPosition }: CreateHudSystemArgs) {
  const updateHud = () => {
    const chunks = getChunks();
    const loaded = chunks.filter((chunk) => chunk.state === 'loaded').length;
    const loading = chunks.filter((chunk) => chunk.state === 'loading').length;
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

  return {
    updateHud,
  };
}
