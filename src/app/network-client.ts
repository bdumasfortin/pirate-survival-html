import type { RoomServerMessage } from "../../shared/room-protocol";
import { isValidRoomCode, normalizeRoomCode } from "../../shared/room-protocol";
import { createWebSocketTransport } from "../net/ws-transport";
import { setHudRoomCode } from "../render/ui";
import { REQUESTED_INPUT_DELAY_FRAMES, WS_SERVER_URL } from "./constants";
import { clearResyncSendState } from "./resync-manager";
import { clearRoomTimeouts, scheduleConnectTimeout, scheduleRoomRequestTimeout } from "./room-connection";
import { parseRoomServerMessage, sendRoomMessage } from "./room-messages";
import { activeRoomSocket, setActiveRoomSocket, setActiveRoomState } from "./state";
import type { NetworkStartOptions, RoomConnectionState } from "./types";
import { sanitizePlayerName } from "./ui-helpers";

type NetworkClientDependencies = {
  getPlayerNameValue: () => string;
  setRoomScreen: ((step: "form" | "room") => void) | null;
  handleRoomServerMessage: (roomState: RoomConnectionState, socket: WebSocket, message: RoomServerMessage) => void;
};

export const startNetworkClient = (
  roomCode: string,
  options: NetworkStartOptions,
  deps: NetworkClientDependencies
): void => {
  const serverUrl = options.serverUrl ?? WS_SERVER_URL;
  const inputDelayFrames = options.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
  const playerName = sanitizePlayerName(options.playerName ?? deps.getPlayerNameValue(), 16);
  const ui = options.ui ?? null;

  ui?.setStatus("Connecting to room server...");
  ui?.setActionsEnabled(false);

  const normalizedCode = normalizeRoomCode(roomCode);
  if (!isValidRoomCode(normalizedCode)) {
    console.warn(`[net] invalid room code "${roomCode}"`);
    ui?.setStatus("Invalid room code.", true);
    ui?.setActionsEnabled(true);
    return;
  }

  const roomState: RoomConnectionState = {
    role: "client",
    roomCode: normalizedCode,
    roomId: null,
    localPlayerIndex: null,
    localPlayerId: null,
    playerCount: 0,
    inputDelayFrames,
    seed: null,
    players: [],
    transport: null,
    hasSentStart: false,
    ui,
    pendingAction: "join",
    connectTimeoutId: null,
    requestTimeoutId: null,
    suppressCloseStatus: false,
  };

  const currentSocket = activeRoomSocket;
  if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
    currentSocket.close();
  }

  const { socket, transport } = createWebSocketTransport(serverUrl, (payload) => {
    const message = parseRoomServerMessage(payload);
    if (!message) {
      return;
    }
    deps.handleRoomServerMessage(roomState, socket, message);
  });

  roomState.transport = transport;
  setActiveRoomState(roomState);
  setActiveRoomSocket(socket);

  scheduleConnectTimeout(roomState, socket, serverUrl);

  socket.addEventListener("open", () => {
    roomState.suppressCloseStatus = false;
    clearRoomTimeouts(roomState);
    sendRoomMessage(socket, {
      type: "join-room",
      code: normalizedCode,
      playerName,
    });
    scheduleRoomRequestTimeout(roomState, socket, "join");
  });

  socket.addEventListener("error", () => {
    roomState.suppressCloseStatus = true;
    roomState.ui?.setStatus("Network error. Could not connect to server.", true);
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
  });

  socket.addEventListener("close", () => {
    clearRoomTimeouts(roomState);
    deps.setRoomScreen?.("form");
    if (!roomState.suppressCloseStatus) {
      roomState.ui?.setStatus("Disconnected from server.", true);
    }
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
    setHudRoomCode(null);
    clearResyncSendState();
    if (activeRoomSocket === socket) {
      setActiveRoomSocket(null);
      setActiveRoomState(null);
    }
  });
};
