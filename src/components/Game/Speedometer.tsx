import { forwardRef } from 'react';

const Speedometer = forwardRef<HTMLDivElement>(function Speedometer(_, ref) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-lg bg-black/80 px-[18px] py-[10px] font-mono text-[30px] font-bold text-white backdrop-blur-sm max-md:bottom-32 max-md:right-4 max-md:px-3 max-md:py-1.5 max-md:text-[22px]"
    />
  );
});

export default Speedometer;
