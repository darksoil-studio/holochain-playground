import {
  serializeHash,
  Dictionary,
  deserializeHash,
} from '@holochain-open-dev/core-types';
import {
  AgentPubKey,
  CellId,
  DnaHash,
  HoloHash,
} from '@holochain/conductor-api';
// @ts-ignore
import blake from 'blakejs';
import { encode } from '@msgpack/msgpack';
import { Base64 } from 'js-base64';
import { HoloHashMap } from './holo-hash-map';

export enum HashType {
  AGENT,
  ENTRY,
  DHTOP,
  HEADER,
  DNA,
}

export const AGENT_PREFIX = 'hCAk';
export const ENTRY_PREFIX = 'hCEk';
export const DHTOP_PREFIX = 'hCQk';
export const DNA_PREFIX = 'hC0k';
export const HEADER_PREFIX = 'hCkk';

function getPrefix(type: HashType) {
  switch (type) {
    case HashType.AGENT:
      return AGENT_PREFIX;
    case HashType.ENTRY:
      return ENTRY_PREFIX;
    case HashType.DHTOP:
      return DHTOP_PREFIX;
    case HashType.HEADER:
      return HEADER_PREFIX;
    case HashType.DNA:
      return DNA_PREFIX;
  }
}

export function retype(hash: HoloHash, type: HashType): HoloHash {
  return new Uint8Array([
    ...Base64.toUint8Array(getPrefix(type)),
    ...hash.slice(3),
  ]);
}

export function isHash(hash: string): boolean {
  return !![
    AGENT_PREFIX,
    ENTRY_PREFIX,
    DHTOP_PREFIX,
    DNA_PREFIX,
    HEADER_PREFIX,
  ].find(prefix => hash.startsWith(`u${prefix}`));
}

// From https://github.com/holochain/holochain/blob/dc0cb61d0603fa410ac5f024ed6ccfdfc29715b3/crates/holo_hash/src/encode.rs
export function hash(content: any, type: HashType): HoloHash {
  const bytesHash: Uint8Array = blake.blake2b(encode(content), null, 32);

  const fullhash = new Uint8Array([
    ...Base64.toUint8Array(getPrefix(type)),
    ...bytesHash,
    ...locationBytes(bytesHash),
  ]);

  return fullhash;
}

const hashLocationCache: HoloHashMap<Uint8Array> = new HoloHashMap();

export function location(bytesHash: HoloHash): number {
  let bytes;
  if (hashLocationCache.has(bytesHash)) {
    bytes = hashLocationCache.get(bytesHash);
  } else {
    bytes = locationBytes(bytesHash);
    hashLocationCache.put(bytesHash, bytes);
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

export function getHashType(hash: HoloHash): HashType {
  const hashExt = serializeHash(hash).slice(1, 5);

  if (hashExt === AGENT_PREFIX) return HashType.AGENT;
  if (hashExt === DNA_PREFIX) return HashType.DNA;
  if (hashExt === DHTOP_PREFIX) return HashType.DHTOP;
  if (hashExt === HEADER_PREFIX) return HashType.HEADER;
  if (hashExt === ENTRY_PREFIX) return HashType.ENTRY;
  throw new Error('Could not get hash type');
}
