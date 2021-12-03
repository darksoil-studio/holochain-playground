import { Hdk } from './context';

export const ensure = (hdk: Hdk) => async (path: string): Promise<void> => {
  const headerHash = await hdk.create_entry({
    content: path,
    entry_def_id: 'path',
  });

  const components = path.split('.');

  if (components.length > 1) {
    components.splice(components.length - 1, 1);
    const parent = components.join('.');

    await ensure(hdk)(parent);

    const pathHash = await hdk.hash_entry({ content: path });
    const parentHash = await hdk.hash_entry({ content: parent });

    await hdk.create_link({ base: parentHash, target: pathHash, tag: path });
  }
};

export interface Path {
  ensure: (path: string) => Promise<void>;
}
