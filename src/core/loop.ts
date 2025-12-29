export type LoopOptions = {
  onUpdate: (delta: number) => void;
  onRender: () => void;
};

export const startLoop = ({ onUpdate, onRender }: LoopOptions) => {
  let last = performance.now();

  const frame = (now: number) => {
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;

    onUpdate(delta);
    onRender();

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
};
