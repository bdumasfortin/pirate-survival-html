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

export type InputFrame = {
  buttons: number;
  craftIndex: number;
  craftScroll: number;
  inventoryIndex: number;
  inventoryScroll: number;
  mouseX: number;
  mouseY: number;
};

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

const buildInputFrame = (input: InputState): InputFrame => {
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
  }

  const craftIndex = input.craftIndexQueued;
  const inventoryIndex = input.inventoryIndexQueued;
  return {
    buttons,
    craftIndex: craftIndex === null ? -1 : craftIndex,
    craftScroll: input.craftScrollQueued,
    inventoryIndex: inventoryIndex === null ? -1 : inventoryIndex,
    inventoryScroll: input.inventoryScrollQueued,
    mouseX: input.mouseScreen ? Math.round(input.mouseScreen.x) : 0,
    mouseY: input.mouseScreen ? Math.round(input.mouseScreen.y) : 0
  };
};

export const storeInputFrameData = (buffer: InputBuffer, frame: number, data: InputFrame) => {
  const index = frame % buffer.capacity;
  buffer.frames[index] = frame;
  buffer.buttons[index] = data.buttons;
  buffer.craftIndex[index] = data.craftIndex;
  buffer.craftScroll[index] = data.craftScroll;
  buffer.inventoryIndex[index] = data.inventoryIndex;
  buffer.inventoryScroll[index] = data.inventoryScroll;
  buffer.mouseX[index] = data.mouseX;
  buffer.mouseY[index] = data.mouseY;
};

export const storeInputFrame = (buffer: InputBuffer, frame: number, input: InputState) => {
  storeInputFrameData(buffer, frame, buildInputFrame(input));

  clearQueuedInputs(input);
};

export const applyInputFrame = (frame: InputFrame, out: InputState) => {
  const buttons = frame.buttons;
  out.up = (buttons & InputBits.Up) !== 0;
  out.down = (buttons & InputBits.Down) !== 0;
  out.left = (buttons & InputBits.Left) !== 0;
  out.right = (buttons & InputBits.Right) !== 0;
  out.interactQueued = (buttons & InputBits.Interact) !== 0;
  out.useQueued = (buttons & InputBits.Use) !== 0;
  out.dropQueued = (buttons & InputBits.Drop) !== 0;
  out.toggleCraftQueued = (buttons & InputBits.ToggleCraft) !== 0;
  out.closeCraftQueued = (buttons & InputBits.CloseCraft) !== 0;

  out.craftIndexQueued = frame.craftIndex >= 0 ? frame.craftIndex : null;
  out.craftScrollQueued = frame.craftScroll;

  out.inventoryIndexQueued = frame.inventoryIndex >= 0 ? frame.inventoryIndex : null;
  out.inventoryScrollQueued = frame.inventoryScroll;

  if ((buttons & InputBits.HasMouse) !== 0) {
    if (!out.mouseScreen) {
      out.mouseScreen = { x: 0, y: 0 };
    }
    out.mouseScreen.x = frame.mouseX;
    out.mouseScreen.y = frame.mouseY;
  } else {
    out.mouseScreen = null;
  }
  out.mouseWorld = null;
};

export const readInputFrame = (buffer: InputBuffer, frame: number): InputFrame | null => {
  const index = frame % buffer.capacity;
  if (buffer.frames[index] !== frame) {
    return null;
  }

  return {
    buttons: buffer.buttons[index],
    craftIndex: buffer.craftIndex[index],
    craftScroll: buffer.craftScroll[index],
    inventoryIndex: buffer.inventoryIndex[index],
    inventoryScroll: buffer.inventoryScroll[index],
    mouseX: buffer.mouseX[index],
    mouseY: buffer.mouseY[index]
  };
};

export const loadInputFrame = (buffer: InputBuffer, frame: number, out: InputState) => {
  const data = readInputFrame(buffer, frame);
  if (!data) {
    clearInputState(out);
    return false;
  }

  applyInputFrame(data, out);
  return true;
};
