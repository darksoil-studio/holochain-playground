use hdi::prelude::*;
#[hdk_entry_helper]
#[derive(Clone)]
pub struct Comment {
    pub comment: String,
    pub post_hash: ActionHash,
}
pub fn validate_create_comment(
    action: EntryCreationAction,
    comment: Comment,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
pub fn validate_update_comment(
    action: Update,
    comment: Comment,
    original_action: EntryCreationAction,
    original_comment: Comment,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Invalid(String::from("Comments cannot be updated")))
}
pub fn validate_delete_comment(
    action: Delete,
    original_action: EntryCreationAction,
    original_comment: Comment,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
pub fn validate_create_link_post_to_comments(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
pub fn validate_delete_link_post_to_comments(
    action: DeleteLink,
    original_action: CreateLink,
    base: AnyLinkableHash,
    target: AnyLinkableHash,
    tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    Ok(
        ValidateCallbackResult::Invalid(
            String::from("PostToComments links cannot be deleted"),
        ),
    )
}
