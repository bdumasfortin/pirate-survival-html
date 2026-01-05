# Project Structure and Core Systems

## Goals
- Simple TypeScript + canvas stack.
- Clean separation of core loop, state, systems, and rendering.
- Keep gameplay code data-driven where practical.

## Directory layout
- `src/core/` low-level utilities (input bindings, math helpers, loop timing).
- `src/game/` game state, entities, inventory, survival stats, crafting data, tuning configs.
- `src/net/` client networking (transport, room protocol, snapshot encoding).
- `src/systems/` update logic (movement, collisions, gathering, survival, crafting, combat).
- `src/render/` draw routines, camera, HUD, asset registry, UI constants.
- `src/world/` world generation, islands, resource nodes, and world configs.
- `src/assets/` static assets (sprites, audio, json data).
- `server/` relay-only WebSocket room server (Node + ws).

## Data flow
1) Input updates in `core/input`.
2) Loop tick applies local/remote inputs and optionally resimulates from rollback.
3) Systems mutate `GameState`.
4) State hashes are exchanged; desyncs trigger resync snapshot flow.
5) Renderer reads `GameState` and draws.
