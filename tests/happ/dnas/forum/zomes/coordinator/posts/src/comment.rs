use hdk::prelude::*;
use posts_integrity::*;
#[hdk_extern]
pub fn create_comment(comment: Comment) -> ExternResult<Record> {
    let comment_hash = create_entry(&EntryTypes::Comment(comment.clone()))?;
    create_link(
        comment.post_hash.clone(),
        comment_hash.clone(),
        LinkTypes::PostToComments,
        (),
    )?;
    let record = get(comment_hash.clone(), GetOptions::default())?
        .ok_or(
            wasm_error!(
                WasmErrorInner::Guest(String::from("Could not find the newly created Comment"))
            ),
        )?;
    Ok(record)
}
#[hdk_extern]
pub fn get_comment(comment_hash: ActionHash) -> ExternResult<Option<Record>> {
    get(comment_hash, GetOptions::default())
}
#[hdk_extern]
pub fn delete_comment(original_comment_hash: ActionHash) -> ExternResult<ActionHash> {
    delete_entry(original_comment_hash)
}
#[hdk_extern]
pub fn get_comments_for_post(post_hash: ActionHash) -> ExternResult<Vec<ActionHash>> {
    let links = get_links(post_hash, LinkTypes::PostToComments, None)?;
    let get_input: Vec<GetInput> = links
        .into_iter()
        .map(|link| GetInput::new(
            ActionHash::from(link.target).into(),
            GetOptions::default(),
        ))
        .collect();
    let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;
    let hashes: Vec<ActionHash> = records
        .into_iter()
        .filter_map(|r| r)
        .map(|r| r.action_address().clone())
        .collect();
    Ok(hashes)
}
