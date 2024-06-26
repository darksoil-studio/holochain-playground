import { encodeHashToBase64 } from '@holochain/client';

export function shortenStrRec(object: any, shorten = false): any {
	if (object === undefined || object === null) {
		return object;
	} else if (Array.isArray(object)) {
		return object.map(o => shortenStrRec(o, shorten));
	} else if (typeof object === 'object') {
		if (object.buffer && ArrayBuffer.isView(object)) {
			const hash = encodeHashToBase64(object as Uint8Array);

			return shorten ? `${hash.slice(0, 7)}...` : hash;
		}
		const o: any = {};
		for (const key of Object.keys(object)) {
			o[key] = shortenStrRec(object[key], shorten);
		}
		return o;
	}
	return object;
}
