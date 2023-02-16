import { HoloHash } from '@holochain/client';
// @ts-ignore
import blake from 'blakejs';

import { HoloHashMap } from '@holochain-open-dev/utils';

const hashLocationCache: HoloHashMap<HoloHash, Uint8Array> = new HoloHashMap();

export function location(bytesHash: HoloHash): number {
  let bytes: Uint8Array;
  if (hashLocationCache.has(bytesHash)) {
    bytes = hashLocationCache.get(bytesHash);
  } else {
    bytes = locationBytes(bytesHash);
    hashLocationCache.set(bytesHash, bytes);
  }
  const view = new DataView(bytes.buffer, 0);
  const location = wrap(view.getUint32(0, false));

  return location;
}

function locationBytes(bytesHash: HoloHash): Uint8Array {
  const hash128: Uint8Array = blake.blake2b(bytesHash, null, 16);

  const out = [hash128[0], hash128[1], hash128[2], hash128[3]];

  for (let i = 4; i < 16; i += 4) {
    out[0] ^= hash128[i];
    out[1] ^= hash128[i + 1];
    out[2] ^= hash128[i + 2];
    out[3] ^= hash128[i + 3];
  }
  return new Uint8Array(out);
}

// We return the distance as the shortest distance between two hashes in the circle
export function distance(hash1: HoloHash, hash2: HoloHash): number {
  const location1 = location(hash1);
  const location2 = location(hash2);

  return shortest_arc_distance(location1, location2) + 1;
}

export function areEqual(b1: Uint8Array, b2: Uint8Array): boolean {
  if (b1.length !== b2.length) return false;
  return hashToString(b1) === hashToString(b2);
}

export function hashToString(holoHash: HoloHash): string {
  return holoHash.toString();
}

export function shortest_arc_distance(
  location1: number,
  location2: number
): number {
  const distance1 = wrap(location1 - location2);
  const distance2 = wrap(location2 - location1);
  return Math.min(distance1, distance2);
}

const MAX_UINT = 4294967295;

export function wrap(uint: number): number {
  if (uint < 0) return 1 + MAX_UINT + uint;
  if (uint > MAX_UINT) return uint - MAX_UINT;
  return uint;
}
