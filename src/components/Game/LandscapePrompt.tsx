interface LandscapePromptProps {
  isPortrait: boolean;
}

export default function LandscapePrompt({ isPortrait }: LandscapePromptProps) {
  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6 text-center text-white backdrop-blur-lg">
      <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
        {/* Animated Phone Rotate Icon */}
        <div className="h-20 w-12 animate-[spin_3s_ease-in-out_infinite] rounded-xl border-4 border-emerald-400 bg-black/40 shadow-[0_0_25px_rgba(52,211,153,0.6)]">
          <div className="mx-auto mt-1.5 h-1 w-4 rounded-full bg-white/60" />
        </div>
        <div className="absolute -bottom-2 text-2xl animate-bounce">🔄</div>
      </div>

      <h2 className="mb-2 font-mono text-2xl font-bold tracking-wide text-emerald-400">
        ROTATE YOUR DEVICE
      </h2>
      <p className="max-w-xs font-mono text-sm leading-relaxed text-gray-300">
        Please turn your screen to <strong>Landscape mode</strong> for the best driving view and controls.
      </p>
    </div>
  );
}
