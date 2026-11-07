import { useCallback, useEffect, useRef, useState } from 'react';
import { useCarGame } from '../../hooks/useCarGame';
import GameHud from './GameHud';
import LandscapePrompt from './LandscapePrompt';
import MiniMapCanvas from './MiniMapCanvas';
import MobileControls, { type MobileInputState } from './MobileControls';
import Speedometer from './Speedometer';

export default function Game() {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const speedoRef = useRef<HTMLDivElement | null>(null);
  const miniMapRef = useRef<HTMLCanvasElement | null>(null);

  const mobileInputRef = useRef<MobileInputState>({
    steer: 0,
    throttle: 0,
    gas: false,
    rev: false,
    hand: false,
  });

  const onCamToggleRef = useRef<(() => void) | null>(null);
  const onResetRef = useRef<(() => void) | null>(null);

  const [isPortrait, setIsPortrait] = useState(() => {
    return typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false;
  });

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const isTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;
      setIsTouchDevice(isTouch);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  const handleMobileInputChange = useCallback((state: MobileInputState) => {
    mobileInputRef.current = state;
  }, []);

  const handleCamToggle = useCallback(() => {
    onCamToggleRef.current?.();
  }, []);

  const handleReset = useCallback(() => {
    onResetRef.current?.();
  }, []);

  useCarGame({
    boxRef,
    hudRef,
    speedoRef,
    minimapRef: miniMapRef,
    mobileInputRef,
    onCamToggleRef,
    onResetRef,
  });

  return (
    <div className="relative m-0 flex h-screen w-screen overflow-hidden bg-black select-none">
      {/* Landscape Orientation Prompt for mobile portrait mode */}
      <LandscapePrompt isPortrait={isPortrait} />

      {/* Main Game Screen (occupies available screen space in landscape mode) */}
      <div
        ref={boxRef}
        className="relative h-full w-full overflow-hidden bg-[#111] touch-none"
      >
        <GameHud ref={hudRef} />
        <Speedometer ref={speedoRef} />
        <MiniMapCanvas ref={miniMapRef} />

        {/* Mobile controls: virtual analog joystick + action buttons (visible on touch/mobile devices) */}
        {isTouchDevice && (
          <MobileControls
            onInputChange={handleMobileInputChange}
            onCamToggle={handleCamToggle}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
