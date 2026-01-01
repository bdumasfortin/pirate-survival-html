import type { ItemKind } from "../game/item-kinds";
import type { EquipmentSlotType } from "../game/equipment";
import crabUrl from "../assets/svg/crab.svg";
import wolfUrl from "../assets/svg/wolf.svg";
import krakenUrl from "../assets/svg/kraken.svg";
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
import wolfmeatUrl from "../assets/svg/items/wolfmeat.svg";
import crabhelmetUrl from "../assets/svg/items/crabhelmet.svg";
import wolfcloakUrl from "../assets/svg/items/wolfcloak.svg";
import krakenringUrl from "../assets/svg/items/krakenring.svg";
import placeholderHelmetUrl from "../assets/svg/placeholders/placeholder-helmet.svg";
import placeholderCloakUrl from "../assets/svg/placeholders/placeholder-cloak.svg";
import placeholderChestUrl from "../assets/svg/placeholders/placeholder-chest.svg";
import placeholderLegsUrl from "../assets/svg/placeholders/placeholder-legs.svg";
import placeholderBootsUrl from "../assets/svg/placeholders/placeholder-boots.svg";
import placeholderRingUrl from "../assets/svg/placeholders/placeholder-ring.svg";

const loadImage = (url: string) => {
  const image = new Image();
  image.src = url;
  return image;
};

export const isImageReady = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0;

export const worldImages = {
  crab: loadImage(crabUrl),
  wolf: loadImage(wolfUrl),
  kraken: loadImage(krakenUrl),
  pirate: loadImage(pirateUrl),
  bush: loadImage(bushUrl),
  palmtree: loadImage(palmtreeUrl),
  rock: loadImage(rockUrl),
  raft: loadImage(raftUrl)
};

export const equipmentPlaceholderImages: Record<EquipmentSlotType, HTMLImageElement> = {
  helmet: loadImage(placeholderHelmetUrl),
  cloak: loadImage(placeholderCloakUrl),
  chest: loadImage(placeholderChestUrl),
  legs: loadImage(placeholderLegsUrl),
  boots: loadImage(placeholderBootsUrl),
  ring: loadImage(placeholderRingUrl)
};

export const itemImages: Record<ItemKind, HTMLImageElement> = {
  wood: loadImage(itemWoodUrl),
  rock: loadImage(itemRockUrl),
  raft: loadImage(itemRaftUrl),
  berries: loadImage(redberryUrl),
  sword: loadImage(sabreUrl),
  crabmeat: loadImage(crabmeatUrl),
  wolfmeat: loadImage(wolfmeatUrl),
  crabhelmet: loadImage(crabhelmetUrl),
  wolfcloak: loadImage(wolfcloakUrl),
  krakenring: loadImage(krakenringUrl)
};
