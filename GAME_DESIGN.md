# Pirate Survival (Working Title) - Game Design Notes

## High-level concept
- Whimsical pirate survival game about being stranded on an island.
- Single-player and co-op; no PvP.
- Short sessions but long-term progression via exploration and base crafting.

## Core loop
- Scavenge: gather basic resources (wood, rocks, berries).
- Craft: tools, camp items, and a basic raft.
- Explore: discover nearby isles and points of interest.
- Survive: manage hunger, thirst, and health.

## World structure
- Archipelago of small islands with distinct biomes and hazards.
- Shallow waters near shore; farther islands require a raft.
- Procedural islands with handcrafted points of interest.

## Progression
- Crafting unlocks additional tools and utility items.
- Exploration reveals new islands and resource types.
- Co-op roles emerge naturally (gatherer, builder, scout).

## Survival systems
- Hunger and thirst decrease over time.
- Health drains when hunger or thirst hits zero.
- Berries can restore hunger when consumed.

## Crafting and building
- Simple recipes with escalating resource requirements.
- Buildable items: campfire, bedroll, storage, dock.
- Tools: axe, pick, fishing rod, shovel.

## Threats (PvE)
- Wildlife: crabs, boars, seabirds.
- Sea threats: reefs, storms, sharks.
- Night events: ghost lights, shipwreck spirits (light combat).

## Co-op and rankings
- Co-op up to 4 players, shared island progress.
- Rankings based on milestones (days survived, islands discovered).
- Seasonal leaderboards with cosmetic rewards.

## Tone and art direction
- Bright, playful palette with chunky silhouettes.
- Friendly animations and expressive character faces.
- UI styled like a pirate journal and treasure map.

## Prototype status (current)
- Organic island shapes with multiple surrounding islands.
- Player movement with island edge sliding.
- Resources: trees (multi-yield wood), rocks (single rock), berry bushes (respawn).
- Inventory: 9-slot hotbar, stack limit 20, mouse wheel/1-9 selection.
- Use: left-click consumes berries (hunger restore, cooldown).
- Drop: Q destroys one item from the selected slot (placeholder for future drops).
- Survival HUD: health, hunger, thirst bars.
- Interaction prompts: contextual E-to-gather labels.

## Next features to implement
- Procedural island generation with deterministic seeds.
- Biomes per island (swamp, reef, volcanic, jungle) with unique resources.
- Monsters tied to biomes; difficulty scales with distance from spawn.
- Boss encounters on remote islands.
- Crafting system: recipes, crafting UI, and tool requirements.
- Tools: axe/pick upgrades that change gather speed/yield.
- Building placement: campfire, storage, dock, simple shelters.
- Raft crafting and launch points for island travel.
- PvE combat: basic enemy AI, hitboxes, health, and loot drops.
- Damage sources: hazards, enemies, and starvation effects.
- Resource variety: rare nodes, fish, and treasure finds.
- Replace Q-destroy with world item drops for co-op pickup.
