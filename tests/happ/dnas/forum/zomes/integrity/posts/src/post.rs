use hdi::prelude::*;
#[hdk_entry_helper]
#[derive(Clone)]
pub struct Post {
    pub title: String,
    pub content: String,
}
pub fn validate_create_post(
    action: EntryCreationAction,
    post: Post,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
pub fn validate_update_post(
    action: Update,
    post: Post,
    original_action: EntryCreationAction,
    original_post: Post,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
pub fn validate_delete_post(
    action: Delete,
    original_action: EntryCreationAction,
    original_post: Post,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
pub fn validate_create_link_post_updates(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
pub fn validate_delete_link_post_updates(
    action: DeleteLink,
    original_action: CreateLink,
    base: AnyLinkableHash,
    target: AnyLinkableHash,
    tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    Ok(
        ValidateCallbackResult::Invalid(
            String::from("PostUpdates links cannot be deleted"),
        ),
    )
}
pub fn validate_create_link_all_posts(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
pub fn validate_delete_link_all_posts(
    action: DeleteLink,
    original_action: CreateLink,
    base: AnyLinkableHash,
    target: AnyLinkableHash,
    tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Invalid(String::from("AllPosts links cannot be deleted")))
}
