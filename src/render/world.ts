import type { GameState } from "../game/state";
import type { IslandType, ResourceNodeType } from "../world/types";
import { CAMERA_ZOOM } from "./ui-config";
import { GROUND_ITEM_RENDER_SIZE } from "../game/ground-items-config";
import { CRAB_HIT_FLASH_DURATION } from "../game/combat-config";
import { ComponentMask, EntityTag, forEachEntity, isEntityAlive } from "../core/ecs";
import { drawIsland, insetPoints } from "./render-helpers";
import { isImageReady, itemImages, worldImages } from "./assets";

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
const DEFAULT_ENTITY_COLOR = "#f56565";

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
  state.groundItems.forEach((item) => {
    const icon = getItemIcon(item.kind);
    if (icon) {
      ctx.drawImage(icon, item.position.x - size / 2, item.position.y - size / 2, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(item.position.x, item.position.y, size * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "#f0d58b";
      ctx.fill();
    }

    ctx.save();
    for (let i = 0; i < GROUND_ITEM_SPARKLE_COUNT; i += 1) {
      const angle = time * GROUND_ITEM_SPARKLE_SPEED + item.id * 0.7 + (i / GROUND_ITEM_SPARKLE_COUNT) * Math.PI * 2;
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.7);
      const orbit = GROUND_ITEM_SPARKLE_ORBIT + pulse * 2;
      const x = item.position.x + Math.cos(angle) * orbit;
      const y = item.position.y + Math.sin(angle) * orbit;

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
  state.world.resources.forEach((resource) => {
    const isBush = resource.nodeType === "bush";
    const isTree = resource.nodeType === "tree";
    const isRock = resource.nodeType === "rock";
    const barren = resource.remaining === 0;

    if (isBush && isImageReady(bushImage)) {
      const size = resource.radius * 2 * RESOURCE_IMAGE_SCALE;

      ctx.save();
      ctx.translate(resource.position.x, resource.position.y);
      ctx.rotate(resource.rotation);
      ctx.globalAlpha = barren ? BUSH_BARREN_ALPHA : 1;
      ctx.drawImage(bushImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (isTree && isImageReady(palmtreeImage)) {
      const size = resource.radius * 2 * RESOURCE_IMAGE_SCALE;

      ctx.save();
      ctx.translate(resource.position.x, resource.position.y);
      ctx.rotate(resource.rotation);
      ctx.drawImage(palmtreeImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (isRock && isImageReady(rockImage)) {
      const size = resource.radius * 2 * RESOURCE_IMAGE_SCALE;

      ctx.save();
      ctx.translate(resource.position.x, resource.position.y);
      ctx.rotate(resource.rotation);
      ctx.drawImage(rockImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    const color = resource.nodeType === "bush" && resource.remaining === 0 ? BUSH_BARREN_COLOR : nodeColors[resource.nodeType];
    ctx.beginPath();
    ctx.arc(resource.position.x, resource.position.y, resource.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
};

const renderEnemies = (ctx: CanvasRenderingContext2D, state: GameState) => {
  state.enemies.forEach((enemy) => {
    const flash = enemy.hitTimer > 0 ? enemy.hitTimer / CRAB_HIT_FLASH_DURATION : 0;
    const image = enemy.kind === "crab"
      ? crabImage
      : enemy.kind === "wolf"
        ? wolfImage
        : enemy.kind === "kraken"
          ? krakenImage
          : null;
    const canDrawImage = image ? isImageReady(image) : false;

    if (canDrawImage) {
      const size = enemy.radius * 2;
      const velocity = (enemy as { velocity?: { x: number; y: number } }).velocity;
      const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0;
      const angle = velocity && speed > 0.01 ? Math.atan2(velocity.y, velocity.x) : 0;
      const rotation = enemy.kind === "wolf"
        ? angle - Math.PI / 2
        : enemy.kind === "kraken"
          ? 0
          : angle;

      ctx.save();
      ctx.translate(enemy.position.x, enemy.position.y);
      ctx.rotate(rotation);
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      const baseColor = enemyColors[enemy.kind] ?? "#d0674b";
      const color = flash > 0 ? `rgba(255, 210, 130, ${flash})` : baseColor;
      ctx.beginPath();
      ctx.arc(enemy.position.x, enemy.position.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    if (flash > 0 && canDrawImage) {
      ctx.beginPath();
      ctx.arc(enemy.position.x, enemy.position.y, enemy.radius, 0, Math.PI * 2);
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
  const renderMask = ComponentMask.Position | ComponentMask.Radius | ComponentMask.Tag;

  forEachEntity(ecs, renderMask, (id) => {
    const tag = ecs.tag[id];
    const x = ecs.position.x[id];
    const y = ecs.position.y[id];
    const radius = ecs.radius[id];

    if (tag === EntityTag.Player) {
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
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = tag === EntityTag.Player ? PLAYER_COLOR : DEFAULT_ENTITY_COLOR;
    ctx.fill();
  });
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







