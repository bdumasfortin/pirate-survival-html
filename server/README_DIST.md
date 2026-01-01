# Pirate Survival Relay Server

## How to run
1) Install Node.js (18+ recommended).
2) Start the server:
   `node server.js`

The default port is `8787`.

## Configuration
- Set a custom port:
  `PORT=9000 node server.js`
- Optional network simulation (for testing):
  `RELAY_LATENCY_MS=60 RELAY_JITTER_MS=20 RELAY_DROP_RATE=0.02 node server.js`

## Notes
- This server is relay-only; clients connect with WebSocket URLs like `ws://HOST:8787`.
