# Biome Tier World Plan

## Goals

- Add 3 biome tiers that scale difficulty with distance from spawn.
- Each biome tier has its own island type weights.
- Each biome has exactly one unique boss island type that always spawns (singleton).
- Non-boss island types only spawn in their designated tier.
- Leave boss loot/progression incentives for later.
- Full rename of current island type ids to the new biome naming scheme.

## Biome tiers (initial)

- Tier 1: Calm belt
  - Non-boss island type: Beach
  - Boss island type: CalmBoss (Huge Crab)
  - Enemies: Crab
- Tier 2: Wild belt
  - Non-boss island type: Woods
  - Boss island type: WildBoss (Dire wolf)
  - Enemies: Wolf
- Tier 3: Volcanic belt
  - Non-boss island type: Volcanic
  - Boss island type: VolcanicBoss (Magma colossus)
  - Enemies: Magma slime

## Island type renames (full)

- `standard` -> `beach`
- `forest` -> `woods`
- `crabBoss` -> `calmBoss`
- `wolfBoss` -> `wildBoss`
- New:
  - `volcanic`
  - `volcanicBoss`

## Data model (world config)

- New config structures:
  - `BiomeTierConfig`
    - `id` (string)
    - `ringMin` / `ringMax` (distance band, tweakable)
    - `weights` (Record<IslandType, number> for non-boss types only)
    - `bossType` (IslandType, unique per tier)
    - `name` (display name, e.g., Calm belt)
- New config tables in `src/world/world-config.ts`:
  - `BIOME_TIERS` (ordered list of 3 tiers)
  - `ISLAND_SHAPE_CONFIG_BY_TYPE` (shape overrides per type)
  - `RESOURCE_NODE_CONFIGS_BY_TYPE` (resource configs per type)

## Generator changes

1. Create boss islands first:
   - For each tier, place one boss island within that tier's ring range.
   - Track spawned boss types so they never appear again.
2. Place remaining islands:
   - Choose tier by ring distance within a 90-degree arc.
   - Roll island type using that tier's weights (non-boss types only).
3. Island generation uses `ISLAND_SHAPE_CONFIG_BY_TYPE`:
   - Shape config overrides per type.
   - Resource configs per type via `RESOURCE_NODE_CONFIGS_BY_TYPE`.
   - Enemy spawn profile per type in creature spawning logic.

## Placement layout

- Arc-based world layout:
  - 90-degree arc centered on northeast (45 degrees).
  - Spawn island placed at the closest corner of the arc (bottom-left relative to the rest of the map).
  - All other islands are placed within the arc (no extra boundary line constraint).

## Initial tuning (starting point)

- Tier ring ranges (tweak later):
  - Calm belt: 700-1400
  - Wild belt: 1500-2500
  - Volcanic belt: 2600-3600
- Island counts (including spawn + boss):
  - Calm belt: 5
  - Wild belt: 7
  - Volcanic belt: 10
- Island size reduction:
  - Reduce base radius range to 120-180 with smaller padding as a starting point.

## Runtime integration

- World creation uses tiered weights and boss placement.
- Resource spawn uses per-island type resource configs.
- Enemy spawn uses per-island type enemy profile (or tier-based scaling).

## Determinism + snapshot updates

- Extend `WorldConfig` to include biome tier definitions or references.
- Update determinism hashing and snapshot serialization to include the new config data.

## Decisions captured

- Tier sizes scale with arc size:
  - Tier 1 target: 5 islands total (including spawn + boss).
  - Tier 3 max: 10 islands total (including boss).
- Tier ranges: initial values chosen and tweakable.
- Boss placement: random within tier ring bounds.
- Island size: start with a ~25% reduction versus current values.
