import { serializeHash } from '@holochain-open-dev/core-types';

export function shortenStrRec(object: any) {
  if (object === undefined || object === null) {
    return object;
  } else if (Array.isArray(object)) {
    return object.map(shortenStrRec);
  } else if (typeof object === 'object') {
    if (object.buffer && ArrayBuffer.isView(object)) {
      return serializeHash(object as Uint8Array);
    }
    const o = {};
    for (const key of Object.keys(object)) {
      o[key] = shortenStrRec(object[key]);
    }
    return o;
  }
  return object;
}
