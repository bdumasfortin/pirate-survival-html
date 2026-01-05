import type { RoomPlayerInfo } from "../../shared/room-protocol";
import { isEntityAlive } from "../core/ecs";
import { setPlayerNameLabels } from "../render/world";
import { resetRemotePlayerInputState } from "./input-manager";
import { activeGame, activeSession } from "./state";
import type { RoomConnectionState } from "./types";

export const syncRoomPlayers = (roomState: RoomConnectionState, players: RoomPlayerInfo[]): void => {
  roomState.players = players;

  const localId = roomState.localPlayerId;
  if (localId) {
    const localInfo = players.find((player) => player.id === localId);
    if (localInfo) {
      const prevIndex = roomState.localPlayerIndex;
      roomState.localPlayerIndex = localInfo.index;
      roomState.role = localInfo.isHost ? "host" : "client";
      if (prevIndex !== localInfo.index) {
        console.info(
          `[sync-players] Local player index changed: ${prevIndex} -> ${localInfo.index}, ` +
            `localId=${localId}, role=${roomState.role}`
        );
      }
    }
  }

  const session = activeSession;
  if (session) {
    const prevLocalIndex = session.localPlayerIndex;
    const sessionLocalId = session.localId;
    session.players = players.map((player) => ({
      id: player.id,
      index: player.index,
      isLocal: player.id === sessionLocalId,
    }));
    const localInfo = players.find((player) => player.id === sessionLocalId);
    if (localInfo) {
      session.localPlayerIndex = localInfo.index;
      session.isHost = localInfo.isHost;
      roomState.role = localInfo.isHost ? "host" : "client";
      if (prevLocalIndex !== localInfo.index) {
        console.info(
          `[sync-players] Session player index changed: ${prevLocalIndex} -> ${localInfo.index}, ` +
            `localId=${session.localId}, isHost=${session.isHost}`
        );
      }
    }
    console.info(
      `[sync-players] Updated session players: ` +
        `${session.players.map((p) => `${p.id}:${p.index}${p.isLocal ? "(local)" : ""}`).join(", ")}`
    );
  }

  const game = activeGame;
  if (!game) {
    return;
  }

  const ecs = game.state.ecs;
  const connected = new Set(players.map((player) => player.index));
  if (game.minRemoteInputFrames.length !== game.state.playerIds.length) {
    game.minRemoteInputFrames = Array.from(
      { length: game.state.playerIds.length },
      (_, index) => game.minRemoteInputFrames[index] ?? 0
    );
  }
  for (let index = 0; index < game.state.playerIds.length; index += 1) {
    const playerId = game.state.playerIds[index];
    if (playerId === undefined) {
      continue;
    }
    const shouldBeAlive = connected.has(index);
    const isAlive = isEntityAlive(ecs, playerId);
    if (shouldBeAlive && !isAlive) {
      console.info(
        `[sync-players] Marking player ${index} as alive (rejoin), ` +
          `playerId=${playerId}, connected=${shouldBeAlive}`
      );
      ecs.alive[playerId] = 1;
      resetRemotePlayerInputState(index);
      const delayFrames = Math.max(0, roomState.inputDelayFrames);
      if (index !== session?.localPlayerIndex) {
        game.maxInputFrames[index] = game.clock.frame - 1;
        game.minRemoteInputFrames[index] = game.clock.frame + delayFrames;
        if (index < game.lastInputGapWarningFrame.length) {
          game.lastInputGapWarningFrame[index] = -1;
        }
      }
      continue;
    }
    if (!shouldBeAlive && isAlive) {
      ecs.alive[playerId] = 0;
      resetRemotePlayerInputState(index);
      if (game.state.attackEffects[index]) {
        game.state.attackEffects[index] = null;
      }
    }
  }

  const labels = Array.from({ length: game.state.playerIds.length }, () => "");
  for (const player of players) {
    if (player.index >= 0 && player.index < labels.length) {
      labels[player.index] = player.name;
    }
  }
  setPlayerNameLabels(labels);
};
