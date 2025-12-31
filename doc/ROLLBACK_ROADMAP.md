# Rollback Roadmap

Keep this checklist updated as we complete steps.

## 1) Deterministic sim foundation
- [x] Seeded RNG for gameplay (spawns, AI wander, drops, respawn yields).
- [x] Move transient cooldowns into `GameState` so they are snapshotable.

## 2) Compact input frame buffer
- [x] Add per-frame input buffer with bitmask + small typed arrays.
- [x] Route inventory selection through the sim (no direct ECS writes from input).

## 3) Rollback snapshots + restore wiring
- [x] ECS snapshot/restore helpers.
- [x] GameState snapshot/restore helpers + ring buffer storage.
- [ ] Add frame counter to the sim and store snapshots each fixed update.
- [ ] Add rollback restore path (rewind to frame N).

## 4) Resimulation using buffered inputs
- [ ] After a rollback restore, re-run updates from frame N to current frame.
- [ ] Ensure inputs are loaded from the input buffer for each re-sim frame.

## 5) Input sync scaffolding (local + remote)
- [ ] Define per-player input frame format (local now, ready for remote).
- [ ] Add hooks to merge remote inputs into the frame buffer.
- [ ] Add basic late-input handling (trigger rollback + resim).
- [ ] Add player index mapping and per-player input queues.

## 6) Validation + determinism checks
- [ ] Add a determinism smoke test (same seed + same inputs => same hash).
- [ ] Identify/replace any remaining nondeterminism (timers, Date, Math.random).

## 7) Multiplayer session bootstrap
- [ ] Define session state (player list, host/peer IDs, current frame).
- [ ] Implement session start handshake (exchange seed + start frame).
- [ ] Add pause/resync path for late join or desync recovery.

## 8) Network transport + serialization
- [ ] Define compact wire format for input frames.
- [ ] Add send/receive loop for input frames (no authoritative server).
- [ ] Add jitter buffer / input delay tuning knobs.

## 9) Multiplayer gameplay integration
- [ ] Support multiple player entities in ECS (spawn, render, input routing).
- [ ] Ensure all gameplay systems iterate over player entities where needed.
- [ ] Add per-player inventory/equipment state in ECS and UI focus.
