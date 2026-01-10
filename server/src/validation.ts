import type { RoomClientMessage } from "../../shared/room-protocol.js";

export const validateMessageStructure = (message: unknown): message is RoomClientMessage => {
  if (!message || typeof message !== "object") {
    return false;
  }

  const msg = message as Record<string, unknown>;
  if (typeof msg.type !== "string") {
    return false;
  }

  switch (msg.type) {
    case "create-room":
      return (
        typeof msg.playerName === "string" && (msg.worldPreset === undefined || typeof msg.worldPreset === "string")
      );
    case "join-room":
      return typeof msg.code === "string" && typeof msg.playerName === "string";
    case "leave-room":
    case "start-room":
      return true;
    case "resync-state":
      return (
        typeof msg.requesterId === "string" &&
        typeof msg.frame === "number" &&
        typeof msg.seed === "string" &&
        Array.isArray(msg.players) &&
        typeof msg.snapshotId === "string" &&
        typeof msg.totalBytes === "number" &&
        typeof msg.chunkSize === "number"
      );
    case "resync-chunk":
      return (
        typeof msg.requesterId === "string" &&
        typeof msg.snapshotId === "string" &&
        typeof msg.offset === "number" &&
        typeof msg.data === "string"
      );
    case "state-hash":
      return typeof msg.frame === "number" && typeof msg.hash === "number";
    case "ping":
      return typeof msg.ts === "number";
    case "resync-request":
      return typeof msg.fromFrame === "number" && typeof msg.reason === "string";
    default:
      return false;
  }
};

export const validateNumericRange = (value: number, min: number, max: number): boolean => {
  return Number.isFinite(value) && value >= min && value <= max;
};

export const validateStringLength = (value: string, min: number, max: number): boolean => {
  return typeof value === "string" && value.length >= min && value.length <= max;
};
