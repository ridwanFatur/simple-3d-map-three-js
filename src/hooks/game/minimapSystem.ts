import { MINI_MAP_HEIGHT, MINI_MAP_ROTATE, MINI_MAP_SCALE, MINI_MAP_WIDTH, MINI_ZOOM, MINI_ZOOM_MAX, MINI_ZOOM_MIN, MINI_ZOOM_SPEED } from '../../constants';
import type { CarState, RuntimeChunk } from '../../types';

type CreateMinimapSystemArgs = {
  minimap: HTMLCanvasElement;
  car: CarState;
  getChunks: () => RuntimeChunk[];
};

export function createMinimapSystem({ minimap, car, getChunks }: CreateMinimapSystemArgs) {
  minimap.width = MINI_MAP_WIDTH * MINI_MAP_SCALE;
  minimap.height = MINI_MAP_HEIGHT * MINI_MAP_SCALE;
  minimap.style.width = `${minimap.width}px`;
  minimap.style.height = `${minimap.height}px`;

  const miniCtx = minimap.getContext('2d');
  if (!miniCtx) {
    throw new Error('Minimap 2D context tidak tersedia');
  }

  let miniZoom = MINI_ZOOM;

  const updateMiniZoom = (dt: number, down: (...names: string[]) => boolean) => {
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
    miniCtx.scale(S, -S);

    if (MINI_MAP_ROTATE) miniCtx.rotate(Math.PI / 2 - car.heading);

    miniCtx.translate(-car.x, -car.y);
    miniCtx.imageSmoothingEnabled = true;

    for (const chunk of getChunks()) {
      if (!chunk.imgReady || !chunk.img) continue;
      miniCtx.drawImage(chunk.img, chunk.x, chunk.y, chunk.width, chunk.height);

      miniCtx.lineWidth = 2 / S;
      miniCtx.strokeStyle = '#ff3b3b';
      miniCtx.strokeRect(chunk.x, chunk.y, chunk.width, chunk.height);
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
    if (!MINI_MAP_ROTATE) miniCtx.rotate(Math.PI / 2 - car.heading);
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

  const resetZoom = () => {
    miniZoom = MINI_MAP_SCALE;
  };

  return {
    updateMiniZoom,
    drawMiniMap,
    resetZoom,
  };
}
