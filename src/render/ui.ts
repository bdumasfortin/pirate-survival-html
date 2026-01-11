import { ComponentMask, EntityTag, forEachEntity, INVENTORY_SLOT_COUNT, isEntityAlive } from "../core/ecs";
import { DAMAGE_FLASH_DURATION } from "../game/combat-config";
import type { Recipe } from "../game/crafting";
import { canCraft, recipes } from "../game/crafting";
import { getDayCycleInfo } from "../game/day-night";
import { EQUIPMENT_SLOT_ORDER, type EquipmentSlotType, getEquipmentSlotKind } from "../game/equipment";
import { getInventorySelectedIndex, getInventorySlotKind, getInventorySlotQuantity } from "../game/inventory";
import type { ItemKind } from "../game/item-kinds";
import { getMapLayout, getWorldBounds, isMapOverlayEnabled } from "../game/map-overlay";
import { propKindFromIndex } from "../game/prop-kinds";
import { RAFT_INTERACTION_DISTANCE } from "../game/raft-config";
import type { GameState } from "../game/state";
import { getStructurePreviewRadius } from "../game/structure-items";
import { getNearestGatherableResource } from "../systems/gathering";
import { findClosestIslandEdge, findContainingIsland } from "../world/island-geometry";
import { resourceNodeTypeFromIndex } from "../world/resource-node-types";
import type { BiomeTierConfig, ResourceNodeType } from "../world/types";
import { equipmentPlaceholderImages, isImageReady, itemImages } from "./assets";
import { getCraftingLayout } from "./crafting-layout";
import { drawRoundedRect } from "./render-helpers";
import {
  ACTION_PROMPT_FONT_SIZE,
  ACTION_PROMPT_PADDING_X,
  ACTION_PROMPT_PADDING_Y,
  BAR_HEIGHT,
  BAR_WIDTH,
  CRAFT_BUTTON_RADIUS,
  CRAFT_INGREDIENT_ROW_HEIGHT,
  CRAFT_PANEL_PADDING,
  CRAFT_PANEL_RADIUS,
  CRAFT_TILE_GAP,
  CRAFT_TILE_RADIUS,
  CRAFT_TILE_SIZE,
  EQUIPMENT_GRID_COLUMNS,
  EQUIPMENT_GRID_ROWS,
  EQUIPMENT_SLOT_GAP,
  EQUIPMENT_SLOT_RADIUS,
  EQUIPMENT_SLOT_SIZE,
  HUD_MARGIN,
  INVENTORY_BAR_MARGIN,
  INVENTORY_BAR_PADDING,
  INVENTORY_CORNER_RADIUS,
  INVENTORY_SLOT_GAP,
  INVENTORY_SLOT_SIZE,
  UI_FONT,
} from "./ui-config";

const itemColors: Record<ItemKind, string> = {
  wood: "#a06a3b",
  rock: "#9aa0a6",
  berries: "#8b4fd6",
  raft: "#caa05a",
  sword: "#c7c9cc",
  crabmeat: "#c66a4b",
  wolfmeat: "#b96c54",
  crabhelmet: "#6f87b7",
  wolfcloak: "#7d6d4f",
  krakenring: "#5aa1c9",
};

const promptLabels: Record<ResourceNodeType, string> = {
  tree: "E to chop",
  rock: "E to pick up",
  bush: "E to collect",
};

const ARMOR_BAR_GAP = 16;
const INVENTORY_KEYBIND_FONT_SIZE = 10;
const INVENTORY_KEYBIND_COLOR = "rgba(246, 231, 193, 0.75)";

const buildVersionLabel = `v${__APP_VERSION__}${import.meta.env.DEV ? "-dev" : ""}`;

let activeSeedLabel = "Seed: --";
let activeRoomCodeLabel: string | null = null;
let debugOverlayEnabled = false;
let debugFps = 0;
let debugFrames = 0;
let debugLastSample = performance.now();

export const toggleDebugOverlay = () => {
  debugOverlayEnabled = !debugOverlayEnabled;
};

export const setDebugOverlayEnabled = (enabled: boolean) => {
  debugOverlayEnabled = enabled;
};

export const setHudSeed = (seed: string) => {
  activeSeedLabel = `Seed: ${seed}`;
};

export const setHudRoomCode = (code: string | null) => {
  activeRoomCodeLabel = code ? `Room: ${code}` : null;
};

const getLocalPlayerId = (state: GameState) => state.playerIds[state.localPlayerIndex];

const getItemIcon = (kind: ItemKind) => {
  const image = itemImages[kind];
  return isImageReady(image) ? image : null;
};

const getPlaceholderIcon = (slot: EquipmentSlotType) => {
  const image = equipmentPlaceholderImages[slot];
  return isImageReady(image) ? image : null;
};

const renderInventory = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const { innerWidth, innerHeight } = window;
  const playerId = getLocalPlayerId(state);
  const ecs = state.ecs;
  if (playerId === undefined || !isEntityAlive(ecs, playerId)) {
    return;
  }

  const totalWidth = INVENTORY_SLOT_COUNT * INVENTORY_SLOT_SIZE + (INVENTORY_SLOT_COUNT - 1) * INVENTORY_SLOT_GAP;
  const startX = (innerWidth - totalWidth) / 2;
  const startY = innerHeight - INVENTORY_BAR_PADDING - INVENTORY_SLOT_SIZE;
  const selectedIndex = getInventorySelectedIndex(ecs, playerId);

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

  for (let index = 0; index < INVENTORY_SLOT_COUNT; index += 1) {
    const x = startX + index * (INVENTORY_SLOT_SIZE + INVENTORY_SLOT_GAP);
    const y = startY;

    ctx.save();
    ctx.fillStyle = "rgba(20, 32, 38, 0.85)";
    ctx.strokeStyle = index === selectedIndex ? "#f0d58b" : "#5f6b6d";
    ctx.lineWidth = index === selectedIndex ? 2.5 : 1.5;
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 6;
    drawRoundedRect(ctx, x, y, INVENTORY_SLOT_SIZE, INVENTORY_SLOT_SIZE, INVENTORY_CORNER_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = `bold ${INVENTORY_KEYBIND_FONT_SIZE}px ${UI_FONT}`;
    ctx.fillStyle = INVENTORY_KEYBIND_COLOR;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(index + 1), x + 6, y + 5);
    ctx.restore();

    const slotKind = getInventorySlotKind(ecs, playerId, index);
    const slotQuantity = getInventorySlotQuantity(ecs, playerId, index);
    if (slotKind && slotQuantity > 0) {
      const color = itemColors[slotKind];
      const iconSize = INVENTORY_SLOT_SIZE * 0.6;
      const icon = getItemIcon(slotKind);

      if (icon) {
        ctx.drawImage(
          icon,
          x + (INVENTORY_SLOT_SIZE - iconSize) / 2,
          y + (INVENTORY_SLOT_SIZE - iconSize) / 2,
          iconSize,
          iconSize
        );
      } else {
        ctx.beginPath();
        ctx.arc(x + INVENTORY_SLOT_SIZE / 2, y + INVENTORY_SLOT_SIZE / 2, INVENTORY_SLOT_SIZE * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      ctx.font = `bold 14px ${UI_FONT}`;
      ctx.fillStyle = "#f0d58b";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(slotQuantity), x + INVENTORY_SLOT_SIZE - 6, y + INVENTORY_SLOT_SIZE - 4);
    }
  }
};

const renderEquipment = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const { innerHeight } = window;
  const totalWidth = EQUIPMENT_GRID_COLUMNS * EQUIPMENT_SLOT_SIZE + (EQUIPMENT_GRID_COLUMNS - 1) * EQUIPMENT_SLOT_GAP;
  const totalHeight = EQUIPMENT_GRID_ROWS * EQUIPMENT_SLOT_SIZE + (EQUIPMENT_GRID_ROWS - 1) * EQUIPMENT_SLOT_GAP;
  const startX = HUD_MARGIN;
  const startY = innerHeight - HUD_MARGIN - totalHeight;
  const playerId = getLocalPlayerId(state);
  const ecs = state.ecs;

  if (playerId === undefined || !isEntityAlive(ecs, playerId)) {
    return;
  }

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(12, 22, 26, 0.6)";
  drawRoundedRect(ctx, startX - 12, startY - 12, totalWidth + 24, totalHeight + 24, 14);
  ctx.fill();
  ctx.restore();

  EQUIPMENT_SLOT_ORDER.forEach((slotType, index) => {
    const column = index % EQUIPMENT_GRID_COLUMNS;
    const row = Math.floor(index / EQUIPMENT_GRID_COLUMNS);
    const x = startX + column * (EQUIPMENT_SLOT_SIZE + EQUIPMENT_SLOT_GAP);
    const y = startY + row * (EQUIPMENT_SLOT_SIZE + EQUIPMENT_SLOT_GAP);
    const equipped = getEquipmentSlotKind(ecs, playerId, slotType);

    ctx.save();
    ctx.fillStyle = "rgba(20, 32, 38, 0.85)";
    ctx.strokeStyle = "#5f6b6d";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 5;
    drawRoundedRect(ctx, x, y, EQUIPMENT_SLOT_SIZE, EQUIPMENT_SLOT_SIZE, EQUIPMENT_SLOT_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const iconSize = EQUIPMENT_SLOT_SIZE * 0.6;
    if (equipped) {
      const icon = getItemIcon(equipped);
      if (icon) {
        ctx.drawImage(
          icon,
          x + (EQUIPMENT_SLOT_SIZE - iconSize) / 2,
          y + (EQUIPMENT_SLOT_SIZE - iconSize) / 2,
          iconSize,
          iconSize
        );
      } else {
        ctx.beginPath();
        ctx.arc(x + EQUIPMENT_SLOT_SIZE / 2, y + EQUIPMENT_SLOT_SIZE / 2, EQUIPMENT_SLOT_SIZE * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = itemColors[equipped] ?? "#f0d58b";
        ctx.fill();
      }
      return;
    }

    const placeholder = getPlaceholderIcon(slotType);
    if (placeholder) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(
        placeholder,
        x + (EQUIPMENT_SLOT_SIZE - iconSize) / 2,
        y + (EQUIPMENT_SLOT_SIZE - iconSize) / 2,
        iconSize,
        iconSize
      );
      ctx.restore();
    }
  });
};

const drawActionPrompt = (ctx: CanvasRenderingContext2D, text: string, barStackHeight = BAR_HEIGHT) => {
  const { innerWidth, innerHeight } = window;
  const fontSize = ACTION_PROMPT_FONT_SIZE;
  const paddingX = ACTION_PROMPT_PADDING_X;
  const paddingY = ACTION_PROMPT_PADDING_Y;

  ctx.save();
  ctx.font = `${fontSize}px ${UI_FONT}`;
  const textWidth = ctx.measureText(text).width;
  const width = textWidth + paddingX * 2;
  const height = fontSize + paddingY * 2;
  const inventoryTop = innerHeight - INVENTORY_BAR_PADDING - INVENTORY_SLOT_SIZE - INVENTORY_BAR_MARGIN;
  const x = (innerWidth - width) / 2;
  const y = Math.max(24, inventoryTop - 14 - height - (barStackHeight + 50));

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

const getBarStackHeight = (state: GameState, playerId: number) => {
  const armorVisible = state.ecs.playerMaxArmor[playerId] > 0;
  return BAR_HEIGHT + (armorVisible ? BAR_HEIGHT + ARMOR_BAR_GAP : 0);
};

const renderInteractionPrompt = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const playerId = getLocalPlayerId(state);
  const ecs = state.ecs;
  if (playerId === undefined || !isEntityAlive(ecs, playerId)) {
    return;
  }

  const position = { x: ecs.position.x[playerId], y: ecs.position.y[playerId] };
  const radius = ecs.radius[playerId];
  const targetId = getNearestGatherableResource(ecs, position, radius);
  if (targetId === null) {
    return;
  }

  const nodeType = resourceNodeTypeFromIndex(ecs.resourceNodeType[targetId]);
  const text = promptLabels[nodeType];
  const barStackHeight = getBarStackHeight(state, playerId);
  drawActionPrompt(ctx, text, barStackHeight);
};

const findNearestRaft = (state: GameState, x: number, y: number) => {
  const ecs = state.ecs;
  const propMask = ComponentMask.Prop | ComponentMask.Position;
  let closestDistance = Number.POSITIVE_INFINITY;
  let closestId: number | null = null;

  forEachEntity(ecs, propMask, (id) => {
    if (propKindFromIndex(ecs.propKind[id]) !== "raft") {
      return;
    }
    const dx = x - ecs.position.x[id];
    const dy = y - ecs.position.y[id];
    const distance = Math.hypot(dx, dy);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestId = id;
    }
  });

  return closestId !== null ? { id: closestId, distance: closestDistance } : null;
};

const renderRaftPrompt = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const playerId = getLocalPlayerId(state);
  const ecs = state.ecs;
  const crafting = state.crafting[state.localPlayerIndex];

  if (playerId === undefined || !isEntityAlive(ecs, playerId)) {
    return false;
  }

  if (ecs.playerIsDead[playerId] || crafting?.isOpen) {
    return false;
  }

  const position = { x: ecs.position.x[playerId], y: ecs.position.y[playerId] };
  if (ecs.playerIsOnRaft[playerId]) {
    const closest = findClosestIslandEdge(position, state.world.islands);
    if (!closest || closest.distance > RAFT_INTERACTION_DISTANCE) {
      return false;
    }

    const text = "E to disembark";
    const barStackHeight = getBarStackHeight(state, playerId);
    drawActionPrompt(ctx, text, barStackHeight);
    return true;
  }

  const nearest = findNearestRaft(state, position.x, position.y);
  if (!nearest) {
    return false;
  }
  const raftRadius = ecs.radius[nearest.id] || getStructurePreviewRadius("raft");
  if (nearest.distance > raftRadius + RAFT_INTERACTION_DISTANCE) {
    return false;
  }

  const text = "E to board";
  const barStackHeight = getBarStackHeight(state, playerId);
  drawActionPrompt(ctx, text, barStackHeight);
  return true;
};

const renderSurvivalBars = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const { innerWidth, innerHeight } = window;
  const playerId = getLocalPlayerId(state);
  const ecs = state.ecs;
  if (playerId === undefined || !isEntityAlive(ecs, playerId)) {
    return;
  }
  const inventoryWidth = INVENTORY_SLOT_COUNT * INVENTORY_SLOT_SIZE + (INVENTORY_SLOT_COUNT - 1) * INVENTORY_SLOT_GAP;
  const startX = (innerWidth - inventoryWidth) / 2;
  const inventoryTop = innerHeight - INVENTORY_BAR_PADDING - INVENTORY_SLOT_SIZE - INVENTORY_BAR_MARGIN;
  const y = Math.max(HUD_MARGIN, inventoryTop - BAR_HEIGHT - 18);
  const healthX = startX;
  const hungerX = startX + inventoryWidth - BAR_WIDTH;

  const drawBar = (x: number, yPos: number, value: number, max: number, color: string) => {
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(12, 22, 26, 0.55)";
    drawRoundedRect(ctx, x - 10, yPos - 8, BAR_WIDTH + 20, BAR_HEIGHT + 16, 8);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    drawRoundedRect(ctx, x, yPos, BAR_WIDTH, BAR_HEIGHT, 7);
    ctx.fill();

    ctx.fillStyle = color;
    drawRoundedRect(ctx, x, yPos, BAR_WIDTH * ratio, BAR_HEIGHT, 7);
    ctx.fill();
    ctx.restore();
  };

  const armorVisible = ecs.playerMaxArmor[playerId] > 0;
  if (armorVisible) {
    const armorY = y - BAR_HEIGHT - ARMOR_BAR_GAP - 2;
    drawBar(healthX, armorY, ecs.playerArmor[playerId], ecs.playerMaxArmor[playerId], "#4b8fe2");
  }

  drawBar(healthX, y, ecs.playerHealth[playerId], ecs.playerMaxHealth[playerId], "#e2534b");
  drawBar(hungerX, y, ecs.playerHunger[playerId], ecs.playerMaxHunger[playerId], "#d9a441");
};

const renderCraftingMenu = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const crafting = state.crafting[state.localPlayerIndex];
  if (!crafting?.isOpen || recipes.length === 0) {
    return;
  }

  const { innerWidth, innerHeight } = window;
  const layout = getCraftingLayout(state, innerWidth, innerHeight);
  if (!layout) {
    return;
  }

  const { rowX, rowY, rowWidth, panelX, panelY, panelWidth, panelHeight, button, selectedIndex } = layout;
  const playerId = getLocalPlayerId(state);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#0c161a";
  drawRoundedRect(
    ctx,
    rowX - CRAFT_PANEL_PADDING,
    rowY - CRAFT_PANEL_PADDING,
    rowWidth + CRAFT_PANEL_PADDING * 2,
    CRAFT_TILE_SIZE + CRAFT_PANEL_PADDING * 2,
    CRAFT_PANEL_RADIUS
  );
  ctx.fill();
  ctx.restore();

  const selectedRecipe: Recipe | undefined = recipes[selectedIndex];

  recipes.forEach((recipe, index) => {
    const x = rowX + index * (CRAFT_TILE_SIZE + CRAFT_TILE_GAP);
    const y = rowY;
    const selected = index === selectedIndex;
    const craftable = playerId !== undefined ? canCraft(state.ecs, playerId, recipe) : false;

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
    const icon = getItemIcon(recipe.output.kind);

    const alpha = craftable ? 1 : 0.4;
    if (icon) {
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
      ctx.fillStyle = itemColors[recipe.output.kind];
      ctx.fill();
      ctx.restore();
    }
  });

  if (!selectedRecipe) {
    return;
  }

  const ingredientIconSize = 16;
  const listPadding = CRAFT_PANEL_PADDING;
  const rowHeight = CRAFT_INGREDIENT_ROW_HEIGHT;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#0c161a";
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, CRAFT_PANEL_RADIUS);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f0d58b";
  ctx.font = `bold 12px ${UI_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const listStartY = panelY + listPadding;
  selectedRecipe.inputs.forEach((input, index) => {
    const rowY = listStartY + index * rowHeight + rowHeight / 2;
    const iconX = panelX + listPadding;
    const iconY = rowY - ingredientIconSize / 2;
    const ingredientIcon = getItemIcon(input.kind);

    if (ingredientIcon) {
      ctx.drawImage(ingredientIcon, iconX, iconY, ingredientIconSize, ingredientIconSize);
    } else {
      ctx.beginPath();
      ctx.arc(iconX + ingredientIconSize / 2, iconY + ingredientIconSize / 2, ingredientIconSize * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = itemColors[input.kind];
      ctx.fill();
      ctx.fillStyle = "#f0d58b";
    }

    const amountText = `x${input.amount}`;
    ctx.fillText(amountText, iconX + ingredientIconSize + 6, rowY);
  });

  const craftable = playerId !== undefined ? canCraft(state.ecs, playerId, selectedRecipe) : false;
  ctx.save();
  ctx.fillStyle = craftable ? "#f0d58b" : "#6f6f6f";
  ctx.strokeStyle = craftable ? "#f7e6b8" : "#404a4d";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, button.x, button.y, button.width, button.height, CRAFT_BUTTON_RADIUS);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = craftable ? "#1c1f21" : "#262d30";
  ctx.font = `bold 14px ${UI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Craft", button.x + button.width / 2, button.y + button.height / 2 + 1);
  ctx.restore();

  ctx.restore();
};

const renderBuildVersion = (ctx: CanvasRenderingContext2D) => {
  const { innerWidth } = window;
  const fontSize = 14;
  const lines = [buildVersionLabel];
  if (activeRoomCodeLabel) {
    lines.push(activeRoomCodeLabel);
  }
  lines.push(activeSeedLabel);

  ctx.save();
  ctx.font = `${fontSize}px ${UI_FONT}`;
  ctx.fillStyle = "rgba(246, 231, 193, 0.7)";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  const startY = HUD_MARGIN;
  const lineHeight = fontSize + 6;
  lines.forEach((line, index) => {
    ctx.fillText(line, innerWidth - HUD_MARGIN, startY + index * lineHeight);
  });
  ctx.restore();
};

const renderMapOverlay = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (!isMapOverlayEnabled()) {
    return;
  }

  const { panelX, panelY, panelWidth, panelHeight, padding } = getMapLayout(window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(12, 22, 26, 0.8)";
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 16);
  ctx.fill();
  ctx.restore();

  const bounds = getWorldBounds(state.world);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const innerSizeX = panelWidth - padding * 2;
  const innerSizeY = panelHeight - padding * 2;
  const scale = Math.min(innerSizeX / width, innerSizeY / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const offsetX = panelX + padding + (innerSizeX - drawWidth) / 2;
  const offsetY = panelY + padding + (innerSizeY - drawHeight) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-bounds.minX, -bounds.minY);

  ctx.fillStyle = "rgba(246, 231, 193, 0.65)";
  ctx.strokeStyle = "rgba(12, 22, 26, 0.6)";
  ctx.lineWidth = Math.max(1 / scale, 0.6);

  for (const island of state.world.islands) {
    if (island.points.length === 0) {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(island.points[0].x, island.points[0].y);
    for (let i = 1; i < island.points.length; i += 1) {
      ctx.lineTo(island.points[i].x, island.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const playerId = getLocalPlayerId(state);
  if (playerId !== undefined && isEntityAlive(state.ecs, playerId)) {
    const x = state.ecs.position.x[playerId];
    const y = state.ecs.position.y[playerId];
    const size = 9 / scale;
    const half = size / 2;
    ctx.strokeStyle = "#e24b4b";
    ctx.lineWidth = Math.max(2 / scale, 2.4);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - half, y - half);
    ctx.lineTo(x + half, y + half);
    ctx.moveTo(x + half, y - half);
    ctx.lineTo(x - half, y + half);
    ctx.stroke();
  }

  ctx.restore();
};

const updateDebugFps = () => {
  debugFrames += 1;
  const now = performance.now();
  const elapsed = now - debugLastSample;
  if (elapsed >= 500) {
    debugFps = Math.round((debugFrames * 1000) / elapsed);
    debugFrames = 0;
    debugLastSample = now;
  }
};

const countEntitiesByTag = (state: GameState) => {
  const ecs = state.ecs;
  const counts = {
    total: 0,
    players: 0,
    enemies: 0,
    resources: 0,
    groundItems: 0,
    props: 0,
  };

  for (let id = 0; id < ecs.nextId; id += 1) {
    if (ecs.alive[id] !== 1) {
      continue;
    }
    counts.total += 1;
    switch (ecs.tag[id]) {
      case EntityTag.Player:
        counts.players += 1;
        break;
      case EntityTag.Enemy:
        counts.enemies += 1;
        break;
      case EntityTag.Resource:
        counts.resources += 1;
        break;
      case EntityTag.GroundItem:
        counts.groundItems += 1;
        break;
      case EntityTag.Prop:
        counts.props += 1;
        break;
      default:
        break;
    }
  }

  return counts;
};

const getBiomeTierForDistance = (distance: number, tiers: BiomeTierConfig[]) => {
  for (const tier of tiers) {
    if (distance >= tier.ringMin && distance <= tier.ringMax) {
      return tier;
    }
  }
  return null;
};

const renderDebugOverlay = (ctx: CanvasRenderingContext2D, state: GameState) => {
  if (!debugOverlayEnabled) {
    return;
  }

  updateDebugFps();
  const dayInfo = getDayCycleInfo(state.time);

  const playerId = getLocalPlayerId(state);
  const ecs = state.ecs;
  const counts = countEntitiesByTag(state);

  const fontSize = 14;
  const lineHeight = fontSize + 4;
  const paddingX = 12;
  const paddingY = 8;
  const lines = [
    `FPS: ${debugFps}`,
    `Time: ${state.time.toFixed(2)}s`,
    `Day: ${dayInfo.day}  ${String(dayInfo.hours).padStart(2, "0")}:${String(dayInfo.minutes).padStart(2, "0")}`,
    `Players: ${counts.players}/${state.playerIds.length} alive (local ${state.localPlayerIndex})`,
    `Islands: ${state.world.islands.length}`,
    `Entities: ${counts.total} (next ${ecs.nextId})`,
    `Enemies: ${counts.enemies}  Resources: ${counts.resources}`,
    `Ground: ${counts.groundItems}  Props: ${counts.props}`,
  ];

  if (playerId !== undefined && isEntityAlive(ecs, playerId)) {
    const health = Math.round(ecs.playerHealth[playerId]);
    const maxHealth = Math.round(ecs.playerMaxHealth[playerId]);
    const hunger = Math.round(ecs.playerHunger[playerId]);
    const maxHunger = Math.round(ecs.playerMaxHunger[playerId]);
    const maxArmor = Math.round(ecs.playerMaxArmor[playerId]);
    const position = { x: ecs.position.x[playerId], y: ecs.position.y[playerId] };
    const spawnCenter = state.world.islands[0]?.center ?? { x: 0, y: 0 };
    const distanceFromSpawn = Math.hypot(position.x - spawnCenter.x, position.y - spawnCenter.y);
    const biomeTier = getBiomeTierForDistance(distanceFromSpawn, state.world.config.procedural.biomeTiers);
    const island = findContainingIsland(position, state.world.islands);
    lines.push(`X: ${Math.round(position.x)}`);
    lines.push(`Y: ${Math.round(position.y)}`);
    lines.push(`Island: ${island?.type ?? "sea"}`);
    lines.push(`Biome: ${biomeTier?.name ?? "none"}`);
    lines.push(`HP: ${health}/${maxHealth}  Hunger: ${hunger}/${maxHunger}`);
    if (maxArmor > 0) {
      const armor = Math.round(ecs.playerArmor[playerId]);
      lines.push(`Armor: ${armor}/${maxArmor}`);
    }
    lines.push(
      `Dead: ${ecs.playerIsDead[playerId] ? "yes" : "no"}  Raft: ${ecs.playerIsOnRaft[playerId] ? "yes" : "no"}`
    );
  } else {
    lines.push("X: --");
    lines.push("Y: --");
  }

  ctx.save();
  ctx.font = `${fontSize}px ${UI_FONT}`;
  const maxWidth = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
  const boxWidth = maxWidth + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const boxX = HUD_MARGIN;
  const boxY = HUD_MARGIN;

  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "rgba(12, 22, 26, 0.6)";
  drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 10);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(246, 231, 193, 0.9)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const startY = boxY + paddingY;

  lines.forEach((line, index) => {
    const x = boxX + paddingX;
    const y = startY + index * lineHeight;
    ctx.fillText(line, x, y);
  });

  ctx.restore();
};
const renderHints = (ctx: CanvasRenderingContext2D) => {
  const { innerWidth, innerHeight } = window;
  const lines = ["Q to drop item", "C opens crafting menu", "M toggles map", "T toggle debug"];
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
  const playerId = getLocalPlayerId(state);
  const ecs = state.ecs;
  if (playerId === undefined) {
    return;
  }

  const { innerWidth, innerHeight } = window;
  const damageFlashTimer = ecs.playerDamageFlashTimer[playerId];
  if (ecs.playerIsDead[playerId] || damageFlashTimer <= 0) {
    return;
  }
  const alpha = damageFlashTimer / DAMAGE_FLASH_DURATION;

  ctx.save();
  ctx.fillStyle = `rgba(180, 30, 30, ${0.35 * alpha})`;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.restore();
};

const renderDeathOverlay = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const playerId = getLocalPlayerId(state);
  if (playerId === undefined || !state.ecs.playerIsDead[playerId]) {
    return;
  }

  const { innerWidth, innerHeight } = window;
  const respawnTimer = state.ecs.playerRespawnTimer[playerId];
  const countdown = Math.max(0, Math.ceil(respawnTimer));
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
  ctx.fillText(`Respawning in ${countdown}...`, innerWidth / 2, innerHeight / 2 + 46);
  ctx.restore();
};

export const renderHud = (ctx: CanvasRenderingContext2D, state: GameState) => {
  renderSurvivalBars(ctx, state);
  renderCraftingMenu(ctx, state);
  const raftPrompted = renderRaftPrompt(ctx, state);
  if (!raftPrompted) {
    renderInteractionPrompt(ctx, state);
  }
  renderEquipment(ctx, state);
  renderInventory(ctx, state);
  renderHints(ctx);
  renderBuildVersion(ctx);
  renderMapOverlay(ctx, state);
  renderDebugOverlay(ctx, state);
  renderDamageFlash(ctx, state);
  renderDeathOverlay(ctx, state);
};
