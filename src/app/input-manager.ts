import type { InputBuffer, InputFrame } from "../core/input-buffer";
import { InputBits } from "../core/input-buffer";
import type { InputSyncState } from "../core/input-sync";
import { readPlayerInputFrame } from "../core/input-sync";
import { activeGame } from "./state";

export const createEmptyInputFrame = (): InputFrame => ({
  buttons: 0,
  craftIndex: -1,
  craftScroll: 0,
  inventoryIndex: -1,
  inventoryScroll: 0,
  mouseX: 0,
  mouseY: 0,
});

export const EMPTY_INPUT_FRAME = createEmptyInputFrame();

const PREDICTED_BUTTON_MASK = InputBits.Up | InputBits.Down | InputBits.Left | InputBits.Right | InputBits.HasMouse;

export const fillPredictedFrame = (target: InputFrame, source: InputFrame): void => {
  target.buttons = source.buttons & PREDICTED_BUTTON_MASK;
  target.craftIndex = -1;
  target.craftScroll = 0;
  target.inventoryIndex = -1;
  target.inventoryScroll = 0;
  target.mouseX = source.mouseX;
  target.mouseY = source.mouseY;
};

export const findLatestInputFrame = (
  sync: InputSyncState,
  playerIndex: number,
  targetFrame: number
): InputFrame | null => {
  const buffer = sync.buffers[playerIndex];
  if (!buffer) {
    return null;
  }
  let bestFrame = -1;
  for (let i = 0; i < buffer.capacity; i += 1) {
    const frame = buffer.frames[i];
    if (frame >= 0 && frame <= targetFrame && frame > bestFrame) {
      bestFrame = frame;
    }
  }
  if (bestFrame < 0) {
    return null;
  }
  return readPlayerInputFrame(sync, playerIndex, bestFrame);
};

export const updateMaxInputFrame = (playerIndex: number, frame: number): void => {
  const game = activeGame;
  if (!game) {
    return;
  }
  if (playerIndex < 0 || playerIndex >= game.maxInputFrames.length) {
    return;
  }
  const current = game.maxInputFrames[playerIndex] ?? -1;
  if (frame > current) {
    game.maxInputFrames[playerIndex] = frame;
  }
};

export const resetInputBuffer = (buffer: InputBuffer): void => {
  buffer.frames.fill(-1);
  buffer.buttons.fill(0);
  buffer.craftIndex.fill(0);
  buffer.craftScroll.fill(0);
  buffer.inventoryIndex.fill(0);
  buffer.inventoryScroll.fill(0);
  buffer.mouseX.fill(0);
  buffer.mouseY.fill(0);
};

export const resetRemotePlayerInputState = (playerIndex: number): void => {
  const game = activeGame;
  if (!game) {
    return;
  }
  const buffer = game.inputSync.buffers[playerIndex];
  if (buffer) {
    resetInputBuffer(buffer);
  }
  const predicted = game.predictedFrames[playerIndex];
  if (predicted) {
    predicted.buttons = 0;
    predicted.craftIndex = -1;
    predicted.craftScroll = 0;
    predicted.inventoryIndex = -1;
    predicted.inventoryScroll = 0;
    predicted.mouseX = 0;
    predicted.mouseY = 0;
  }
  if (playerIndex >= 0 && playerIndex < game.maxInputFrames.length) {
    game.maxInputFrames[playerIndex] = game.clock.frame - 1;
  }
  const queue = game.remoteInputQueue;
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    if (queue[i].playerIndex === playerIndex) {
      queue.splice(i, 1);
    }
  }
};
