export const setOverlayVisible = (element: HTMLElement | null, visible: boolean): void => {
  if (!element) {
    return;
  }
  element.classList.toggle("hidden", !visible);
};

export const setNetIndicator = (netIndicator: HTMLElement | null, text: string, visible: boolean): void => {
  if (!netIndicator) {
    return;
  }
  netIndicator.textContent = text;
  netIndicator.classList.toggle("hidden", !visible);
};

export const generateRandomSeed = (): string => {
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0].toString(36);
  }
  return Math.floor(Math.random() * 1_000_000_000).toString(36);
};

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
};

export const buildJoinLink = (roomCode: string, serverUrl: string): string => {
  const url = new URL(window.location.href);
  url.searchParams.set("net", "ws");
  url.searchParams.set("role", "client");
  url.searchParams.set("room", roomCode);
  url.searchParams.set("ws", serverUrl);
  return url.toString();
};

export const sanitizePlayerName = (value: string, maxLength: number): string => {
  return value.trim().slice(0, maxLength);
};
