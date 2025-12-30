export type RaftState = {
  isOnRaft: boolean;
};

export const createRaftState = (): RaftState => ({
  isOnRaft: false
});
