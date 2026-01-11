import { copyTextToClipboard, generateRandomSeed } from "../app/ui-helpers";
import { drawIsland, insetPoints } from "../render/render-helpers";
import type { IslandType, ProceduralWorldConfig, WorldState } from "../world/types";
import { BIOME_TIERS, getSpawnZoneRadius, WORLD_GEN_CONFIG } from "../world/world-config";
import { createWorld } from "../world/world-creation";

type PreviewDependencies = {
  ctx: CanvasRenderingContext2D;
  menuOverlay?: HTMLElement | null;
  loadingOverlay?: HTMLElement | null;
  netIndicator?: HTMLElement | null;
  inGameMenu?: HTMLElement | null;
};

type CameraState = {
  x: number;
  y: number;
  zoom: number;
};

const SEA_GRADIENT_TOP = "#2c7a7b";
const SEA_GRADIENT_BOTTOM = "#0b2430";
const ISLAND_INSET_SCALE = 0.82;
const LABEL_COLOR = "#f6e7c1";
const LABEL_STROKE = "rgba(0, 0, 0, 0.65)";
const LABEL_FONT = "12px Zain";

const islandStyles: Record<IslandType, { sand: string; grass?: string }> = {
  beach: { sand: "#f6e7c1", grass: "#7dbb6a" },
  woods: { sand: "#f6e7c1", grass: "#4b7a74" },
  volcanic: { sand: "#e7c29e", grass: "#5f3a2a" },
  calmBoss: { sand: "#f6e7c1" },
  wildBoss: { sand: "#f6e7c1", grass: "#4b7a74" },
  volcanicBoss: { sand: "#e7c29e", grass: "#5f3a2a" },
};

const tierColors: Record<string, string> = {
  calm: "rgba(125, 187, 106, 0.7)",
  wild: "rgba(75, 122, 116, 0.7)",
  volcanic: "rgba(199, 96, 63, 0.7)",
};

const createDefaultConfig = (): ProceduralWorldConfig => ({
  ...WORLD_GEN_CONFIG,
  islandShapeConfig: { ...WORLD_GEN_CONFIG.islandShapeConfig },
  biomeTiers: BIOME_TIERS.map((tier) => ({
    ...tier,
    weights: { ...tier.weights },
  })),
});

const parseNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isBossIsland = (type: IslandType) => type.endsWith("Boss");

const getWorldBounds = (world: WorldState) => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  world.islands.forEach((island) => {
    island.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return { minX, minY, maxX, maxY };
};

const buildWorldStats = (world: WorldState) => {
  const counts = world.islands.reduce(
    (acc, island) => {
      acc.total += 1;
      acc.types[island.type] = (acc.types[island.type] ?? 0) + 1;
      return acc;
    },
    { total: 0, types: {} as Partial<Record<IslandType, number>> }
  );

  const typeSummary = Object.entries(counts.types)
    .map(([type, count]) => `${type}:${count}`)
    .join(" | ");

  return `Islands ${counts.total}${typeSummary ? ` (${typeSummary})` : ""}`;
};

const createSectionTitle = (label: string) => {
  const title = document.createElement("div");
  title.className = "dev-preview-section-title";
  title.textContent = label;
  return title;
};

const createRow = (label: string, input: HTMLElement) => {
  const row = document.createElement("label");
  row.className = "dev-preview-row";
  const span = document.createElement("span");
  span.textContent = label;
  row.append(span, input);
  return row;
};

const createNumberInput = (value: number, step: number | "any" = "any") => {
  const input = document.createElement("input");
  input.type = "number";
  input.value = value.toString();
  input.step = step === "any" ? "any" : step.toString();
  input.inputMode = "decimal";
  input.className = "dev-preview-input";
  return input;
};

const createCheckbox = (checked: boolean) => {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.className = "dev-preview-checkbox";
  return input;
};

const createButton = (label: string) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dev-preview-button";
  button.textContent = label;
  return button;
};

export const startWorldPreview = (deps: PreviewDependencies) => {
  const { ctx, menuOverlay, loadingOverlay, netIndicator, inGameMenu } = deps;
  menuOverlay?.classList.add("hidden");
  loadingOverlay?.classList.add("hidden");
  netIndicator?.classList.add("hidden");
  inGameMenu?.classList.add("hidden");

  const panel = document.createElement("div");
  panel.className = "dev-preview-panel";

  const header = document.createElement("div");
  header.className = "dev-preview-header";
  header.textContent = "World Preview (Dev)";

  const seedRow = document.createElement("div");
  seedRow.className = "dev-preview-seed";
  const seedInput = document.createElement("input");
  seedInput.type = "text";
  seedInput.className = "dev-preview-input";
  const seedButton = createButton("Random seed");
  seedRow.append(seedInput, seedButton);

  const stats = document.createElement("div");
  stats.className = "dev-preview-stats";
  const status = document.createElement("div");
  status.className = "dev-preview-status";

  const actions = document.createElement("div");
  actions.className = "dev-preview-actions";
  const regenButton = createButton("Regenerate");
  const fitButton = createButton("Fit view");
  const copyButton = createButton("Copy JSON");
  actions.append(regenButton, fitButton, copyButton);

  const options = document.createElement("div");
  options.className = "dev-preview-options";
  const showRingsInput = createCheckbox(true);
  const showLabelsInput = createCheckbox(false);
  options.append(createRow("Show tier rings", showRingsInput), createRow("Show labels", showLabelsInput));

  const configSection = document.createElement("div");
  configSection.className = "dev-preview-section";
  configSection.append(createSectionTitle("World config"));

  const currentConfig = createDefaultConfig();
  let currentSeed = generateRandomSeed();
  seedInput.value = currentSeed;

  const spawnRadiusInput = createNumberInput(currentConfig.spawnRadius, 10);
  const spawnZoneRadiusInput = createNumberInput(currentConfig.spawnZoneRadius, 10);
  const radiusMinInput = createNumberInput(currentConfig.radiusMin, 10);
  const radiusMaxInput = createNumberInput(currentConfig.radiusMax, 10);
  const edgePaddingInput = createNumberInput(currentConfig.edgePadding, 10);
  const placementAttemptsInput = createNumberInput(currentConfig.placementAttempts, 1);
  const arcMinInput = createNumberInput(currentConfig.arcMinAngle, "any");
  const arcMaxInput = createNumberInput(currentConfig.arcMaxAngle, "any");

  configSection.append(
    createRow("Spawn radius", spawnRadiusInput),
    createRow("Spawn zone radius", spawnZoneRadiusInput),
    createRow("Radius min", radiusMinInput),
    createRow("Radius max", radiusMaxInput),
    createRow("Edge padding", edgePaddingInput),
    createRow("Placement attempts", placementAttemptsInput),
    createRow("Arc min angle", arcMinInput),
    createRow("Arc max angle", arcMaxInput)
  );

  const shapeSection = document.createElement("div");
  shapeSection.className = "dev-preview-section";
  shapeSection.append(createSectionTitle("Island shape"));

  const pointCountMinInput = createNumberInput(currentConfig.islandShapeConfig.pointCountMin, 1);
  const pointCountMaxInput = createNumberInput(currentConfig.islandShapeConfig.pointCountMax, 1);
  const waveAMinInput = createNumberInput(currentConfig.islandShapeConfig.waveAMin, 1);
  const waveAMaxInput = createNumberInput(currentConfig.islandShapeConfig.waveAMax, 1);
  const waveBMinInput = createNumberInput(currentConfig.islandShapeConfig.waveBMin, 1);
  const waveBMaxInput = createNumberInput(currentConfig.islandShapeConfig.waveBMax, 1);
  const ampAMinInput = createNumberInput(currentConfig.islandShapeConfig.ampAMin, "any");
  const ampAMaxInput = createNumberInput(currentConfig.islandShapeConfig.ampAMax, "any");
  const ampBMinInput = createNumberInput(currentConfig.islandShapeConfig.ampBMin, "any");
  const ampBMaxInput = createNumberInput(currentConfig.islandShapeConfig.ampBMax, "any");
  const jitterMinInput = createNumberInput(currentConfig.islandShapeConfig.jitterMin, "any");
  const jitterMaxInput = createNumberInput(currentConfig.islandShapeConfig.jitterMax, "any");
  const minRadiusRatioInput = createNumberInput(currentConfig.islandShapeConfig.minRadiusRatio, "any");
  const smoothingMinInput = createNumberInput(currentConfig.islandShapeConfig.smoothingPassesMin, 1);
  const smoothingMaxInput = createNumberInput(currentConfig.islandShapeConfig.smoothingPassesMax, 1);
  const leanMinInput = createNumberInput(currentConfig.islandShapeConfig.leanMin, "any");
  const leanMaxInput = createNumberInput(currentConfig.islandShapeConfig.leanMax, "any");

  shapeSection.append(
    createRow("Points min", pointCountMinInput),
    createRow("Points max", pointCountMaxInput),
    createRow("Wave A min", waveAMinInput),
    createRow("Wave A max", waveAMaxInput),
    createRow("Wave B min", waveBMinInput),
    createRow("Wave B max", waveBMaxInput),
    createRow("Amp A min", ampAMinInput),
    createRow("Amp A max", ampAMaxInput),
    createRow("Amp B min", ampBMinInput),
    createRow("Amp B max", ampBMaxInput),
    createRow("Jitter min", jitterMinInput),
    createRow("Jitter max", jitterMaxInput),
    createRow("Min radius ratio", minRadiusRatioInput),
    createRow("Smoothing min", smoothingMinInput),
    createRow("Smoothing max", smoothingMaxInput),
    createRow("Lean min", leanMinInput),
    createRow("Lean max", leanMaxInput)
  );

  const tiersSection = document.createElement("div");
  tiersSection.className = "dev-preview-section";
  tiersSection.append(createSectionTitle("Biome tiers"));

  currentConfig.biomeTiers.forEach((tier) => {
    const tierGroup = document.createElement("div");
    tierGroup.className = "dev-preview-tier";

    const title = document.createElement("div");
    title.className = "dev-preview-tier-title";
    title.textContent = tier.name;

    const ringMinInput = createNumberInput(tier.ringMin, 10);
    const ringMaxInput = createNumberInput(tier.ringMax, 10);
    const islandCountInput = createNumberInput(tier.islandCount, 1);
    tierGroup.append(
      title,
      createRow("Ring min", ringMinInput),
      createRow("Ring max", ringMaxInput),
      createRow("Island count", islandCountInput)
    );

    Object.keys(tier.weights).forEach((key) => {
      const type = key as IslandType;
      const weightInput = createNumberInput(tier.weights[type] ?? 0, 0.1);
      tierGroup.append(createRow(`Weight ${type}`, weightInput));
      weightInput.addEventListener("input", () => {
        tier.weights[type] = parseNumber(weightInput.value, tier.weights[type] ?? 0);
        scheduleRegenerate();
      });
    });

    ringMinInput.addEventListener("input", () => {
      tier.ringMin = parseNumber(ringMinInput.value, tier.ringMin);
      scheduleRegenerate();
    });
    ringMaxInput.addEventListener("input", () => {
      tier.ringMax = parseNumber(ringMaxInput.value, tier.ringMax);
      scheduleRegenerate();
    });
    islandCountInput.addEventListener("input", () => {
      tier.islandCount = Math.max(0, Math.round(parseNumber(islandCountInput.value, tier.islandCount)));
      islandCountInput.value = tier.islandCount.toString();
      scheduleRegenerate();
    });

    tiersSection.append(tierGroup);
  });

  panel.append(header, seedRow, stats, status, actions, options, configSection, shapeSection, tiersSection);
  document.body.appendChild(panel);

  let world = createWorld({ seed: currentSeed, preset: "procedural", procedural: currentConfig });
  const camera: CameraState = { x: 0, y: 0, zoom: 0.5 };

  const setConfigFromInputs = () => {
    currentConfig.spawnRadius = Math.max(0, parseNumber(spawnRadiusInput.value, currentConfig.spawnRadius));
    currentConfig.spawnZoneRadius = Math.max(0, parseNumber(spawnZoneRadiusInput.value, currentConfig.spawnZoneRadius));
    currentConfig.radiusMin = Math.max(0, parseNumber(radiusMinInput.value, currentConfig.radiusMin));
    currentConfig.radiusMax = Math.max(
      currentConfig.radiusMin,
      parseNumber(radiusMaxInput.value, currentConfig.radiusMax)
    );
    currentConfig.edgePadding = Math.max(0, parseNumber(edgePaddingInput.value, currentConfig.edgePadding));
    currentConfig.placementAttempts = Math.max(
      1,
      Math.round(parseNumber(placementAttemptsInput.value, currentConfig.placementAttempts))
    );
    currentConfig.arcMinAngle = parseNumber(arcMinInput.value, currentConfig.arcMinAngle);
    currentConfig.arcMaxAngle = parseNumber(arcMaxInput.value, currentConfig.arcMaxAngle);

    spawnRadiusInput.value = currentConfig.spawnRadius.toString();
    spawnZoneRadiusInput.value = currentConfig.spawnZoneRadius.toString();
    radiusMinInput.value = currentConfig.radiusMin.toString();
    radiusMaxInput.value = currentConfig.radiusMax.toString();
    edgePaddingInput.value = currentConfig.edgePadding.toString();
    placementAttemptsInput.value = currentConfig.placementAttempts.toString();
    arcMinInput.value = currentConfig.arcMinAngle.toString();
    arcMaxInput.value = currentConfig.arcMaxAngle.toString();

    const shape = currentConfig.islandShapeConfig;
    shape.pointCountMin = Math.max(3, Math.round(parseNumber(pointCountMinInput.value, shape.pointCountMin)));
    shape.pointCountMax = Math.max(
      shape.pointCountMin,
      Math.round(parseNumber(pointCountMaxInput.value, shape.pointCountMax))
    );
    shape.waveAMin = Math.max(1, Math.round(parseNumber(waveAMinInput.value, shape.waveAMin)));
    shape.waveAMax = Math.max(shape.waveAMin, Math.round(parseNumber(waveAMaxInput.value, shape.waveAMax)));
    shape.waveBMin = Math.max(2, Math.round(parseNumber(waveBMinInput.value, shape.waveBMin)));
    shape.waveBMax = Math.max(shape.waveBMin, Math.round(parseNumber(waveBMaxInput.value, shape.waveBMax)));
    shape.ampAMin = Math.max(0, parseNumber(ampAMinInput.value, shape.ampAMin));
    shape.ampAMax = Math.max(shape.ampAMin, parseNumber(ampAMaxInput.value, shape.ampAMax));
    shape.ampBMin = Math.max(0, parseNumber(ampBMinInput.value, shape.ampBMin));
    shape.ampBMax = Math.max(shape.ampBMin, parseNumber(ampBMaxInput.value, shape.ampBMax));
    shape.jitterMin = Math.max(0, parseNumber(jitterMinInput.value, shape.jitterMin));
    shape.jitterMax = Math.max(shape.jitterMin, parseNumber(jitterMaxInput.value, shape.jitterMax));
    shape.minRadiusRatio = Math.max(0.05, parseNumber(minRadiusRatioInput.value, shape.minRadiusRatio));
    shape.smoothingPassesMin = Math.max(0, Math.round(parseNumber(smoothingMinInput.value, shape.smoothingPassesMin)));
    shape.smoothingPassesMax = Math.max(
      shape.smoothingPassesMin,
      Math.round(parseNumber(smoothingMaxInput.value, shape.smoothingPassesMax))
    );
    shape.leanMin = Math.max(0.1, parseNumber(leanMinInput.value, shape.leanMin));
    shape.leanMax = Math.max(shape.leanMin, parseNumber(leanMaxInput.value, shape.leanMax));

    pointCountMinInput.value = shape.pointCountMin.toString();
    pointCountMaxInput.value = shape.pointCountMax.toString();
    waveAMinInput.value = shape.waveAMin.toString();
    waveAMaxInput.value = shape.waveAMax.toString();
    waveBMinInput.value = shape.waveBMin.toString();
    waveBMaxInput.value = shape.waveBMax.toString();
    ampAMinInput.value = shape.ampAMin.toString();
    ampAMaxInput.value = shape.ampAMax.toString();
    ampBMinInput.value = shape.ampBMin.toString();
    ampBMaxInput.value = shape.ampBMax.toString();
    jitterMinInput.value = shape.jitterMin.toString();
    jitterMaxInput.value = shape.jitterMax.toString();
    minRadiusRatioInput.value = shape.minRadiusRatio.toString();
    smoothingMinInput.value = shape.smoothingPassesMin.toString();
    smoothingMaxInput.value = shape.smoothingPassesMax.toString();
    leanMinInput.value = shape.leanMin.toString();
    leanMaxInput.value = shape.leanMax.toString();
  };

  const buildConfigSnapshot = (): ProceduralWorldConfig => ({
    ...currentConfig,
    islandShapeConfig: { ...currentConfig.islandShapeConfig },
    biomeTiers: currentConfig.biomeTiers.map((tier) => ({
      ...tier,
      weights: { ...tier.weights },
    })),
  });

  const regenerateWorld = () => {
    setConfigFromInputs();
    currentSeed = seedInput.value.trim() || generateRandomSeed();
    seedInput.value = currentSeed;
    world = createWorld({ seed: currentSeed, preset: "procedural", procedural: buildConfigSnapshot() });
    stats.textContent = buildWorldStats(world);
  };

  let regenTimer: number | null = null;
  const scheduleRegenerate = () => {
    if (regenTimer !== null) {
      window.clearTimeout(regenTimer);
    }
    regenTimer = window.setTimeout(() => {
      regenTimer = null;
      regenerateWorld();
    }, 120);
  };

  const fitView = () => {
    const bounds = getWorldBounds(world);
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const padding = 120;
    const viewWidth = Math.max(1, window.innerWidth - padding * 2);
    const viewHeight = Math.max(1, window.innerHeight - padding * 2);
    const zoomX = viewWidth / width;
    const zoomY = viewHeight / height;
    camera.zoom = Math.min(2.5, Math.max(0.08, Math.min(zoomX, zoomY)));
    camera.x = (bounds.minX + bounds.maxX) / 2;
    camera.y = (bounds.minY + bounds.maxY) / 2;
  };

  const resetView = () => {
    camera.x = 0;
    camera.y = 0;
    camera.zoom = 0.5;
  };

  const canvas = ctx.canvas;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
  });
  window.addEventListener("mousemove", (event) => {
    if (!dragging) {
      return;
    }
    const dx = (event.clientX - lastX) / camera.zoom;
    const dy = (event.clientY - lastY) / camera.zoom;
    camera.x -= dx;
    camera.y -= dy;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const viewportX = event.clientX - rect.left;
      const viewportY = event.clientY - rect.top;
      const worldX = (viewportX - rect.width / 2) / camera.zoom + camera.x;
      const worldY = (viewportY - rect.height / 2) / camera.zoom + camera.y;
      const zoomFactor = Math.exp(-event.deltaY * 0.0014);
      const nextZoom = Math.min(4, Math.max(0.05, camera.zoom * zoomFactor));
      camera.zoom = nextZoom;
      camera.x = worldX - (viewportX - rect.width / 2) / camera.zoom;
      camera.y = worldY - (viewportY - rect.height / 2) / camera.zoom;
    },
    { passive: false }
  );

  spawnRadiusInput.addEventListener("input", scheduleRegenerate);
  spawnZoneRadiusInput.addEventListener("input", scheduleRegenerate);
  radiusMinInput.addEventListener("input", scheduleRegenerate);
  radiusMaxInput.addEventListener("input", scheduleRegenerate);
  edgePaddingInput.addEventListener("input", scheduleRegenerate);
  placementAttemptsInput.addEventListener("input", scheduleRegenerate);
  arcMinInput.addEventListener("input", scheduleRegenerate);
  arcMaxInput.addEventListener("input", scheduleRegenerate);
  pointCountMinInput.addEventListener("input", scheduleRegenerate);
  pointCountMaxInput.addEventListener("input", scheduleRegenerate);
  waveAMinInput.addEventListener("input", scheduleRegenerate);
  waveAMaxInput.addEventListener("input", scheduleRegenerate);
  waveBMinInput.addEventListener("input", scheduleRegenerate);
  waveBMaxInput.addEventListener("input", scheduleRegenerate);
  ampAMinInput.addEventListener("input", scheduleRegenerate);
  ampAMaxInput.addEventListener("input", scheduleRegenerate);
  ampBMinInput.addEventListener("input", scheduleRegenerate);
  ampBMaxInput.addEventListener("input", scheduleRegenerate);
  jitterMinInput.addEventListener("input", scheduleRegenerate);
  jitterMaxInput.addEventListener("input", scheduleRegenerate);
  minRadiusRatioInput.addEventListener("input", scheduleRegenerate);
  smoothingMinInput.addEventListener("input", scheduleRegenerate);
  smoothingMaxInput.addEventListener("input", scheduleRegenerate);
  leanMinInput.addEventListener("input", scheduleRegenerate);
  leanMaxInput.addEventListener("input", scheduleRegenerate);

  seedInput.addEventListener("input", scheduleRegenerate);
  seedButton.addEventListener("click", () => {
    seedInput.value = generateRandomSeed();
    scheduleRegenerate();
  });

  regenButton.addEventListener("click", regenerateWorld);
  fitButton.addEventListener("click", fitView);
  copyButton.addEventListener("click", async () => {
    setConfigFromInputs();
    const snapshot = buildConfigSnapshot();
    const json = JSON.stringify(snapshot, null, 2);
    const ok = await copyTextToClipboard(json);
    status.textContent = ok ? "Copied config JSON." : "Copy failed.";
  });

  const render = () => {
    const { innerWidth, innerHeight } = window;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const gradient = ctx.createLinearGradient(0, 0, 0, innerHeight);
    gradient.addColorStop(0, SEA_GRADIENT_TOP);
    gradient.addColorStop(1, SEA_GRADIENT_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    ctx.save();
    ctx.translate(innerWidth / 2, innerHeight / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    if (showRingsInput.checked) {
      ctx.setLineDash([14 / camera.zoom, 10 / camera.zoom]);
      ctx.lineWidth = 2 / camera.zoom;
      currentConfig.biomeTiers.forEach((tier) => {
        const color = tierColors[tier.id] ?? "rgba(246, 231, 193, 0.6)";
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, tier.ringMin, currentConfig.arcMinAngle, currentConfig.arcMaxAngle);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, tier.ringMax, currentConfig.arcMinAngle, currentConfig.arcMaxAngle);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    const spawnZoneRadius = getSpawnZoneRadius(currentConfig);
    ctx.beginPath();
    ctx.arc(0, 0, spawnZoneRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(184, 139, 101, 0.35)";
    ctx.fill();

    world.islands.forEach((island) => {
      const style = islandStyles[island.type] ?? islandStyles.beach;
      ctx.fillStyle = style.sand;
      drawIsland(ctx, island.points);

      if (isBossIsland(island.type)) {
        ctx.strokeStyle = "rgba(255, 215, 160, 0.8)";
        ctx.lineWidth = 3 / camera.zoom;
        ctx.stroke();
      }

      if (style.grass) {
        const inner = insetPoints(island.points, island.center, ISLAND_INSET_SCALE);
        ctx.fillStyle = style.grass;
        drawIsland(ctx, inner);
      }

      if (showLabelsInput.checked) {
        ctx.save();
        ctx.font = LABEL_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3 / camera.zoom;
        ctx.strokeStyle = LABEL_STROKE;
        ctx.fillStyle = LABEL_COLOR;
        ctx.strokeText(island.type, island.center.x, island.center.y);
        ctx.fillText(island.type, island.center.x, island.center.y);
        ctx.restore();
      }
    });

    ctx.restore();
    requestAnimationFrame(render);
  };

  regenerateWorld();
  fitView();
  render();

  return {
    regenerateWorld,
    fitView,
    resetView,
    camera,
    panel,
  };
};
