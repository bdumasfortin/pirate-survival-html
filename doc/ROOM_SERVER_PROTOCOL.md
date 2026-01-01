# Room Server Protocol (Relay-Only)

This defines the wire messages and room model for the relay-only server.

## Room model
- Room code: 5 chars, uppercase, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- Code matching is case-insensitive, server stores uppercase.
- Player count: fixed to 2 (server ignores `create-room.playerCount`).
- Host: room creator, index 0. Host selects seed and triggers start (no auto-start).
- Player names: clients provide `playerName`, server stores and relays it with player lists.
- Late join: server sends `start` to the new client and broadcasts `resync-request` (reason: `late-join`).
- Server role: assigns player indices, validates room membership, relays inputs and session control.

## Transport rules
- Control messages are JSON objects with a `type` field.
- Input frames are binary `InputPacket` buffers encoded via `encodeInputPacket`.
- Clients periodically send `state-hash` for determinism checks; server relays to peers.
- Relay drops malformed JSON, oversize payloads, and binary packets that are not exactly 26 bytes.
- Rate limits apply to join/start/resync/state-hash/binary messages to prevent spam.

## Client -> Server messages (JSON)
- `create-room` { playerName, playerCount?, seed?, inputDelayFrames? } (playerCount ignored)
- `join-room` { code, playerName }
- `leave-room` {}
- `start-room` {}
- `state-hash` { frame, hash }
- `ping` { ts }
- `resync-request` { fromFrame, reason: "late-join" | "desync" }
- `resync-state` { requesterId, frame, seed, players[], snapshotId, totalBytes, chunkSize }
- `resync-chunk` { requesterId, snapshotId, offset, data }

## Server -> Client messages (JSON)
- `room-created` { code, roomId, playerIndex, playerCount, seed, inputDelayFrames, players[] }
- `room-joined` { code, roomId, playerIndex, playerCount, seed, inputDelayFrames, players[] }
- `room-updated` { players[] }
- `room-closed` { reason }
- `state-hash` { playerId, playerIndex, frame, hash }
- `start` { seed, startFrame, inputDelayFrames, players[] }
- `resync-request` { fromFrame, reason, requesterId }
- `resync-state` { frame, seed, players[], snapshotId, totalBytes, chunkSize }
- `resync-chunk` { snapshotId, offset, data }
- `error` { code, message }
- `pong` { ts }

`players[]` entries include `{ id, index, isHost, name }`.

## Resync snapshot delivery
- Server forwards `resync-request` to the host only.
- Host sends `resync-state` metadata first, server relays to requester.
- Snapshot bytes are base64 chunks via `resync-chunk`.

## Limits
- Max JSON payload: 64 KB.
- Max binary payload: 1024 bytes (input packets must be 26 bytes).
- Max snapshot bytes: 2 MB.
- Max resync chunk: 32 KB (base64 in JSON).
