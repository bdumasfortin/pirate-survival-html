import type { GameState } from "../game/state";
import type { IslandType, ResourceNodeType } from "../world/types";
import { CAMERA_ZOOM } from "./ui-config";
import { GROUND_ITEM_RENDER_SIZE } from "../game/ground-items-config";
import { CRAB_HIT_FLASH_DURATION } from "../game/combat-config";
import { ComponentMask, forEachEntity, isEntityAlive } from "../core/ecs";
import { enemyKindFromIndex } from "../game/enemy-kinds";
import { GROUND_ITEM_MASK } from "../game/ground-items";
import { drawIsland, insetPoints } from "./render-helpers";
import { isImageReady, itemImages, worldImages } from "./assets";
import { resourceKindFromIndex, resourceNodeTypeFromIndex } from "../world/resource-kinds";

const SEA_GRADIENT_TOP = "#2c7a7b";
const SEA_GRADIENT_BOTTOM = "#0b2430";
const ISLAND_INSET_SCALE = 0.82;
const RESOURCE_IMAGE_SCALE = 1.4;
const BUSH_BARREN_COLOR = "#4a3a59";
const BUSH_BARREN_ALPHA = 0.5;
const GROUND_ITEM_GLOW_COLOR = "#ffffff";
const GROUND_ITEM_SPARKLE_COUNT = 5;
const GROUND_ITEM_SPARKLE_RADIUS = 1.4;
const GROUND_ITEM_SPARKLE_ORBIT = 10;
const GROUND_ITEM_SPARKLE_SPEED = 1.8;
const ATTACK_EFFECT_COLOR = "rgba(255, 233, 180, 0.4)";
const PLAYER_COLOR = "#222222";

const islandStyles: Record<IslandType, { sand: string; grass?: string }> = {
  standard: { sand: "#f6e7c1", grass: "#7dbb6a" },
  forest: { sand: "#f6e7c1", grass: "#4b7a74" },
  wolfBoss: { sand: "#f6e7c1", grass: "#4b7a74" },
  beach: { sand: "#f6e7c1" }
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

const { crab: crabImage, wolf: wolfImage, kraken: krakenImage, pirate: pirateImage, bush: bushImage, palmtree: palmtreeImage, rock: rockImage, raft: raftImage } =
  worldImages;

const getItemIcon = (kind: keyof typeof itemImages) => {
  const image = itemImages[kind];
  return isImageReady(image) ? image : null;
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

const renderIslands = (ctx: CanvasRenderingContext2D, state: GameState) => {
  state.world.islands.forEach((island) => {
    const style = islandStyles[island.type] ?? islandStyles.standard;
    ctx.fillStyle = style.sand;
    drawIsland(ctx, island.points);

    if (style.grass) {
      const inner = insetPoints(island.points, island.center, ISLAND_INSET_SCALE);
      ctx.fillStyle = style.grass;
      drawIsland(ctx, inner);
    }
  });
};

const renderGroundItems = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const size = GROUND_ITEM_RENDER_SIZE;
  const time = state.time;
  const ecs = state.ecs;
  forEachEntity(ecs, GROUND_ITEM_MASK, (id) => {
    const kind = resourceKindFromIndex(ecs.groundItemKind[id]);
    const icon = getItemIcon(kind);
    if (icon) {
      ctx.drawImage(icon, ecs.position.x[id] - size / 2, ecs.position.y[id] - size / 2, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(ecs.position.x[id], ecs.position.y[id], size * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "#f0d58b";
      ctx.fill();
    }

    ctx.save();
    for (let i = 0; i < GROUND_ITEM_SPARKLE_COUNT; i += 1) {
      const angle = time * GROUND_ITEM_SPARKLE_SPEED + id * 0.7 + (i / GROUND_ITEM_SPARKLE_COUNT) * Math.PI * 2;
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.7);
      const orbit = GROUND_ITEM_SPARKLE_ORBIT + pulse * 2;
      const x = ecs.position.x[id] + Math.cos(angle) * orbit;
      const y = ecs.position.y[id] + Math.sin(angle) * orbit;

      ctx.globalAlpha = 0.3 + pulse * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, GROUND_ITEM_SPARKLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = GROUND_ITEM_GLOW_COLOR;
      ctx.fill();
    }
    ctx.restore();
  });
};

const renderResources = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const ecs = state.ecs;
  const resourceMask = ComponentMask.Resource | ComponentMask.Position | ComponentMask.Radius;
  forEachEntity(ecs, resourceMask, (id) => {
    const nodeType = resourceNodeTypeFromIndex(ecs.resourceNodeType[id]);
    const isBush = nodeType === "bush";
    const isTree = nodeType === "tree";
    const isRock = nodeType === "rock";
    const barren = ecs.resourceRemaining[id] === 0;

    if (isBush && isImageReady(bushImage)) {
      const size = ecs.radius[id] * 2 * RESOURCE_IMAGE_SCALE;

      ctx.save();
      ctx.translate(ecs.position.x[id], ecs.position.y[id]);
      ctx.rotate(ecs.resourceRotation[id]);
      ctx.globalAlpha = barren ? BUSH_BARREN_ALPHA : 1;
      ctx.drawImage(bushImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (isTree && isImageReady(palmtreeImage)) {
      const size = ecs.radius[id] * 2 * RESOURCE_IMAGE_SCALE;

      ctx.save();
      ctx.translate(ecs.position.x[id], ecs.position.y[id]);
      ctx.rotate(ecs.resourceRotation[id]);
      ctx.drawImage(palmtreeImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (isRock && isImageReady(rockImage)) {
      const size = ecs.radius[id] * 2 * RESOURCE_IMAGE_SCALE;

      ctx.save();
      ctx.translate(ecs.position.x[id], ecs.position.y[id]);
      ctx.rotate(ecs.resourceRotation[id]);
      ctx.drawImage(rockImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    const color = nodeType === "bush" && barren ? BUSH_BARREN_COLOR : nodeColors[nodeType];
    ctx.beginPath();
    ctx.arc(ecs.position.x[id], ecs.position.y[id], ecs.radius[id], 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
};

const renderEnemies = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const ecs = state.ecs;
  const enemyMask = ComponentMask.Enemy | ComponentMask.Position | ComponentMask.Radius | ComponentMask.Velocity;
  forEachEntity(ecs, enemyMask, (id) => {
    const kind = enemyKindFromIndex(ecs.enemyKind[id]);
    const flash = ecs.enemyHitTimer[id] > 0 ? ecs.enemyHitTimer[id] / CRAB_HIT_FLASH_DURATION : 0;
    const image = kind === "crab"
      ? crabImage
      : kind === "wolf"
        ? wolfImage
        : kind === "kraken"
          ? krakenImage
          : null;
    const canDrawImage = image ? isImageReady(image) : false;

    if (canDrawImage) {
      const size = ecs.radius[id] * 2;
      const velX = ecs.velocity.x[id];
      const velY = ecs.velocity.y[id];
      const speed = Math.hypot(velX, velY);
      const angle = speed > 0.01 ? Math.atan2(velY, velX) : 0;
      const rotation = kind === "wolf"
        ? angle - Math.PI / 2
        : kind === "kraken"
          ? 0
          : angle;

      ctx.save();
      ctx.translate(ecs.position.x[id], ecs.position.y[id]);
      ctx.rotate(rotation);
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      const baseColor = enemyColors[kind] ?? "#d0674b";
      const color = flash > 0 ? `rgba(255, 210, 130, ${flash})` : baseColor;
      ctx.beginPath();
      ctx.arc(ecs.position.x[id], ecs.position.y[id], ecs.radius[id], 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    if (flash > 0 && canDrawImage) {
      ctx.beginPath();
      ctx.arc(ecs.position.x[id], ecs.position.y[id], ecs.radius[id], 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 210, 130, ${flash})`;
      ctx.fill();
    }
  });
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
  ctx.fillStyle = ATTACK_EFFECT_COLOR;
  ctx.beginPath();
  ctx.moveTo(effect.origin.x, effect.origin.y);
  ctx.arc(effect.origin.x, effect.origin.y, radius, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const renderEntities = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const ecs = state.ecs;
  const playerId = state.playerId;
  if (!isEntityAlive(ecs, playerId)) {
    return;
  }

  const x = ecs.position.x[playerId];
  const y = ecs.position.y[playerId];
  const radius = ecs.radius[playerId];

  if (state.raft.isOnRaft && isImageReady(raftImage)) {
    const raftSize = radius * 3;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state.moveAngle + Math.PI / 2);
    ctx.drawImage(raftImage, -raftSize / 2, -raftSize / 2, raftSize, raftSize);
    ctx.restore();
  }

  if (isImageReady(pirateImage)) {
    const size = radius * 2.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state.aimAngle - Math.PI / 2);
    ctx.drawImage(pirateImage, -size / 2, -size / 2, size, size);
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = PLAYER_COLOR;
  ctx.fill();
};

export const renderWorld = (ctx: CanvasRenderingContext2D, state: GameState) => {
  renderBackground(ctx);

  const { innerWidth, innerHeight } = window;
  const playerId = state.playerId;
  const ecs = state.ecs;
  const hasPlayer = isEntityAlive(ecs, playerId);
  const cameraX = hasPlayer ? ecs.position.x[playerId] : 0;
  const cameraY = hasPlayer ? ecs.position.y[playerId] : 0;

  ctx.save();
  ctx.translate(innerWidth / 2, innerHeight / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-cameraX, -cameraY);

  renderIslands(ctx, state);
  renderResources(ctx, state);
  renderGroundItems(ctx, state);
  renderEnemies(ctx, state);
  renderAttackEffect(ctx, state);
  renderEntities(ctx, state);

  ctx.restore();
};







