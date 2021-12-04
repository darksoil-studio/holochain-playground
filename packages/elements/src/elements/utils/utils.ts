import { Entry } from '@holochain/conductor-api';
import { decode } from '@msgpack/msgpack';

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
  let entryContent = entry.entry;
  if (entry.entry_type === 'App') {
    entryContent = decode(entry.entry);

    if (
      Array.isArray(entryContent) &&
      entryContent.length > 0 &&
      typeof entryContent[0] === 'object' &&
      ArrayBuffer.isView(entryContent[0])
    ) {
      // Convert from path
      entryContent = entryContent.map((c) => utf32Decode(c)).join('.');
    }
  }

  return {
    ...entry,
    entry: entryContent,
  };
}
