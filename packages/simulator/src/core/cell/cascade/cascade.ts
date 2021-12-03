import {
  Details,
  DetailsType,
  Dictionary,
  Element,
  ElementDetails,
  EntryDetails,
} from '@holochain-open-dev/core-types';
import {
  AnyDhtHash,
  Entry,
  EntryHash,
  HeaderHash,
  NewEntryHeader,
  SignedHeaderHashed,
} from '@holochain/conductor-api';


import { areEqual, getHashType, HashType } from '../../../processors/hash';
import { GetLinksOptions, GetOptions, GetStrategy } from '../../../types';
import { P2pCell } from '../../network/p2p-cell';
import { Cell } from '../cell';
import { computeDhtStatus, getEntryDhtStatus, getLiveLinks } from '../dht/get';
import { CellState } from '../state';
import { Authority } from './authority';
import {
  GetElementResponse,
  GetEntryResponse,
  GetLinksResponse,
  Link,
} from './types';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain_cascade/src/lib.rs#L1523

// TODO: refactor Cascade when sqlite gets merged

export class Cascade {
  constructor(protected state: CellState, protected p2p: P2pCell) {}

  // TODO refactor when sqlite gets merged
  public async retrieve_header(
    hash: HeaderHash,
    options: GetOptions
  ): Promise<SignedHeaderHashed | undefined> {
    if (getHashType(hash) !== HashType.HEADER)
      throw new Error(
        `Trying to retrieve a header with a hash of another type`
      );

    const isPresent = this.state.CAS.get(hash);

    // TODO only return local if GetOptions::content() is given
    if (isPresent && options.strategy === GetStrategy.Contents) {
      const signed_header = this.state.CAS.get(hash);
      return signed_header;
    }

    const result = await this.p2p.get(hash, options);

    if (result && (result as GetElementResponse).signed_header) {
      return (result as GetElementResponse).signed_header;
    } else return undefined;
  }

  public async retrieve_entry(
    hash: EntryHash,
    options: GetOptions
  ): Promise<Entry | undefined> {
    const hashType = getHashType(hash);
    if (hashType !== HashType.ENTRY && hashType !== HashType.AGENT)
      throw new Error(`Trying to retrieve a entry with a hash of another type`);

    const isPresent = this.state.CAS.get(hash);

    if (isPresent && options.strategy === GetStrategy.Contents) {
      const entry = this.state.CAS.get(hash);
      return entry;
    }

    const result = await this.p2p.get(hash, options);

    if (result && (result as GetEntryResponse).entry) {
      return (result as GetEntryResponse).entry;
    } else return undefined;
  }

  public async dht_get(
    hash: AnyDhtHash,
    options: GetOptions
  ): Promise<Element | undefined> {
    // TODO rrDHT arcs
    const authority = new Authority(this.state, this.p2p);

    const isPresent = this.state.CAS.get(hash);

    // TODO only return local if GetOptions::content() is given
    if (isPresent && options.strategy === GetStrategy.Contents) {
      const hashType = getHashType(hash);

      if (hashType === HashType.ENTRY) {
        const entry = this.state.CAS.get(hash);
        const signed_header = this.state.CAS.values().find(
          header =>
            (header as SignedHeaderHashed).header &&
            areEqual(
              (header as SignedHeaderHashed<NewEntryHeader>).header.content
                .entry_hash,
              hash
            )
        );

        return {
          entry,
          signed_header,
        };
      }

      if (hashType === HashType.HEADER) {
        const signed_header = this.state.CAS.get(hash);
        const entry_hash = (signed_header as SignedHeaderHashed<NewEntryHeader>)
          .header.content.entry_hash;

        const entry = entry_hash ? this.state.CAS.get(entry_hash) : undefined;
        return {
          entry,
          signed_header,
        };
      }
    }

    const result = await this.p2p.get(hash, options);

    if (!result) return undefined;

    if ((result as GetElementResponse).signed_header) {
      return {
        entry: (result as GetElementResponse).maybe_entry,
        signed_header: (result as GetElementResponse).signed_header,
      };
    } else {
      return {
        signed_header: (result as GetEntryResponse).live_headers[0],
        entry: (result as GetEntryResponse).entry,
      };
    }
  }

  public async dht_get_details(
    hash: AnyDhtHash,
    options: GetOptions
  ): Promise<Details | undefined> {
    if (getHashType(hash) === HashType.ENTRY) {
      const entryDetails = await this.getEntryDetails(hash, options);

      if (!entryDetails) return undefined;

      return {
        type: DetailsType.Entry,
        content: entryDetails,
      };
    } else if (getHashType(hash) === HashType.HEADER) {
      const elementDetails = await this.getHeaderDetails(hash, options);

      if (!elementDetails) return undefined;

      return {
        type: DetailsType.Element,
        content: elementDetails,
      };
    }

    return undefined;
  }

  public async dht_get_links(
    base_address: EntryHash,
    options: GetLinksOptions
  ): Promise<Link[]> {
    // TODO: check if we are an authority

    const linksResponses = await this.p2p.get_links(base_address, options);
    return getLiveLinks(linksResponses);
  }

  async getEntryDetails(
    entryHash: EntryHash,
    options: GetOptions
  ): Promise<EntryDetails | undefined> {
    // TODO: check if we are an authority
    const result = await this.p2p.get(entryHash, options);

    if (!result) return undefined;
    if ((result as GetEntryResponse).live_headers === undefined)
      throw new Error('Unreachable');

    const getEntryFull = result as GetEntryResponse;

    const allHeaders = [
      ...getEntryFull.deletes,
      ...getEntryFull.updates,
      ...getEntryFull.live_headers,
    ];

    const { rejected_headers, entry_dht_status } = computeDhtStatus(allHeaders);

    return {
      entry: getEntryFull.entry,
      headers: getEntryFull.live_headers,
      deletes: getEntryFull.deletes,
      updates: getEntryFull.updates,
      rejected_headers,
      entry_dht_status,
    };
  }

  async getHeaderDetails(
    headerHash: HeaderHash,
    options: GetOptions
  ): Promise<ElementDetails | undefined> {
    const result = await this.p2p.get(headerHash, options);

    if (!result) return undefined;
    if ((result as GetElementResponse).validation_status === undefined)
      throw new Error('Unreachable');

    const response = result as GetElementResponse;

    const element: Element = {
      entry: response.maybe_entry,
      signed_header: response.signed_header,
    };

    return {
      element,
      deletes: response.deletes,
      updates: response.updates,
      validation_status: response.validation_status,
    };
  }
}
