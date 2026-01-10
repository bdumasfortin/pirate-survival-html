# Agent Guide: SailorQuest

## Project overview

- HTML Canvas game built with Vite + TypeScript.
- Entry point is `index.html`, bootstrapped by `src/main.ts`.
- Multiplayer uses a relay-only WebSocket server in `server/`.

## Repo map (client)

- `src/app/`: menu UI, game startup, network client/host, session state.
- `src/core/`: ECS, input buffers, RNG, loop timing, state hashing.
- `src/game/`: game state, simulation, configs, rollback snapshots.
- `src/systems/`: gameplay systems (movement, crafting, combat, etc.).
- `src/render/`: canvas renderer, HUD/UI, asset registry.
- `src/world/`: world generation and resource nodes.
- `src/net/`: client networking, snapshots, session/transport.
- `shared/`: protocol types shared by client + server.

More detail: `doc/ARCHITECTURE.md`, `doc/ROOM_SERVER_PROTOCOL.md`.

## Multiplayer + determinism notes

- If you change protocol fields, update both client and server handlers.
- When adding new ECS/game-state fields, update:
  - `src/game/rollback.ts` (snapshots)
  - `src/net/snapshot.ts` (serialize/deserialize)
  - `src/core/state-hash.ts` (determinism checks)

## Entry points

- UI/menu: `index.html`, `src/main.ts`, `src/app/menu-ui.ts`.
- Game loop + sim: `src/app/game-runtime.ts`, `src/game/sim.ts`.

## Style/standards

- Follow `doc/CODE_STANDARDS.md` (double quotes, semicolons, 120 cols, sorted imports).
