import { PLAYER_NAME_STORAGE_KEY, ROOM_CODE_STORAGE_KEY, SERVER_URL_STORAGE_KEY } from "./constants";

export const readStoredPlayerName = (): string => {
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

export const readStoredServerUrl = (): string => {
  try {
    return localStorage.getItem(SERVER_URL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

export const readStoredRoomCode = (): string => {
  try {
    return localStorage.getItem(ROOM_CODE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

export const storePlayerName = (value: string): void => {
  try {
    if (!value) {
      localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
      return;
    }
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (private mode, etc).
  }
};

export const storeServerUrl = (value: string): void => {
  try {
    if (!value) {
      localStorage.removeItem(SERVER_URL_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SERVER_URL_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (private mode, etc).
  }
};

export const storeRoomCode = (value: string): void => {
  try {
    if (!value) {
      localStorage.removeItem(ROOM_CODE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ROOM_CODE_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (private mode, etc).
  }
};
