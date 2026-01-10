# SailorQuest - Game Wiki

## Game overview

- Pirate survival game about a stranded pirate exploring a procedural archipelago.
- Single-player and 4-player co-op (relay server); no PvP.
- Focus on gathering, crafting, exploration, and PvE.
- Semi-linear progression (inspired on Valheim/V Rising)
- Ability system inspired by One Piece's devil fruits

## Design principles

- Favor mystery and self-discovery: avoid over-explaining, keep instructions minimal, and design systems that encourage players to explore and learn on their own.

## Controls

- Move: WASD
- Aim: mouse cursor
- Attack: LMB (when weapon selected)
- Gather / board / disembark / interact: E
- Inventory slot: 1-9 or mouse wheel
- Drop item: Q
- Crafting menu: C (or Escape to close)
- Craft: click the Craft button in the crafting panel

## World

- Deterministic procedural islands generated from a seed.
- Islands are placed in biome tiers along a 90-degree arc; each tier has its own island types and a single boss island.
- Island types:
  - Beach (Calm belt): grass + sand, crabs, trees, rocks, berry bushes.
  - Woods (Wild belt): darker grass + sand, wolves, trees, rocks, berry bushes.
  - Volcanic (Volcanic belt): rocky terrain, magma slimes.
  - CalmBoss: sand only, rocks, Huge Crab boss.
  - WildBoss: forest look, Dire wolf boss.
  - VolcanicBoss: volcanic look, Magma colossus boss.
- Rare krakens roam the outer sea.

## Player

- Camera follows the player; world is larger than the view.
- Player sprite faces the cursor.
- Death disables input and shows a death overlay (F5 hint).
- In multiplayer, other players have name tags above their characters.

## Survival systems

- Health and hunger.
- Hunger decays; starvation drains health.
- Armor:
  - Each equipped item grants +20 max armor (up to 120).
  - Damage is absorbed by armor before health.
  - Armor regenerates after a delay if no hits are taken.

## Combat

- Sword attack via LMB when sword is selected.
- Attack aims toward the cursor.
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

- Single-row crafting menu centered on screen with ingredient list below.
- Select recipe with 1-9 or mouse wheel; click Craft to craft.
- Recipes: raft, sword.

## Building

- Structure items appear as a ghost preview in front of the player when selected.
- Valid placement shows a translucent preview; invalid placement turns red.
- Placement uses LMB and consumes the item.

## Resources

- Trees: multi-yield wood, then disappear.
- Rocks: single pickup.
- Berry bushes: 2-3 berries, berries respawn on a timer.

## Creatures and loot

- Crabs: drops crab meat; boss crab drops crab helmet.
- Wolves: drops wolf meat; wolf boss drops wolf cloak.
- Krakens: drops kraken ring.
- Food restores hunger.

## Raft / Ships

- Raft is now a placeable structure item (water-only).
- Use LMB to place the raft when selected in the inventory.
- Board/disembark with E when close to the raft or shoreline.

## Props

- Decorative world props (non-pickup items).

## Multiplayer

- Relay-only WebSocket server with room codes.
- Host creates a room and shares the code; host must start the match.
- Rooms are fixed to 4 players for now.
- Player names are required when hosting/joining and persist in browser storage.
