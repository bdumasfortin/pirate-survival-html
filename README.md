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
Open the game with:
`http://localhost:5173/?net=ws&role=host&players=2`

Optional params:
- `ws=ws://localhost:8787` to point at a custom relay URL.
- `autostart=1` to auto-start when the room is full.

After the room is created, the server logs the room code and the client logs it in the console.

### 3) Join a room (client)
Open a second window with:
`http://localhost:5173/?net=ws&role=client&room=ABCDE`

Replace `ABCDE` with the room code from the host. If `autostart=1` is not set, run `window.startRoom()` in the host console to start the match.

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
