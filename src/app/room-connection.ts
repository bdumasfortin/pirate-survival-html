import { CONNECT_TIMEOUT_MS, ROOM_REQUEST_TIMEOUT_MS } from "./constants";
import type { RoomConnectionState } from "./types";

export const clearRoomTimeouts = (roomState: RoomConnectionState): void => {
  if (roomState.connectTimeoutId !== null) {
    window.clearTimeout(roomState.connectTimeoutId);
    roomState.connectTimeoutId = null;
  }
  if (roomState.requestTimeoutId !== null) {
    window.clearTimeout(roomState.requestTimeoutId);
    roomState.requestTimeoutId = null;
  }
};

export const scheduleConnectTimeout = (roomState: RoomConnectionState, socket: WebSocket, serverUrl: string): void => {
  if (roomState.connectTimeoutId !== null) {
    window.clearTimeout(roomState.connectTimeoutId);
  }
  roomState.connectTimeoutId = window.setTimeout(() => {
    roomState.connectTimeoutId = null;
    if (socket.readyState === WebSocket.OPEN) {
      return;
    }
    roomState.suppressCloseStatus = true;
    roomState.ui?.setStatus(`Connection timed out. Check server URL and port (${serverUrl}).`, true);
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
    socket.close();
  }, CONNECT_TIMEOUT_MS);
};

export const scheduleRoomRequestTimeout = (
  roomState: RoomConnectionState,
  socket: WebSocket,
  action: "create" | "join"
): void => {
  if (roomState.requestTimeoutId !== null) {
    window.clearTimeout(roomState.requestTimeoutId);
  }
  roomState.requestTimeoutId = window.setTimeout(() => {
    roomState.requestTimeoutId = null;
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const verb = action === "create" ? "create" : "join";
    roomState.suppressCloseStatus = true;
    roomState.ui?.setStatus(`Timed out waiting to ${verb} room.`, true);
    roomState.ui?.setActionsEnabled(true);
    roomState.ui?.setStartEnabled(false);
    socket.close();
  }, ROOM_REQUEST_TIMEOUT_MS);
};
