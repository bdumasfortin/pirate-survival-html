import type { InventoryState } from "../game/inventory";

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  interactQueued: boolean;
  useQueued: boolean;
  dropQueued: boolean;
};

export const createInputState = (): InputState => ({
  up: false,
  down: false,
  left: false,
  right: false,
  interactQueued: false,
  useQueued: false,
  dropQueued: false
});

export const bindKeyboard = (state: InputState) => {
  const setKey = (key: string, value: boolean) => {
    switch (key) {
      case "ArrowUp":
      case "KeyW":
        state.up = value;
        break;
      case "ArrowDown":
      case "KeyS":
        state.down = value;
        break;
      case "ArrowLeft":
      case "KeyA":
        state.left = value;
        break;
      case "ArrowRight":
      case "KeyD":
        state.right = value;
        break;
      case "KeyE":
        if (value) {
          state.interactQueued = true;
        }
        break;
      case "KeyQ":
        if (value) {
          state.dropQueued = true;
        }
        break;
      default:
        break;
    }
  };

  window.addEventListener("keydown", (event) => setKey(event.code, true));
  window.addEventListener("keyup", (event) => setKey(event.code, false));
};

export const bindMouse = (state: InputState) => {
  window.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
      state.useQueued = true;
    }
  });
};

export const consumeInteract = (state: InputState) => {
  if (!state.interactQueued) {
    return false;
  }

  state.interactQueued = false;
  return true;
};

export const consumeUse = (state: InputState) => {
  if (!state.useQueued) {
    return false;
  }

  state.useQueued = false;
  return true;
};

export const consumeDrop = (state: InputState) => {
  if (!state.dropQueued) {
    return false;
  }

  state.dropQueued = false;
  return true;
};

const clampIndex = (index: number, length: number) => {
  if (length <= 0) {
    return 0;
  }
  return (index + length) % length;
};

export const bindInventorySelection = (inventory: InventoryState) => {
  const setIndex = (index: number) => {
    inventory.selectedIndex = clampIndex(index, inventory.slots.length);
  };

  const handleKey = (event: KeyboardEvent) => {
    const { code } = event;

    if (code.startsWith("Digit") && code.length === 6) {
      const digit = Number.parseInt(code.slice(5), 10);
      if (digit >= 1 && digit <= 9) {
        setIndex(digit - 1);
      }
    }

    if (code.startsWith("Numpad")) {
      const digit = Number.parseInt(code.slice(6), 10);
      if (digit >= 1 && digit <= 9) {
        setIndex(digit - 1);
      }
    }
  };

  const handleWheel = (event: WheelEvent) => {
    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    setIndex(inventory.selectedIndex + direction);
  };

  window.addEventListener("keydown", handleKey);
  window.addEventListener("wheel", handleWheel, { passive: false });
};
