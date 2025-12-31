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

After the room is created, the server logs the room code and the client logs it in the console.

### 3) Join a room (client)
Open a second window and use the Multiplayer tab to join a room.

Or open directly with:
`http://localhost:5173/?net=ws&role=client&room=ABCDE`

Replace `ABCDE` with the room code from the host. Run `window.startRoom()` in the host console to start the match.

### 4) Network simulation (optional)
To test jitter/latency in the relay, set env vars before `npm run dev` in `server/`:
`RELAY_LATENCY_MS=60 RELAY_JITTER_MS=20 RELAY_DROP_RATE=0.02 npm run dev`

Defaults are zero (no artificial latency/drop).

## Deploy (GitHub Pages)
- Project page URL: `https://bdumasfortin.github.io/pirate-survival-html/`
- Push to `main` and GitHub Actions will build + deploy automatically.
- Pages source should be set to GitHub Actions in the repo settings.

## Controls
- Move: WASD or Arrow keys
- Gather: E
- Use / Attack: Left mouse click
- Use raft: Left mouse click while raft is selected near shore
- Select hotbar slot: 1-9 or mouse wheel
- Drop item: Q
- Crafting menu: C
