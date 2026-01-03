import type { ItemKind } from "../game/item-kinds";
import type { PropKind } from "../game/prop-kinds";
import type { EquipmentSlotType } from "../game/equipment";
import crabUrl from "../assets/png/entities/crab.png";
import wolfUrl from "../assets/png/entities/wolf.png";
import krakenUrl from "../assets/png/entities/kraken.png";
import pirateUrl from "../assets/png/entities/pirate.png";
import bushUrl from "../assets/png/environment/bush.png";
import bushEmptyUrl from "../assets/png/environment/bush-empty.png";
import palmtreeUrl from "../assets/png/environment/palm-tree.png";
import pebbleUrl from "../assets/png/environment/pebble.png";
import raftUrl from "../assets/png/vehicules/raft.png";
import cutlassUrl from "../assets/png/tools/cutlass.png";
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
import strawhatUrl from "../assets/svg/strawhat.svg";
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
  bushEmpty: loadImage(bushEmptyUrl),
  palmtree: loadImage(palmtreeUrl),
  rock: loadImage(pebbleUrl),
  raft: loadImage(raftUrl),
  cutlass: loadImage(cutlassUrl)
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

export const propImages: Record<PropKind, HTMLImageElement> = {
  strawhat: loadImage(strawhatUrl)
};
