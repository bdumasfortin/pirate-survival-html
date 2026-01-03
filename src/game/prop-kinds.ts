export type PropKind = "strawhat" | "raft";

export const PROP_KIND_TO_INDEX: Record<PropKind, number> = {
  strawhat: 1,
  raft: 2
};

const PROP_KIND_BY_INDEX: PropKind[] = [
  "strawhat",
  "raft"
];

export const propKindToIndex = (kind: PropKind) => PROP_KIND_TO_INDEX[kind];

export const propKindFromIndex = (index: number): PropKind =>
  PROP_KIND_BY_INDEX[index - 1] ?? "strawhat";
