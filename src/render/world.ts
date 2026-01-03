import type { GameState } from "../game/state";
import type { Vec2 } from "../core/types";
import type { Island, IslandType, ResourceNodeType } from "../world/types";
import { CAMERA_ZOOM } from "./ui-config";
import { GROUND_ITEM_RENDER_SIZE } from "../game/ground-items-config";
import { ATTACK_EFFECT_DURATION, CRAB_HIT_FLASH_DURATION, PLAYER_ATTACK_COOLDOWN } from "../game/combat-config";
import { ComponentMask, forEachEntity, isEntityAlive } from "../core/ecs";
import { enemyKindFromIndex } from "../game/enemy-kinds";
import { GROUND_ITEM_MASK } from "../game/ground-items";
import { drawIsland, insetPoints } from "./render-helpers";
import { isImageReady, itemImages, propImages, worldImages } from "./assets";
import { getInventorySelectedIndex, getInventorySlotKind, getInventorySlotQuantity } from "../game/inventory";
import { itemKindFromIndex } from "../game/item-kinds";
import { resourceNodeTypeFromIndex } from "../world/resource-node-types";
import { propKindFromIndex } from "../game/prop-kinds";
import { UI_FONT } from "./ui-config";

const SEA_GRADIENT_TOP = "#2c7a7b";
const SEA_GRADIENT_BOTTOM = "#0b2430";
const ISLAND_INSET_SCALE = 0.82;
const RESOURCE_IMAGE_SCALE = 1.4;
const GROUND_ITEM_GLOW_COLOR = "#ffffff";
const GROUND_ITEM_SPARKLE_COUNT = 5;
const GROUND_ITEM_SPARKLE_RADIUS = 1.4;
const GROUND_ITEM_SPARKLE_ORBIT = 10;
const GROUND_ITEM_SPARKLE_SPEED = 1.8;
const PROP_RENDER_SIZE = 24;
const ATTACK_EFFECT_COLOR = "rgba(255, 233, 180, 0.4)";
const PLAYER_COLOR = "#222222";
const PLAYER_PIVOT_Y = 0.264;
const CUTLASS_LENGTH_SCALE = 2.5;
const CUTLASS_HAND_OFFSET_X = 0;
const CUTLASS_HAND_OFFSET_Y = 0.8;
const CUTLASS_PIVOT_X = 0.18;
const CUTLASS_PIVOT_Y = 0.6;
const CUTLASS_BASE_ROTATION = 0.1;
const CUTLASS_SLASH_ARC = 1.4;
const PLAYER_NAME_COLOR = "#f6f2e7";
const PLAYER_NAME_STROKE = "rgba(0, 0, 0, 0.65)";
const PLAYER_NAME_OFFSET = 12;
const PLAYER_NAME_FONT_SIZE = 8;
const PLAYER_NAME_PADDING_X = 4;
const PLAYER_NAME_PADDING_Y = 2;
const PLAYER_NAME_RADIUS = 4;
const PLAYER_NAME_LOWER_OFFSET = 4;
const PLAYER_NAME_TEXT_OFFSET = 2;
const CULL_PADDING = 120;

let playerNameLabels: string[] = [];
const labelMetricsCache = new Map<string, { width: number; height: number }>();

export const setPlayerNameLabels = (labels: string[]) => {
  playerNameLabels = labels;
  labelMetricsCache.clear();
};

type ViewBounds = { minX: number; maxX: number; minY: number; maxY: number };

const islandBoundsCache = new WeakMap<Island, ViewBounds>();
const islandInnerPointsCache = new WeakMap<Island, Vec2[]>();

const getLabelMetrics = (ctx: CanvasRenderingContext2D, label: string) => {
  const cached = labelMetricsCache.get(label);
  if (cached) {
    return cached;
  }
  const metrics = ctx.measureText(label);
  const entry = {
    width: metrics.width,
    height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
  };
  labelMetricsCache.set(label, entry);
  return entry;
};

const getIslandBounds = (island: Island): ViewBounds => {
  const cached = islandBoundsCache.get(island);
  if (cached) {
    return cached;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of island.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const bounds = { minX, minY, maxX, maxY };
  islandBoundsCache.set(island, bounds);
  return bounds;
};

const getIslandInnerPoints = (island: Island) => {
  const cached = islandInnerPointsCache.get(island);
  if (cached) {
    return cached;
  }
  const inner = insetPoints(island.points, island.center, ISLAND_INSET_SCALE);
  islandInnerPointsCache.set(island, inner);
  return inner;
};

const isRectInView = (bounds: ViewBounds, view: ViewBounds) =>
  !(bounds.maxX < view.minX || bounds.minX > view.maxX || bounds.maxY < view.minY || bounds.minY > view.maxY);

const isCircleInView = (x: number, y: number, radius: number, view: ViewBounds) =>
  !(x + radius < view.minX || x - radius > view.maxX || y + radius < view.minY || y - radius > view.maxY);

const getViewBounds = (cameraX: number, cameraY: number, width: number, height: number): ViewBounds => {
  const halfWidth = width / (2 * CAMERA_ZOOM);
  const halfHeight = height / (2 * CAMERA_ZOOM);
  return {
    minX: cameraX - halfWidth - CULL_PADDING,
    maxX: cameraX + halfWidth + CULL_PADDING,
    minY: cameraY - halfHeight - CULL_PADDING,
    maxY: cameraY + halfHeight + CULL_PADDING
  };
};

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const clamped = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + clamped, y);
  ctx.arcTo(x + width, y, x + width, y + height, clamped);
  ctx.arcTo(x + width, y + height, x, y + height, clamped);
  ctx.arcTo(x, y + height, x, y, clamped);
  ctx.arcTo(x, y, x + width, y, clamped);
  ctx.closePath();
};

const islandStyles: Record<IslandType, { sand: string; grass?: string }> = {
  standard: { sand: "#f6e7c1", grass: "#7dbb6a" },
  forest: { sand: "#f6e7c1", grass: "#4b7a74" },
  wolfBoss: { sand: "#f6e7c1", grass: "#4b7a74" },
  crabBoss: { sand: "#f6e7c1" }
};
const nodeColors: Record<ResourceNodeType, string> = {
  tree: "#3f7d4a",
  rock: "#8f9399",
  bush: "#6f4aa8"
};

const enemyColors: Record<string, string> = {
  crab: "#d0674b",
  wolf: "#8a6b55",
  kraken: "#2f8aa0"
};

const {
  crab: crabImage,
  wolf: wolfImage,
  kraken: krakenImage,
  pirate: pirateImage,
  bush: bushImage,
  bushEmpty: bushEmptyImage,
  palmtree: palmtreeImage,
  rock: rockImage,
  raft: raftImage,
  cutlass: cutlassImage
} = worldImages;

const getItemIcon = (kind: keyof typeof itemImages) => {
  const image = itemImages[kind];
  return isImageReady(image) ? image : null;
};

const hasSelectedSword = (state: GameState, playerId: number) => {
  const ecs = state.ecs;
  const selectedIndex = getInventorySelectedIndex(ecs, playerId);
  const slotKind = getInventorySlotKind(ecs, playerId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(ecs, playerId, selectedIndex);
  return slotKind === "sword" && slotQuantity > 0;
};

const renderBackground = (ctx: CanvasRenderingContext2D) => {
  const { innerWidth, innerHeight } = window;
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  const seaGradient = ctx.createLinearGradient(0, 0, 0, innerHeight);
  seaGradient.addColorStop(0, SEA_GRADIENT_TOP);
  seaGradient.addColorStop(1, SEA_GRADIENT_BOTTOM);
  ctx.fillStyle = seaGradient;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
};

const renderIslands = (ctx: CanvasRenderingContext2D, state: GameState, view: ViewBounds) => {
  state.world.islands.forEach((island) => {
    if (!isRectInView(getIslandBounds(island), view)) {
      return;
    }
    const style = islandStyles[island.type] ?? islandStyles.standard;
    ctx.fillStyle = style.sand;
    drawIsland(ctx, island.points);

    if (style.grass) {
      const inner = getIslandInnerPoints(island);
      ctx.fillStyle = style.grass;
      drawIsland(ctx, inner);
    }
  });
};

const renderGroundItems = (ctx: CanvasRenderingContext2D, state: GameState, view: ViewBounds) => {
  const size = GROUND_ITEM_RENDER_SIZE;
  const cullRadius = size / 2 + GROUND_ITEM_SPARKLE_ORBIT + GROUND_ITEM_SPARKLE_RADIUS;
  const time = state.time;
  const ecs = state.ecs;
  forEachEntity(ecs, GROUND_ITEM_MASK, (id) => {
    const x = ecs.position.x[id];
    const y = ecs.position.y[id];
    if (!isCircleInView(x, y, cullRadius, view)) {
      return;
    }
    const kind = itemKindFromIndex(ecs.groundItemKind[id]);
    const icon = getItemIcon(kind);
    if (icon) {
      ctx.drawImage(icon, x - size / 2, y - size / 2, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "#f0d58b";
      ctx.fill();
    }

    const previousAlpha = ctx.globalAlpha;
    ctx.fillStyle = GROUND_ITEM_GLOW_COLOR;
    for (let i = 0; i < GROUND_ITEM_SPARKLE_COUNT; i += 1) {
      const angle = time * GROUND_ITEM_SPARKLE_SPEED + id * 0.7 + (i / GROUND_ITEM_SPARKLE_COUNT) * Math.PI * 2;
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.7);
      const orbit = GROUND_ITEM_SPARKLE_ORBIT + pulse * 2;
      const sparkleX = x + Math.cos(angle) * orbit;
      const sparkleY = y + Math.sin(angle) * orbit;

      ctx.globalAlpha = 0.3 + pulse * 0.5;
      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, GROUND_ITEM_SPARKLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = previousAlpha;
  });
};

type ResourceLayer = "all" | "trees" | "bushes" | "non-trees";

const renderResources = (ctx: CanvasRenderingContext2D, state: GameState, view: ViewBounds, layer: ResourceLayer = "all") => {
  const ecs = state.ecs;
  const resourceMask = ComponentMask.Resource | ComponentMask.Position | ComponentMask.Radius;
  const bushReady = isImageReady(bushImage);
  const bushEmptyReady = isImageReady(bushEmptyImage);
  const treeReady = isImageReady(palmtreeImage);
  const rockReady = isImageReady(rockImage);
  forEachEntity(ecs, resourceMask, (id) => {
    const x = ecs.position.x[id];
    const y = ecs.position.y[id];
    const cullRadius = ecs.radius[id] * RESOURCE_IMAGE_SCALE;
    if (!isCircleInView(x, y, cullRadius, view)) {
      return;
    }
    const nodeType = resourceNodeTypeFromIndex(ecs.resourceNodeType[id]);
    const isBush = nodeType === "bush";
    const isTree = nodeType === "tree";
    const isRock = nodeType === "rock";
    const barren = ecs.resourceRemaining[id] === 0;

    if (layer === "trees" && !isTree) {
      return;
    }
    if (layer === "bushes" && !isBush) {
      return;
    }
    if (layer === "non-trees" && isTree) {
      return;
    }

    if (isBush && bushReady) {
      const size = ecs.radius[id] * 2 * RESOURCE_IMAGE_SCALE;
      const image = barren && bushEmptyReady ? bushEmptyImage : bushImage;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ecs.resourceRotation[id]);
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (isTree && treeReady) {
      const size = ecs.radius[id] * 2 * RESOURCE_IMAGE_SCALE;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ecs.resourceRotation[id]);
      ctx.drawImage(palmtreeImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (isRock && rockReady) {
      const size = ecs.radius[id] * 2 * RESOURCE_IMAGE_SCALE;
      const width = size * 1.2;
      const height = size * 0.8;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ecs.resourceRotation[id]);
      ctx.drawImage(rockImage, -width / 2, -height / 2, width, height);
      ctx.restore();
      return;
    }

    const color = nodeColors[nodeType];
    ctx.beginPath();
    ctx.arc(x, y, ecs.radius[id], 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
};

const renderProps = (ctx: CanvasRenderingContext2D, state: GameState, view: ViewBounds) => {
  const ecs = state.ecs;
  const propMask = ComponentMask.Prop | ComponentMask.Position;
  forEachEntity(ecs, propMask, (id) => {
    const x = ecs.position.x[id];
    const y = ecs.position.y[id];
    const cullRadius = PROP_RENDER_SIZE / 2;
    if (!isCircleInView(x, y, cullRadius, view)) {
      return;
    }
    const kind = propKindFromIndex(ecs.propKind[id]);
    const image = propImages[kind];
    if (image && isImageReady(image)) {
      ctx.drawImage(
        image,
        x - PROP_RENDER_SIZE / 2,
        y - PROP_RENDER_SIZE / 2,
        PROP_RENDER_SIZE,
        PROP_RENDER_SIZE
      );
      return;
    }

    ctx.beginPath();
    ctx.arc(x, y, PROP_RENDER_SIZE * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "#d5b075";
    ctx.fill();
  });
};

const renderEnemies = (ctx: CanvasRenderingContext2D, state: GameState, view: ViewBounds) => {
  const ecs = state.ecs;
  const enemyMask = ComponentMask.Enemy | ComponentMask.Position | ComponentMask.Radius | ComponentMask.Velocity;
  const crabReady = isImageReady(crabImage);
  const wolfReady = isImageReady(wolfImage);
  const krakenReady = isImageReady(krakenImage);
  forEachEntity(ecs, enemyMask, (id) => {
    const x = ecs.position.x[id];
    const y = ecs.position.y[id];
    const radius = ecs.radius[id];
    if (!isCircleInView(x, y, radius, view)) {
      return;
    }
    const kind = enemyKindFromIndex(ecs.enemyKind[id]);
    const flash = ecs.enemyHitTimer[id] > 0 ? ecs.enemyHitTimer[id] / CRAB_HIT_FLASH_DURATION : 0;
    const image = kind === "crab"
      ? (crabReady ? crabImage : null)
      : kind === "wolf"
        ? (wolfReady ? wolfImage : null)
        : kind === "kraken"
          ? (krakenReady ? krakenImage : null)
          : null;
    const canDrawImage = image !== null;

    if (canDrawImage) {
      const size = radius * 2;
      const isKraken = kind === "kraken";
      const velX = ecs.velocity.x[id];
      const velY = ecs.velocity.y[id];
      const speed = Math.hypot(velX, velY);
      const angle = speed > 0.01 ? Math.atan2(velY, velX) : 0;
      const rotation = kind === "wolf"
        ? angle + Math.PI
        : kind === "kraken"
          ? 0
          : angle;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      if (isKraken || kind === "wolf") {
        const aspect = image.height > 0 ? image.width / image.height : 1;
        const width = size * aspect;
        ctx.drawImage(image, -width / 2, -size / 2, width, size);
      } else {
        ctx.drawImage(image, -size / 2, -size / 2, size, size);
      }
      ctx.restore();
    } else {
      const baseColor = enemyColors[kind] ?? "#d0674b";
      const color = flash > 0 ? `rgba(255, 210, 130, ${flash})` : baseColor;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    if (flash > 0 && canDrawImage) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 210, 130, ${flash})`;
      ctx.fill();
    }
  });
};

const renderAttackEffect = (ctx: CanvasRenderingContext2D, effect: NonNullable<GameState["attackEffects"][number]>) => {
  const alpha = effect.duration > 0 ? effect.timer / effect.duration : 0;
  const radius = effect.radius + (1 - alpha) * 4;
  const startAngle = effect.angle - effect.spread / 2;
  const endAngle = effect.angle + effect.spread / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ATTACK_EFFECT_COLOR;
  ctx.beginPath();
  ctx.moveTo(effect.origin.x, effect.origin.y);
  ctx.arc(effect.origin.x, effect.origin.y, radius, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const renderAttackEffects = (ctx: CanvasRenderingContext2D, state: GameState, view: ViewBounds) => {
  for (const effect of state.attackEffects) {
    if (!effect) {
      continue;
    }
    const maxRadius = effect.radius + 4;
    if (!isCircleInView(effect.origin.x, effect.origin.y, maxRadius, view)) {
      continue;
    }
    renderAttackEffect(ctx, effect);
  }
};

const renderEntities = (ctx: CanvasRenderingContext2D, state: GameState, view: ViewBounds) => {
  const ecs = state.ecs;
  const raftReady = isImageReady(raftImage);
  const pirateReady = isImageReady(pirateImage);
  const cutlassReady = isImageReady(cutlassImage);

  for (let index = 0; index < state.playerIds.length; index += 1) {
    const playerId = state.playerIds[index];
    if (!isEntityAlive(ecs, playerId)) {
      continue;
    }

    const x = ecs.position.x[playerId];
    const y = ecs.position.y[playerId];
    const radius = ecs.radius[playerId];
    if (!isCircleInView(x, y, radius, view)) {
      continue;
    }

    if (ecs.playerIsOnRaft[playerId] && raftReady) {
      const raftSize = radius * 3;
      const aspect = raftImage.naturalHeight > 0 ? raftImage.naturalWidth / raftImage.naturalHeight : 1;
      const raftWidth = raftSize * aspect;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ecs.playerMoveAngle[playerId]);
      ctx.drawImage(raftImage, -raftWidth / 2, -raftSize / 2, raftWidth, raftSize);
      ctx.restore();
    }

    if (cutlassReady && hasSelectedSword(state, playerId)) {
      const aimAngle = ecs.playerAimAngle[playerId];
      const attackElapsed = PLAYER_ATTACK_COOLDOWN - ecs.playerAttackTimer[playerId];
      const slashDuration = Math.min(ATTACK_EFFECT_DURATION, PLAYER_ATTACK_COOLDOWN);
      const slashT = slashDuration > 0 ? Math.max(0, Math.min(1, attackElapsed / slashDuration)) : 0;
      const slashAngle = slashT > 0 && slashT < 1 ? (slashT - 0.5) * CUTLASS_SLASH_ARC : 0;
      const aspect = cutlassImage.naturalHeight > 0 ? cutlassImage.naturalWidth / cutlassImage.naturalHeight : 1;
      const width = radius * CUTLASS_LENGTH_SCALE;
      const height = width / aspect;
      const pivotX = width * CUTLASS_PIVOT_X;
      const pivotY = height * CUTLASS_PIVOT_Y;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(aimAngle);
      ctx.translate(radius * CUTLASS_HAND_OFFSET_X, radius * CUTLASS_HAND_OFFSET_Y);
      ctx.rotate(CUTLASS_BASE_ROTATION + slashAngle);
      ctx.scale(1, -1);
      ctx.drawImage(cutlassImage, -pivotX, -pivotY, width, height);
      ctx.restore();
    }

    if (pirateReady) {
      const size = radius * 2.4;
      const pivotYOffset = size * PLAYER_PIVOT_Y;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ecs.playerAimAngle[playerId] - Math.PI / 2);
      ctx.drawImage(pirateImage, -size / 2, -size / 2 - pivotYOffset, size, size);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLOR;
      ctx.fill();
    }

    const label = playerNameLabels[index];
    if (label && index !== state.localPlayerIndex) {
      ctx.save();
      ctx.font = `${PLAYER_NAME_FONT_SIZE}px ${UI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelY = y - radius - PLAYER_NAME_OFFSET + PLAYER_NAME_LOWER_OFFSET + PLAYER_NAME_TEXT_OFFSET;
      const metrics = getLabelMetrics(ctx, label);
      const rectWidth = metrics.width + PLAYER_NAME_PADDING_X * 2;
      const rectHeight = metrics.height + PLAYER_NAME_PADDING_Y * 2;
      const rectX = x - rectWidth / 2;
      const rectY = labelY - rectHeight / 2;

      ctx.fillStyle = PLAYER_NAME_STROKE;
      drawRoundedRect(ctx, rectX, rectY, rectWidth, rectHeight, PLAYER_NAME_RADIUS);
      ctx.fill();

      ctx.fillStyle = PLAYER_NAME_COLOR;
      ctx.fillText(label, x, labelY);
      ctx.restore();
    }
  }
};

export const renderWorld = (ctx: CanvasRenderingContext2D, state: GameState) => {
  renderBackground(ctx);

  const { innerWidth, innerHeight } = window;
  const playerId = state.playerIds[state.localPlayerIndex];
  const ecs = state.ecs;
  const hasPlayer = isEntityAlive(ecs, playerId);
  const cameraX = hasPlayer ? ecs.position.x[playerId] : 0;
  const cameraY = hasPlayer ? ecs.position.y[playerId] : 0;
  const view = getViewBounds(cameraX, cameraY, innerWidth, innerHeight);

  ctx.save();
  ctx.translate(innerWidth / 2, innerHeight / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-cameraX, -cameraY);

  renderIslands(ctx, state, view);
  renderResources(ctx, state, view, "non-trees");
  renderProps(ctx, state, view);
  renderGroundItems(ctx, state, view);
  renderEnemies(ctx, state, view);
  renderEntities(ctx, state, view);
  renderResources(ctx, state, view, "bushes");
  renderResources(ctx, state, view, "trees");

  ctx.restore();
};







