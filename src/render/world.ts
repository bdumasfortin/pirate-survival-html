import type { GameState } from "../game/state";
import type { ResourceNodeType } from "../world/types";
import { CAMERA_ZOOM } from "./ui-config";
import { CRAB_HIT_FLASH_DURATION } from "../game/combat-config";
import { drawIsland, insetPoints } from "./render-helpers";
import { isImageReady, worldImages } from "./assets";

const SEA_GRADIENT_TOP = "#2c7a7b";
const SEA_GRADIENT_BOTTOM = "#0b2430";
const ISLAND_INSET_SCALE = 0.82;
const RESOURCE_IMAGE_SCALE = 1.4;
const BUSH_BARREN_COLOR = "#4a3a59";
const BUSH_BARREN_ALPHA = 0.5;
const ATTACK_EFFECT_COLOR = "rgba(255, 233, 180, 0.4)";
const PLAYER_COLOR = "#222222";
const DEFAULT_ENTITY_COLOR = "#f56565";

const nodeColors: Record<ResourceNodeType, string> = {
  tree: "#3f7d4a",
  rock: "#8f9399",
  bush: "#6f4aa8"
};

const enemyColors: Record<string, string> = {
  crab: "#d0674b"
};

const { crab: crabImage, pirate: pirateImage, bush: bushImage, palmtree: palmtreeImage, rock: rockImage, raft: raftImage } =
  worldImages;

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
    ctx.fillStyle = "#f6e7c1";
    drawIsland(ctx, island.points);

    const inner = insetPoints(island.points, island.center, ISLAND_INSET_SCALE);
    ctx.fillStyle = "#7dbb6a";
    drawIsland(ctx, inner);
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
    const isCrab = enemy.kind === "crab";
    const canDrawImage = isCrab && isImageReady(crabImage);

    if (canDrawImage) {
      const size = enemy.radius * 2;
      const velocity = (enemy as { velocity?: { x: number; y: number } }).velocity;
      const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0;
      const angle = velocity && speed > 0.01 ? Math.atan2(velocity.y, velocity.x) : 0;

      ctx.save();
      ctx.translate(enemy.position.x, enemy.position.y);
      ctx.rotate(angle);
      ctx.drawImage(crabImage, -size / 2, -size / 2, size, size);
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
  state.entities.forEach((entity) => {
    if (entity.tag === "player") {
      if (state.raft.isOnRaft && isImageReady(raftImage)) {
        const raftSize = entity.radius * 3;

        ctx.save();
        ctx.translate(entity.position.x, entity.position.y);
        ctx.rotate(state.moveAngle + Math.PI / 2);
        ctx.drawImage(raftImage, -raftSize / 2, -raftSize / 2, raftSize, raftSize);
        ctx.restore();
      }

      if (isImageReady(pirateImage)) {
        const size = entity.radius * 2.4;

        ctx.save();
        ctx.translate(entity.position.x, entity.position.y);
        ctx.rotate(state.aimAngle - Math.PI / 2);
        ctx.drawImage(pirateImage, -size / 2, -size / 2, size, size);
        ctx.restore();
        return;
      }
    }

    ctx.beginPath();
    ctx.arc(entity.position.x, entity.position.y, entity.radius, 0, Math.PI * 2);
    ctx.fillStyle = entity.tag === "player" ? PLAYER_COLOR : DEFAULT_ENTITY_COLOR;
    ctx.fill();
  });
};

export const renderWorld = (ctx: CanvasRenderingContext2D, state: GameState) => {
  renderBackground(ctx);

  const { innerWidth, innerHeight } = window;
  const player = state.entities.find((entity) => entity.id === state.playerId);
  const cameraX = player?.position.x ?? 0;
  const cameraY = player?.position.y ?? 0;

  ctx.save();
  ctx.translate(innerWidth / 2, innerHeight / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-cameraX, -cameraY);

  renderIslands(ctx, state);
  renderResources(ctx, state);
  renderEnemies(ctx, state);
  renderAttackEffect(ctx, state);
  renderEntities(ctx, state);

  ctx.restore();
};
