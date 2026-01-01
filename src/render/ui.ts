import type { GameState } from "../game/state";
import { EQUIPMENT_SLOT_ORDER, getEquipmentSlotKind, type EquipmentSlotType } from "../game/equipment";
import type { ResourceNodeType } from "../world/types";
import type { ItemKind } from "../game/item-kinds";
import { findClosestIslandEdge } from "../world/island-geometry";
import { canCraft, recipes } from "../game/crafting";
import type { Recipe } from "../game/crafting";
import { getNearestGatherableResource } from "../systems/gathering";
import { DAMAGE_FLASH_DURATION } from "../game/combat-config";
import { RAFT_INTERACTION_DISTANCE } from "../game/raft-config";
import { INVENTORY_SLOT_COUNT, isEntityAlive } from "../core/ecs";
import { resourceNodeTypeFromIndex } from "../world/resource-node-types";
import { equipmentPlaceholderImages, isImageReady, itemImages } from "./assets";
import { drawRoundedRect } from "./render-helpers";
import {
  ACTION_PROMPT_FONT_SIZE,
  ACTION_PROMPT_PADDING_X,
  ACTION_PROMPT_PADDING_Y,
  BAR_HEIGHT,
  BAR_WIDTH,
  CRAFT_COLUMN_OFFSET,
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
  UI_FONT
} from "./ui-config";
import {
  getInventorySelectedIndex,
  getInventorySlotKind,
  getInventorySlotQuantity
} from "../game/inventory";

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
  krakenring: "#5aa1c9"
};

const promptLabels: Record<ResourceNodeType, string> = {
  tree: "E to chop",
  rock: "E to pick up",
  bush: "E to collect"
};

const ARMOR_BAR_GAP = 16;

const buildVersionLabel = `v${__APP_VERSION__}${import.meta.env.DEV ? "-dev" : ""}`;

let activeSeedLabel = "Seed: --";

export const setHudSeed = (seed: string) => {
  activeSeedLabel = `Seed: ${seed}`;
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

  const totalWidth = INVENTORY_SLOT_COUNT * INVENTORY_SLOT_SIZE +
    (INVENTORY_SLOT_COUNT - 1) * INVENTORY_SLOT_GAP;
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
  drawRoundedRect(
    ctx,
    startX - 12,
    startY - 12,
    totalWidth + 24,
    totalHeight + 24,
    14
  );
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

  const selectedIndex = getInventorySelectedIndex(ecs, playerId);
  const slotKind = getInventorySlotKind(ecs, playerId, selectedIndex);
  const slotQuantity = getInventorySlotQuantity(ecs, playerId, selectedIndex);
  if (slotKind !== "raft" || slotQuantity <= 0) {
    return false;
  }

  const position = { x: ecs.position.x[playerId], y: ecs.position.y[playerId] };
  const closest = findClosestIslandEdge(position, state.world.islands);
  if (!closest || closest.distance > RAFT_INTERACTION_DISTANCE) {
    return false;
  }

  const text = ecs.playerIsOnRaft[playerId] ? "LMB to disembark" : "LMB to board";
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
  const inventoryWidth = INVENTORY_SLOT_COUNT * INVENTORY_SLOT_SIZE +
    (INVENTORY_SLOT_COUNT - 1) * INVENTORY_SLOT_GAP;
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
  if (!crafting?.isOpen) {
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
  const playerId = getLocalPlayerId(state);

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

  const selectedIndex = Math.max(0, Math.min(crafting.selectedIndex, recipes.length - 1));
  const selectedRecipe: Recipe | undefined = recipes[selectedIndex];
  const selectedY = startY + selectedIndex * (CRAFT_TILE_SIZE + CRAFT_TILE_GAP);

  recipes.forEach((recipe, index) => {
    const x = columnX;
    const y = startY + index * (CRAFT_TILE_SIZE + CRAFT_TILE_GAP);
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

  if (selectedRecipe && selectedRecipe.inputs.length > 0) {
    const ingredientIconSize = 16;
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
      const ingredientIcon = getItemIcon(input.kind);

      if (ingredientIcon) {
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
        ctx.fillStyle = itemColors[input.kind];
        ctx.fill();
        ctx.fillStyle = "#f0d58b";
      }

      const amountText = `x${input.amount}`;
      ctx.fillText(amountText, iconX + ingredientIconSize + 6, rowY);
    });

    ctx.restore();
  }
};

const renderBuildVersion = (ctx: CanvasRenderingContext2D) => {
  const { innerWidth } = window;
  const fontSize = 14;

  ctx.save();
  ctx.font = `${fontSize}px ${UI_FONT}`;
  ctx.fillStyle = "rgba(246, 231, 193, 0.7)";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(buildVersionLabel, innerWidth - HUD_MARGIN, HUD_MARGIN);
  ctx.fillText(activeSeedLabel, innerWidth - HUD_MARGIN, HUD_MARGIN + fontSize + 6);
  ctx.restore();
};

const renderPlayerCoords = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const playerId = getLocalPlayerId(state);
  const ecs = state.ecs;
  if (playerId === undefined || !isEntityAlive(ecs, playerId)) {
    return;
  }

  const fontSize = 14;
  const lineHeight = fontSize + 4;
  const paddingX = 12;
  const paddingTop = 8;
  const paddingBottom = 4;
  const lines = [
    `X: ${Math.round(ecs.position.x[playerId])}`,
    `Y: ${Math.round(ecs.position.y[playerId])}`
  ];

  ctx.save();
  ctx.font = `${fontSize}px ${UI_FONT}`;
  const maxWidth = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
  const boxWidth = maxWidth + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingTop + paddingBottom;
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

  const contentHeight = boxHeight - paddingTop - paddingBottom;
  const textBlockHeight = lines.length * lineHeight;
  const startY = boxY + paddingTop + Math.max(0, (contentHeight - textBlockHeight) / 2);

  lines.forEach((line, index) => {
    const x = boxX + paddingX;
    const y = startY + index * lineHeight;
    ctx.fillText(line, x, y);
  });

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
  renderPlayerCoords(ctx, state);
  renderDamageFlash(ctx, state);
  renderDeathOverlay(ctx, state);
};



