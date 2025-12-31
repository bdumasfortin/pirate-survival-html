import type { Transport, TransportHandler } from "./transport";

export type WebSocketTransport = {
  socket: WebSocket;
  transport: Transport;
};

export const createWebSocketTransport = (url: string, onJsonMessage: (payload: string) => void): WebSocketTransport => {
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";

  let handler: TransportHandler | null = null;

  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      onJsonMessage(event.data);
      return;
    }

    if (event.data instanceof ArrayBuffer) {
      handler?.(event.data);
      return;
    }

    if (event.data instanceof Blob) {
      event.data.arrayBuffer().then((buffer) => handler?.(buffer)).catch(() => {
        // Ignore malformed binary messages.
      });
    }
  });

  const transport: Transport = {
    send: (data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    },
    onMessage: (nextHandler) => {
      handler = nextHandler;
    },
    close: () => {
      socket.close();
    }
  };

  return { socket, transport };
};
