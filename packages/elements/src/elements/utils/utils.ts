import { serializeHash } from '@holochain-open-dev/utils';
import { Entry } from '@holochain/client';
import { decode } from '@msgpack/msgpack';

import { shortenStrRec } from './hash';

export const sleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(() => r(), ms));

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

    if (
      Array.isArray(entryContent) &&
      entryContent.length > 0 &&
      typeof entryContent[0] === 'object' &&
      ArrayBuffer.isView(entryContent[0])
    ) {
      // Try convert from path
      try {
        entryContent = decodePath(entryContent);
      } catch (e) {
        // TODO: what do?
      }
    }
  }

  return shortenStrRec({
    ...entry,
    entry: entryContent,
  });
}

export function decodeComponent(component: Uint8Array): string {
  try {
    const result = utf32Decode(component);
    return result;
  } catch (e) {}
  try {
    const result2 = JSON.stringify(decode(component));
    return result2;
  } catch (e) {}

  return serializeHash(component);
}

export function decodePath(path: Uint8Array[]): string {
  return path.map((c) => decodeComponent(c)).join('.');
}
export function getLinkTagStr(linkTag: Uint8Array): string {
  let tagStr = getLinkTagStrInner(linkTag);

  if (tagStr.length > 15) tagStr = `${tagStr.slice(0, 13)}...`;
  return tagStr;
}

export function getLinkTagStrInner(linkTag: Uint8Array): string {
  // Check if this tag belongs to a Path
  try {
    if (linkTag.length > 8 && linkTag[0] === 0x68) {
      const pathContent = linkTag.slice(8);
      return decodePath(decode(pathContent) as Uint8Array[]);
    } else if (linkTag.length > 1 && linkTag[0] === 0x0) {
      const pathContent = linkTag.slice(1);
      return decodePath(decode(pathContent) as Uint8Array[]);
    }
  } catch (e) {
    // TODO: what do?
  }

  try {
    return JSON.stringify(decode(linkTag));
  } catch (e) {
    return bin2String(linkTag);
  }
}

function bin2String(array) {
  let result = '';
  for (let i = 0; i < array.length; i += 1) {
    result += String.fromCharCode(array[i]);
  }
  return result;
}
