import { HoloHash, HoloHashB64 } from '@holochain/client';
import blake from 'blakejs';

const hashLocationCache: Record<HoloHashB64, number> = {};

export function location(bytesHash: HoloHash): number {
	let bytesStr = bytesHash.toString();
	if (hashLocationCache[bytesStr]) {
		return hashLocationCache[bytesStr];
	}
	const bytes = locationBytes(bytesHash);
	const view = new DataView(bytes.buffer, 0);
	const location = wrap(view.getUint32(0, false));
	hashLocationCache[bytesStr] = location;

	return location;
}

function locationBytes(bytesHash: HoloHash): Uint8Array {
	const hash128: Uint8Array = blake.blake2b(bytesHash, undefined, 16);

	const out = [hash128[0], hash128[1], hash128[2], hash128[3]];

	for (let i = 4; i < 16; i += 4) {
		out[0] ^= hash128[i];
		out[1] ^= hash128[i + 1];
		out[2] ^= hash128[i + 2];
		out[3] ^= hash128[i + 3];
	}
	return new Uint8Array(out);
}

const distanceCache: Record<HoloHashB64, Record<HoloHashB64, number>> = {};

// We return the distance as the shortest distance between two hashes in the circle
export function distance(hash1: HoloHash, hash2: HoloHash): number {
	const hash1Str = hash1.toString();
	const hash2Str = hash2.toString();
	const firstHash = hash1Str > hash2Str ? hash1Str : hash2Str;
	const secondHash = hash1Str > hash2Str ? hash2Str : hash1Str;

	if (distanceCache[firstHash] && distanceCache[firstHash][secondHash]) {
		return distanceCache[firstHash][secondHash];
	}

	const location1 = location(hash1);
	const location2 = location(hash2);

	const distance = shortest_arc_distance(location1, location2) + 1;

	if (!distanceCache[firstHash]) {
		distanceCache[firstHash] = {};
	}
	distanceCache[firstHash][secondHash] = distance;

	return distance;
}

export function areEqual(b1: Uint8Array, b2: Uint8Array): boolean {
	return b1.toString() === b2.toString();
}

export function hashToString(holoHash: HoloHash): string {
	return holoHash.toString();
}

export function shortest_arc_distance(
	location1: number,
	location2: number,
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
