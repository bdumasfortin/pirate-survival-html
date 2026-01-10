import { encodeBase64 } from "../net/snapshot";
import {
  RESYNC_CHUNK_SEND_INTERVAL_MS,
  RESYNC_CHUNKS_PER_TICK,
  RESYNC_MAX_RETRIES,
  RESYNC_RETRY_DELAY_MS,
  RESYNC_TIMEOUT_MS,
} from "./constants";
import { sendRoomMessage } from "./room-messages";
import {
  activeRoomSocket,
  activeRoomState,
  activeSession,
  pendingResync,
  resyncRequestFrame,
  resyncRetryCount,
  resyncSendState,
  setPendingResync,
  setResyncRequestFrame,
  setResyncRetryCount,
} from "./state";

// Local timer state (not exported from state to allow assignment)
let resyncRetryTimer: number | null = null;
let resyncTimeoutTimer: number | null = null;
let resyncSendTimer: number | null = null;

// Export resyncSendState setter for use in resync-snapshot
export { resyncSendState };
import { pauseSession } from "../net/session";
import { sendResyncSnapshot } from "./resync-snapshot";
import { setNetIndicator } from "./ui-helpers";

// This will be set from main.ts
let netIndicatorElement: HTMLElement | null = null;
export const setNetIndicatorElement = (element: HTMLElement | null): void => {
  netIndicatorElement = element;
};

export const clearResyncTimers = (): void => {
  if (resyncRetryTimer !== null) {
    window.clearTimeout(resyncRetryTimer);
  }
  if (resyncTimeoutTimer !== null) {
    window.clearTimeout(resyncTimeoutTimer);
  }
};

export const clearResyncSendState = (): void => {
  if (resyncSendTimer !== null) {
    window.clearTimeout(resyncSendTimer);
    resyncSendTimer = null;
  }
  // Note: resyncSendState is managed externally
};

export const scheduleResyncChunkSend = (): void => {
  const sendState = resyncSendState;
  if (!sendState) {
    return;
  }
  if (resyncSendTimer !== null) {
    return;
  }
  resyncSendTimer = window.setTimeout(() => {
    const currentSendState = resyncSendState;
    if (!currentSendState) {
      return;
    }
    const socket = activeRoomSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      clearResyncSendState();
      return;
    }
    let sent = 0;
    while (sent < RESYNC_CHUNKS_PER_TICK && currentSendState.offset < currentSendState.bytes.length) {
      const offset = currentSendState.offset;
      const chunk = currentSendState.bytes.subarray(offset, offset + currentSendState.chunkSize);
      sendRoomMessage(socket, {
        type: "resync-chunk",
        requesterId: currentSendState.requesterId,
        snapshotId: currentSendState.snapshotId,
        offset,
        data: encodeBase64(chunk),
      });
      currentSendState.offset += currentSendState.chunkSize;
      sent += 1;
    }
    if (currentSendState.offset >= currentSendState.bytes.length) {
      return;
    }
    scheduleResyncChunkSend();
  }, RESYNC_CHUNK_SEND_INTERVAL_MS);
};

export const scheduleResyncRetry = (): void => {
  if (resyncRetryCount >= RESYNC_MAX_RETRIES) {
    return;
  }
  const session = activeSession;
  const socket = activeRoomSocket;
  if (!session || !socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  if (resyncRequestFrame === null) {
    return;
  }
  if (resyncRetryTimer !== null) {
    return;
  }
  resyncRetryTimer = window.setTimeout(() => {
    const currentSession = activeSession;
    const currentPendingResync = pendingResync;
    const currentSocket = activeRoomSocket;
    if (!currentSession || currentSession.status !== "paused" || currentPendingResync) {
      return;
    }
    if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    setResyncRetryCount(resyncRetryCount + 1);
    activeRoomState?.ui?.setStatus("Resync stalled. Retrying...");
    sendRoomMessage(currentSocket, {
      type: "resync-request",
      fromFrame: resyncRequestFrame ?? 0,
      reason: "desync",
    });
    scheduleResyncRetry();
  }, RESYNC_RETRY_DELAY_MS);
};

export const scheduleResyncTimeout = (): void => {
  const currentPendingResync = pendingResync;
  if (!currentPendingResync) {
    return;
  }
  if (resyncTimeoutTimer !== null) {
    window.clearTimeout(resyncTimeoutTimer);
  }
  resyncTimeoutTimer = window.setTimeout(() => {
    const pending = pendingResync;
    if (!pending) {
      return;
    }
    const idleMs = Date.now() - pending.lastReceivedAt;
    if (idleMs < RESYNC_TIMEOUT_MS) {
      scheduleResyncTimeout();
      return;
    }
    setPendingResync(null);
    activeRoomState?.ui?.setStatus("Resync timed out. Retrying...", true);
    setNetIndicator(netIndicatorElement, "Resyncing...", true);
    scheduleResyncRetry();
  }, RESYNC_TIMEOUT_MS);
};

export const requestDesyncResync = (frame: number, peerId?: string): void => {
  const session = activeSession;
  const socket = activeRoomSocket;
  if (!session || session.status !== "running") {
    return;
  }
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  if (session.isHost && peerId && activeRoomState) {
    activeRoomState.ui?.setStatus("Desync detected. Sending resync...");
    sendResyncSnapshot(activeRoomState, peerId, frame);
    return;
  }
  pauseSession(session, "desync");
  setNetIndicator(netIndicatorElement, "Resyncing...", true);
  setPendingResync(null);
  setResyncRequestFrame(frame);
  setResyncRetryCount(0);
  clearResyncTimers();
  scheduleResyncRetry();
  activeRoomState?.ui?.setStatus("Desync detected. Requesting resync...", true);
  sendRoomMessage(socket, { type: "resync-request", fromFrame: frame, reason: "desync" });
};
