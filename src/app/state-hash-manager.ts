import { hashGameStateSnapshot } from "../core/state-hash";
import { getRollbackSnapshot } from "../game/rollback";
import { HASH_COOLDOWN_FRAMES, STATE_HASH_HISTORY_FRAMES, STATE_HASH_INTERVAL_FRAMES } from "./constants";
import { requestDesyncResync } from "./resync-manager";
import { sendRoomMessage } from "./room-messages";
import {
  activeGame,
  activeRoomSocket,
  activeSession,
  lastHashSentFrame,
  lastResyncFrame,
  localStateHashes,
  pendingResync,
  remoteStateHashes,
  setLastHashSentFrame,
} from "./state";

export const getConfirmedFrame = (): number => {
  const session = activeSession;
  const game = activeGame;
  if (!session || !game) {
    return -1;
  }
  if (game.maxInputFrames.length !== session.expectedPlayerCount) {
    return -1;
  }
  let confirmed = game.maxInputFrames[0] ?? -1;
  for (const value of game.maxInputFrames) {
    confirmed = Math.min(confirmed, value);
  }
  return Math.min(confirmed, game.clock.frame);
};

export const shouldCompareHashes = (frame: number): boolean => {
  const session = activeSession;
  const game = activeGame;
  if (!session || !game) {
    return false;
  }
  if (session.status !== "running" || pendingResync) {
    return false;
  }
  if (lastResyncFrame >= 0 && frame <= lastResyncFrame + HASH_COOLDOWN_FRAMES) {
    return false;
  }
  return frame <= getConfirmedFrame();
};

export const resetStateHashTracking = (): void => {
  localStateHashes.clear();
  remoteStateHashes.clear();
};

export const pruneStateHashHistory = (currentFrame: number): void => {
  const cutoff = currentFrame - STATE_HASH_HISTORY_FRAMES;
  for (const frame of localStateHashes.keys()) {
    if (frame < cutoff) {
      localStateHashes.delete(frame);
    }
  }
  for (const [frame, hashes] of remoteStateHashes.entries()) {
    if (frame < cutoff) {
      remoteStateHashes.delete(frame);
      continue;
    }
    if (hashes.size === 0) {
      remoteStateHashes.delete(frame);
    }
  }
};

export const recordLocalStateHash = (frame: number, hash: number): void => {
  localStateHashes.set(frame, hash);
  if (!shouldCompareHashes(frame)) {
    pruneStateHashHistory(frame);
    return;
  }
  const remoteForFrame = remoteStateHashes.get(frame);
  if (remoteForFrame) {
    for (const [playerId, remoteHash] of remoteForFrame.entries()) {
      if (remoteHash !== hash) {
        const playerInfo = activeSession?.players.find((p) => p.id === playerId);
        const playerIndex = playerInfo?.index ?? -1;
        console.error(
          `[desync] State hash mismatch at frame ${frame}: ` +
            `local=${hash.toString(16)}, remote(player ${playerIndex})=${remoteHash.toString(16)}`
        );
        requestDesyncResync(frame, playerId);
        break;
      }
    }
  }
  pruneStateHashHistory(frame);
};

export const recordRemoteStateHash = (playerId: string, frame: number, hash: number): void => {
  let remoteForFrame = remoteStateHashes.get(frame);
  if (!remoteForFrame) {
    remoteForFrame = new Map();
    remoteStateHashes.set(frame, remoteForFrame);
  }
  if (remoteForFrame.get(playerId) === hash) {
    return;
  }
  remoteForFrame.set(playerId, hash);
  if (!shouldCompareHashes(frame)) {
    pruneStateHashHistory(frame);
    return;
  }
  const localHash = localStateHashes.get(frame);
  if (localHash !== undefined && localHash !== hash) {
    const playerInfo = activeSession?.players.find((p) => p.id === playerId);
    const playerIndex = playerInfo?.index ?? -1;
    console.error(
      `[desync] State hash mismatch at frame ${frame}: ` +
        `local=${localHash.toString(16)}, remote(player ${playerIndex})=${hash.toString(16)}`
    );
    requestDesyncResync(frame, playerId);
  }
  pruneStateHashHistory(frame);
};

export const clearLocalStateHashesFrom = (frame: number): void => {
  for (const key of localStateHashes.keys()) {
    if (key >= frame) {
      localStateHashes.delete(key);
    }
  }
  if (lastHashSentFrame >= frame) {
    setLastHashSentFrame(frame - 1);
  }
};

export const sendConfirmedStateHash = (): void => {
  const socket = activeRoomSocket;
  const game = activeGame;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  if (!game) {
    return;
  }
  const confirmedFrame = getConfirmedFrame();
  if (confirmedFrame < 0 || confirmedFrame <= lastHashSentFrame) {
    return;
  }
  if (confirmedFrame % STATE_HASH_INTERVAL_FRAMES !== 0) {
    return;
  }
  if (!shouldCompareHashes(confirmedFrame)) {
    return;
  }
  const snapshot = getRollbackSnapshot(game.rollbackBuffer, confirmedFrame);
  if (!snapshot) {
    return;
  }
  const hash = hashGameStateSnapshot(snapshot);
  setLastHashSentFrame(confirmedFrame);
  recordLocalStateHash(confirmedFrame, hash);
  sendRoomMessage(socket, { type: "state-hash", frame: confirmedFrame, hash });
};
