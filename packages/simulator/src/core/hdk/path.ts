import { Hdk } from './context.js';

export const ensure =
  (hdk: Hdk) =>
  async (path: string): Promise<void> => {
    const components = path.split('.');

    if (components.length > 1) {
      components.splice(components.length - 1, 1);
      const parent = components.join('.');

      await ensure(hdk)(parent);

      const pathHash = await hdk.hash_entry(path);
      const parentHash = await hdk.hash_entry(parent);

      await hdk.create_link({ base: parentHash, target: pathHash, tag: path });
    }
  };

export interface Path {
  ensure: (path: string) => Promise<void>;
}
