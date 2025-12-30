import type { GameState } from "../game/state";
import { CAMERA_ZOOM as CAMERA_ZOOM_VALUE } from "../game/config";
import type { ResourceKind, ResourceNodeType } from "../world/world";
import { findClosestIslandEdge } from "../world/island-geometry";
import { canCraft, recipes } from "../game/crafting";
import { getNearestGatherableResource } from "../systems/gathering";
import crabUrl from "../assets/svg/crab.svg";
import pirateUrl from "../assets/svg/pirate.svg";
import bushUrl from "../assets/svg/bush.svg";
import palmtreeUrl from "../assets/svg/palmtree.svg";
import rockUrl from "../assets/svg/rock.svg";
import raftUrl from "../assets/svg/raft.svg";
import itemWoodUrl from "../assets/svg/items/item-wood.svg";
import itemRockUrl from "../assets/svg/items/item-rock.svg";
import itemRaftUrl from "../assets/svg/items/item-raft.svg";
import redberryUrl from "../assets/svg/items/redberry.svg";
import sabreUrl from "../assets/svg/items/sabre.svg";

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

const crabImage = new Image();
crabImage.src = crabUrl;
let crabImageReady = false;
crabImage.onload = () => {
  crabImageReady = true;
};

const pirateImage = new Image();
pirateImage.src = pirateUrl;
let pirateImageReady = false;
pirateImage.onload = () => {
  pirateImageReady = true;
};

const bushImage = new Image();
bushImage.src = bushUrl;
let bushImageReady = false;
bushImage.onload = () => {
  bushImageReady = true;
};

const palmtreeImage = new Image();
palmtreeImage.src = palmtreeUrl;
let palmtreeImageReady = false;
palmtreeImage.onload = () => {
  palmtreeImageReady = true;
};

const rockImage = new Image();
rockImage.src = rockUrl;
let rockImageReady = false;
rockImage.onload = () => {
  rockImageReady = true;
};

const raftImage = new Image();
raftImage.src = raftUrl;
let raftImageReady = false;
raftImage.onload = () => {
  raftImageReady = true;
};

const itemWoodImage = new Image();
itemWoodImage.src = itemWoodUrl;
let itemWoodReady = false;
itemWoodImage.onload = () => {
  itemWoodReady = true;
};

const itemRockImage = new Image();
itemRockImage.src = itemRockUrl;
let itemRockReady = false;
itemRockImage.onload = () => {
  itemRockReady = true;
};

const itemRaftImage = new Image();
itemRaftImage.src = itemRaftUrl;
let itemRaftReady = false;
itemRaftImage.onload = () => {
  itemRaftReady = true;
};

const redberryImage = new Image();
redberryImage.src = redberryUrl;
let redberryReady = false;
redberryImage.onload = () => {
  redberryReady = true;
};

const sabreImage = new Image();
sabreImage.src = sabreUrl;
let sabreReady = false;
sabreImage.onload = () => {
  sabreReady = true;
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

const DAMAGE_FLASH_DURATION = 0.25;
const RAFT_PROMPT_DISTANCE = 18;

const CRAFT_TILE_SIZE = 72;
const CRAFT_TILE_GAP = 14;
const CRAFT_TILE_RADIUS = 14;
const CRAFT_PANEL_PADDING = 18;
const CRAFT_PANEL_RADIUS = 16;
const CRAFT_COLUMN_OFFSET = 180;

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
      const iconSize = INVENTORY_SLOT_SIZE * 0.6;
      let icon: HTMLImageElement | null = null;
      let ready = false;

      switch (slot.kind) {
        case "wood":
          icon = itemWoodImage;
          ready = itemWoodReady;
          break;
        case "rock":
          icon = itemRockImage;
          ready = itemRockReady;
          break;
        case "raft":
          icon = itemRaftImage;
          ready = itemRaftReady;
          break;
        case "berries":
          icon = redberryImage;
          ready = redberryReady;
          break;
        case "sword":
          icon = sabreImage;
          ready = sabreReady;
          break;
        default:
          break;
      }

      if (icon && ready) {
        ctx.drawImage(
          icon,
          x + (INVENTORY_SLOT_SIZE - iconSize) / 2,
          y + (INVENTORY_SLOT_SIZE - iconSize) / 2,
          iconSize,
          iconSize
        );
      } else {
        ctx.beginPath();
        ctx.arc(
          x + INVENTORY_SLOT_SIZE / 2,
          y + INVENTORY_SLOT_SIZE / 2,
          INVENTORY_SLOT_SIZE * 0.22,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = color;
        ctx.fill();
      }



      ctx.font = `bold 14px ${UI_FONT}`;
      ctx.fillStyle = "#f0d58b";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(slot.quantity), x + INVENTORY_SLOT_SIZE - 6, y + INVENTORY_SLOT_SIZE - 4);
    }
  });
};


const drawActionPrompt = (ctx: CanvasRenderingContext2D, text: string) => {
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
  const y = Math.max(24, inventoryTop - 14 - height - (BAR_HEIGHT + 50));

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
  drawActionPrompt(ctx, text);
};


const renderRaftPrompt = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (state.isDead || state.crafting.isOpen) {
    return false;
  }

  const player = state.entities.find((entity) => entity.id === state.playerId);
  if (!player) {
    return false;
  }

  const slot = state.inventory.slots[state.inventory.selectedIndex];
  if (!slot || slot.kind !== "raft" || slot.quantity <= 0) {
    return false;
  }

  const closest = findClosestIslandEdge(player.position, state.world.islands);
  if (!closest || closest.distance > RAFT_PROMPT_DISTANCE) {
    return false;
  }

  const text = state.raft.isOnRaft ? "LMB to disembark" : "LMB to board";
  drawActionPrompt(ctx, text);
  return true;
};

const renderSurvivalBars = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const { innerWidth, innerHeight } = window;
  const stats = state.survival;
  const inventoryWidth = state.inventory.slots.length * INVENTORY_SLOT_SIZE +
    (state.inventory.slots.length - 1) * INVENTORY_SLOT_GAP;
  const startX = (innerWidth - inventoryWidth) / 2;
  const inventoryTop = innerHeight - INVENTORY_BAR_PADDING - INVENTORY_SLOT_SIZE - INVENTORY_BAR_MARGIN;
  const y = Math.max(HUD_MARGIN, inventoryTop - BAR_HEIGHT - 18);
  const healthX = startX;
  const hungerX = startX + inventoryWidth - BAR_WIDTH;

  const drawBar = (x: number, value: number, max: number, color: string) => {
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
  };

  drawBar(healthX, stats.health, stats.maxHealth, "#e2534b");
  drawBar(hungerX, stats.hunger, stats.maxHunger, "#d9a441");
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
  const { innerWidth, innerHeight } = window;
  const lines = [
    "Q to drop item",
    "C to open crafting menu"
  ];
  const fontSize = 14;
  const lineHeight = fontSize + 6;
  const paddingX = 12;
  const paddingY = 8;

  ctx.save();
  ctx.font = `${fontSize}px ${UI_FONT}`;
  const maxWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, ctx.measureText(line).width), 0);
  const boxWidth = maxWidth + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const textX = innerWidth - HUD_MARGIN - maxWidth;
  const boxX = textX - paddingX;
  const boxY = innerHeight - HUD_MARGIN - boxHeight + paddingY;

  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "rgba(12, 22, 26, 0.6)";
  drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 10);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(246, 231, 193, 0.8)";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  let y = boxY + boxHeight - paddingY;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    ctx.fillText(lines[i], textX, y);
    y -= lineHeight;
  }

  ctx.restore();
};

const renderDamageFlash = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (state.isDead || state.damageFlashTimer <= 0) {
    return;
  }

  const { innerWidth, innerHeight } = window;
  const alpha = state.damageFlashTimer / DAMAGE_FLASH_DURATION;

  ctx.save();
  ctx.fillStyle = `rgba(180, 30, 30, ${0.35 * alpha})`;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.restore();
};

const renderDeathOverlay = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (!state.isDead) {
    return;
  }

  const { innerWidth, innerHeight } = window;
  ctx.save();
  ctx.fillStyle = "rgba(8, 10, 12, 0.72)";
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  ctx.fillStyle = "#f6e7c1";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `48px ${UI_FONT}`;
  ctx.fillText("You Died", innerWidth / 2, innerHeight / 2);

  ctx.font = `18px ${UI_FONT}`;
  ctx.fillStyle = "rgba(246, 231, 193, 0.85)";
  ctx.fillText("F5 to restart", innerWidth / 2, innerHeight / 2 + 46);
  ctx.restore();
};
const renderCraftingMenu = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (!state.crafting.isOpen) {
    return;
  }

  if (recipes.length === 0) {
    return;
  }

  const { innerWidth, innerHeight } = window;
  const columnCenterX = innerWidth / 2 + CRAFT_COLUMN_OFFSET;
  const columnX = columnCenterX - CRAFT_TILE_SIZE / 2;
  const totalHeight = recipes.length * CRAFT_TILE_SIZE + (recipes.length - 1) * CRAFT_TILE_GAP;
  const startY = (innerHeight - totalHeight) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgba(12, 22, 26, 0.65)";
  drawRoundedRect(
    ctx,
    columnX - CRAFT_PANEL_PADDING,
    startY - CRAFT_PANEL_PADDING,
    CRAFT_TILE_SIZE + CRAFT_PANEL_PADDING * 2,
    totalHeight + CRAFT_PANEL_PADDING * 2,
    CRAFT_PANEL_RADIUS
  );
  ctx.fill();
  ctx.restore();

  let selectedRecipe: typeof recipes[number] | null = null;
  let selectedY = startY;

  recipes.forEach((recipe, index) => {
    const x = columnX;
    const y = startY + index * (CRAFT_TILE_SIZE + CRAFT_TILE_GAP);
    const selected = index === state.crafting.selectedIndex;
    const craftable = canCraft(state.inventory, recipe);

    if (selected) {
      selectedRecipe = recipe;
      selectedY = y;
    }

    ctx.save();
    ctx.fillStyle = "rgba(20, 32, 38, 0.9)";
    ctx.strokeStyle = selected ? "#f0d58b" : "#5f6b6d";
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 6;
    drawRoundedRect(ctx, x, y, CRAFT_TILE_SIZE, CRAFT_TILE_SIZE, CRAFT_TILE_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const iconSize = CRAFT_TILE_SIZE * 0.65;
    let icon: HTMLImageElement | null = null;
    let ready = false;

    switch (recipe.output.kind) {
      case "wood":
        icon = itemWoodImage;
        ready = itemWoodReady;
        break;
      case "rock":
        icon = itemRockImage;
        ready = itemRockReady;
        break;
      case "raft":
        icon = itemRaftImage;
        ready = itemRaftReady;
        break;
      case "berries":
        icon = redberryImage;
        ready = redberryReady;
        break;
      case "sword":
        icon = sabreImage;
        ready = sabreReady;
        break;
      default:
        break;
    }

    const alpha = craftable ? 1 : 0.4;
    if (icon && ready) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        icon,
        x + (CRAFT_TILE_SIZE - iconSize) / 2,
        y + (CRAFT_TILE_SIZE - iconSize) / 2,
        iconSize,
        iconSize
      );
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x + CRAFT_TILE_SIZE / 2, y + CRAFT_TILE_SIZE / 2, CRAFT_TILE_SIZE * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = resourceColors[recipe.output.kind];
      ctx.fill();
      ctx.restore();
    }
  });

  if (selectedRecipe && selectedRecipe.inputs.length > 0) {
    const ingredientIconSize = 16;
    const ingredientGap = 6;
    const listPadding = 10;
    const rowHeight = 22;
    const listX = columnX + CRAFT_TILE_SIZE + CRAFT_PANEL_PADDING + 12;

    ctx.save();
    ctx.font = `bold 12px ${UI_FONT}`;
    const maxRowWidth = selectedRecipe.inputs.reduce((maxWidth, input) => {
      const amountText = `x${input.amount}`;
      const textWidth = ctx.measureText(amountText).width;
      return Math.max(maxWidth, ingredientIconSize + 6 + textWidth);
    }, 0);

    const listWidth = maxRowWidth + listPadding * 2;
    const listHeight = selectedRecipe.inputs.length * rowHeight + listPadding * 2;
    const listY = selectedY + (CRAFT_TILE_SIZE - listHeight) / 2;

    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(12, 22, 26, 0.65)";
    drawRoundedRect(ctx, listX, listY, listWidth, listHeight, 12);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f0d58b";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    selectedRecipe.inputs.forEach((input, index) => {
      const rowY = listY + listPadding + index * rowHeight + rowHeight / 2;
      const iconX = listX + listPadding;
      const iconY = rowY - ingredientIconSize / 2;
      let ingredientIcon: HTMLImageElement | null = null;
      let ingredientReady = false;

      switch (input.kind) {
        case "wood":
          ingredientIcon = itemWoodImage;
          ingredientReady = itemWoodReady;
          break;
        case "rock":
          ingredientIcon = itemRockImage;
          ingredientReady = itemRockReady;
          break;
        case "raft":
          ingredientIcon = itemRaftImage;
          ingredientReady = itemRaftReady;
          break;
        case "berries":
          ingredientIcon = redberryImage;
          ingredientReady = redberryReady;
          break;
        case "sword":
          ingredientIcon = sabreImage;
          ingredientReady = sabreReady;
          break;
        default:
          break;
      }

      if (ingredientIcon && ingredientReady) {
        ctx.drawImage(ingredientIcon, iconX, iconY, ingredientIconSize, ingredientIconSize);
      } else {
        ctx.beginPath();
        ctx.arc(
          iconX + ingredientIconSize / 2,
          iconY + ingredientIconSize / 2,
          ingredientIconSize * 0.4,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = resourceColors[input.kind];
        ctx.fill();
        ctx.fillStyle = "#f0d58b";
      }

      const amountText = `x ${input.amount}`;
      ctx.fillText(amountText, iconX + ingredientIconSize + 6, rowY);
    });

    ctx.restore();
  }
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
    const isBush = resource.nodeType === "bush";
    const isTree = resource.nodeType === "tree";
    const isRock = resource.nodeType === "rock";
    const barren = resource.remaining === 0;

    if (isBush && bushImageReady) {
      const size = resource.radius * 2 * 1.4;

      ctx.save();
      ctx.translate(resource.position.x, resource.position.y);
      ctx.rotate(resource.rotation);
      ctx.globalAlpha = barren ? 0.5 : 1;
      ctx.drawImage(bushImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (isTree && palmtreeImageReady) {
      const size = resource.radius * 2 * 1.4;

      ctx.save();
      ctx.translate(resource.position.x, resource.position.y);
      ctx.rotate(resource.rotation);
      ctx.drawImage(palmtreeImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

    if (isRock && rockImageReady) {
      const size = resource.radius * 2 * 1.4;

      ctx.save();
      ctx.translate(resource.position.x, resource.position.y);
      ctx.rotate(resource.rotation);
      ctx.drawImage(rockImage, -size / 2, -size / 2, size, size);
      ctx.restore();
      return;
    }

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
    const isCrab = enemy.kind === "crab";
    const canDrawImage = isCrab && crabImageReady;

    if (canDrawImage) {
      const size = enemy.radius * 2;
      const velocity = (enemy as { velocity?: { x: number; y: number } }).velocity;
      const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0;
      const angle = speed > 0.01 ? Math.atan2(velocity.y, velocity.x) : 0;

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

  renderAttackEffect(ctx, state);

  state.entities.forEach((entity) => {
    if (entity.tag === "player") {
      if (state.raft.isOnRaft && raftImageReady) {
        const raftSize = entity.radius * 3;

        ctx.save();
        ctx.translate(entity.position.x, entity.position.y);
        ctx.rotate(state.moveAngle + Math.PI / 2);
        ctx.drawImage(raftImage, -raftSize / 2, -raftSize / 2, raftSize, raftSize);
        ctx.restore();
      }

      if (pirateImageReady) {
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
    ctx.fillStyle = entity.tag === "player" ? "#222222" : "#f56565";
    ctx.fill();
  });

  ctx.restore();

  renderSurvivalBars(ctx, state);
  renderCraftingMenu(ctx, state);
  const raftPrompted = renderRaftPrompt(ctx, state);
  if (!raftPrompted) {
    renderInteractionPrompt(ctx, state);
  }
  renderInventory(ctx, state);
  renderHints(ctx);
  renderDamageFlash(ctx, state);
  renderDeathOverlay(ctx, state);
};


