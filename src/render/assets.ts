import type { ResourceKind } from "../world/types";
import crabUrl from "../assets/svg/crab.svg";
import pirateUrl from "../assets/svg/pirate.svg";
import bushUrl from "../assets/svg/bush.svg";
import palmtreeUrl from "../assets/svg/palmtree.svg";
import rockUrl from "../assets/svg/rock.svg";
import raftUrl from "../assets/svg/raft.svg";
import itemWoodUrl from "../assets/svg/items/item-wood.svg";
import itemRockUrl from "../assets/svg/items/item-rock.svg";
import itemRaftUrl from "../assets/svg/items/item-raft.svg";
import redberryUrl from "../assets/svg/items/redberry.svg";
import sabreUrl from "../assets/svg/items/sabre.svg";
import crabmeatUrl from "../assets/svg/items/crabmeat.svg";
import crabhelmetUrl from "../assets/svg/items/crabhelmet.svg";

const loadImage = (url: string) => {
  const image = new Image();
  image.src = url;
  return image;
};

export const isImageReady = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0;

export const worldImages = {
  crab: loadImage(crabUrl),
  pirate: loadImage(pirateUrl),
  bush: loadImage(bushUrl),
  palmtree: loadImage(palmtreeUrl),
  rock: loadImage(rockUrl),
  raft: loadImage(raftUrl)
};

export const itemImages: Record<ResourceKind, HTMLImageElement> = {
  wood: loadImage(itemWoodUrl),
  rock: loadImage(itemRockUrl),
  raft: loadImage(itemRaftUrl),
  berries: loadImage(redberryUrl),
  sword: loadImage(sabreUrl),
  crabmeat: loadImage(crabmeatUrl),
  crabhelmet: loadImage(crabhelmetUrl)
};
