import type { RoomClientMessage, RoomServerMessage } from "../../shared/room-protocol";
import type { RoomConnectionState } from "./types";

export const parseRoomServerMessage = (payload: string): RoomServerMessage | null => {
  try {
    const data = JSON.parse(payload) as RoomServerMessage;
    if (!data || typeof data !== "object" || !("type" in data)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

export const sendRoomMessage = (socket: WebSocket, message: RoomClientMessage): void => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

export const formatRoomError = (
  _roomState: RoomConnectionState,
  message: Extract<RoomServerMessage, { type: "error" }>
): string => {
  let detail = message.message;
  switch (message.code) {
    case "room-not-found":
      detail = "Room not found. Check the code and server URL.";
      break;
    case "room-full":
      detail = "Room is full.";
      break;
    case "invalid-code":
      detail = "Invalid room code. Use the 5-character code from the host.";
      break;
    case "not-host":
      detail = "Only the host can perform that action.";
      break;
    case "not-in-room":
      detail = "You are not currently in a room.";
      break;
    case "room-already-started":
      detail = message.message || "Can't join an already started room.";
      break;
    case "bad-request":
      detail = message.message || "Bad request.";
      break;
    default:
      break;
  }
  return `${detail}`;
};
