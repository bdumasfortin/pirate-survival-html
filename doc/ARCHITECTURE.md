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

## Current implementation (prototype)
- Canvas renderer with camera follow + zoom.
- Organic polygon islands with multiple surrounding islands.
- Player movement + island boundary collisions with edge sliding.
- Resources: trees (multi-yield), rocks (single), bushes (berry respawn).
- Inventory: 9 slots, stack limit 20, mouse wheel/1-9 selection.
- Crafting: toggleable menu (column layout) with basic recipes (raft, sword).
- Combat: crab AI + player melee attack using sword on LMB.
- Boss crab on the leftmost island (oversized).
- Item use: left-click uses berries to restore hunger (cooldown 0.33s).
- Ground items: dropped items render on the ground and auto-pickup nearby.
- Survival bars: health and hunger UI with decay over time.
- Raft: LMB board/disembark near shore when raft is selected.
- UI: bottom hotbar with item icons, action prompts, hints, survival bars.
- SVG sprites for player, enemies, resources, and items.
- Multiplayer: relay server + room UI, deterministic rollback sync, state-hash checks, resync snapshots.

## Module responsibilities
- `src/core/loop.ts` manages requestAnimationFrame timing.
- `src/core/input.ts` keyboard + mouse input queues.
- `src/core/input-sync.ts` per-player input buffers for rollback.
- `src/core/state-hash.ts` deterministic state hashing for sync checks.
- `src/core/math.ts` shared math helpers (clamp/normalize).
- `src/game/state.ts` top-level game state and initializers.
- `src/game/rollback.ts` rollback snapshots and state restore helpers.
- `src/game/inventory.ts` inventory data and stack handling.
- `src/game/crafting.ts` recipe data and craft helpers.
- `src/game/combat-config.ts` combat tuning values.
- `src/game/creatures-config.ts` crab/boss spawn tuning.
- `src/game/raft-config.ts` raft interaction tuning.
- `src/game/survival-config.ts` hunger/health tuning.
- `src/game/use-config.ts` item use tuning.
- `src/game/creatures.ts` crab definitions + spawn helpers.
- `src/game/survival.ts` survival stats model.
- `src/systems/movement.ts` movement updates.
- `src/systems/collisions.ts` island boundary constraints + sliding.
- `src/systems/gathering.ts` resource interaction + respawn.
- `src/systems/ground-items.ts` ground item pickup.
- `src/systems/crafting.ts` crafting menu toggle + recipe crafting.
- `src/systems/crabs.ts` crab behavior + player attack.
- `src/systems/raft.ts` raft boarding + disembarking.
- `src/systems/survival.ts` hunger decay + health loss.
- `src/systems/use-selected-item.ts` item use + cooldown.
- `src/render/assets.ts` asset registry for SVG sprites.
- `src/render/render-helpers.ts` shared canvas drawing helpers.
- `src/render/ui-config.ts` HUD/layout constants.
- `src/render/world.ts` world/background rendering (islands, entities, effects).
- `src/render/ui.ts` HUD rendering (inventory, prompts, crafting, bars).
- `src/render/renderer.ts` render orchestrator.
- `src/net/room-protocol.ts` room server message contracts.
- `src/net/input-wire.ts` binary input packet encoding.
- `src/net/snapshot.ts` snapshot serialization + base64 chunk helpers.
- `src/world/types.ts` world domain types.
- `src/world/world-config.ts` island/resource config data.
- `src/world/world.ts` island creation + resource seeding.
- `server/src/index.ts` relay server entry (rooms, rate limits, resync routing).

## Data flow
1) Input updates in `core/input`.
2) Loop tick applies local/remote inputs and optionally resimulates from rollback.
3) Systems mutate `GameState`.
4) State hashes are exchanged; desyncs trigger resync snapshot flow.
5) Renderer reads `GameState` and draws.

## Update order (current)
1) Movement
2) Raft boarding/disembark
3) Collisions
4) Crafting
5) Resource respawn
6) Gather (E)
7) Use cooldown tick
8) Player attack (LMB with sword)
9) Item use (LMB with berries)
10) Drop (Q)
11) Ground item pickup
12) Crab behavior
13) Survival decay
14) Render

## Notes
- Systems are intentionally stateless; mutate the passed `GameState`.
- Resources and islands are deterministic via seed config.
- Fonts are loaded before the first frame (`document.fonts.load`).
