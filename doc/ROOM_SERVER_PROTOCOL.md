# Room Server Protocol (Relay-Only)

This defines the wire messages and room model for the relay-only server.

## Room model
- Room code: 5 chars, uppercase, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- Code matching is case-insensitive, server stores uppercase.
- Player count: min 2, max 4 (host chooses on create).
- Host: room creator, index 0. Host selects seed and triggers start (server can auto-start when full).
- Server role: assigns player indices, validates room membership, relays inputs and session control.

## Transport rules
- Control messages are JSON objects with a `type` field.
- Input frames are binary `InputPacket` buffers encoded via `encodeInputPacket`.
- Server overwrites or rejects `playerIndex` mismatches to prevent spoofing.

## Client -> Server messages (JSON)
- `create-room` { playerCount?, seed?, inputDelayFrames? }
- `join-room` { code }
- `leave-room` {}
- `start-room` {}
- `ping` { ts }
- `resync-request` { fromFrame, reason: "late-join" | "desync" }

## Server -> Client messages (JSON)
- `room-created` { code, roomId, playerIndex, playerCount, seed, inputDelayFrames, players[] }
- `room-joined` { code, roomId, playerIndex, playerCount, seed, inputDelayFrames, players[] }
- `room-updated` { players[] }
- `room-closed` { reason }
- `start` { seed, startFrame, inputDelayFrames, players[] }
- `resync-request` { fromFrame, reason, requesterId }
- `resync-state` { frame, seed, players[], snapshotId, totalBytes, chunkSize }
- `error` { code, message }
- `pong` { ts }

## Resync snapshot delivery (planned)
- Host sends `resync-state` metadata first.
- Snapshot bytes are sent in chunks (details in step 7).

