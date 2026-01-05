import type { InputFrame } from "../core/input-buffer";

export type InputPacket = {
  playerIndex: number;
  frame: number;
  input: InputFrame;
};

export const INPUT_PACKET_SIZE = 26;

export const encodeInputPacket = (packet: InputPacket): ArrayBuffer => {
  const buffer = new ArrayBuffer(INPUT_PACKET_SIZE);
  const view = new DataView(buffer);
  let offset = 0;

  view.setInt32(offset, packet.frame, true);
  offset += 4;
  view.setUint8(offset, packet.playerIndex);
  offset += 1;
  view.setUint8(offset, 0);
  offset += 1;
  view.setUint32(offset, packet.input.buttons >>> 0, true);
  offset += 4;
  view.setInt16(offset, packet.input.craftIndex, true);
  offset += 2;
  view.setInt16(offset, packet.input.craftScroll, true);
  offset += 2;
  view.setInt16(offset, packet.input.inventoryIndex, true);
  offset += 2;
  view.setInt16(offset, packet.input.inventoryScroll, true);
  offset += 2;
  view.setInt32(offset, packet.input.mouseX, true);
  offset += 4;
  view.setInt32(offset, packet.input.mouseY, true);
  return buffer;
};

export const decodeInputPacket = (buffer: ArrayBuffer): InputPacket | null => {
  if (buffer.byteLength < INPUT_PACKET_SIZE) {
    return null;
  }

  const view = new DataView(buffer);
  let offset = 0;

  const frame = view.getInt32(offset, true);
  offset += 4;
  const playerIndex = view.getUint8(offset);
  offset += 2;
  const buttons = view.getUint32(offset, true);
  offset += 4;
  const craftIndex = view.getInt16(offset, true);
  offset += 2;
  const craftScroll = view.getInt16(offset, true);
  offset += 2;
  const inventoryIndex = view.getInt16(offset, true);
  offset += 2;
  const inventoryScroll = view.getInt16(offset, true);
  offset += 2;
  const mouseX = view.getInt32(offset, true);
  offset += 4;
  const mouseY = view.getInt32(offset, true);

  return {
    frame,
    playerIndex,
    input: {
      buttons,
      craftIndex,
      craftScroll,
      inventoryIndex,
      inventoryScroll,
      mouseX,
      mouseY,
    },
  };
};
