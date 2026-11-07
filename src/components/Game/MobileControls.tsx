import { useCallback, useEffect, useRef, useState } from 'react';

export interface MobileInputState {
  steer: number; // Continuous analog: -1.0 (left) to 1.0 (right)
  throttle: number; // 0.0 to 1.0
  gas: boolean;
  rev: boolean;
  hand: boolean;
  onCamToggle?: () => void;
  onReset?: () => void;
}

interface MobileControlsProps {
  onInputChange: (state: MobileInputState) => void;
  onCamToggle?: () => void;
  onReset?: () => void;
}

export default function MobileControls({ onInputChange, onCamToggle, onReset }: MobileControlsProps) {
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const [gasActive, setGasActive] = useState(false);
  const [revActive, setRevActive] = useState(false);
  const [handActive, setHandActive] = useState(false);

  const steerRef = useRef(0);
  const throttleRef = useRef(0);
  const gasRef = useRef(false);
  const revRef = useRef(false);
  const handRef = useRef(false);

  const emitState = useCallback(() => {
    onInputChange({
      steer: steerRef.current,
      throttle: throttleRef.current,
      gas: gasRef.current,
      rev: revRef.current,
      hand: handRef.current,
    });
  }, [onInputChange]);

  // Touch handlers for the virtual analog joystick
  const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    updateJoystickPos(touch.clientX, touch.clientY);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateJoystickPos(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setKnobPos({ x: 0, y: 0 });
        steerRef.current = 0;
        throttleRef.current = 0;
        emitState();
        break;
      }
    }
  };

  const updateJoystickPos = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;

    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const maxRadius = rect.width / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setKnobPos({ x: knobX, y: knobY });

    // Continuous analog steering: -1.0 to 1.0
    const normalizedSteer = Math.max(-1, Math.min(1, knobX / maxRadius));
    steerRef.current = normalizedSteer;

    // Optional forward/backward push on joystick
    const normalizedY = -Math.max(-1, Math.min(1, knobY / maxRadius));
    throttleRef.current = normalizedY;

    emitState();
  };

  // Button touch handlers
  const handleGasDown = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    gasRef.current = true;
    setGasActive(true);
    emitState();
  };
  const handleGasUp = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    gasRef.current = false;
    setGasActive(false);
    emitState();
  };

  const handleRevDown = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    revRef.current = true;
    setRevActive(true);
    emitState();
  };
  const handleRevUp = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    revRef.current = false;
    setRevActive(false);
    emitState();
  };

  const handleHandDown = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    handRef.current = true;
    setHandActive(true);
    emitState();
  };
  const handleHandUp = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    handRef.current = false;
    setHandActive(false);
    emitState();
  };

  // Clear inputs on blur/unmount
  useEffect(() => {
    const onWindowBlur = () => {
      touchIdRef.current = null;
      setKnobPos({ x: 0, y: 0 });
      steerRef.current = 0;
      gasRef.current = false;
      revRef.current = false;
      handRef.current = false;
      setGasActive(false);
      setRevActive(false);
      setHandActive(false);
      emitState();
    };

    window.addEventListener('blur', onWindowBlur);
    return () => window.removeEventListener('blur', onWindowBlur);
  }, [emitState]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none touch-none">
      {/* Virtual Analog Joystick (Bottom-Left) */}
      <div className="pointer-events-auto absolute bottom-6 left-6 flex items-center justify-center">
        <div
          ref={joystickBaseRef}
          onTouchStart={handleJoystickTouchStart}
          onTouchMove={handleJoystickTouchMove}
          onTouchEnd={handleJoystickTouchEnd}
          onTouchCancel={handleJoystickTouchEnd}
          className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-white/30 bg-black/45 shadow-[0_4px_16px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          {/* Axis Crosshairs */}
          <div className="pointer-events-none absolute h-[1px] w-full bg-white/20" />
          <div className="pointer-events-none absolute h-full w-[1px] bg-white/20" />

          {/* Draggable Knob */}
          <div
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              transition: touchIdRef.current === null ? 'transform 0.15s ease-out' : 'none',
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/80 bg-gradient-to-br from-emerald-500 to-teal-700 shadow-[0_0_12px_rgba(52,211,153,0.7)]"
          >
            <div className="h-4 w-4 rounded-full bg-white/80" />
          </div>
        </div>
      </div>

      {/* Top Controls Bar: Camera & Reset buttons */}
      <div className="pointer-events-auto absolute bottom-6 left-44 flex gap-3">
        <button
          type="button"
          onClick={onCamToggle}
          className="flex h-11 items-center justify-center rounded-lg border border-white/25 bg-black/60 px-3.5 font-mono text-xs font-bold text-white shadow-md active:bg-white/20"
        >
          📷 CAM
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex h-11 items-center justify-center rounded-lg border border-red-500/50 bg-black/60 px-3.5 font-mono text-xs font-bold text-red-400 shadow-md active:bg-red-500/30"
        >
          🔄 RESET
        </button>
      </div>

      {/* Action Pedals / Buttons (Bottom-Right) */}
      <div className="pointer-events-auto absolute bottom-6 right-6 flex items-end gap-3.5">
        {/* Handbrake Button */}
        <button
          type="button"
          onTouchStart={handleHandDown}
          onTouchEnd={handleHandUp}
          onTouchCancel={handleHandUp}
          onMouseDown={handleHandDown}
          onMouseUp={handleHandUp}
          onMouseLeave={handleHandUp}
          className={`flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 font-mono text-xs font-bold transition-transform active:scale-95 ${
            handActive
              ? 'border-yellow-400 bg-yellow-500/80 text-black shadow-[0_0_15px_rgba(250,204,21,0.8)]'
              : 'border-yellow-500/60 bg-black/50 text-yellow-300 shadow-md'
          }`}
        >
          <span>HAND</span>
          <span className="text-[9px]">BRAKE</span>
        </button>

        {/* Reverse / Brake Button */}
        <button
          type="button"
          onTouchStart={handleRevDown}
          onTouchEnd={handleRevUp}
          onTouchCancel={handleRevUp}
          onMouseDown={handleRevDown}
          onMouseUp={handleRevUp}
          onMouseLeave={handleRevUp}
          className={`flex h-20 w-20 flex-col items-center justify-center rounded-2xl border-2 font-mono text-sm font-bold transition-transform active:scale-95 ${
            revActive
              ? 'border-red-400 bg-red-600/90 text-white shadow-[0_0_20px_rgba(239,68,68,0.8)]'
              : 'border-red-500/60 bg-black/50 text-red-400 shadow-lg'
          }`}
        >
          <span className="text-lg">▼</span>
          <span className="text-xs">BRAKE</span>
        </button>

        {/* Gas / Acceleration Button */}
        <button
          type="button"
          onTouchStart={handleGasDown}
          onTouchEnd={handleGasUp}
          onTouchCancel={handleGasUp}
          onMouseDown={handleGasDown}
          onMouseUp={handleGasUp}
          onMouseLeave={handleGasUp}
          className={`flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 font-mono text-sm font-bold transition-transform active:scale-95 ${
            gasActive
              ? 'border-emerald-400 bg-emerald-600/90 text-white shadow-[0_0_25px_rgba(16,185,129,0.85)]'
              : 'border-emerald-500/60 bg-black/50 text-emerald-300 shadow-xl'
          }`}
        >
          <span className="text-2xl">▲</span>
          <span className="text-xs tracking-wider">GAS</span>
        </button>
      </div>
    </div>
  );
}
