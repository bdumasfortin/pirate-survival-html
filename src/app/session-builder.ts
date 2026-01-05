import type { RoomServerMessage } from "../../shared/room-protocol";
import { createClientSession, type SessionState } from "../net/session";
import type { RoomConnectionState } from "./types";

export const buildSessionFromStart = (
  startMessage: Extract<RoomServerMessage, { type: "start" }>,
  roomState: RoomConnectionState
): SessionState => {
  const session = createClientSession();
  session.isHost = roomState.role === "host";
  session.localPlayerIndex = roomState.localPlayerIndex ?? 0;
  session.expectedPlayerCount = roomState.playerCount > 0 ? roomState.playerCount : startMessage.players.length;
  session.seed = startMessage.seed;
  session.startFrame = startMessage.startFrame;
  session.currentFrame = startMessage.startFrame;
  session.players = startMessage.players.map((player) => ({
    id: player.id,
    index: player.index,
    isLocal: player.index === session.localPlayerIndex,
  }));
  session.localId = roomState.localPlayerId ?? session.localId;
  session.status = "running";
  session.pauseReason = null;
  return session;
};
