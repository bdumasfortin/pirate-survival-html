import { getDayCycleInfo, getDayTitleInfo } from "../game/day-night";
import type { GameState } from "../game/state";
import { UI_FONT } from "./ui-config";

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

export const renderDayTitle = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const info = getDayTitleInfo(state.time);
  if (!info || info.alpha <= 0.01) {
    return;
  }

  const { innerWidth, innerHeight } = window;
  const text = `Day ${info.dayNumber}`;
  const y = innerHeight * 0.35;

  ctx.save();
  ctx.globalAlpha = info.alpha;
  ctx.font = `32px ${UI_FONT}`;
  ctx.fillStyle = "rgba(246, 231, 193, 0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 12;
  ctx.fillText(text, innerWidth / 2, y);
  ctx.restore();
};
