# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vite + React + TypeScript Three.js game project.

- `src/` — application source code.
  - `components/Game/` — UI container pieces (`Game.tsx`, HUD, minimap canvas, speedometer).
  - `hooks/` — runtime game orchestration (`useCarGame.ts`) for scene setup, controls, and loop.
  - `constants/` — centralized gameplay/rendering config values.
  - `types/` — shared TypeScript types for map/chunk/game data.
- `public/map_objects/` — runtime map assets (`.glb`, `.jpg`, `map.json`).
- `dist/` — production build output.
- Root config: `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `tsconfig*.json`.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start local development server with HMR.
- `npm run build` — type-check (`tsc -b`) and produce production bundle.
- `npm run preview` — serve the built `dist/` output locally.

Example flow:
`npm install && npm run dev`

## Coding Style & Naming Conventions
- Use TypeScript with `strict` settings; prefer explicit types for shared structures.
- Use 2-space indentation and keep formatting consistent with existing files.
- Components: `PascalCase` filenames and exports (e.g., `MiniMapCanvas.tsx`).
- Hooks: `camelCase` with `use` prefix (e.g., `useCarGame.ts`).
- Constants: `UPPER_SNAKE_CASE`; map coordinate refs may follow existing `first_chunk` / `last_chunk` naming.
- Keep gameplay logic in hooks and configuration in `src/constants/index.ts` (avoid magic numbers in components).

## Testing Guidelines
There is currently no dedicated test framework configured.

Minimum validation before PR:
- `npm run build` must pass.
- Manually verify: game loads at `/`, controls work, chunks load/unload, minimap and HUD update, assets load from `public/map_objects/`.

If adding tests later, colocate unit tests under `src/` with `*.test.ts` / `*.test.tsx` naming.

## Commit & Pull Request Guidelines
Current history mostly uses short messages like `Update`. Prefer clearer, imperative messages:
- `feat(game): add lat/lon HUD interpolation`
- `fix(floor): mirror chunk texture on X axis`

PRs should include:
- concise summary of behavior changes,
- files/areas affected,
- manual verification steps,
- screenshots or short video for visual/gameplay changes.
