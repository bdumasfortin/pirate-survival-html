import type { GameState } from "../game/state";
import { renderDayNightOverlay, renderDayTitle } from "./day-night";
import { renderHud } from "./ui";
import { renderWorld } from "./world";

export const render = (ctx: CanvasRenderingContext2D, state: GameState) => {
  renderWorld(ctx, state);
  renderDayNightOverlay(ctx, state);
  renderDayTitle(ctx, state);
  renderHud(ctx, state);
};
