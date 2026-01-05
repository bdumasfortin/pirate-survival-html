import { MAX_DEVICE_PIXEL_RATIO } from "./constants";

export const setupCanvas = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available.");
  }

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  const resize = () => {
    const dpr = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, window.devicePixelRatio || 1));
    const { innerWidth, innerHeight } = window;

    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  window.addEventListener("resize", resize);
  resize();

  return ctx;
};
