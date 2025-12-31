export type TransportHandler = (data: ArrayBuffer) => void;

export type Transport = {
  send: (data: ArrayBuffer) => void;
  onMessage: (handler: TransportHandler) => void;
  close: () => void;
};

export type LoopbackOptions = {
  latencyMs?: number;
  jitterMs?: number;
  dropRate?: number;
};

const scheduleDelivery = (handler: TransportHandler | null, data: ArrayBuffer, options: LoopbackOptions) => {
  if (!handler) {
    return;
  }

  const dropRate = options.dropRate ?? 0;
  if (dropRate > 0 && Math.random() < dropRate) {
    return;
  }

  const latencyMs = options.latencyMs ?? 0;
  const jitterMs = options.jitterMs ?? 0;
  const jitter = jitterMs > 0 ? (Math.random() * 2 - 1) * jitterMs : 0;
  const delay = Math.max(0, latencyMs + jitter);
  const payload = data.slice(0);

  if (delay <= 0) {
    handler(payload);
    return;
  }

  setTimeout(() => handler(payload), delay);
};

export const createLoopbackTransportPair = (options: LoopbackOptions = {}): [Transport, Transport] => {
  let handlerA: TransportHandler | null = null;
  let handlerB: TransportHandler | null = null;

  const endpointA: Transport = {
    send: (data) => scheduleDelivery(handlerB, data, options),
    onMessage: (handler) => {
      handlerA = handler;
    },
    close: () => {
      handlerA = null;
      handlerB = null;
    }
  };

  const endpointB: Transport = {
    send: (data) => scheduleDelivery(handlerA, data, options),
    onMessage: (handler) => {
      handlerB = handler;
    },
    close: () => {
      handlerA = null;
      handlerB = null;
    }
  };

  return [endpointA, endpointB];
};
