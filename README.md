# Pirate Survival Prototype

## Run locally
1) Install dependencies:
   `npm install`
2) Start the dev server:
   `npm run dev`

Open the URL printed by Vite (default is `http://localhost:5173`).

## Multiplayer (relay server)
This project uses a lightweight relay server for room-based multiplayer. Keep this section updated as parameters change.

### 1) Start the relay server
From the repo root:
1) Install server dependencies:
   `cd server && npm install`
2) Run the server (default port `8787`):
   `npm run dev`

You can set a custom port with `PORT=9000 npm run dev`.

### 2) Host a room (client)
Open the game and use the Multiplayer tab in the start menu to create a room.

You can also open directly with:
`http://localhost:5173/?net=ws&role=host`

Optional params:
- `ws=ws://localhost:8787` to point at a custom relay URL.
- `inputDelay=4` to override the input delay (frames).

Notes:
- Rooms are fixed to 2 players for now.
- Player name is required for host/join and is stored in browser storage.
- After creating a room, share the code shown in the UI. The host must click "Start Room" to begin.

### 3) Join a room (client)
Open a second window and use the Multiplayer tab to join a room.

Or open directly with:
`http://localhost:5173/?net=ws&role=client&room=ABCDE`

Replace `ABCDE` with the room code from the host. The host must press "Start Room" to start the match.

### 4) Network simulation (optional)
To test jitter/latency in the relay, set env vars before `npm run dev` in `server/`:
`RELAY_LATENCY_MS=60 RELAY_JITTER_MS=20 RELAY_DROP_RATE=0.02 npm run dev`

Defaults are zero (no artificial latency/drop).

### 5) Play with friends (home hosting)
If you want to host from home, you need to make the relay server reachable from the internet.

1) Start the relay server on your machine:
   `cd server && npm run dev`
   The default port is `8787`.
2) Allow inbound traffic to port `8787` on your OS firewall.
3) Set up port forwarding on your router:
   - Forward external port `8787` (TCP) to your PC's local IP (example `192.168.1.50:8787`).
4) Find your public IP address (or set up a dynamic DNS hostname).
5) Share the room code and the relay URL with your friend.

Host URL example:
`http://localhost:5173/?net=ws&role=host&ws=ws://YOUR_PUBLIC_IP:8787`

Friend URL example:
`http://<your-game-host>/?net=ws&role=client&ws=ws://YOUR_PUBLIC_IP:8787&room=ABCDE`

Notes:
- `YOUR_PUBLIC_IP` can be your ISP public IP or a dynamic DNS hostname.
- Some ISPs use CGNAT, which blocks inbound connections; if port forwarding does not work, you will need a VPS instead.

## Controls
- Move: WASD or Arrow keys
- Gather: E
- Use / Attack: Left mouse click
- Use raft: Left mouse click while raft is selected near shore
- Select hotbar slot: 1-9 or mouse wheel
- Drop item: Q
- Crafting menu: C
