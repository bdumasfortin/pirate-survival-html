import type { InputState } from "./input";

export const InputBits = {
  Up: 1 << 0,
  Down: 1 << 1,
  Left: 1 << 2,
  Right: 1 << 3,
  Interact: 1 << 4,
  Use: 1 << 5,
  Drop: 1 << 6,
  ToggleCraft: 1 << 7,
  CloseCraft: 1 << 8,
  HasMouse: 1 << 9
} as const;

export type InputBuffer = {
  capacity: number;
  frames: Int32Array;
  buttons: Uint32Array;
  craftIndex: Int16Array;
  craftScroll: Int16Array;
  inventoryIndex: Int16Array;
  inventoryScroll: Int16Array;
  mouseX: Int32Array;
  mouseY: Int32Array;
};

const clearQueuedInputs = (input: InputState) => {
  input.interactQueued = false;
  input.useQueued = false;
  input.dropQueued = false;
  input.toggleCraftQueued = false;
  input.closeCraftQueued = false;
  input.craftIndexQueued = null;
  input.craftScrollQueued = 0;
  input.inventoryIndexQueued = null;
  input.inventoryScrollQueued = 0;
};

const clearInputState = (input: InputState) => {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  clearQueuedInputs(input);
  input.mouseScreen = null;
  input.mouseWorld = null;
};

export const createInputBuffer = (capacity: number): InputBuffer => {
  const frames = new Int32Array(capacity);
  frames.fill(-1);
  return {
    capacity,
    frames,
    buttons: new Uint32Array(capacity),
    craftIndex: new Int16Array(capacity),
    craftScroll: new Int16Array(capacity),
    inventoryIndex: new Int16Array(capacity),
    inventoryScroll: new Int16Array(capacity),
    mouseX: new Int32Array(capacity),
    mouseY: new Int32Array(capacity)
  };
};

export const storeInputFrame = (buffer: InputBuffer, frame: number, input: InputState) => {
  const index = frame % buffer.capacity;
  buffer.frames[index] = frame;

  let buttons = 0;
  if (input.up) {
    buttons |= InputBits.Up;
  }
  if (input.down) {
    buttons |= InputBits.Down;
  }
  if (input.left) {
    buttons |= InputBits.Left;
  }
  if (input.right) {
    buttons |= InputBits.Right;
  }
  if (input.interactQueued) {
    buttons |= InputBits.Interact;
  }
  if (input.useQueued) {
    buttons |= InputBits.Use;
  }
  if (input.dropQueued) {
    buttons |= InputBits.Drop;
  }
  if (input.toggleCraftQueued) {
    buttons |= InputBits.ToggleCraft;
  }
  if (input.closeCraftQueued) {
    buttons |= InputBits.CloseCraft;
  }

  if (input.mouseScreen) {
    buttons |= InputBits.HasMouse;
    buffer.mouseX[index] = Math.round(input.mouseScreen.x);
    buffer.mouseY[index] = Math.round(input.mouseScreen.y);
  } else {
    buffer.mouseX[index] = 0;
    buffer.mouseY[index] = 0;
  }

  buffer.buttons[index] = buttons;

  const craftIndex = input.craftIndexQueued;
  buffer.craftIndex[index] = craftIndex === null ? -1 : craftIndex;
  buffer.craftScroll[index] = input.craftScrollQueued;

  const inventoryIndex = input.inventoryIndexQueued;
  buffer.inventoryIndex[index] = inventoryIndex === null ? -1 : inventoryIndex;
  buffer.inventoryScroll[index] = input.inventoryScrollQueued;

  clearQueuedInputs(input);
};

export const loadInputFrame = (buffer: InputBuffer, frame: number, out: InputState) => {
  const index = frame % buffer.capacity;
  if (buffer.frames[index] !== frame) {
    clearInputState(out);
    return false;
  }

  const buttons = buffer.buttons[index];
  out.up = (buttons & InputBits.Up) !== 0;
  out.down = (buttons & InputBits.Down) !== 0;
  out.left = (buttons & InputBits.Left) !== 0;
  out.right = (buttons & InputBits.Right) !== 0;
  out.interactQueued = (buttons & InputBits.Interact) !== 0;
  out.useQueued = (buttons & InputBits.Use) !== 0;
  out.dropQueued = (buttons & InputBits.Drop) !== 0;
  out.toggleCraftQueued = (buttons & InputBits.ToggleCraft) !== 0;
  out.closeCraftQueued = (buttons & InputBits.CloseCraft) !== 0;

  const craftIndex = buffer.craftIndex[index];
  out.craftIndexQueued = craftIndex >= 0 ? craftIndex : null;
  out.craftScrollQueued = buffer.craftScroll[index];

  const inventoryIndex = buffer.inventoryIndex[index];
  out.inventoryIndexQueued = inventoryIndex >= 0 ? inventoryIndex : null;
  out.inventoryScrollQueued = buffer.inventoryScroll[index];

  if ((buttons & InputBits.HasMouse) !== 0) {
    if (!out.mouseScreen) {
      out.mouseScreen = { x: 0, y: 0 };
    }
    out.mouseScreen.x = buffer.mouseX[index];
    out.mouseScreen.y = buffer.mouseY[index];
  } else {
    out.mouseScreen = null;
  }
  out.mouseWorld = null;
  return true;
};
