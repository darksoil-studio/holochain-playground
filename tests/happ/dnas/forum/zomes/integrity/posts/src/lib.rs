pub mod comment;
pub use comment::*;
pub mod post;
pub use post::*;
use hdi::prelude::*;
#[hdk_entry_defs]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    Post(Post),
    Comment(Comment),
}
#[hdk_link_types]
pub enum LinkTypes {
    PostUpdates,
    PostToComments,
    AllPosts,
}
/// Validation you perform during the genesis process. Nobody else on the network performs it, only you.
/// There *is no* access to network calls in this callback
#[hdk_extern]
pub fn genesis_self_check(
    data: GenesisSelfCheckData,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
/// Validation the network performs when you try to join, you can't perform this validation yourself as you are not a member yet.
/// There *is* access to network calls in this function
pub fn validate_agent_joining(
    agent_pub_key: AgentPubKey,
    membrane_proof: &Option<MembraneProof>,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
/// This is the unified validation callback for all entries and link types in this integrity zome
/// Below is a match template for all of the variants of `DHT Ops` and entry and link types
///
/// Holochain has already performed the following validation for you:
/// - The action signature matches on the hash of its content and is signed by its author
/// - The previous action exists, has a lower timestamp than the new action, and incremented sequence number
/// - The previous action author is the same as the new action author
/// - The timestamp of each action is after the DNA's origin time
/// - AgentActivity authorities check that the agent hasn't forked their chain
/// - The entry hash in the action matches the entry content
/// - The entry type in the action matches the entry content
/// - The entry size doesn't exceed the maximum entry size (currently 4MB)
/// - Private entry types are not included in the Op content, and public entry types are
/// - If the `Op` is an update or a delete, the original action exists and is a `Create` or `Update` action
/// - If the `Op` is an update, the original entry exists and is of the same type as the new one
/// - If the `Op` is a delete link, the original action exists and is a `CreateLink` action
/// - Link tags don't exceed the maximum tag size (currently 1KB)
/// - Countersigned entries include an action from each required signer
///
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.to_type::<EntryTypes, LinkTypes>()? {
        OpType::StoreEntry(store_entry) => {
            match store_entry {
                OpEntry::CreateEntry { app_entry, action } => {
                    match app_entry {
                        EntryTypes::Post(post) => {
                            validate_create_post(
                                EntryCreationAction::Create(action),
                                post,
                            )
                        }
                        EntryTypes::Comment(comment) => {
                            validate_create_comment(
                                EntryCreationAction::Create(action),
                                comment,
                            )
                        }
                    }
                }
                OpEntry::UpdateEntry { app_entry, action, .. } => {
                    match app_entry {
                        EntryTypes::Post(post) => {
                            validate_create_post(
                                EntryCreationAction::Update(action),
                                post,
                            )
                        }
                        EntryTypes::Comment(comment) => {
                            validate_create_comment(
                                EntryCreationAction::Update(action),
                                comment,
                            )
                        }
                    }
                }
                _ => Ok(ValidateCallbackResult::Valid),
            }
        }
        OpType::RegisterUpdate(update_entry) => {
            match update_entry {
                OpUpdate::Entry {
                    original_action,
                    original_app_entry,
                    app_entry,
                    action,
                } => {
                    match (app_entry, original_app_entry) {
                        (
                            EntryTypes::Comment(comment),
                            EntryTypes::Comment(original_comment),
                        ) => {
                            validate_update_comment(
                                action,
                                comment,
                                original_action,
                                original_comment,
                            )
                        }
                        (EntryTypes::Post(post), EntryTypes::Post(original_post)) => {
                            validate_update_post(
                                action,
                                post,
                                original_action,
                                original_post,
                            )
                        }
                        _ => {
                            Ok(
                                ValidateCallbackResult::Invalid(
                                    "Original and updated entry types must be the same"
                                        .to_string(),
                                ),
                            )
                        }
                    }
                }
                _ => Ok(ValidateCallbackResult::Valid),
            }
        }
        OpType::RegisterDelete(delete_entry) => {
            match delete_entry {
                OpDelete::Entry { original_action, original_app_entry, action } => {
                    match original_app_entry {
                        EntryTypes::Post(post) => {
                            validate_delete_post(action, original_action, post)
                        }
                        EntryTypes::Comment(comment) => {
                            validate_delete_comment(action, original_action, comment)
                        }
                    }
                }
                _ => Ok(ValidateCallbackResult::Valid),
            }
        }
        OpType::RegisterCreateLink {
            link_type,
            base_address,
            target_address,
            tag,
            action,
        } => {
            match link_type {
                LinkTypes::PostUpdates => {
                    validate_create_link_post_updates(
                        action,
                        base_address,
                        target_address,
                        tag,
                    )
                }
                LinkTypes::PostToComments => {
                    validate_create_link_post_to_comments(
                        action,
                        base_address,
                        target_address,
                        tag,
                    )
                }
                LinkTypes::AllPosts => {
                    validate_create_link_all_posts(
                        action,
                        base_address,
                        target_address,
                        tag,
                    )
                }
            }
        }
        OpType::RegisterDeleteLink {
            link_type,
            base_address,
            target_address,
            tag,
            original_action,
            action,
        } => {
            match link_type {
                LinkTypes::PostUpdates => {
                    validate_delete_link_post_updates(
                        action,
                        original_action,
                        base_address,
                        target_address,
                        tag,
                    )
                }
                LinkTypes::PostToComments => {
                    validate_delete_link_post_to_comments(
                        action,
                        original_action,
                        base_address,
                        target_address,
                        tag,
                    )
                }
                LinkTypes::AllPosts => {
                    validate_delete_link_all_posts(
                        action,
                        original_action,
                        base_address,
                        target_address,
                        tag,
                    )
                }
            }
        }
        OpType::StoreRecord(store_record) => {
            match store_record {
                /// Complementary validation to the `StoreEntry` Op, in which the record itself is validated
                /// If you want to optimize performance, you can remove the validation for an entry type here and keep it in `StoreEntry`
                /// Notice that doing so will cause `must_get_valid_record` for this record to return a valid record even if the `StoreEntry` validation failed
                OpRecord::CreateEntry { app_entry, action } => {
                    match app_entry {
                        EntryTypes::Post(post) => {
                            validate_create_post(
                                EntryCreationAction::Create(action),
                                post,
                            )
                        }
                        EntryTypes::Comment(comment) => {
                            validate_create_comment(
                                EntryCreationAction::Create(action),
                                comment,
                            )
                        }
                    }
                }
                /// Complementary validation to the `RegisterUpdate` Op, in which the record itself is validated
                /// If you want to optimize performance, you can remove the validation for an entry type here and keep it in `StoreEntry` and in `RegisterUpdate`
                /// Notice that doing so will cause `must_get_valid_record` for this record to return a valid record even if the other validations failed
                OpRecord::UpdateEntry {
                    original_action_hash,
                    original_entry_hash,
                    app_entry,
                    action,
                } => {
                    let original_record = must_get_valid_record(original_action_hash)?;
                    let original_action = original_record.action().clone();
                    let original_action = match original_action {
                        Action::Create(create) => EntryCreationAction::Create(create),
                        Action::Update(update) => EntryCreationAction::Update(update),
                        _ => {
                            return Ok(
                                ValidateCallbackResult::Invalid(
                                    "Original action for an update must be a Create or Update action"
                                        .to_string(),
                                ),
                            );
                        }
                    };
                    let original_app_entry = match record_to_app_entry(
                        &original_record,
                    )? {
                        Some(original_app_entry) => original_app_entry,
                        None => {
                            return Ok(ValidateCallbackResult::Valid);
                        }
                    };
                    match app_entry {
                        EntryTypes::Post(post) => {
                            let result = validate_create_post(
                                EntryCreationAction::Update(action.clone()),
                                post.clone(),
                            )?;
                            if let ValidateCallbackResult::Valid = result {
                                let original_post: Option<Post> = original_record
                                    .entry()
                                    .to_app_option()
                                    .map_err(|e| wasm_error!(e))?;
                                let original_post = match original_post {
                                    Some(post) => post,
                                    None => {
                                        return Ok(
                                            ValidateCallbackResult::Invalid(
                                                "The updated entry type must be the same as the original entry type"
                                                    .to_string(),
                                            ),
                                        );
                                    }
                                };
                                validate_update_post(
                                    action,
                                    post,
                                    original_action,
                                    original_post,
                                )
                            } else {
                                Ok(result)
                            }
                        }
                        EntryTypes::Comment(comment) => {
                            let result = validate_create_comment(
                                EntryCreationAction::Update(action.clone()),
                                comment.clone(),
                            )?;
                            if let ValidateCallbackResult::Valid = result {
                                let original_comment: Option<Comment> = original_record
                                    .entry()
                                    .to_app_option()
                                    .map_err(|e| wasm_error!(e))?;
                                let original_comment = match original_comment {
                                    Some(comment) => comment,
                                    None => {
                                        return Ok(
                                            ValidateCallbackResult::Invalid(
                                                "The updated entry type must be the same as the original entry type"
                                                    .to_string(),
                                            ),
                                        );
                                    }
                                };
                                validate_update_comment(
                                    action,
                                    comment,
                                    original_action,
                                    original_comment,
                                )
                            } else {
                                Ok(result)
                            }
                        }
                    }
                }
                /// Complementary validation to the `RegisterDelete` Op, in which the record itself is validated
                /// If you want to optimize performance, you can remove the validation for an entry type here and keep it in `RegisterDelete`
                /// Notice that doing so will cause `must_get_valid_record` for this record to return a valid record even if the `RegisterDelete` validation failed
                OpRecord::DeleteEntry {
                    original_action_hash,
                    original_entry_hash,
                    action,
                } => {
                    let original_record = must_get_valid_record(original_action_hash)?;
                    let original_action = original_record.action().clone();
                    let original_action = match original_action {
                        Action::Create(create) => EntryCreationAction::Create(create),
                        Action::Update(update) => EntryCreationAction::Update(update),
                        _ => {
                            return Ok(
                                ValidateCallbackResult::Invalid(
                                    "Original action for an update must be a Create or Update action"
                                        .to_string(),
                                ),
                            );
                        }
                    };
                    let original_app_entry = match record_to_app_entry(
                        &original_record,
                    )? {
                        Some(original_app_entry) => original_app_entry,
                        None => {
                            return Ok(ValidateCallbackResult::Valid);
                        }
                    };
                    match original_app_entry {
                        EntryTypes::Post(original_post) => {
                            validate_delete_post(action, original_action, original_post)
                        }
                        EntryTypes::Comment(original_comment) => {
                            validate_delete_comment(
                                action,
                                original_action,
                                original_comment,
                            )
                        }
                    }
                }
                /// Complementary validation to the `RegisterCreateLink` Op, in which the record itself is validated
                /// If you want to optimize performance, you can remove the validation for an entry type here and keep it in `RegisterCreateLink`
                /// Notice that doing so will cause `must_get_valid_record` for this record to return a valid record even if the `RegisterCreateLink` validation failed
                OpRecord::CreateLink {
                    base_address,
                    target_address,
                    tag,
                    link_type,
                    action,
                } => {
                    match link_type {
                        LinkTypes::PostUpdates => {
                            validate_create_link_post_updates(
                                action,
                                base_address,
                                target_address,
                                tag,
                            )
                        }
                        LinkTypes::PostToComments => {
                            validate_create_link_post_to_comments(
                                action,
                                base_address,
                                target_address,
                                tag,
                            )
                        }
                        LinkTypes::AllPosts => {
                            validate_create_link_all_posts(
                                action,
                                base_address,
                                target_address,
                                tag,
                            )
                        }
                    }
                }
                /// Complementary validation to the `RegisterDeleteLink` Op, in which the record itself is validated
                /// If you want to optimize performance, you can remove the validation for an entry type here and keep it in `RegisterDeleteLink`
                /// Notice that doing so will cause `must_get_valid_record` for this record to return a valid record even if the `RegisterDeleteLink` validation failed
                OpRecord::DeleteLink { original_action_hash, base_address, action } => {
                    let record = must_get_valid_record(original_action_hash)?;
                    let create_link = match record.action() {
                        Action::CreateLink(create_link) => create_link.clone(),
                        _ => {
                            return Ok(
                                ValidateCallbackResult::Invalid(
                                    "The action that a DeleteLink deletes must be a CreateLink"
                                        .to_string(),
                                ),
                            );
                        }
                    };
                    let link_type = match LinkTypes::from_type(
                        create_link.zome_index.clone(),
                        create_link.link_type.clone(),
                    )? {
                        Some(lt) => lt,
                        None => {
                            return Ok(ValidateCallbackResult::Valid);
                        }
                    };
                    match link_type {
                        LinkTypes::PostUpdates => {
                            validate_delete_link_post_updates(
                                action,
                                create_link.clone(),
                                base_address,
                                create_link.target_address,
                                create_link.tag,
                            )
                        }
                        LinkTypes::PostToComments => {
                            validate_delete_link_post_to_comments(
                                action,
                                create_link.clone(),
                                base_address,
                                create_link.target_address,
                                create_link.tag,
                            )
                        }
                        LinkTypes::AllPosts => {
                            validate_delete_link_all_posts(
                                action,
                                create_link.clone(),
                                base_address,
                                create_link.target_address,
                                create_link.tag,
                            )
                        }
                    }
                }
                OpRecord::CreatePrivateEntry { app_entry_type, action } => {
                    Ok(ValidateCallbackResult::Valid)
                }
                OpRecord::UpdatePrivateEntry {
                    original_action_hash,
                    original_entry_hash,
                    app_entry_type,
                    action,
                } => Ok(ValidateCallbackResult::Valid),
                OpRecord::CreateCapClaim { action } => Ok(ValidateCallbackResult::Valid),
                OpRecord::CreateCapGrant { action } => Ok(ValidateCallbackResult::Valid),
                OpRecord::UpdateCapClaim {
                    original_action_hash,
                    original_entry_hash,
                    action,
                } => Ok(ValidateCallbackResult::Valid),
                OpRecord::UpdateCapGrant {
                    original_action_hash,
                    original_entry_hash,
                    action,
                } => Ok(ValidateCallbackResult::Valid),
                OpRecord::Dna { dna_hash, action } => Ok(ValidateCallbackResult::Valid),
                OpRecord::OpenChain { previous_dna_hash, action } => {
                    Ok(ValidateCallbackResult::Valid)
                }
                OpRecord::CloseChain { new_dna_hash, action } => {
                    Ok(ValidateCallbackResult::Valid)
                }
                OpRecord::InitZomesComplete { action } => {
                    Ok(ValidateCallbackResult::Valid)
                }
                _ => Ok(ValidateCallbackResult::Valid),
            }
        }
        OpType::RegisterAgentActivity(agent_activity) => {
            match agent_activity {
                OpActivity::CreateAgent { agent, action } => {
                    let previous_action = must_get_action(action.prev_action)?;
                    match previous_action.action() {
                        Action::AgentValidationPkg(
                            AgentValidationPkg { membrane_proof, .. },
                        ) => validate_agent_joining(agent, membrane_proof),
                        _ => {
                            Ok(
                                ValidateCallbackResult::Invalid(
                                    "The previous action for a `CreateAgent` action must be an `AgentValidationPkg`"
                                        .to_string(),
                                ),
                            )
                        }
                    }
                }
                _ => Ok(ValidateCallbackResult::Valid),
            }
        }
    }
}
fn record_to_app_entry(record: &Record) -> ExternResult<Option<EntryTypes>> {
    if let Record { signed_action, entry: RecordEntry::Present(entry) } = record {
        if let Some(EntryType::App(AppEntryDef { entry_index, zome_index, .. }))
            = signed_action.action().entry_type()
        {
            return EntryTypes::deserialize_from_type(
                zome_index.clone(),
                entry_index.clone(),
                &entry,
            );
        }
    }
    Ok(None)
}
