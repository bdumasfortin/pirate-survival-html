import { createInputState } from "../core/input";
import { applyInputFrame, InputBits, type InputFrame } from "../core/input-buffer";
import { hashGameState } from "../core/state-hash";
import { simulateFrame } from "../game/sim";
import { createInitialState } from "../game/state";

const buildTestInputFrame = (frame: number): InputFrame => {
  let buttons = 0;
  const phase = frame % 240;
  if (phase < 60) {
    buttons |= InputBits.Right;
  } else if (phase < 120) {
    buttons |= InputBits.Down;
  } else if (phase < 180) {
    buttons |= InputBits.Left;
  } else {
    buttons |= InputBits.Up;
  }

  if (frame % 90 === 10) {
    buttons |= InputBits.Interact;
  }
  if (frame % 120 === 20) {
    buttons |= InputBits.Use;
  }
  if (frame % 150 === 30) {
    buttons |= InputBits.Drop;
  }

  return {
    buttons,
    craftIndex: -1,
    craftScroll: 0,
    inventoryIndex: -1,
    inventoryScroll: 0,
    mouseX: 0,
    mouseY: 0,
  };
};

const runSimulation = (seed: string, frames: number) => {
  const state = createInitialState(seed, 1, 0);
  const inputs = [createInputState()];
  const delta = 1 / 60;

  for (let frame = 0; frame < frames; frame += 1) {
    applyInputFrame(buildTestInputFrame(frame), inputs[0]);
    simulateFrame(state, inputs, delta);
  }

  return hashGameState(state);
};

export const runDeterminismCheck = (seed = "determinism", frames = 600) => {
  const hashA = runSimulation(seed, frames);
  const hashB = runSimulation(seed, frames);
  const ok = hashA === hashB;
  const status = ok ? "PASS" : "FAIL";
  console.info(`[determinism] ${status} seed=${seed} frames=${frames} hash=${hashA.toString(16)}`);
  if (!ok) {
    console.error(`[determinism] mismatch hashB=${hashB.toString(16)}`);
  }
  return ok;
};
