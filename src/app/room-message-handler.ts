import type { RoomServerMessage } from "../../shared/room-protocol";
import { isEntityAlive } from "../core/ecs";
import { pauseSession } from "../net/session";
import { decodeBase64 } from "../net/snapshot";
import { MAX_REMOTE_FRAME_AHEAD, REQUESTED_INPUT_DELAY_FRAMES, STATE_HASH_HISTORY_FRAMES } from "./constants";
import { syncRoomPlayers } from "./player-sync";
import { clearResyncTimers, scheduleResyncRetry } from "./resync-manager";
import { scheduleResyncTimeout } from "./resync-manager";
import { applyResyncSnapshot } from "./resync-snapshot";
import { sendResyncSnapshot } from "./resync-snapshot";
import { clearRoomTimeouts } from "./room-connection";
import { formatRoomError } from "./room-messages";
import { buildSessionFromStart } from "./session-builder";
import {
  activeGame,
  activeSession,
  hasStarted,
  pendingResync,
  setPendingResync,
  setResyncRequestFrame,
  setResyncRetryCount,
} from "./state";
import { recordRemoteStateHash } from "./state-hash-manager";
import type { PendingResync, RoomConnectionState } from "./types";
import { setNetIndicator } from "./ui-helpers";

type RoomMessageHandlerDependencies = {
  netIndicator: HTMLElement | null;
  roomStatusForm: HTMLElement | null;
  roomStatusFormBox: HTMLElement | null;
  setRoomScreen: ((step: "form" | "room") => void) | null;
  startGame: (seed: string, options: import("./types").StartGameOptions) => Promise<void>;
};

export const createRoomMessageHandler = (deps: RoomMessageHandlerDependencies) => {
  return (roomState: RoomConnectionState, _socket: WebSocket, message: RoomServerMessage): void => {
    switch (message.type) {
      case "room-created": {
        clearRoomTimeouts(roomState);
        roomState.pendingAction = null;
        deps.setRoomScreen?.("room");
        roomState.roomCode = message.code;
        roomState.roomId = message.roomId;
        roomState.playerCount = message.playerCount;
        roomState.inputDelayFrames = message.inputDelayFrames;
        roomState.seed = message.seed;
        roomState.worldPreset = message.worldPreset;
        roomState.players = message.players;
        roomState.localPlayerIndex = message.playerIndex;
        const localPlayerId = message.players.find((player) => player.index === message.playerIndex)?.id ?? null;
        roomState.localPlayerId = localPlayerId;

        roomState.ui?.setStatus(`Room created. Share code ${message.code}.`);
        roomState.ui?.setRoomInfo(message.code, message.players, message.playerCount);
        roomState.ui?.setStartEnabled(roomState.role === "host");
        console.info(`[room] created code=${message.code} players=${message.playerCount}`);
        return;
      }
      case "room-joined": {
        clearRoomTimeouts(roomState);
        roomState.pendingAction = null;
        deps.setRoomScreen?.("room");
        roomState.roomCode = message.code;
        roomState.roomId = message.roomId;
        roomState.playerCount = message.playerCount;
        roomState.inputDelayFrames = message.inputDelayFrames;
        roomState.seed = message.seed;
        roomState.worldPreset = message.worldPreset;
        roomState.players = message.players;
        roomState.localPlayerIndex = message.playerIndex;
        const localPlayerId = message.players.find((player) => player.index === message.playerIndex)?.id ?? null;
        roomState.localPlayerId = localPlayerId;

        roomState.ui?.setStatus(`Joined room ${message.code}. Waiting for host...`);
        roomState.ui?.setRoomInfo(message.code, message.players, message.playerCount);
        roomState.ui?.setStartEnabled(false);
        console.info(`[room] joined code=${message.code} players=${message.playerCount}`);
        return;
      }
      case "room-updated": {
        syncRoomPlayers(roomState, message.players);
        roomState.ui?.setRoomInfo(roomState.roomCode, message.players, roomState.playerCount);
        roomState.ui?.setStartEnabled(roomState.role === "host");
        return;
      }
      case "start": {
        if (hasStarted) {
          return;
        }

        roomState.ui?.setStatus("Starting match...");
        roomState.pendingAction = null;
        roomState.worldPreset = message.worldPreset ?? roomState.worldPreset ?? "procedural";
        const session = buildSessionFromStart(message, roomState);
        const inputDelayFrames = message.inputDelayFrames ?? roomState.inputDelayFrames ?? REQUESTED_INPUT_DELAY_FRAMES;
        roomState.hasSentStart = true;
        const worldConfig = { preset: message.worldPreset ?? "procedural" };
        void deps.startGame(message.seed, {
          session,
          inputDelayFrames,
          transport: roomState.transport,
          worldConfig,
        });
        return;
      }
      case "room-closed":
        deps.setRoomScreen?.("form");
        roomState.ui?.setStatus(`Room closed: ${message.reason}`, true);
        roomState.ui?.setActionsEnabled(true);
        console.warn(`[room] closed: ${message.reason}`);
        return;
      case "state-hash": {
        const currentSession = activeSession;
        if (!currentSession || message.playerId === currentSession.localId) {
          return;
        }
        if (
          message.frame < currentSession.currentFrame - STATE_HASH_HISTORY_FRAMES ||
          message.frame > currentSession.currentFrame + MAX_REMOTE_FRAME_AHEAD
        ) {
          return;
        }
        recordRemoteStateHash(message.playerId, message.frame, message.hash);
        return;
      }
      case "resync-state": {
        if (message.totalBytes <= 0 || message.totalBytes > 2 * 1024 * 1024) {
          roomState.ui?.setStatus("Resync snapshot rejected (too large).", true);
          setNetIndicator(deps.netIndicator, "", false);
          return;
        }
        if (message.chunkSize <= 0 || message.chunkSize > 32 * 1024) {
          roomState.ui?.setStatus("Resync snapshot rejected (chunk size).", true);
          setNetIndicator(deps.netIndicator, "", false);
          return;
        }
        clearResyncTimers();
        roomState.players = message.players;
        setResyncRequestFrame(message.frame);
        setResyncRetryCount(0);
        const newPendingResync: PendingResync = {
          snapshotId: message.snapshotId,
          frame: message.frame,
          seed: message.seed,
          players: message.players,
          totalBytes: message.totalBytes,
          chunkSize: message.chunkSize,
          buffer: new Uint8Array(message.totalBytes),
          received: new Set(),
          receivedBytes: 0,
          lastReceivedAt: Date.now(),
        };
        setPendingResync(newPendingResync);
        roomState.pendingAction = null;
        if (!hasStarted) {
          console.warn("[resync-state] Received resync but game hasn't started, ignoring");
          return;
        }
        const currentSession = activeSession;
        if (currentSession && currentSession.status === "running") {
          pauseSession(currentSession, "desync");
        }
        setNetIndicator(deps.netIndicator, "Receiving snapshot...", true);
        roomState.ui?.setStatus("Receiving resync snapshot...");
        scheduleResyncTimeout();
        return;
      }
      case "resync-chunk": {
        const currentPending = pendingResync;
        if (!currentPending || currentPending.snapshotId !== message.snapshotId) {
          return;
        }
        if (message.data.length > Math.ceil((32 * 1024) / 3) * 4 + 16) {
          return;
        }
        const bytes = decodeBase64(message.data);
        const offset = Math.max(0, Math.floor(message.offset));
        if (currentPending.received.has(offset) || offset >= currentPending.totalBytes) {
          return;
        }
        const available = Math.min(bytes.length, currentPending.chunkSize, currentPending.totalBytes - offset);
        currentPending.buffer.set(bytes.subarray(0, available), offset);
        currentPending.received.add(offset);
        currentPending.receivedBytes += available;
        currentPending.lastReceivedAt = Date.now();
        scheduleResyncTimeout();
        if (currentPending.receivedBytes >= currentPending.totalBytes) {
          applyResyncSnapshot(currentPending);
        }
        return;
      }
      case "error": {
        clearRoomTimeouts(roomState);
        roomState.pendingAction = null;
        deps.setRoomScreen?.("form");
        const errorMessage = formatRoomError(roomState, message);
        roomState.ui?.setStatus(errorMessage, true);

        if (deps.roomStatusForm && deps.roomStatusFormBox) {
          deps.roomStatusForm.textContent = errorMessage;
          deps.roomStatusForm.classList.add("error");
          deps.roomStatusFormBox.classList.remove("hidden");
        }

        roomState.ui?.setActionsEnabled(true);
        return;
      }
      case "pong":
        return;
      case "resync-request": {
        const currentSession = activeSession;
        if (currentSession) {
          const isLocalRequester = message.requesterId === currentSession.localId;
          if (!currentSession.isHost || isLocalRequester) {
            pauseSession(currentSession, message.reason);
            setNetIndicator(deps.netIndicator, "Resyncing...", true);
            roomState.ui?.setStatus("Resync requested. Waiting for host...");
          } else {
            roomState.ui?.setStatus("Sending resync snapshot...");
          }
          console.info(`[room] resync requested reason=${message.reason} requester=${message.requesterId}`);
          if (currentSession.isHost && message.requesterId && !isLocalRequester) {
            const useLiveSnapshot = message.reason === "desync";
            const currentGame = activeGame;
            const requestedFrame = useLiveSnapshot && currentGame ? currentGame.clock.frame : message.fromFrame;

            if (currentGame && useLiveSnapshot) {
              const connectedIndices = new Set(roomState.players.map((p) => p.index));
              for (let index = 0; index < currentGame.state.playerIds.length; index += 1) {
                const playerId = currentGame.state.playerIds[index];
                if (playerId !== undefined && connectedIndices.has(index)) {
                  if (!isEntityAlive(currentGame.state.ecs, playerId)) {
                    console.info(
                      `[resync] Marking player ${index} as alive before sending snapshot (rejoin), ` +
                        `playerId=${playerId}`
                    );
                    currentGame.state.ecs.alive[playerId] = 1;
                  }
                }
              }
            }

            console.info(
              `[resync] Host sending resync to ${message.requesterId}, ` +
                `reason=${message.reason}, frame=${requestedFrame}, live=${useLiveSnapshot}, ` +
                `roomState.players=${roomState.players.map((p) => `${p.id}:${p.index}`).join(", ")}`
            );
            sendResyncSnapshot(roomState, message.requesterId, requestedFrame, { useLiveSnapshot });
          } else if (isLocalRequester) {
            setPendingResync(null);
            setResyncRequestFrame(message.fromFrame);
            setResyncRetryCount(0);
            clearResyncTimers();
            scheduleResyncRetry();
          }
        }
        return;
      }
      default:
        return;
    }
  };
};
