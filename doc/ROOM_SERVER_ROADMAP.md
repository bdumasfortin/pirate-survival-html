# Room Server Roadmap (Relay-Only, Node + ws)

Keep this checklist updated as we complete steps.

## 1) Protocol + room model
- [x] Define room code format (length, alphabet) and max player count.
- [x] Define server envelope messages (create/join/leave/error/ping).
- [x] Define game payload messages (start, input-frame, resync-request/resync-state).
- [x] Decide host responsibilities (who triggers start, who provides resync snapshots).

## 2) Server scaffolding
- [x] Add a `server/` workspace with Node + TypeScript build/run scripts.
- [x] Implement room registry (`Map<code, Room>`), player registry, and TTL cleanup.
- [x] Implement short-code generator with collision checks.
- [x] Add basic logging and per-room metrics (players, ping).

## 3) WebSocket transport (client)
- [x] Add `WebSocketTransport` implementing `Transport` (send/onMessage/close).
- [x] Parse `net=ws` + `room=CODE` params in `src/main.ts`.
- [x] Wire incoming messages to session join/start and `applyRemoteInputFrame`.
- [x] Send outgoing `InputPacket` via server instead of loopback.

## 4) Room UX (create/join)
- [ ] Add UI flow: Create room -> show code; Join room -> enter code.
- [ ] Display connection status + player count; show error messages on failure.
- [ ] Allow host to start once required players are connected (or auto-start on full).

## 5) Session bootstrap over server
- [ ] Server assigns player indices and broadcasts `start` with seed/startFrame.
- [ ] Clients create host/client sessions based on server messages.
- [ ] Handle late join (pause running clients, send resync request).

## 6) Resync + determinism hooks
- [ ] Add periodic state hash exchange (client -> server -> peers).
- [ ] On mismatch, trigger resync request for a snapshot from host.
- [ ] Ensure rollback buffers can accept a full state restore.

## 7) Snapshot serialization
- [ ] Implement `serializeGameState` + `deserializeGameState` (binary format).
- [ ] Chunk large snapshots and reassemble on client.
- [ ] Validate snapshot applies deterministically across peers.

## 8) Hardening + abuse limits
- [ ] Validate message sizes, drop malformed frames, clamp frame drift.
- [ ] Rate-limit joins and input spam per connection.
- [ ] Idle room expiry + disconnected player cleanup.

## 9) Local + remote testing
- [ ] Local 2-client test with `net=ws` using two browser windows.
- [ ] Simulate latency/drop in server (optional debug flags).
- [ ] Verify determinism hashes stay stable under network jitter.
