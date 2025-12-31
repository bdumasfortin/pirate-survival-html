import type { EcsWorld, EntityId } from "./ecs";
import { INVENTORY_SLOT_COUNT } from "./ecs";
import type { Vec2 } from "./types";

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  interactQueued: boolean;
  useQueued: boolean;
  dropQueued: boolean;
  toggleCraftQueued: boolean;
  closeCraftQueued: boolean;
  craftIndexQueued: number | null;
  craftScrollQueued: number;
  mouseScreen: Vec2 | null;
  mouseWorld: Vec2 | null;
};

export const createInputState = (): InputState => ({
  up: false,
  down: false,
  left: false,
  right: false,
  interactQueued: false,
  useQueued: false,
  dropQueued: false,
  toggleCraftQueued: false,
  closeCraftQueued: false,
  craftIndexQueued: null,
  craftScrollQueued: 0,
  mouseScreen: null,
  mouseWorld: null
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
      case "KeyC":
        if (value) {
          state.toggleCraftQueued = true;
        }
        break;
      case "Escape":
        if (value) {
          state.closeCraftQueued = true;
        }
        break;
      default:
        break;
    }
  };
  const resetMovement = () => {
    state.up = false;
    state.down = false;
    state.left = false;
    state.right = false;
  };

  const resetQueuedInputs = () => {
    state.interactQueued = false;
    state.useQueued = false;
    state.dropQueued = false;
    state.toggleCraftQueued = false;
    state.closeCraftQueued = false;
    state.craftIndexQueued = null;
    state.craftScrollQueued = 0;
  };

  const resetInputState = () => {
    resetMovement();
    resetQueuedInputs();
  };

  const queueCraftIndex = (code: string) => {
    if (code.startsWith("Digit") && code.length === 6) {
      const digit = Number.parseInt(code.slice(5), 10);
      if (digit >= 1 && digit <= 9) {
        state.craftIndexQueued = digit - 1;
      }
    }

    if (code.startsWith("Numpad")) {
      const digit = Number.parseInt(code.slice(6), 10);
      if (digit >= 1 && digit <= 9) {
        state.craftIndexQueued = digit - 1;
      }
    }
  };

  window.addEventListener("keydown", (event) => {
    setKey(event.code, true);
    queueCraftIndex(event.code);
  });
  window.addEventListener("keyup", (event) => setKey(event.code, false));
  window.addEventListener("blur", resetInputState);
  window.addEventListener("contextmenu", resetInputState);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resetInputState();
    }
  });
};

export const bindCraftScroll = (state: InputState, isActive: () => boolean) => {
  const handleWheel = (event: WheelEvent) => {
    if (!isActive()) {
      return;
    }

    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    state.craftScrollQueued += direction;
  };

  window.addEventListener("wheel", handleWheel, { passive: false });
};

export const bindMouse = (state: InputState) => {
  window.addEventListener("mousemove", (event) => {
    state.mouseScreen = { x: event.clientX, y: event.clientY };
  });

  window.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
      state.useQueued = true;
      if (!state.mouseScreen) {
        state.mouseScreen = { x: event.clientX, y: event.clientY };
      }
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

export const consumeToggleCraft = (state: InputState) => {
  if (!state.toggleCraftQueued) {
    return false;
  }

  state.toggleCraftQueued = false;
  return true;
};

export const consumeCloseCraft = (state: InputState) => {
  if (!state.closeCraftQueued) {
    return false;
  }

  state.closeCraftQueued = false;
  return true;
};

export const consumeCraftScroll = (state: InputState) => {
  if (state.craftScrollQueued === 0) {
    return 0;
  }

  const delta = state.craftScrollQueued;
  state.craftScrollQueued = 0;
  return delta;
};

export const consumeCraftIndex = (state: InputState) => {
  if (state.craftIndexQueued === null) {
    return null;
  }

  const index = state.craftIndexQueued;
  state.craftIndexQueued = null;
  return index;
};

const clampIndex = (index: number, length: number) => {
  if (length <= 0) {
    return 0;
  }
  return (index + length) % length;
};

export const bindInventorySelection = (ecs: EcsWorld, entityId: EntityId, canSelect: () => boolean = () => true) => {
  const setIndex = (index: number) => {
    ecs.inventorySelected[entityId] = clampIndex(index, INVENTORY_SLOT_COUNT);
  };

  const handleKey = (event: KeyboardEvent) => {
    if (!canSelect()) {
      return;
    }

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
    if (!canSelect()) {
      return;
    }

    if (event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    setIndex(ecs.inventorySelected[entityId] + direction);
  };

  window.addEventListener("keydown", handleKey);
  window.addEventListener("wheel", handleWheel, { passive: false });
};
