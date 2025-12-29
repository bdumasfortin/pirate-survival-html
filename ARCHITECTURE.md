# Project Structure and Core Systems

## Goals
- Simple TypeScript + canvas stack.
- Clean separation of core loop, state, systems, and rendering.
- Keep gameplay code data-driven where practical.

## Directory layout
- `src/core/` low-level utilities (time, input, math, RNG).
- `src/game/` game state, entities, and high-level orchestration.
- `src/systems/` update logic (movement, hunger, gathering, AI).
- `src/render/` draw routines and camera.
- `src/world/` world generation, islands, tiles, and resources.
- `src/assets/` static assets (sprites, audio, json data).

## Module responsibilities
- `src/core/loop.ts` manages requestAnimationFrame and fixed step.
- `src/core/input.ts` keyboard + pointer state.
- `src/core/time.ts` time helpers and delta smoothing.
- `src/game/state.ts` top-level game state and initializers.
- `src/game/entities.ts` entity types and IDs.
- `src/systems/` runs in order; each system mutates state.
- `src/render/renderer.ts` draws world + entities; camera follows player.
- `src/world/world.ts` island layout, resource nodes, spawn points.

## Data flow
1) Input updates in `core/input`.
2) `core/loop` ticks fixed update for deterministic systems.
3) Systems mutate state (movement, hunger, AI, etc).
4) Renderer reads state and draws to canvas.

## Ordering (prototype)
1) Input
2) Movement + collisions
3) Hunger/Thirst
4) Interaction (gather, pick up)
5) AI (crabs)
6) Render

## Notes
- Keep systems stateless; pass state in/out.
- Avoid global singletons; use one `GameState` instance.
- Assets referenced by IDs (string enums or consts).
