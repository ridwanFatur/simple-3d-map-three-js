import { forwardRef } from 'react';

const GameHud = forwardRef<HTMLDivElement>(function GameHud(_, ref) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-3 top-3 z-10 max-w-[280px] rounded-md bg-black/80 p-3 font-mono text-[13px] leading-[1.5] text-[#00ff88] backdrop-blur-sm max-sm:max-w-[190px] max-sm:p-2 max-sm:text-[10px] max-sm:leading-[1.35]"
    />
  );
});

export default GameHud;
