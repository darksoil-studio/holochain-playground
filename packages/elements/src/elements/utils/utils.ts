import { Entry } from '@holochain/client';
import { decode } from '@msgpack/msgpack';

import { shortenStrRec } from './hash.js';

export const sleep = (ms: number) =>
	new Promise<void>(r => setTimeout(() => r(), ms));

export function utf32Decode(bytes: Uint8Array): string {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let result = '';

	for (let i = 0; i < bytes.length; i += 4) {
		result += String.fromCodePoint(view.getInt32(i, true));
	}

	return result;
}

export function getEntryContents(entry: Entry): any {
	let entryContent: any = entry.entry;
	if (entry.entry_type === 'App') {
		entryContent = decode(entry.entry);
	}

	return shortenStrRec({
		...entry,
		entry: entryContent,
	});
}

export function decodeComponent(component: Uint8Array): string {
	try {
		const result = utf32Decode(decode(component) as any);
		return result;
	} catch (e) {}
	try {
		const result2 = JSON.stringify(decode(component));
		return result2;
	} catch (e) {}

	return bin2String(component);
}

export function decodePath(path: Uint8Array[]): string {
	return path.map(c => decodeComponent(c)).join('.');
}

export function getLinkTagStr(linkTag: Uint8Array): string {
	let tagStr = getLinkTagStrInner(linkTag);

	if (tagStr.length > 15) tagStr = `${tagStr.slice(0, 13)}...`;
	return tagStr;
}

export function getLinkTagStrInner(linkTag: Uint8Array): string {
	// Check if this tag belongs to a Path

	return decodeComponent(linkTag);
}

function bin2String(array: any) {
	let result = '';
	for (let i = 0; i < array.length; i += 1) {
		result += String.fromCharCode(array[i]);
	}
	return result;
}
