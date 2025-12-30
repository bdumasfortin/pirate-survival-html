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
- Crafting: toggleable menu with basic recipes.
- Combat: crab AI + player melee attack.
- Item use: left-click uses berries to restore hunger (cooldown 0.33s).
- Survival bars: health, hunger, thirst UI with decay over time.
- UI: bottom hotbar, interaction prompts, hints, survival bars.

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
- `src/systems/survival.ts` hunger/thirst decay + health loss.
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
2) Collisions
3) Crafting
4) Resource respawn
5) Gather (E)
6) Item use (LMB)
7) Drop (Q)
8) Crab behavior
9) Player attack (Space)
10) Survival decay
11) Render

## Notes
- Systems are intentionally stateless; mutate the passed `GameState`.
- Resources and islands are deterministic via seed config.
- Fonts are loaded before the first frame (`document.fonts.load`).
