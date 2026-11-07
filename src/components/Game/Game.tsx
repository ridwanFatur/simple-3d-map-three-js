import { useMemo, useRef } from 'react';
import { MAX_SIZE, RESOLUTION } from '../../constants';
import { useCarGame } from '../../hooks/useCarGame';
import GameHud from './GameHud';
import MiniMapCanvas from './MiniMapCanvas';
import Speedometer from './Speedometer';

const IS_LANDSCAPE = RESOLUTION.width >= RESOLUTION.height;
const RATIO = RESOLUTION.width / RESOLUTION.height;

const boxStyle = IS_LANDSCAPE
  ? { width: `${MAX_SIZE}vw`, height: `${MAX_SIZE / RATIO}vw` }
  : { height: `${MAX_SIZE}vh`, width: `${MAX_SIZE * RATIO}vh` };

export default function Game() {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const speedoRef = useRef<HTMLDivElement | null>(null);
  const miniMapRef = useRef<HTMLCanvasElement | null>(null);

  const wrapperClass = useMemo(() => 'm-0 flex h-screen items-center justify-center bg-[#111]', []);

  useCarGame({
    boxRef,
    hudRef,
    speedoRef,
    minimapRef: miniMapRef,
  });

  return (
    <div className={wrapperClass}>
      <div ref={boxRef} className="relative overflow-hidden bg-white" style={boxStyle}>
        <GameHud ref={hudRef} />
        <Speedometer ref={speedoRef} />
        <MiniMapCanvas ref={miniMapRef} />
      </div>
    </div>
  );
}
