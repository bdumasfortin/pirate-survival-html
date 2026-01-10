import type { RoomServerMessage } from "../../shared/room-protocol";
import { createWebSocketTransport } from "../net/ws-transport";
import { setHudRoomCode } from "../render/ui";
import { REQUESTED_INPUT_DELAY_FRAMES, WS_SERVER_URL } from "./constants";
import { scheduleResyncRetry } from "./resync-manager";
import { clearResyncSendState } from "./resync-manager";
import { clearRoomTimeouts, scheduleConnectTimeout, scheduleRoomRequestTimeout } from "./room-connection";
import { parseRoomServerMessage, sendRoomMessage } from "./room-messages";
import { activeRoomSocket, activeSession, pendingResync, setActiveRoomSocket, setActiveRoomState } from "./state";
import type { NetworkStartOptions, RoomConnectionState } from "./types";
import { sanitizePlayerName } from "./ui-helpers";

type NetworkHostDependencies = {
  getPlayerNameValue: () => string;
  setRoomScreen: ((step: "form" | "room") => void) | null;
  handleRoomServerMessage: (roomState: RoomConnectionState, socket: WebSocket, message: RoomServerMessage) => void;
};

export const startNetworkHost = (seed: string, options: NetworkStartOptions, deps: NetworkHostDependencies): void => {
  const playerCount = 4;
  const inputDelayFrames = options.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
  const serverUrl = options.serverUrl ?? WS_SERVER_URL;
  const playerName = sanitizePlayerName(options.playerName ?? deps.getPlayerNameValue(), 16);
  const worldPreset = options.worldPreset ?? "procedural";
  const ui = options.ui ?? null;

  ui?.setStatus("Connecting to room server...");
  ui?.setActionsEnabled(false);

  const roomState: RoomConnectionState = {
    role: "host",
    roomCode: null,
    roomId: null,
    localPlayerIndex: null,
    localPlayerId: null,
    playerCount,
    inputDelayFrames,
    seed,
    worldPreset,
    players: [],
    transport: null,
    hasSentStart: false,
    ui,
    pendingAction: "create",
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
    const currentPendingResync = pendingResync;
    const currentSession = activeSession;
    if (!currentPendingResync && currentSession?.status === "paused") {
      scheduleResyncRetry();
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
      type: "create-room",
      playerName,
      playerCount,
      seed,
      inputDelayFrames,
      worldPreset,
    });
    scheduleRoomRequestTimeout(roomState, socket, "create");
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

  if (import.meta.env.DEV) {
    const devWindow = window as typeof window & { startRoom?: () => void };
    devWindow.startRoom = () => {
      if (!roomState.hasSentStart) {
        sendRoomMessage(socket, { type: "start-room" });
        roomState.hasSentStart = true;
      }
    };
  }
};
