type CreateKeyboardControlsArgs = {
  onToggleCamera: () => void;
  onResetZoom: () => void;
  onResetCar: () => void;
};

export function createKeyboardControls({ onToggleCamera, onResetZoom, onResetCar }: CreateKeyboardControlsArgs) {
  const keys = new Set<string>();

  const down = (...names: string[]) => names.some((name) => keys.has(name));

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    keys.add(key);
    if (event.key.startsWith('Arrow') || key === ' ') event.preventDefault();

    if (key === 'c') onToggleCamera();
    if (key === '0') onResetZoom();
    if (key === 'r') onResetCar();
  };

  const onKeyUp = (event: KeyboardEvent) => {
    keys.delete(event.key.toLowerCase());
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  const dispose = () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
  };

  return {
    down,
    dispose,
  };
}
