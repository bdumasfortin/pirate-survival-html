import type { GameState } from "../game/state";
import type { ResourceKind, ResourceNodeType } from "../world/world";
import { getNearestGatherableResource } from "../systems/gathering";

const resourceColors: Record<ResourceKind, string> = {
  wood: "#a06a3b",
  rock: "#9aa0a6",
  berries: "#8b4fd6"
};

const nodeColors: Record<ResourceNodeType, string> = {
  tree: "#3f7d4a",
  rock: "#8f9399",
  bush: "#6f4aa8"
};

const promptLabels: Record<ResourceNodeType, string> = {
  tree: "E to chop",
  rock: "E to pick up",
  bush: "E to collect"
};

const UI_FONT = "\"Zain\"";
const CAMERA_ZOOM = 2;
const INVENTORY_SLOT_SIZE = 52;
const INVENTORY_SLOT_GAP = 10;
const INVENTORY_BAR_PADDING = 18;
const INVENTORY_BAR_MARGIN = 12;
const INVENTORY_CORNER_RADIUS = 12;

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

  state.entities.forEach((entity) => {
    ctx.beginPath();
    ctx.arc(entity.position.x, entity.position.y, entity.radius, 0, Math.PI * 2);
    ctx.fillStyle = entity.tag === "player" ? "#222222" : "#f56565";
    ctx.fill();
  });

  ctx.restore();

  renderInteractionPrompt(ctx, state);
  renderInventory(ctx, state);
};

