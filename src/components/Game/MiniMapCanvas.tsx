import { forwardRef } from 'react';

const MiniMapCanvas = forwardRef<HTMLCanvasElement>(function MiniMapCanvas(_, ref) {
  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute right-3 top-3 z-10 h-auto w-auto rounded-[6px] border-[3px] border-white bg-[#222] shadow-[0_0_0_2px_rgba(0,0,0,0.7),0_4px_12px_rgba(0,0,0,0.5)]"
    />
  );
});

export default MiniMapCanvas;
