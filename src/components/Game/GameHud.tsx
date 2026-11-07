import { forwardRef } from 'react';

const GameHud = forwardRef<HTMLDivElement>(function GameHud(_, ref) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-3 top-3 z-10 bg-black/80 p-3 font-mono text-[14px] leading-[1.6] text-[#00ff88]"
    />
  );
});

export default GameHud;
