import { HoloHash } from "@holochain/client";

export function hashToString(holoHash: HoloHash): string {
  return holoHash.toString();
}