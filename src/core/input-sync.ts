import type { InputState } from "./input";
import {
  createInputBuffer,
  loadInputFrame,
  readInputFrame,
  storeInputFrame,
  storeInputFrameData,
  type InputBuffer,
  type InputFrame
} from "./input-buffer";

export type InputSyncState = {
  playerCount: number;
  localPlayerIndex: number;
  buffers: InputBuffer[];
};

export const createInputSyncState = (playerCount: number, localPlayerIndex: number, capacity: number): InputSyncState => ({
  playerCount,
  localPlayerIndex,
  buffers: Array.from({ length: playerCount }, () => createInputBuffer(capacity))
});

export const storeLocalInputFrame = (sync: InputSyncState, frame: number, input: InputState) => {
  const buffer = sync.buffers[sync.localPlayerIndex];
  if (!buffer) {
    return;
  }
  storeInputFrame(buffer, frame, input);
};

export const loadPlayerInputFrame = (sync: InputSyncState, playerIndex: number, frame: number, out: InputState) => {
  const buffer = sync.buffers[playerIndex];
  if (!buffer) {
    return false;
  }
  return loadInputFrame(buffer, frame, out);
};

export const readPlayerInputFrame = (sync: InputSyncState, playerIndex: number, frame: number) => {
  const buffer = sync.buffers[playerIndex];
  if (!buffer) {
    return null;
  }
  return readInputFrame(buffer, frame);
};

export const applyRemoteInputFrame = (
  sync: InputSyncState,
  playerIndex: number,
  currentFrame: number,
  frame: number,
  inputFrame: InputFrame
) => {
  const buffer = sync.buffers[playerIndex];
  if (!buffer) {
    return null;
  }

  storeInputFrameData(buffer, frame, inputFrame);
  return frame < currentFrame ? frame : null;
};
