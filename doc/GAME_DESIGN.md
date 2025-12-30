# Pirate Survival - Game Wiki

## Game overview
- Whimsical pirate survival game about a stranded pirate exploring a procedural archipelago.
- Single-player with planned co-op; no PvP.
- Focus on gathering, crafting, exploration, and PvE.

## Controls
- Move: WASD
- Aim: mouse cursor
- Use / attack / craft / board: LMB
- Gather: E
- Inventory slot: 1-9 or mouse wheel
- Drop item: Q
- Crafting menu: C (or Escape to close)

## World
- Deterministic procedural islands generated from a seed.
- 100 islands placed with separation so they do not touch.
- Island types:
  - Standard: grass + sand, crabs, trees, rocks, berry bushes.
  - Forest: darker grass + sand, wolves, trees, rocks, berry bushes.
  - Beach: sand only, rocks, boss crab.
  - Wolf Boss: forest look, wolf boss.
- Rare krakens roam the sea.

## Player
- Camera follows the player; world is larger than the view.
- Player sprite faces the cursor.
- Death disables input and shows a death overlay (F5 hint).

## Survival systems
- Health and hunger.
- Hunger decays; starvation drains health.
- Armor:
  - Each equipped item grants +20 max armor (up to 120).
  - Damage is absorbed by armor before health.
  - Armor regenerates after a delay if no hits are taken.

## Combat
- Sword attack via LMB when sword is selected.
- Attack aims toward the cursor and shows a cone effect.
- Enemies have hit flash feedback.

## Inventory and items
- 9-slot hotbar, stack limit 20.
- Items drop to the ground with Q; pickup when close (with a short pickup delay).
- Ground items render with their icon and sparkle effect.

## Equipment
- Slots: helmet, cloak, chest, legs, boots, ring.
- Equipment grid (3x2) shown bottom-left.
- Current equipment items: crab helmet, wolf cloak, kraken ring.

## Crafting
- Column crafting menu with item icons and ingredient list.
- Select recipe with 1-9 or mouse wheel; LMB crafts.
- Recipes: raft, sword.

## Resources
- Trees: multi-yield wood, then disappear.
- Rocks: single pickup.
- Berry bushes: 2-3 berries, berries respawn on a timer.

## Creatures and loot
- Crabs: drop crab meat; boss crab drops crab helmet.
- Wolves: drop wolf meat; wolf boss drops wolf cloak.
- Krakens: drop kraken ring.
- Food use:
  - Berries restore 20% hunger.
  - Crab meat restores 75% hunger.
  - Wolf meat restores 100% hunger.

## Raft
- Craftable raft used to traverse water.
- Board/disembark near shore using LMB while raft is selected.

## UI and visuals
- Hotbar with item icons and stack counts.
- Health, hunger, and armor bars above the hotbar.
- Action prompts and hints.
- Build version and active seed shown top-right.
- SVG sprites for player, enemies, resources, and items.
