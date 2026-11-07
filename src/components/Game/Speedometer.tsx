import { forwardRef } from 'react';

const Speedometer = forwardRef<HTMLDivElement>(function Speedometer(_, ref) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute bottom-4 right-4 z-10 bg-black/80 px-[18px] py-[10px] font-mono text-[32px] font-bold text-white"
    />
  );
});

export default Speedometer;
