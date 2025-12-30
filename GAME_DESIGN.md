# Pirate Survival (Working Title) - Game Design Notes

## High-level concept
- Whimsical pirate survival game about being stranded on an island.
- Single-player and co-op; no PvP.
- Short sessions but long-term progression via exploration and base crafting.

## Core loop
- Scavenge: gather basic resources (wood, rocks, berries).
- Craft: tools, camp items, and a basic raft.
- Explore: discover nearby isles and points of interest.
- Survive: manage hunger and health.

## World structure
- Archipelago of small islands with distinct biomes and hazards.
- Procedural islands with handcrafted points of interest.

## Progression
- Crafting unlocks additional tools and utility items.
- Exploration reveals new islands and resource types.

## Survival systems
- Hunger decreases over time.
- Health drains when hunger hits zero.
- Berries can restore hunger when consumed.

## Crafting and building
- Simple recipes with escalating resource requirements.

## Threats (PvE)
- Land wildlife
- Sea threats: reefs, storms, sharks.
- Night events: ghost lights, shipwreck spirits (light combat).

## Co-op and rankings
- Co-op up to 4 players, shared island progress.
- Rankings based on milestones (days survived, bosses slain, etc.).

## Tone and art direction
- Bright, playful palette with chunky silhouettes.
- UI styled like a pirate journal and treasure map.

## Features status (current)
- Organic island shapes with multiple surrounding islands.
- Player movement with island edge sliding.
- Resources: trees (multi-yield wood), rocks (single rock), berry bushes (respawn).
- Inventory: 9-slot hotbar, stack limit 20, mouse wheel/1-9 selection, Q drops one item onto the ground.
- Crafting: column menu, select with 1-9/mouse wheel, LMB crafts, Escape closes (recipes: raft, sword).
- Raft travel: board/disembark near shore with LMB when raft is selected.
- Use: left-click consumes berries (hunger restore, cooldown).
- Combat: LMB sword attack toward cursor with cone effect; crab AI plus a boss crab on the leftmost island.
- Loot: crabs drop crab meat; eating it restores hunger.
- Survival HUD: health and hunger bars; death overlay with F5 restart hint.
- UI: action prompts, hints, and item icons in the hotbar.
- Visuals: SVG sprites for player, enemies, resources, and items.

## Next features to implement
- Music and SFX
- Procedural island generation with deterministic seeds.
- Biomes per island (swamp, reef, volcanic, jungle) with unique resources.
- Monsters tied to biomes; difficulty scales with distance from spawn.
- Boss encounters on remote islands.
- Crafting system expansion: recipe categories, crafting stations, and tool requirements.
- Loot drops, ground items, item dropping
- Tools: axe/pick upgrades that change gather speed/yield.
- Building placement: bedroll, storage, dock, simple shelters.
- Resource variety: rare nodes, fish, and treasure finds.
