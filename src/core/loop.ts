export type LoopOptions = {
  onUpdate: (delta: number) => void;
  onRender: () => void;
  fixedDelta?: number;
  maxUpdatesPerFrame?: number;
};

export const startLoop = ({ onUpdate, onRender, fixedDelta = 1 / 60, maxUpdatesPerFrame = 5 }: LoopOptions) => {
  let last = performance.now();
  let accumulator = 0;

  const frame = (now: number) => {
    const maxDelta = fixedDelta * maxUpdatesPerFrame;
    const delta = Math.min(maxDelta, (now - last) / 1000);
    last = now;

    accumulator += delta;

    let updates = 0;
    while (accumulator >= fixedDelta && updates < maxUpdatesPerFrame) {
      onUpdate(fixedDelta);
      accumulator -= fixedDelta;
      updates += 1;
    }

    if (updates === maxUpdatesPerFrame) {
      accumulator = 0;
    }
    onRender();

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
};
