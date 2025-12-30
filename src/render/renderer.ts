import type { GameState } from "../game/state";
import { renderHud } from "./ui";
import { renderWorld } from "./world";

export const render = (ctx: CanvasRenderingContext2D, state: GameState) => {
  renderWorld(ctx, state);
  renderHud(ctx, state);
};
