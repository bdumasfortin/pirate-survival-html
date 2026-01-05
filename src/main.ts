import { setupCanvas } from "./app/canvas-setup";
import { WS_SERVER_URL } from "./app/constants";
import { startGame } from "./app/game-runtime";
import { initMenu } from "./app/menu-ui";
import { startNetworkClient } from "./app/network-client";
import { startNetworkHost } from "./app/network-host";
import { setNetIndicatorElement } from "./app/resync-manager";
import { createRoomMessageHandler } from "./app/room-message-handler";
import { activeSession } from "./app/state";
import { readStoredPlayerName } from "./app/storage";
import { generateRandomSeed, sanitizePlayerName } from "./app/ui-helpers";
import { pauseSession, resumeSessionFromFrame } from "./net/session";

// DOM element references
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("Canvas element not found.");
}
const ctx = setupCanvas(canvas);

const menuOverlay = document.getElementById("seed-menu") as HTMLElement | null;
const loadingOverlay = document.getElementById("loading-overlay") as HTMLElement | null;
const seedInput = document.getElementById("seed-input") as HTMLInputElement | null;
const seedInputMulti = document.getElementById("seed-input-mp") as HTMLInputElement | null;
const randomSeedButton = document.getElementById("seed-random") as HTMLButtonElement | null;
const randomSeedButtonMulti = document.getElementById("seed-random-mp") as HTMLButtonElement | null;
const startButton = document.getElementById("start-game") as HTMLButtonElement | null;
const modeSoloButton = document.getElementById("mode-solo") as HTMLButtonElement | null;
const modeMultiButton = document.getElementById("mode-multi") as HTMLButtonElement | null;
const multiCreateButton = document.getElementById("multi-create") as HTMLButtonElement | null;
const multiJoinButton = document.getElementById("multi-join") as HTMLButtonElement | null;
const soloPanel = document.getElementById("solo-panel") as HTMLElement | null;
const multiPanel = document.getElementById("multi-panel") as HTMLElement | null;
const roomForm = document.getElementById("room-form") as HTMLElement | null;
const roomScreen = document.getElementById("room-screen") as HTMLElement | null;
const playerNameInput = document.getElementById("player-name") as HTMLInputElement | null;
const serverUrlInput = document.getElementById("server-url") as HTMLInputElement | null;
const roomCodeInput = document.getElementById("room-code") as HTMLInputElement | null;
const createRoomButton = document.getElementById("create-room") as HTMLButtonElement | null;
const joinRoomButton = document.getElementById("join-room") as HTMLButtonElement | null;
const copyJoinLinkButton = document.getElementById("copy-join-link") as HTMLButtonElement | null;
const startRoomButton = document.getElementById("start-room") as HTMLButtonElement | null;
const leaveRoomButton = document.getElementById("leave-room") as HTMLButtonElement | null;
const roomStatus = document.getElementById("room-status") as HTMLElement | null;
const roomStatusForm = document.getElementById("room-status-form") as HTMLElement | null;
const roomStatusFormBox = roomStatusForm?.closest(".status-box") as HTMLElement | null;
const roomCodeDisplay = document.getElementById("room-code-display") as HTMLElement | null;
const roomPlayerCount = document.getElementById("room-player-count") as HTMLElement | null;
const netIndicator = document.getElementById("net-indicator") as HTMLElement | null;
const inGameMenu = document.getElementById("in-game-menu") as HTMLElement | null;
const resumeButton = document.getElementById("resume-game") as HTMLButtonElement | null;
const exitToMenuButton = document.getElementById("exit-to-menu") as HTMLButtonElement | null;

if (netIndicator) {
  setNetIndicatorElement(netIndicator);
}

const getServerUrlValue = (): string => serverUrlInput?.value.trim() || WS_SERVER_URL;

const getSeedValue = (input: HTMLInputElement | null): string => {
  const value = input?.value.trim() ?? "";
  return value.length > 0 ? value : generateRandomSeed();
};

const getPlayerNameValue = (): string => {
  const maxLength = 16; // MAX_PLAYER_NAME_LENGTH from constants
  return sanitizePlayerName(playerNameInput?.value ?? readStoredPlayerName(), maxLength);
};

const setInGameMenuVisible = (visible: boolean): void => {
  if (!inGameMenu) {
    return;
  }
  inGameMenu.classList.toggle("hidden", !visible);

  const session = activeSession;
  if (!session || session.expectedPlayerCount !== 1) {
    return;
  }

  if (visible) {
    if (session.status === "running") {
      pauseSession(session, "menu");
    }
  } else if (session.status === "paused" && session.pauseReason === "menu") {
    resumeSessionFromFrame(session, session.currentFrame);
  }
};

const returnToMainMenu = (): void => {
  window.location.href = window.location.pathname;
};

const setRoomScreenRef: { current: ((step: "form" | "room") => void) | null } = { current: null };

const handleRoomServerMessage = createRoomMessageHandler({
  netIndicator,
  roomStatusForm,
  roomStatusFormBox,
  setRoomScreen: (step: "form" | "room") => {
    if (setRoomScreenRef.current) {
      setRoomScreenRef.current(step);
    }
  },
  startGame: async (seed, options) => {
    await startGame(seed, options, {
      menuOverlay,
      loadingOverlay,
      netIndicator,
      setInGameMenuVisible,
      ctx,
    });
  },
});

const startNetworkHostWithDeps = (seed: string, options: import("./app/types").NetworkStartOptions): void => {
  startNetworkHost(seed, options, {
    getPlayerNameValue,
    setRoomScreen: (step: "form" | "room") => {
      if (setRoomScreenRef.current) {
        setRoomScreenRef.current(step);
      }
    },
    handleRoomServerMessage,
  });
};

const startNetworkClientWithDeps = (roomCode: string, options: import("./app/types").NetworkStartOptions): void => {
  startNetworkClient(roomCode, options, {
    getPlayerNameValue,
    setRoomScreen: (step: "form" | "room") => {
      if (setRoomScreenRef.current) {
        setRoomScreenRef.current(step);
      }
    },
    handleRoomServerMessage,
  });
};

initMenu({
  menuOverlay,
  loadingOverlay,
  seedInput,
  randomSeedButton,
  startButton,
  seedInputMulti,
  randomSeedButtonMulti,
  roomStatus,
  roomCodeDisplay,
  roomPlayerCount,
  createRoomButton,
  joinRoomButton,
  startRoomButton,
  leaveRoomButton,
  copyJoinLinkButton,
  multiCreateButton,
  multiJoinButton,
  modeSoloButton,
  modeMultiButton,
  serverUrlInput,
  roomCodeInput,
  playerNameInput,
  roomForm,
  roomScreen,
  roomStatusForm,
  roomStatusFormBox,
  multiPanel,
  soloPanel,
  resumeButton,
  exitToMenuButton,
  inGameMenu,
  getSeedValue,
  getPlayerNameValue,
  getServerUrlValue,
  setInGameMenuVisible,
  returnToMainMenu,
  startGame: async (seed, options) => {
    await startGame(seed, options ?? {}, {
      menuOverlay,
      loadingOverlay,
      netIndicator,
      setInGameMenuVisible,
      ctx,
    });
  },
  startNetworkHost: startNetworkHostWithDeps,
  startNetworkClient: startNetworkClientWithDeps,
  setRoomScreen: setRoomScreenRef,
});
