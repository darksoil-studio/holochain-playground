import {
  AppEntryType,
  Create,
  Entry,
  Header,
  HeaderType,
  NewEntryHeader,
  Signature,
  Update,
  AnyDhtHash,
} from '@holochain/conductor-api';
import { Element } from '@holochain-open-dev/core-types';

import { ValidationLimboStatus } from '../state';
import { getValidationLimboDhtOps } from '../dht/get';
import { putValidationLimboValue } from '../dht/put';
import { app_validation_task } from './app_validation';
import { Workflow, WorkflowReturn, WorkflowType, Workspace } from './workflows';
import { P2pCell } from '../../network/p2p-cell';
import {
  author_key_is_valid,
  check_app_entry_type,
  check_entry_hash,
  check_entry_size,
  check_entry_type,
  check_new_entry_header,
  check_not_private,
  check_prev_header,
  check_prev_seq,
  check_prev_timestamp,
  check_update_reference,
  verify_header_signature,
} from '../sys_validate';
import { GetStrategy } from '../../../types';
import { Cascade } from '../cascade/cascade';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/sys_validation_workflow.rs
export const sys_validation = async (
  worskpace: Workspace
): Promise<WorkflowReturn<void>> => {
  let workComplete = true;

  const pendingDhtOps = getValidationLimboDhtOps(worskpace.state, [
    ValidationLimboStatus.Pending,
    ValidationLimboStatus.AwaitingSysDeps,
  ]);

  // TODO: actually validate
  for (const [dhtOpHash, limboValue] of pendingDhtOps.entries()) {
    limboValue.status = ValidationLimboStatus.SysValidated;

    putValidationLimboValue(dhtOpHash, limboValue)(worskpace.state);
  }

  return {
    result: undefined,
    triggers: [app_validation_task()],
  };
};

export type SysValidationWorkflow = Workflow<void, void>;

export function sys_validation_task(): SysValidationWorkflow {
  return {
    type: WorkflowType.SYS_VALIDATION,
    details: undefined,
    task: worskpace => sys_validation(worskpace),
  };
}

function validate_op() {}

export async function sys_validate_element(
  element: Element,
  workspace: Workspace,
  network: P2pCell
): Promise<void | DepsMissing> {
  try {
    const isNotCounterfeit = await counterfeit_check(
      element.signed_header.signature,
      element.signed_header.header.content
    );
    if (!isNotCounterfeit)
      throw new Error(`Trying to validate counterfeited element`);
  } catch (e) {
    throw new Error(`Trying to validate counterfeited element`);
  }

  let maybeDepsMissing = await store_element(
    element.signed_header.header.content,
    workspace,
    network
  );
  if (maybeDepsMissing) return maybeDepsMissing;

  const entry_type = (element.signed_header.header.content as NewEntryHeader)
    .entry_type;

  if (
    element.entry &&
    (
      entry_type as {
        App: AppEntryType;
      }
    ).App &&
    (
      entry_type as {
        App: AppEntryType;
      }
    ).App.visibility === 'Public'
  ) {
    maybeDepsMissing = await store_entry(
      element.signed_header.header.content as NewEntryHeader,
      element.entry,
      workspace,
      network
    );
    if (maybeDepsMissing) return maybeDepsMissing;
  }

  // TODO: implement register_* when cache is in place
}

/// Check if the op has valid signature and author.
/// Ops that fail this check should be dropped.
export async function counterfeit_check(
  signature: Signature,
  header: Header
): Promise<Boolean> {
  return (
    (await verify_header_signature(signature, header)) &&
    (await author_key_is_valid(header.author))
  );
}

export interface DepsMissing {
  depsHashes: Array<AnyDhtHash>;
}

export async function store_element(
  header: Header,
  workspace: Workspace,
  network: P2pCell
): Promise<void | DepsMissing> {
  check_prev_header(header);

  const prev_header_hash = (header as Create).prev_header;
  if (prev_header_hash) {
    const prev_header = await new Cascade(
      workspace.state,
      workspace.p2p
    ).retrieve_header(prev_header_hash, {
      strategy: GetStrategy.Contents,
    });

    if (!prev_header)
      return {
        depsHashes: [prev_header_hash],
      };

    check_prev_timestamp(header, prev_header.header.content);
    check_prev_seq(header, prev_header.header.content);
  }
}

export async function store_entry(
  header: NewEntryHeader,
  entry: Entry,
  workspace: Workspace,
  network: P2pCell
): Promise<void | DepsMissing> {
  check_entry_type(header.entry_type, entry);
  const appEntryType = (header.entry_type as { App: AppEntryType }).App;
  if (appEntryType) {
    const entry_def = check_app_entry_type(appEntryType, workspace.dna);
    check_not_private(entry_def);
  }

  check_entry_hash(header.entry_hash, entry);
  check_entry_size(entry);

  if (header.type === HeaderType.Update) {
    const signed_header = await new Cascade(
      workspace.state,
      workspace.p2p
    ).retrieve_header(header.original_header_address, {
      strategy: GetStrategy.Contents,
    });
    if (!signed_header) {
      return {
        depsHashes: [header.original_header_address],
      };
    }

    update_check(header, signed_header.header.content);
  }
}

function update_check(entry_update: Update, original_header: Header): void {
  check_new_entry_header(original_header);

  if (!(original_header as NewEntryHeader).entry_type)
    throw new Error(`Trying to update a header that didn't create any entry`);

  check_update_reference(entry_update, original_header as NewEntryHeader);
}
