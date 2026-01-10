import { isValidRoomCode, normalizeRoomCode } from "../../shared/room-protocol";
import { runDeterminismCheck } from "../dev/determinism";
import { closeMapOverlay, isMapOverlayEnabled } from "../game/map-overlay";
import { setHudRoomCode } from "../render/ui";
import type { WorldPreset } from "../world/types";
import {
  NETWORK_MODE,
  REQUESTED_INPUT_DELAY_FRAMES,
  SHOULD_RUN_DETERMINISM,
  WS_ROLE,
  WS_ROOM_CODE,
  WS_SERVER_URL,
} from "./constants";
import { sendRoomMessage } from "./room-messages";
import { activeGame, activeRoomSocket, activeRoomState, activeSession, hasStarted, setActiveRoomState } from "./state";
import {
  readStoredPlayerName,
  readStoredRoomCode,
  readStoredServerUrl,
  storePlayerName,
  storeRoomCode,
  storeServerUrl,
} from "./storage";
import type { NetworkStartOptions, RoomUiState } from "./types";
import { buildJoinLink, copyTextToClipboard, generateRandomSeed, sanitizePlayerName } from "./ui-helpers";

type MenuUIDependencies = {
  // DOM elements
  menuOverlay: HTMLElement | null;
  loadingOverlay: HTMLElement | null;
  seedInput: HTMLInputElement | null;
  randomSeedButton: HTMLButtonElement | null;
  startButton: HTMLButtonElement | null;
  seedInputMulti: HTMLInputElement | null;
  randomSeedButtonMulti: HTMLButtonElement | null;
  roomStatus: HTMLElement | null;
  roomCodeDisplay: HTMLElement | null;
  roomPlayerCount: HTMLElement | null;
  createRoomButton: HTMLButtonElement | null;
  joinRoomButton: HTMLButtonElement | null;
  startRoomButton: HTMLButtonElement | null;
  leaveRoomButton: HTMLButtonElement | null;
  copyJoinLinkButton: HTMLButtonElement | null;
  multiCreateButton: HTMLButtonElement | null;
  multiJoinButton: HTMLButtonElement | null;
  modeSoloButton: HTMLButtonElement | null;
  modeMultiButton: HTMLButtonElement | null;
  serverUrlInput: HTMLInputElement | null;
  roomCodeInput: HTMLInputElement | null;
  playerNameInput: HTMLInputElement | null;
  worldPresetSelect: HTMLSelectElement | null;
  worldPresetSelectMulti: HTMLSelectElement | null;
  roomForm: HTMLElement | null;
  roomScreen: HTMLElement | null;
  roomStatusForm: HTMLElement | null;
  roomStatusFormBox: HTMLElement | null;
  multiPanel: HTMLElement | null;
  soloPanel: HTMLElement | null;
  resumeButton: HTMLButtonElement | null;
  exitToMenuButton: HTMLButtonElement | null;
  inGameMenu: HTMLElement | null;
  // Functions
  getSeedValue: (input: HTMLInputElement | null) => string;
  getPlayerNameValue: () => string;
  getServerUrlValue: () => string;
  setInGameMenuVisible: (visible: boolean) => void;
  returnToMainMenu: () => void;
  startGame: (seed: string, options?: import("./types").StartGameOptions) => Promise<void>;
  startNetworkHost: (seed: string, options: NetworkStartOptions) => void;
  startNetworkClient: (roomCode: string, options: NetworkStartOptions) => void;
  setRoomScreen: { current: ((step: "form" | "room") => void) | null } | null;
};

let isInGameMenuOpen = false;

export const initMenu = (deps: MenuUIDependencies): void => {
  if (SHOULD_RUN_DETERMINISM) {
    runDeterminismCheck();
    return;
  }

  deps.resumeButton?.addEventListener("click", () => deps.setInGameMenuVisible(false));
  deps.exitToMenuButton?.addEventListener("click", deps.returnToMainMenu);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    if (!hasStarted || !activeGame || !activeSession) {
      return;
    }
    if (isMapOverlayEnabled()) {
      closeMapOverlay();
      event.preventDefault();
      return;
    }
    const currentGame = activeGame;
    const currentSession = activeSession;
    const craftingOpen = currentGame.state.crafting[currentSession.localPlayerIndex]?.isOpen ?? false;
    if (craftingOpen) {
      return;
    }
    isInGameMenuOpen = !isInGameMenuOpen;
    deps.setInGameMenuVisible(isInGameMenuOpen);
    event.preventDefault();
  });

  const hasMenu =
    deps.menuOverlay && deps.loadingOverlay && deps.seedInput && deps.randomSeedButton && deps.startButton;
  if (!hasMenu) {
    const seed = generateRandomSeed();
    if (NETWORK_MODE === "ws" && WS_ROLE === "host") {
      void deps.startNetworkHost(seed, {});
      return;
    }
    void deps.startGame(seed);
    return;
  }

  let multiplayerActionsEnabled = true;
  const setJoinLinkEnabled = (enabled: boolean): void => {
    if (deps.copyJoinLinkButton) {
      deps.copyJoinLinkButton.disabled = !enabled;
    }
  };
  const updateMultiplayerActions = (): void => {
    const nameValid = deps.getPlayerNameValue().length > 0;
    const enabled = multiplayerActionsEnabled && nameValid;
    if (deps.createRoomButton) {
      deps.createRoomButton.disabled = !enabled;
    }
    if (deps.joinRoomButton) {
      deps.joinRoomButton.disabled = !enabled;
    }
  };

  const roomUi: RoomUiState | null =
    deps.roomStatus &&
    deps.roomCodeDisplay &&
    deps.roomPlayerCount &&
    deps.createRoomButton &&
    deps.joinRoomButton &&
    deps.startRoomButton
      ? {
          setStatus: (text, isError = false) => {
            if (deps.roomStatus) {
              deps.roomStatus.textContent = `Status: ${text}`;
              deps.roomStatus.classList.toggle("error", isError);
            }
          },
          setRoomInfo: (code, players, playerCount) => {
            if (deps.roomCodeDisplay) {
              deps.roomCodeDisplay.textContent = code ?? "--";
            }
            if (deps.roomPlayerCount) {
              const total = playerCount > 0 ? playerCount : players.length;
              deps.roomPlayerCount.textContent = `${players.length}/${total}`;
            }
            setHudRoomCode(code);
            setJoinLinkEnabled(Boolean(code));
            storeRoomCode(code ?? "");
          },
          setStartEnabled: (enabled) => {
            if (deps.startRoomButton) {
              deps.startRoomButton.disabled = !enabled;
              deps.startRoomButton.classList.toggle("hidden", !enabled);
            }
          },
          setActionsEnabled: (enabled) => {
            multiplayerActionsEnabled = enabled;
            updateMultiplayerActions();
            setJoinLinkEnabled(enabled && Boolean(activeRoomState?.roomCode));
            if (deps.multiCreateButton) {
              deps.multiCreateButton.disabled = !enabled;
            }
            if (deps.multiJoinButton) {
              deps.multiJoinButton.disabled = !enabled;
            }
            if (deps.modeSoloButton) {
              deps.modeSoloButton.disabled = !enabled;
            }
            if (deps.modeMultiButton) {
              deps.modeMultiButton.disabled = !enabled;
            }
            if (deps.serverUrlInput) {
              deps.serverUrlInput.disabled = !enabled;
            }
            if (deps.roomCodeInput) {
              deps.roomCodeInput.disabled = !enabled;
            }
            if (deps.playerNameInput) {
              deps.playerNameInput.disabled = !enabled;
            }
            if (deps.seedInputMulti) {
              deps.seedInputMulti.disabled = !enabled;
            }
            if (deps.randomSeedButtonMulti) {
              deps.randomSeedButtonMulti.disabled = !enabled;
            }
            if (deps.worldPresetSelectMulti) {
              deps.worldPresetSelectMulti.disabled = !enabled;
            }
          },
        }
      : null;

  let multiplayerMode: "create" | "join" = "create";
  const createOnlyElements = deps.multiPanel?.querySelectorAll<HTMLElement>(".create-only") ?? [];
  const joinOnlyElements = deps.multiPanel?.querySelectorAll<HTMLElement>(".join-only") ?? [];
  const setFormStatus = (text: string, isError = false): void => {
    if (!deps.roomStatusForm) {
      return;
    }
    deps.roomStatusForm.textContent = text || "";
    deps.roomStatusForm.classList.toggle("error", isError);
    deps.roomStatusFormBox?.classList.toggle("hidden", !text);
  };
  const setRoomStep = (step: "form" | "room"): void => {
    if (!deps.roomForm || !deps.roomScreen) {
      return;
    }
    deps.roomForm.classList.toggle("hidden", step !== "form");
    deps.roomScreen.classList.toggle("hidden", step !== "room");
    if (step === "form") {
      setFormStatus("", false);
    }
  };
  if (deps.setRoomScreen) {
    deps.setRoomScreen.current = setRoomStep;
  }

  const setMultiplayerMode = (mode: "create" | "join"): void => {
    multiplayerMode = mode;
    createOnlyElements.forEach((element) => {
      element.classList.toggle("hidden", mode === "join");
    });
    joinOnlyElements.forEach((element) => {
      element.classList.toggle("hidden", mode === "create");
    });
    deps.multiCreateButton?.classList.toggle("active", mode === "create");
    deps.multiJoinButton?.classList.toggle("active", mode === "join");
    setFormStatus("", false);
  };

  const setMode = (mode: "solo" | "multi"): void => {
    if (deps.soloPanel) {
      deps.soloPanel.classList.toggle("hidden", mode !== "solo");
    }
    if (deps.multiPanel) {
      deps.multiPanel.classList.toggle("hidden", mode !== "multi");
    }
    deps.modeSoloButton?.classList.toggle("active", mode === "solo");
    deps.modeMultiButton?.classList.toggle("active", mode === "multi");
    if (mode === "multi") {
      setMultiplayerMode(multiplayerMode);
      setRoomStep("form");
    }
  };

  deps.modeSoloButton?.addEventListener("click", () => setMode("solo"));
  deps.modeMultiButton?.addEventListener("click", () => setMode("multi"));
  deps.multiCreateButton?.addEventListener("click", () => setMultiplayerMode("create"));
  deps.multiJoinButton?.addEventListener("click", () => setMultiplayerMode("join"));
  setMode("solo");
  setMultiplayerMode("create");

  if (deps.serverUrlInput) {
    const storedUrl = readStoredServerUrl();
    deps.serverUrlInput.value = storedUrl || WS_SERVER_URL;
    deps.serverUrlInput.addEventListener("input", () => {
      const value = deps.serverUrlInput!.value.trim();
      storeServerUrl(value);
    });
  }
  if (deps.roomCodeInput) {
    const storedCode = readStoredRoomCode();
    deps.roomCodeInput.value = WS_ROOM_CODE || storedCode;
    deps.roomCodeInput.addEventListener("input", () => {
      const value = normalizeRoomCode(deps.roomCodeInput!.value);
      if (deps.roomCodeInput!.value !== value) {
        deps.roomCodeInput!.value = value;
      }
      storeRoomCode(value);
    });
  }
  if (deps.playerNameInput) {
    const storedName = sanitizePlayerName(readStoredPlayerName(), 16);
    if (storedName) {
      deps.playerNameInput.value = storedName;
    }
    deps.playerNameInput.addEventListener("input", () => {
      const sanitized = sanitizePlayerName(deps.playerNameInput!.value, 16);
      if (deps.playerNameInput!.value !== sanitized) {
        deps.playerNameInput!.value = sanitized;
      }
      storePlayerName(sanitized);
      updateMultiplayerActions();
      setFormStatus("", false);
    });
  }
  roomUi?.setRoomInfo(null, [], 0);
  updateMultiplayerActions();
  setJoinLinkEnabled(false);

  deps.randomSeedButton?.addEventListener("click", () => {
    if (!deps.seedInput) return;
    const seed = generateRandomSeed();
    deps.seedInput.value = seed;
    deps.seedInput.focus();
    deps.seedInput.select();
  });

  deps.randomSeedButtonMulti?.addEventListener("click", () => {
    const seed = generateRandomSeed();
    if (deps.seedInputMulti) {
      deps.seedInputMulti.value = seed;
      deps.seedInputMulti.focus();
      deps.seedInputMulti.select();
    }
  });

  const ensurePlayerName = (): string | null => {
    const playerName = deps.getPlayerNameValue();
    if (!playerName) {
      setFormStatus("Enter player name.", true);
      deps.playerNameInput?.focus();
      return null;
    }
    storePlayerName(playerName);
    return playerName;
  };

  const resolveWorldPreset = (select: HTMLSelectElement | null): WorldPreset => {
    const value = select?.value ?? "procedural";
    if (value === "test" || value === "creative") {
      return value;
    }
    return "procedural";
  };

  const handleStart = (): void => {
    const seed = deps.getSeedValue(deps.seedInput);
    deps.seedInput!.value = seed;
    deps.seedInput!.disabled = true;
    deps.randomSeedButton!.disabled = true;
    if (deps.worldPresetSelect) {
      deps.worldPresetSelect.disabled = true;
    }
    deps.startButton!.disabled = true;
    if (NETWORK_MODE === "ws" && WS_ROLE === "host") {
      const worldPreset = resolveWorldPreset(deps.worldPresetSelectMulti ?? deps.worldPresetSelect);
      deps.startNetworkHost(seed, { ui: roomUi, worldPreset });
      return;
    }
    const worldPreset = resolveWorldPreset(deps.worldPresetSelect);
    void deps.startGame(seed, { worldConfig: { preset: worldPreset } });
  };

  deps.startButton?.addEventListener("click", handleStart);
  deps.seedInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleStart();
    }
  });

  deps.createRoomButton?.addEventListener("click", () => {
    const playerName = ensurePlayerName();
    if (!playerName) {
      return;
    }
    setRoomStep("room");
    const seed = deps.getSeedValue(deps.seedInputMulti ?? deps.seedInput);
    const serverUrl = deps.getServerUrlValue();
    const worldPreset = resolveWorldPreset(deps.worldPresetSelectMulti ?? deps.worldPresetSelect);
    setMode("multi");
    setMultiplayerMode("create");
    deps.startNetworkHost(seed, {
      serverUrl,
      inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
      ui: roomUi,
      playerName,
      worldPreset,
    });
  });

  deps.joinRoomButton?.addEventListener("click", () => {
    const playerName = ensurePlayerName();
    if (!playerName) {
      return;
    }
    const serverUrl = deps.getServerUrlValue();
    const code = deps.roomCodeInput?.value.trim() ?? "";
    const normalizedCode = normalizeRoomCode(code);
    if (!isValidRoomCode(normalizedCode)) {
      setFormStatus("Invalid room code.", true);
      return;
    }
    setRoomStep("room");
    setMode("multi");
    setMultiplayerMode("join");
    deps.startNetworkClient(normalizedCode, {
      serverUrl,
      inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
      ui: roomUi,
      playerName,
    });
  });

  deps.startRoomButton?.addEventListener("click", () => {
    const currentRoomState = activeRoomState;
    if (!currentRoomState || currentRoomState.role !== "host") {
      return;
    }
    const currentSocket = activeRoomSocket;
    if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    sendRoomMessage(currentSocket, { type: "start-room" });
    currentRoomState.hasSentStart = true;
    roomUi?.setStatus("Starting match...");
  });

  deps.leaveRoomButton?.addEventListener("click", () => {
    const currentSocket = activeRoomSocket;
    if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
      sendRoomMessage(currentSocket, { type: "leave-room" });
      currentSocket.close();
    } else if (currentSocket) {
      currentSocket.close();
    }
    setActiveRoomState(null);
    deps.setRoomScreen?.current?.("form");
    roomUi?.setActionsEnabled(true);
    roomUi?.setStartEnabled(false);
    setHudRoomCode(null);
  });

  deps.copyJoinLinkButton?.addEventListener("click", async () => {
    const code = activeRoomState?.roomCode;
    if (!code) {
      return;
    }
    const serverUrl = deps.getServerUrlValue();
    const link = buildJoinLink(code, serverUrl);
    const ok = await copyTextToClipboard(link);
    roomUi?.setStatus(ok ? "Join link copied." : "Failed to copy join link.", !ok);
  });

  if (NETWORK_MODE === "ws") {
    setMode("multi");
    if (WS_ROLE === "client" && WS_ROOM_CODE) {
      const playerName = ensurePlayerName();
      if (!playerName) {
        return;
      }
      setMultiplayerMode("join");
      deps.startNetworkClient(WS_ROOM_CODE, {
        serverUrl: WS_SERVER_URL,
        inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
        ui: roomUi,
        playerName,
      });
      return;
    }
    if (WS_ROLE === "host") {
      const playerName = ensurePlayerName();
      if (!playerName) {
        return;
      }
      const seed = deps.getSeedValue(deps.seedInputMulti ?? deps.seedInput);
      const worldPreset = resolveWorldPreset(deps.worldPresetSelectMulti ?? deps.worldPresetSelect);
      setMultiplayerMode("create");
      deps.startNetworkHost(seed, {
        serverUrl: WS_SERVER_URL,
        inputDelayFrames: REQUESTED_INPUT_DELAY_FRAMES,
        ui: roomUi,
        playerName,
        worldPreset,
      });
      return;
    }
  }
};
