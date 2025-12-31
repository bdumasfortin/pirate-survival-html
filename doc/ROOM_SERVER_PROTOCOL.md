# Room Server Protocol (Relay-Only)

This defines the wire messages and room model for the relay-only server.

## Room model
- Room code: 5 chars, uppercase, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- Code matching is case-insensitive, server stores uppercase.
- Player count: fixed to 2 (server ignores `create-room.playerCount`).
- Host: room creator, index 0. Host selects seed and triggers start (no auto-start).
- Late join: server sends `start` to the new client and broadcasts `resync-request` (reason: `late-join`).
- Server role: assigns player indices, validates room membership, relays inputs and session control.

## Transport rules
- Control messages are JSON objects with a `type` field.
- Input frames are binary `InputPacket` buffers encoded via `encodeInputPacket`.
- Server overwrites or rejects `playerIndex` mismatches to prevent spoofing.
- Clients periodically send `state-hash` for determinism checks; server relays to peers.

## Client -> Server messages (JSON)
- `create-room` { playerCount?, seed?, inputDelayFrames? } (playerCount ignored)
- `join-room` { code }
- `leave-room` {}
- `start-room` {}
- `state-hash` { frame, hash }
- `ping` { ts }
- `resync-request` { fromFrame, reason: "late-join" | "desync" }

## Server -> Client messages (JSON)
- `room-created` { code, roomId, playerIndex, playerCount, seed, inputDelayFrames, players[] }
- `room-joined` { code, roomId, playerIndex, playerCount, seed, inputDelayFrames, players[] }
- `room-updated` { players[] }
- `room-closed` { reason }
- `state-hash` { playerId, playerIndex, frame, hash }
- `start` { seed, startFrame, inputDelayFrames, players[] }
- `resync-request` { fromFrame, reason, requesterId }
- `resync-state` { frame, seed, players[], snapshotId, totalBytes, chunkSize }
- `error` { code, message }
- `pong` { ts }

## Resync snapshot delivery (planned)
- Host sends `resync-state` metadata first.
- Snapshot bytes are sent in chunks (details in step 7).
