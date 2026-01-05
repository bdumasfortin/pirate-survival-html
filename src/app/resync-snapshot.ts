import { isEntityAlive } from "../core/ecs";
import { createInputState } from "../core/input";
import { applyRemoteInputFrame, trimInputSyncState } from "../core/input-sync";
import { resetRollbackBuffer } from "../game/rollback";
import { restoreGameStateSnapshot } from "../game/rollback";
import { createGameStateSnapshot, getRollbackSnapshot } from "../game/rollback";
import { resumeSessionFromFrame, setSessionFrame } from "../net/session";
import { deserializeGameStateSnapshot, serializeGameStateSnapshot } from "../net/snapshot";
import { setHudSeed } from "../render/ui";
import { MAX_SNAPSHOT_BYTES } from "./constants";
import { createEmptyInputFrame, resetInputBuffer, updateMaxInputFrame } from "./input-manager";
import { syncRoomPlayers } from "./player-sync";
import { clearResyncTimers } from "./resync-manager";
import { sendRoomMessage } from "./room-messages";
import {
  activeGame,
  activeRoomSocket,
  activeRoomState,
  activeSession,
  setLastResyncFrame,
  setPendingResync,
  setResyncRequestFrame,
  setResyncRetryCount,
} from "./state";
import { resetStateHashTracking } from "./state-hash-manager";
import type { PendingResync, RoomConnectionState } from "./types";
import { setNetIndicator } from "./ui-helpers";

export const createSnapshotId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(2);
    (crypto as Crypto).getRandomValues(values);
    return `${values[0].toString(16)}${values[1].toString(16)}`;
  }
  return Math.floor(Math.random() * 1_000_000_000).toString(16);
};

export const applyResyncSnapshot = (pending: PendingResync): void => {
  const game = activeGame;
  const session = activeSession;
  if (!game || !session) {
    return;
  }

  const snapshot = deserializeGameStateSnapshot(pending.buffer);
  const sessionLocalId = session.localId;

  let localPlayer = pending.players.find((player) => player.id === sessionLocalId) ?? null;

  if (!localPlayer && activeRoomState) {
    const roomJoinedIndex = activeRoomState.localPlayerIndex;
    if (roomJoinedIndex !== null && roomJoinedIndex >= 0 && roomJoinedIndex < snapshot.playerIds.length) {
      localPlayer = {
        id: session.localId,
        index: roomJoinedIndex,
        isHost: false,
        name: "",
      };
      console.info(
        `[resync] Rejoin detected: client ID ${session.localId} not in snapshot, ` +
          `using index ${roomJoinedIndex} from room-joined message`
      );
    }
  }

  if (!localPlayer) {
    console.error(
      `[resync] Could not determine player index. ` +
        `localId=${sessionLocalId}, ` +
        `roomIndex=${activeRoomState?.localPlayerIndex ?? "null"}, ` +
        `snapshot players=${pending.players.map((p) => `${p.id}:${p.index}`).join(", ")}`
    );
    return;
  }

  session.localPlayerIndex = localPlayer.index;
  if (activeRoomState) {
    activeRoomState.localPlayerIndex = localPlayer.index;
    activeRoomState.localPlayerId = sessionLocalId;
  }

  const localIndex = Math.max(0, Math.min(session.localPlayerIndex, snapshot.playerIds.length - 1));
  snapshot.localPlayerIndex = localIndex;
  restoreGameStateSnapshot(game.state, snapshot);
  game.state.localPlayerIndex = localIndex;
  game.inputSync.localPlayerIndex = localIndex;

  console.info(
    `[resync] Applied snapshot at frame ${pending.frame}, ` +
      `localPlayerIndex=${localIndex}, players=${pending.players.length}, ` +
      `playerIds in snapshot=${snapshot.playerIds.length}, ` +
      `session players=${session.players.map((p) => `${p.id}:${p.index}`).join(", ")}, ` +
      `snapshot players=${pending.players.map((p) => `${p.id}:${p.index}`).join(", ")}`
  );
  resetRollbackBuffer(game.rollbackBuffer, pending.frame, game.state);
  trimInputSyncState(game.inputSync, pending.frame);

  const localBuffer = game.inputSync.buffers[localIndex];
  if (localBuffer) {
    resetInputBuffer(localBuffer);
    console.info(`[resync] Cleared local input buffer for player ${localIndex} at frame ${pending.frame}`);
  }
  session.seed = pending.seed;
  session.players = pending.players.map((player) => ({
    id: player.id,
    index: player.index,
    isLocal: player.id === sessionLocalId,
  }));
  const expectedPlayerCount =
    activeRoomState?.playerCount && activeRoomState.playerCount > 0
      ? activeRoomState.playerCount
      : Math.max(session.expectedPlayerCount, pending.players.length);
  session.expectedPlayerCount = expectedPlayerCount;
  game.inputSync.playerCount = expectedPlayerCount;
  const resetFrame = pending.frame - 1;
  game.maxInputFrames.length = expectedPlayerCount;
  for (let i = 0; i < game.maxInputFrames.length; i += 1) {
    game.maxInputFrames[i] = resetFrame;
  }
  if (game.minRemoteInputFrames.length !== expectedPlayerCount) {
    const next = Array.from({ length: expectedPlayerCount }, (_, index) => game.minRemoteInputFrames[index] ?? 0);
    game.minRemoteInputFrames = next;
  }
  const inputDelayFrames = activeRoomState?.inputDelayFrames ?? 0;
  for (let i = 0; i < expectedPlayerCount; i += 1) {
    if (i !== localIndex && game.minRemoteInputFrames[i] !== undefined) {
      const oldMinFrame = game.minRemoteInputFrames[i];
      game.minRemoteInputFrames[i] = pending.frame + Math.max(0, inputDelayFrames);
      console.info(
        `[resync] Reset minRemoteInputFrames for player ${i}: ` +
          `${oldMinFrame} -> ${game.minRemoteInputFrames[i]}, ` +
          `resyncFrame=${pending.frame}, delayFrames=${inputDelayFrames}`
      );
    }
  }
  if (game.lastInputGapWarningFrame.length !== expectedPlayerCount) {
    game.lastInputGapWarningFrame = Array.from({ length: expectedPlayerCount }, () => -1);
  }
  game.predictedFrames.length = 0;
  for (let i = 0; i < expectedPlayerCount; i += 1) {
    game.predictedFrames.push(createEmptyInputFrame());
  }
  game.pendingRollbackFrame.value = null;
  for (const entry of game.remoteInputQueue) {
    if (entry.frame < pending.frame) {
      continue;
    }
    applyRemoteInputFrame(game.inputSync, entry.playerIndex, pending.frame, entry.frame, entry.input);
    updateMaxInputFrame(entry.playerIndex, entry.frame);
  }
  game.remoteInputQueue.length = 0;
  game.clock.frame = pending.frame;
  setSessionFrame(session, pending.frame);
  if (game.frameInputs.length !== expectedPlayerCount) {
    game.frameInputs.length = 0;
    for (let i = 0; i < expectedPlayerCount; i += 1) {
      game.frameInputs.push(createInputState());
    }
  }
  setHudSeed(pending.seed);
  resumeSessionFromFrame(session, pending.frame);
  resetStateHashTracking();
  setLastResyncFrame(pending.frame);
  setResyncRetryCount(0);
  setResyncRequestFrame(null);
  clearResyncTimers();
  setPendingResync(null);
  setNetIndicator(null, "", false);
  activeRoomState?.ui?.setStatus("Resync complete.");
  if (activeRoomState) {
    syncRoomPlayers(activeRoomState, pending.players);

    if (game) {
      console.info(
        `[resync] After sync, player entities: ` +
          game.state.playerIds
            .map(
              (id, idx) =>
                `${idx}:${id ?? "none"}${id !== undefined && isEntityAlive(game.state.ecs, id) ? "(alive)" : "(dead)"}`
            )
            .join(", ")
      );
    }
  }
};

export const sendResyncSnapshot = (
  roomState: RoomConnectionState,
  requesterId: string,
  fromFrame: number,
  options: { useLiveSnapshot?: boolean } = {}
): void => {
  const game = activeGame;
  const session = activeSession;
  if (!game || !session || !session.isHost) {
    return;
  }
  const socket = activeRoomSocket;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  const requestedFrame = Math.max(0, Math.floor(fromFrame));
  let snapshotFrame = requestedFrame;
  let snapshot = options.useLiveSnapshot ? null : getRollbackSnapshot(game.rollbackBuffer, requestedFrame);
  if (!snapshot) {
    snapshot = createGameStateSnapshot(game.state);
    snapshotFrame = game.clock.frame;
  }
  const bytes = serializeGameStateSnapshot(snapshot);
  if (bytes.length > MAX_SNAPSHOT_BYTES) {
    roomState.ui?.setStatus("Snapshot too large to resync.", true);
    return;
  }
  const snapshotId = createSnapshotId();
  const chunkSize = 16 * 1024;
  const seed = roomState.seed ?? session.seed ?? "";
  const sessionLocalId = session.localId;
  const currentPlayers =
    roomState.players.length > 0
      ? roomState.players
      : session.players.map((p) => ({
          id: p.id,
          index: p.index,
          isHost: p.id === sessionLocalId ? session.isHost : false,
          name: "",
        }));

  console.info(
    `[resync] Sending snapshot to ${requesterId}, frame=${snapshotFrame}, ` +
      `players=${currentPlayers.length}, playerIds in snapshot=${snapshot.playerIds.length}`
  );

  sendRoomMessage(socket, {
    type: "resync-state",
    requesterId,
    frame: snapshotFrame,
    seed,
    players: currentPlayers,
    snapshotId,
    totalBytes: bytes.length,
    chunkSize,
  });
  // Note: resyncSendState management is handled in resync-manager
};
