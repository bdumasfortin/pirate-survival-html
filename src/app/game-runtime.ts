import { isEntityAlive } from "../core/ecs";
import {
  bindCraftScroll,
  bindInventorySelection,
  bindKeyboard,
  bindMouse,
  consumeDebugToggle,
  consumeMapToggle,
  createInputState,
} from "../core/input";
import { applyInputFrame, type InputFrame, storeInputFrameData } from "../core/input-buffer";
import {
  applyRemoteInputFrame,
  createInputSyncState,
  readPlayerInputFrame,
  storeLocalInputFrame,
} from "../core/input-sync";
import { startLoop } from "../core/loop";
import { toggleMapOverlay } from "../game/map-overlay";
import { createRollbackBuffer, restoreRollbackFrame, storeRollbackSnapshot } from "../game/rollback";
import { simulateFrame } from "../game/sim";
import { createInitialState } from "../game/state";
import { decodeInputPacket, encodeInputPacket, type InputPacket } from "../net/input-wire";
import { createHostSession, finalizeSessionStart, pauseSession, setSessionFrame } from "../net/session";
import { createLoopbackTransportPair, type Transport } from "../net/transport";
import { getCraftingLayout } from "../render/crafting-layout";
import { render } from "../render/renderer";
import { setHudRoomCode, setHudSeed, toggleDebugOverlay } from "../render/ui";
import {
  INPUT_BUFFER_FRAMES,
  INPUT_DELAY_FRAMES,
  INPUT_GAP_WARN_INTERVAL_FRAMES,
  LOOPBACK_DROP_RATE,
  LOOPBACK_JITTER_MS,
  LOOPBACK_LATENCY_MS,
  MAX_INPUT_GAP_FRAMES,
  MAX_REMOTE_FRAME_AHEAD,
  MAX_REMOTE_FRAME_BEHIND,
  NETWORK_MODE,
  PLAYER_COUNT,
  ROLLBACK_BUFFER_FRAMES,
} from "./constants";
import { EMPTY_INPUT_FRAME, fillPredictedFrame, findLatestInputFrame, updateMaxInputFrame } from "./input-manager";
import { syncRoomPlayers } from "./player-sync";
import { clearResyncSendState, clearResyncTimers } from "./resync-manager";
import { applyResyncSnapshot } from "./resync-snapshot";
import {
  activeGame,
  activeRoomState,
  hasStarted,
  pendingResync,
  setActiveGame,
  setActiveSession,
  setHasStarted,
  setLastResyncFrame,
  setPendingResync,
  setResyncRequestFrame,
  setResyncRetryCount,
} from "./state";
import { clearLocalStateHashesFrom, sendConfirmedStateHash } from "./state-hash-manager";
import { resetStateHashTracking } from "./state-hash-manager";
import type { ActiveGameRuntime, StartGameOptions } from "./types";
import { setNetIndicator, setOverlayVisible } from "./ui-helpers";

type GameRuntimeDependencies = {
  menuOverlay: HTMLElement | null;
  loadingOverlay: HTMLElement | null;
  netIndicator: HTMLElement | null;
  setInGameMenuVisible: (visible: boolean) => void;
  ctx: CanvasRenderingContext2D;
};

export const startGame = async (
  seed: string,
  options: StartGameOptions,
  deps: GameRuntimeDependencies
): Promise<void> => {
  if (hasStarted) {
    return;
  }

  setHasStarted(true);
  setOverlayVisible(deps.menuOverlay, false);
  setOverlayVisible(deps.loadingOverlay, true);
  deps.setInGameMenuVisible(false);

  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  const hasPendingResync = pendingResync !== null;
  const inputDelayFrames = options.inputDelayFrames ?? INPUT_DELAY_FRAMES;
  const session = options.session ?? createHostSession(seed, PLAYER_COUNT);
  if (!options.session) {
    finalizeSessionStart(session, 0, inputDelayFrames);
  }
  setActiveSession(session);
  resetStateHashTracking();
  if (!hasPendingResync) {
    setNetIndicator(deps.netIndicator, "", false);
  }
  setHudRoomCode(activeRoomState?.roomCode ?? null);
  setLastResyncFrame(-1);
  if (!hasPendingResync) {
    setPendingResync(null);
    setResyncRequestFrame(null);
    setResyncRetryCount(0);
    clearResyncTimers();
  }
  clearResyncSendState();

  const sessionSeed = session.seed ?? seed;
  const state = createInitialState(
    sessionSeed,
    session.expectedPlayerCount,
    session.localPlayerIndex,
    options.worldConfig
  );
  setHudSeed(sessionSeed);
  const liveInput = createInputState();
  const frameInputs = Array.from({ length: session.expectedPlayerCount }, () => createInputState());
  const predictedFrames = Array.from({ length: session.expectedPlayerCount }, () => EMPTY_INPUT_FRAME);
  const inputSync = createInputSyncState(session.expectedPlayerCount, session.localPlayerIndex, INPUT_BUFFER_FRAMES);
  const rollbackBuffer = createRollbackBuffer(ROLLBACK_BUFFER_FRAMES);
  const clock = { frame: session.startFrame };
  const pendingRollbackFrame = { value: null as number | null };
  const remoteInputQueue: Array<{ playerIndex: number; frame: number; input: InputFrame }> = [];
  let transport: Transport | null = options.transport ?? null;

  const game: ActiveGameRuntime = {
    state,
    rollbackBuffer,
    inputSync,
    frameInputs,
    predictedFrames,
    clock,
    pendingRollbackFrame,
    remoteInputQueue,
    maxInputFrames: Array.from({ length: session.expectedPlayerCount }, () => -1),
    minRemoteInputFrames: Array.from({ length: session.expectedPlayerCount }, () => 0),
    lastInputGapWarningFrame: Array.from({ length: session.expectedPlayerCount }, () => -1),
  };
  setActiveGame(game);

  if (activeRoomState) {
    syncRoomPlayers(activeRoomState, activeRoomState.players);
  }

  if (hasPendingResync) {
    pauseSession(session, "desync");
  }

  const enqueueRemoteInput = (playerIndex: number, remoteFrame: number, inputFrame: InputFrame): void => {
    remoteInputQueue.push({ playerIndex, frame: remoteFrame, input: inputFrame });
  };

  if (import.meta.env.DEV) {
    const devWindow = window as typeof window & { enqueueRemoteInput?: typeof enqueueRemoteInput };
    devWindow.enqueueRemoteInput = enqueueRemoteInput;
  }

  if (!transport && NETWORK_MODE === "loopback") {
    const [localTransport, remoteTransport] = createLoopbackTransportPair({
      latencyMs: LOOPBACK_LATENCY_MS,
      jitterMs: LOOPBACK_JITTER_MS,
      dropRate: LOOPBACK_DROP_RATE,
    });
    transport = localTransport;

    if (import.meta.env.DEV) {
      const devWindow = window as typeof window & { sendLoopbackPacket?: (packet: InputPacket) => void };
      devWindow.sendLoopbackPacket = (packet: InputPacket) => {
        remoteTransport.send(encodeInputPacket(packet));
      };
    }
  } else if (import.meta.env.DEV && options.debugRemoteTransport) {
    const devWindow = window as typeof window & { sendLoopbackPacket?: (packet: InputPacket) => void };
    devWindow.sendLoopbackPacket = (packet: InputPacket) => {
      options.debugRemoteTransport?.send(encodeInputPacket(packet));
    };
  }

  if (transport) {
    transport.onMessage((data) => {
      const packet = decodeInputPacket(data);
      if (!packet) {
        return;
      }
      if (packet.frame < 0) {
        return;
      }
      if (packet.playerIndex < 0 || packet.playerIndex >= session.expectedPlayerCount) {
        return;
      }
      const maxAhead =
        session.status === "running" && !pendingResync ? MAX_REMOTE_FRAME_AHEAD : MAX_REMOTE_FRAME_AHEAD * 4;
      if (packet.frame > clock.frame + maxAhead) {
        return;
      }
      if (packet.frame < clock.frame - MAX_REMOTE_FRAME_BEHIND) {
        return;
      }
      enqueueRemoteInput(packet.playerIndex, packet.frame, packet.input);
    });
  }

  const flushRemoteInputs = (): void => {
    if (remoteInputQueue.length === 0) {
      return;
    }

    for (const entry of remoteInputQueue) {
      const currentGame = activeGame;
      if (!currentGame) {
        continue;
      }
      const playerId = currentGame.state.playerIds[entry.playerIndex];
      if (playerId === undefined || !isEntityAlive(currentGame.state.ecs, playerId)) {
        continue;
      }
      const minFrame = currentGame.minRemoteInputFrames[entry.playerIndex] ?? 0;
      if (entry.frame < minFrame) {
        continue;
      }
      const rollbackFrame = applyRemoteInputFrame(inputSync, entry.playerIndex, clock.frame, entry.frame, entry.input);
      updateMaxInputFrame(entry.playerIndex, entry.frame);
      if (rollbackFrame !== null) {
        pendingRollbackFrame.value =
          pendingRollbackFrame.value === null ? rollbackFrame : Math.min(pendingRollbackFrame.value, rollbackFrame);
      }
    }
    remoteInputQueue.length = 0;
  };

  const loadFrameInputs = (targetFrame: number): void => {
    for (let playerIndex = 0; playerIndex < session.expectedPlayerCount; playerIndex += 1) {
      const input = readPlayerInputFrame(inputSync, playerIndex, targetFrame);
      if (input) {
        const currentGame = activeGame;
        if (currentGame && playerIndex < currentGame.lastInputGapWarningFrame.length) {
          currentGame.lastInputGapWarningFrame[playerIndex] = -1;
        }
        applyInputFrame(input, frameInputs[playerIndex]);
        continue;
      }

      if (playerIndex === session.localPlayerIndex) {
        applyInputFrame(EMPTY_INPUT_FRAME, frameInputs[playerIndex]);
        continue;
      }

      const currentGame = activeGame;
      const maxInputFrame = currentGame?.maxInputFrames[playerIndex] ?? -1;
      const minRemoteFrame = currentGame?.minRemoteInputFrames[playerIndex] ?? 0;
      const gapFrames = targetFrame - maxInputFrame;

      if (gapFrames > MAX_INPUT_GAP_FRAMES && targetFrame >= minRemoteFrame && currentGame) {
        const playerId = currentGame.state.playerIds[playerIndex];
        const isPlayerAlive = playerId !== undefined && isEntityAlive(currentGame.state.ecs, playerId);

        if (isPlayerAlive) {
          const lastWarning = currentGame.lastInputGapWarningFrame[playerIndex] ?? -1;
          if (targetFrame - lastWarning >= INPUT_GAP_WARN_INTERVAL_FRAMES) {
            currentGame.lastInputGapWarningFrame[playerIndex] = targetFrame;
          }
        }
      }

      const fallback = findLatestInputFrame(inputSync, playerIndex, targetFrame);
      if (fallback) {
        const predicted = predictedFrames[playerIndex];
        fillPredictedFrame(predicted, fallback);
        const buffer = inputSync.buffers[playerIndex];
        if (buffer) {
          storeInputFrameData(buffer, targetFrame, predicted);
        }
        applyInputFrame(predicted, frameInputs[playerIndex]);
        continue;
      }

      applyInputFrame(EMPTY_INPUT_FRAME, frameInputs[playerIndex]);
    }
  };

  const resimulateFrom = (fromFrame: number, toFrame: number, delta: number): boolean => {
    if (!restoreRollbackFrame(rollbackBuffer, state, fromFrame)) {
      return false;
    }

    for (let simFrame = fromFrame; simFrame < toFrame; simFrame += 1) {
      loadFrameInputs(simFrame);
      storeRollbackSnapshot(rollbackBuffer, simFrame, state);
      simulateFrame(state, frameInputs, delta);
    }

    return true;
  };

  bindKeyboard(liveInput);
  bindMouse(liveInput, (x, y) => {
    const layout = getCraftingLayout(state, window.innerWidth, window.innerHeight);
    if (!layout) {
      return false;
    }
    const { button } = layout;
    return x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height;
  });
  bindCraftScroll(liveInput, () => state.crafting[state.localPlayerIndex]?.isOpen ?? false);
  bindInventorySelection(liveInput, () => {
    const localPlayerId = state.playerIds[state.localPlayerIndex];
    if (localPlayerId === undefined) {
      return false;
    }
    return !(state.crafting[state.localPlayerIndex]?.isOpen ?? false) && !state.ecs.playerIsDead[localPlayerId];
  });

  if (document.fonts && document.fonts.load) {
    try {
      await document.fonts.load("16px Zain");
    } catch {
      // Ignore font loading issues; fallback rendering will still work.
    }
  }

  setOverlayVisible(deps.loadingOverlay, false);

  const currentPending = pendingResync;
  if (currentPending && currentPending.receivedBytes >= currentPending.totalBytes) {
    applyResyncSnapshot(currentPending);
  }

  startLoop({
    onUpdate: (delta) => {
      if (session.status !== "running") {
        return;
      }

      if (consumeDebugToggle(liveInput)) {
        toggleDebugOverlay();
      }
      if (consumeMapToggle(liveInput)) {
        toggleMapOverlay();
      }

      const inputFrameIndex = clock.frame + inputDelayFrames;
      storeLocalInputFrame(inputSync, inputFrameIndex, liveInput);
      updateMaxInputFrame(session.localPlayerIndex, inputFrameIndex);

      if (transport && !pendingResync) {
        const outgoing = readPlayerInputFrame(inputSync, session.localPlayerIndex, inputFrameIndex);
        if (outgoing) {
          const packet = {
            playerIndex: session.localPlayerIndex,
            frame: inputFrameIndex,
            input: outgoing,
          };
          transport.send(encodeInputPacket(packet));
        }
      }
      flushRemoteInputs();

      if (pendingRollbackFrame.value !== null && pendingRollbackFrame.value < clock.frame) {
        const rollbackFrame = pendingRollbackFrame.value;
        pendingRollbackFrame.value = null;
        if (resimulateFrom(rollbackFrame, clock.frame, delta)) {
          clearLocalStateHashesFrom(rollbackFrame);
        }
      }

      loadFrameInputs(clock.frame);
      storeRollbackSnapshot(rollbackBuffer, clock.frame, state);
      simulateFrame(state, frameInputs, delta);
      clock.frame += 1;
      setSessionFrame(session, clock.frame);
      sendConfirmedStateHash();
    },
    onRender: () => {
      render(deps.ctx, state);
    },
  });
};
