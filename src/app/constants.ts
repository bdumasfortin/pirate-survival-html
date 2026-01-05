const URL_PARAMS = new URLSearchParams(window.location.search);

export const MAX_DEVICE_PIXEL_RATIO = 1.5;
export const SHOULD_RUN_DETERMINISM = import.meta.env.DEV && URL_PARAMS.has("determinism");
export const NETWORK_MODE = URL_PARAMS.get("net");
export const INPUT_DELAY_FRAMES = Math.max(0, Number.parseInt(URL_PARAMS.get("inputDelay") ?? "0", 10) || 0);
export const REQUESTED_INPUT_DELAY_FRAMES = URL_PARAMS.has("inputDelay") ? INPUT_DELAY_FRAMES : 0; // Will use DEFAULT_INPUT_DELAY_FRAMES from room-protocol
export const LOOPBACK_LATENCY_MS = Math.max(0, Number.parseInt(URL_PARAMS.get("latencyMs") ?? "0", 10) || 0);
export const LOOPBACK_JITTER_MS = Math.max(0, Number.parseInt(URL_PARAMS.get("jitterMs") ?? "0", 10) || 0);
export const LOOPBACK_DROP_RATE = Math.min(1, Math.max(0, Number.parseFloat(URL_PARAMS.get("dropRate") ?? "0") || 0));

export const INPUT_BUFFER_FRAMES = 240;
export const ROLLBACK_BUFFER_FRAMES = 240;
export const STATE_HASH_INTERVAL_FRAMES = 20;
export const STATE_HASH_HISTORY_FRAMES = ROLLBACK_BUFFER_FRAMES;
export const MAX_REMOTE_FRAME_AHEAD = 600;
export const MAX_REMOTE_FRAME_BEHIND = ROLLBACK_BUFFER_FRAMES;
export const MAX_INPUT_GAP_FRAMES = 180;
export const INPUT_GAP_WARN_INTERVAL_FRAMES = 120;
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
export const MAX_RESYNC_CHUNK_BYTES = 32 * 1024;
export const MAX_RESYNC_CHUNK_BASE64 = Math.ceil(MAX_RESYNC_CHUNK_BYTES / 3) * 4 + 16;
export const HASH_COOLDOWN_FRAMES = 120;
export const RESYNC_RETRY_DELAY_MS = 2000;
export const RESYNC_TIMEOUT_MS = 6000;
export const RESYNC_MAX_RETRIES = 10;
export const RESYNC_CHUNK_SEND_INTERVAL_MS = 16;
export const RESYNC_CHUNKS_PER_TICK = 4;
export const CONNECT_TIMEOUT_MS = 8000;
export const ROOM_REQUEST_TIMEOUT_MS = 8000;

export const PLAYER_NAME_STORAGE_KEY = "pirate_player_name";
export const SERVER_URL_STORAGE_KEY = "pirate_server_url";
export const ROOM_CODE_STORAGE_KEY = "pirate_room_code";
export const MAX_PLAYER_NAME_LENGTH = 16;
export const PLAYER_COUNT = 1;

export const WS_SERVER_URL =
  URL_PARAMS.get("ws") ??
  (window.location.protocol === "https:" ? "wss://server.sailorquest.com" : `ws://${window.location.hostname}:8787`);
export const WS_ROOM_CODE = URL_PARAMS.get("room");
export const WS_ROLE = (URL_PARAMS.get("role") ?? (WS_ROOM_CODE ? "client" : "host")).toLowerCase();
