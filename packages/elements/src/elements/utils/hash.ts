import { serializeHash } from '@holochain-open-dev/utils';

export function shortenStrRec(object: any, shorten = false) {
  if (object === undefined || object === null) {
    return object;
  } else if (Array.isArray(object)) {
    return object.map((o) => shortenStrRec(o, shorten));
  } else if (typeof object === 'object') {
    if (object.buffer && ArrayBuffer.isView(object)) {
      const hash = serializeHash(object as Uint8Array);

      return shorten ? `${hash.slice(0, 7)}...` : hash;
    }
    const o = {};
    for (const key of Object.keys(object)) {
      o[key] = shortenStrRec(object[key], shorten);
    }
    return o;
  }
  return object;
}
