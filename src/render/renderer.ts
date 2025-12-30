import type { GameState } from "../game/state";
import { CAMERA_ZOOM as CAMERA_ZOOM_VALUE } from "../game/config";
import type { ResourceKind, ResourceNodeType } from "../world/world";
import { canCraft, recipes } from "../game/crafting";
import { getNearestGatherableResource } from "../systems/gathering";

const resourceColors: Record<ResourceKind, string> = {
  wood: "#a06a3b",
  rock: "#9aa0a6",
  berries: "#8b4fd6",
  raft: "#caa05a",
  sword: "#c7c9cc"
};

const nodeColors: Record<ResourceNodeType, string> = {
  tree: "#3f7d4a",
  rock: "#8f9399",
  bush: "#6f4aa8"
};

const enemyColors: Record<string, string> = {
  crab: "#d0674b"
};

const promptLabels: Record<ResourceNodeType, string> = {
  tree: "E to chop",
  rock: "E to pick up",
  bush: "E to collect"
};

const UI_FONT = "\"Zain\"";
const CAMERA_ZOOM = CAMERA_ZOOM_VALUE;
const INVENTORY_SLOT_SIZE = 52;
const INVENTORY_SLOT_GAP = 10;
const INVENTORY_BAR_PADDING = 18;
const INVENTORY_BAR_MARGIN = 12;
const INVENTORY_CORNER_RADIUS = 12;

const HUD_MARGIN = 18;
const BAR_WIDTH = 220;
const BAR_HEIGHT = 14;

const CRAFT_MENU_WIDTH = 260;
const CRAFT_MENU_PADDING = 14;
const CRAFT_LINE_HEIGHT = 22;

const drawIsland = (ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) => {
  if (points.length === 0) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
};

const insetPoints = (points: { x: number; y: number }[], center: { x: number; y: number }, factor: number) =>
  points.map((point) => ({
    x: center.x + (point.x - center.x) * factor,
    y: center.y + (point.y - center.y) * factor
  }));

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const renderInventory = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const { innerWidth, innerHeight } = window;
  const totalWidth = state.inventory.slots.length * INVENTORY_SLOT_SIZE +
    (state.inventory.slots.length - 1) * INVENTORY_SLOT_GAP;
  const startX = (innerWidth - totalWidth) / 2;
  const startY = innerHeight - INVENTORY_BAR_PADDING - INVENTORY_SLOT_SIZE;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgba(12, 22, 26, 0.6)";
  drawRoundedRect(
    ctx,
    startX - 14,
    startY - INVENTORY_BAR_MARGIN,
    totalWidth + 28,
    INVENTORY_SLOT_SIZE + INVENTORY_BAR_MARGIN * 2,
    16
  );
  ctx.fill();
  ctx.restore();

  state.inventory.slots.forEach((slot, index) => {
    const x = startX + index * (INVENTORY_SLOT_SIZE + INVENTORY_SLOT_GAP);
    const y = startY;

    ctx.save();
    ctx.fillStyle = "rgba(20, 32, 38, 0.85)";
    ctx.strokeStyle = index === state.inventory.selectedIndex ? "#f0d58b" : "#5f6b6d";
    ctx.lineWidth = index === state.inventory.selectedIndex ? 2.5 : 1.5;
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 6;
    drawRoundedRect(ctx, x, y, INVENTORY_SLOT_SIZE, INVENTORY_SLOT_SIZE, INVENTORY_CORNER_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (slot.kind && slot.quantity > 0) {
      const color = resourceColors[slot.kind];
      ctx.beginPath();
      ctx.arc(x + INVENTORY_SLOT_SIZE / 2, y + INVENTORY_SLOT_SIZE / 2, INVENTORY_SLOT_SIZE * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.font = `14px ${UI_FONT}`;
      ctx.fillStyle = "#f6e7c1";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(slot.quantity), x + INVENTORY_SLOT_SIZE - 6, y + INVENTORY_SLOT_SIZE - 4);
    }
  });
};

const renderInteractionPrompt = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const player = state.entities.find((entity) => entity.id === state.playerId);
  if (!player) {
    return;
  }

  const target = getNearestGatherableResource(player.position, player.radius, state.world.resources);
  if (!target) {
    return;
  }

  const text = promptLabels[target.nodeType];
  const { innerWidth, innerHeight } = window;
  const fontSize = 18;
  const paddingX = 16;
  const paddingY = 8;

  ctx.save();
  ctx.font = `${fontSize}px ${UI_FONT}`;
  const textWidth = ctx.measureText(text).width;
  const width = textWidth + paddingX * 2;
  const height = fontSize + paddingY * 2;
  const inventoryTop = innerHeight - INVENTORY_BAR_PADDING - INVENTORY_SLOT_SIZE - INVENTORY_BAR_MARGIN;
  const x = (innerWidth - width) / 2;
  const y = Math.max(24, inventoryTop - 14 - height);

  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(18, 28, 34, 0.75)";
  drawRoundedRect(ctx, x, y, width, height, 10);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f6e7c1";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const textY = y + height / 2 + 1;
  ctx.fillText(text, innerWidth / 2, textY);
  ctx.restore();
};

const renderSurvivalBars = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const stats = state.survival;
  const x = HUD_MARGIN;
  let y = HUD_MARGIN;

  const drawBar = (value: number, max: number, color: string) => {
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(12, 22, 26, 0.55)";
    drawRoundedRect(ctx, x - 10, y - 8, BAR_WIDTH + 20, BAR_HEIGHT + 16, 8);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    drawRoundedRect(ctx, x, y, BAR_WIDTH, BAR_HEIGHT, 7);
    ctx.fill();

    ctx.fillStyle = color;
    drawRoundedRect(ctx, x, y, BAR_WIDTH * ratio, BAR_HEIGHT, 7);
    ctx.fill();
    ctx.restore();

    y += BAR_HEIGHT + 18;
  };

  drawBar(stats.health, stats.maxHealth, "#e2534b");
  drawBar(stats.hunger, stats.maxHunger, "#d9a441");
};

const renderAttackEffect = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const effect = state.attackEffect;
  if (!effect) {
    return;
  }

  const alpha = effect.duration > 0 ? effect.timer / effect.duration : 0;
  const radius = effect.radius + (1 - alpha) * 4;
  const startAngle = effect.angle - effect.spread / 2;
  const endAngle = effect.angle + effect.spread / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255, 233, 180, 0.4)";
  ctx.beginPath();
  ctx.moveTo(effect.origin.x, effect.origin.y);
  ctx.arc(effect.origin.x, effect.origin.y, radius, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const renderHints = (ctx: CanvasRenderingContext2D) => {
  const { innerHeight } = window;
  const lines = [
    "Q to drop item",
    "C to open crafting menu",
    "LMB to use or attack"
  ];
  const fontSize = 14;
  const lineHeight = fontSize + 6;
  let y = innerHeight - HUD_MARGIN + 2;

  ctx.save();
  ctx.font = `${fontSize}px ${UI_FONT}`;
  ctx.fillStyle = "rgba(246, 231, 193, 0.8)";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    ctx.fillText(lines[i], HUD_MARGIN, y);
    y -= lineHeight;
  }

  ctx.restore();
};

const renderCraftingMenu = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (!state.crafting.isOpen) {
    return;
  }

  const { innerWidth } = window;
  const menuX = innerWidth - CRAFT_MENU_WIDTH - HUD_MARGIN;
  let y = HUD_MARGIN;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgba(12, 22, 26, 0.7)";
  const menuHeight = CRAFT_MENU_PADDING * 2 + CRAFT_LINE_HEIGHT * (recipes.length + 1);
  drawRoundedRect(ctx, menuX, y, CRAFT_MENU_WIDTH, menuHeight, 14);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f6e7c1";
  ctx.font = `18px ${UI_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Crafting", menuX + CRAFT_MENU_PADDING, y + CRAFT_MENU_PADDING);

  y += CRAFT_MENU_PADDING + CRAFT_LINE_HEIGHT;
  ctx.font = `14px ${UI_FONT}`;

  recipes.forEach((recipe, index) => {
    const craftable = canCraft(state.inventory, recipe);
    const prefix = `${index + 1}.`;
    const ingredients = recipe.inputs
      .map((input) => `${input.kind} x${input.amount}`)
      .join(", ");
    const line = `${prefix} ${recipe.name} (${ingredients})`;

    ctx.fillStyle = craftable ? "#f6e7c1" : "rgba(246, 231, 193, 0.4)";
    ctx.fillText(line, menuX + CRAFT_MENU_PADDING, y);
    y += CRAFT_LINE_HEIGHT;
  });

  ctx.restore();
};

export const render = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const { innerWidth, innerHeight } = window;
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  const seaGradient = ctx.createLinearGradient(0, 0, 0, innerHeight);
  seaGradient.addColorStop(0, "#2c7a7b");
  seaGradient.addColorStop(1, "#0b2430");
  ctx.fillStyle = seaGradient;
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  const player = state.entities.find((entity) => entity.id === state.playerId);
  const cameraX = player?.position.x ?? 0;
  const cameraY = player?.position.y ?? 0;

  ctx.save();
  ctx.translate(innerWidth / 2, innerHeight / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-cameraX, -cameraY);

  state.world.islands.forEach((island) => {
    ctx.fillStyle = "#f6e7c1";
    drawIsland(ctx, island.points);

    const inner = insetPoints(island.points, island.center, 0.82);
    ctx.fillStyle = "#7dbb6a";
    drawIsland(ctx, inner);
  });

  state.world.resources.forEach((resource) => {
    const color = resource.nodeType === "bush" && resource.remaining === 0
      ? "#4a3a59"
      : nodeColors[resource.nodeType];
    ctx.beginPath();
    ctx.arc(resource.position.x, resource.position.y, resource.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  state.enemies.forEach((enemy) => {
    const flash = enemy.hitTimer > 0 ? enemy.hitTimer / 0.18 : 0;
    const baseColor = enemyColors[enemy.kind] ?? "#d0674b";
    const color = flash > 0 ? `rgba(255, 210, 130, ${flash})` : baseColor;
    ctx.beginPath();
    ctx.arc(enemy.position.x, enemy.position.y, enemy.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  renderAttackEffect(ctx, state);

  state.entities.forEach((entity) => {
    ctx.beginPath();
    ctx.arc(entity.position.x, entity.position.y, entity.radius, 0, Math.PI * 2);
    ctx.fillStyle = entity.tag === "player" ? "#222222" : "#f56565";
    ctx.fill();
  });

  ctx.restore();

  renderSurvivalBars(ctx, state);
  renderCraftingMenu(ctx, state);
  renderInteractionPrompt(ctx, state);
  renderInventory(ctx, state);
  renderHints(ctx);
};
