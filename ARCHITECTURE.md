# Project Structure and Core Systems

## Goals
- Simple TypeScript + canvas stack.
- Clean separation of core loop, state, systems, and rendering.
- Keep gameplay code data-driven where practical.

## Directory layout
- `src/core/` low-level utilities (input bindings, loop timing).
- `src/game/` game state, entities, inventory, survival stats, crafting data.
- `src/systems/` update logic (movement, collisions, gathering, survival, crafting, combat).
- `src/render/` draw routines, camera, HUD.
- `src/world/` world generation, islands, resource nodes.
- `src/assets/` static assets (sprites, audio, json data).

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
- Survival bars: health and hunger UI with decay over time.
- Raft: LMB board/disembark near shore when raft is selected.
- UI: bottom hotbar with item icons, action prompts, hints, survival bars.
- SVG sprites for player, enemies, resources, and items.

## Module responsibilities
- `src/core/loop.ts` manages requestAnimationFrame timing.
- `src/core/input.ts` keyboard + mouse input queues.
- `src/game/state.ts` top-level game state and initializers.
- `src/game/inventory.ts` inventory data and stack handling.
- `src/game/crafting.ts` recipe data and craft helpers.
- `src/game/creatures.ts` crab definitions + spawn helpers.
- `src/game/survival.ts` survival stats model.
- `src/systems/movement.ts` movement updates.
- `src/systems/collisions.ts` island boundary constraints + sliding.
- `src/systems/gathering.ts` resource interaction + respawn.
- `src/systems/crafting.ts` crafting menu toggle + recipe crafting.
- `src/systems/crabs.ts` crab behavior + player attack.
- `src/systems/raft.ts` raft boarding + disembarking.
- `src/systems/survival.ts` hunger decay + health loss.
- `src/systems/use-selected-item.ts` item use + cooldown.
- `src/render/renderer.ts` world render + HUD (inventory, prompts, bars, crafting).
- `src/world/world.ts` island creation + resource seeding.

## Data flow
1) Input updates in `core/input`.
2) Loop tick updates systems in `main.ts` order.
3) Systems mutate `GameState`.
4) Renderer reads `GameState` and draws.

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
11) Crab behavior
12) Survival decay
13) Render

## Notes
- Systems are intentionally stateless; mutate the passed `GameState`.
- Resources and islands are deterministic via seed config.
- Fonts are loaded before the first frame (`document.fonts.load`).
