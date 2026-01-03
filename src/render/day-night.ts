import type { GameState } from "../game/state";
import { getDayCycleInfo } from "../game/day-night";

export const renderDayNightOverlay = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const { innerWidth, innerHeight } = window;
  const { nightFactor } = getDayCycleInfo(state.time);
  if (nightFactor <= 0.01) {
    return;
  }

  const tintAlpha = 0.32 * nightFactor;
  ctx.save();
  ctx.globalAlpha = tintAlpha;
  ctx.fillStyle = "rgb(14, 24, 38)";
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.restore();

  const vignetteAlpha = 0.45 * nightFactor;
  const radius = Math.max(innerWidth, innerHeight) * 0.75;
  const gradient = ctx.createRadialGradient(
    innerWidth / 2,
    innerHeight / 2,
    radius * 0.2,
    innerWidth / 2,
    innerHeight / 2,
    radius
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${vignetteAlpha})`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.restore();
};
