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

  const existing = readInputFrame(buffer, frame);
  if (existing &&
    existing.buttons === inputFrame.buttons &&
    existing.craftIndex === inputFrame.craftIndex &&
    existing.craftScroll === inputFrame.craftScroll &&
    existing.inventoryIndex === inputFrame.inventoryIndex &&
    existing.inventoryScroll === inputFrame.inventoryScroll &&
    existing.mouseX === inputFrame.mouseX &&
    existing.mouseY === inputFrame.mouseY) {
    return null;
  }

  storeInputFrameData(buffer, frame, inputFrame);
  return frame < currentFrame ? frame : null;
};

export const resetInputSyncState = (sync: InputSyncState) => {
  for (const buffer of sync.buffers) {
    buffer.frames.fill(-1);
    buffer.buttons.fill(0);
    buffer.craftIndex.fill(0);
    buffer.craftScroll.fill(0);
    buffer.inventoryIndex.fill(0);
    buffer.inventoryScroll.fill(0);
    buffer.mouseX.fill(0);
    buffer.mouseY.fill(0);
  }
};

export const trimInputSyncState = (sync: InputSyncState, minFrame: number) => {
  for (const buffer of sync.buffers) {
    for (let i = 0; i < buffer.capacity; i += 1) {
      if (buffer.frames[i] >= minFrame) {
        continue;
      }
      buffer.frames[i] = -1;
      buffer.buttons[i] = 0;
      buffer.craftIndex[i] = 0;
      buffer.craftScroll[i] = 0;
      buffer.inventoryIndex[i] = 0;
      buffer.inventoryScroll[i] = 0;
      buffer.mouseX[i] = 0;
      buffer.mouseY[i] = 0;
    }
  }
};
