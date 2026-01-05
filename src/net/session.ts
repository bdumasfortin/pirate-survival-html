export type SessionStatus = "handshaking" | "running" | "paused";

export type PauseReason = "desync" | "menu";

export type SessionPlayerInfo = {
  id: string;
  index: number;
};

export type SessionPlayer = SessionPlayerInfo & {
  isLocal: boolean;
};

export type SessionState = {
  id: string;
  status: SessionStatus;
  isHost: boolean;
  localId: string;
  localPlayerIndex: number;
  expectedPlayerCount: number;
  players: SessionPlayer[];
  seed: string | null;
  startFrame: number;
  currentFrame: number;
  pauseReason: PauseReason | null;
};

export type SessionMessage =
  | { type: "join-request"; playerId: string }
  | { type: "join-accept"; playerId: string; assignedIndex: number }
  | { type: "start"; seed: string; startFrame: number; players: SessionPlayerInfo[] }
  | { type: "resync-request"; fromFrame: number; reason: PauseReason }
  | { type: "resync-state"; frame: number; seed: string; players: SessionPlayerInfo[] };

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const values = new Uint32Array(2);
    (crypto as Crypto).getRandomValues(values);
    return `${values[0].toString(16)}${values[1].toString(16)}`;
  }

  return Math.floor(Math.random() * 1_000_000_000).toString(16);
};

const toPlayerInfo = (players: SessionPlayer[]) => players.map(({ id, index }) => ({ id, index }));

export const createHostSession = (seed: string, expectedPlayerCount: number): SessionState => {
  const localId = createId();
  return {
    id: createId(),
    status: "handshaking",
    isHost: true,
    localId,
    localPlayerIndex: 0,
    expectedPlayerCount,
    players: [{ id: localId, index: 0, isLocal: true }],
    seed,
    startFrame: 0,
    currentFrame: 0,
    pauseReason: null
  };
};

export const createClientSession = (): SessionState => {
  const localId = createId();
  return {
    id: createId(),
    status: "handshaking",
    isHost: false,
    localId,
    localPlayerIndex: -1,
    expectedPlayerCount: 0,
    players: [{ id: localId, index: -1, isLocal: true }],
    seed: null,
    startFrame: 0,
    currentFrame: 0,
    pauseReason: null
  };
};

export const buildJoinRequest = (session: SessionState): SessionMessage => ({
  type: "join-request",
  playerId: session.localId
});

export const applyJoinRequest = (session: SessionState, message: SessionMessage) => {
  if (!session.isHost || message.type !== "join-request") {
    return null;
  }

  if (session.players.length >= session.expectedPlayerCount) {
    return null;
  }

  const assignedIndex = session.players.length;
  session.players.push({ id: message.playerId, index: assignedIndex, isLocal: false });
  return {
    type: "join-accept",
    playerId: message.playerId,
    assignedIndex
  } satisfies SessionMessage;
};

export const applyJoinAccept = (session: SessionState, message: SessionMessage) => {
  if (message.type !== "join-accept" || message.playerId !== session.localId) {
    return;
  }

  session.localPlayerIndex = message.assignedIndex;
  session.players = session.players.map((player) =>
    player.id === session.localId
      ? { ...player, index: message.assignedIndex }
      : player
  );
};

export const finalizeSessionStart = (session: SessionState, currentFrame: number, delayFrames: number) => {
  if (!session.isHost || session.seed === null) {
    return null;
  }

  const startFrame = currentFrame + Math.max(0, delayFrames);
  session.startFrame = startFrame;
  session.status = "running";
  session.pauseReason = null;

  return {
    type: "start",
    seed: session.seed,
    startFrame,
    players: toPlayerInfo(session.players)
  } satisfies SessionMessage;
};

export const applySessionStart = (session: SessionState, message: SessionMessage) => {
  if (message.type !== "start") {
    return;
  }

  session.seed = message.seed;
  session.startFrame = message.startFrame;
  session.players = message.players.map((player) => ({
    ...player,
    isLocal: player.id === session.localId
  }));
  session.expectedPlayerCount = session.players.length;
  session.status = "running";
  session.pauseReason = null;
};

export const pauseSession = (session: SessionState, reason: PauseReason) => {
  session.status = "paused";
  session.pauseReason = reason;
};

export const resumeSessionFromFrame = (session: SessionState, frame: number) => {
  session.currentFrame = frame;
  session.status = "running";
  session.pauseReason = null;
};

export const buildResyncRequest = (session: SessionState, reason: PauseReason): SessionMessage => {
  pauseSession(session, reason);
  return {
    type: "resync-request",
    fromFrame: session.currentFrame,
    reason
  };
};

export const applyResyncRequest = (session: SessionState, message: SessionMessage) => {
  if (message.type !== "resync-request") {
    return;
  }

  pauseSession(session, message.reason);
};

export const buildResyncState = (session: SessionState, frame: number): SessionMessage | null => {
  if (session.seed === null) {
    return null;
  }

  return {
    type: "resync-state",
    frame,
    seed: session.seed,
    players: toPlayerInfo(session.players)
  };
};

export const applyResyncState = (session: SessionState, message: SessionMessage) => {
  if (message.type !== "resync-state") {
    return;
  }

  session.seed = message.seed;
  session.currentFrame = message.frame;
  session.players = message.players.map((player) => ({
    ...player,
    isLocal: player.id === session.localId
  }));
  session.status = "paused";
  session.pauseReason = "desync";
};

export const setSessionFrame = (session: SessionState, frame: number) => {
  session.currentFrame = frame;
};
