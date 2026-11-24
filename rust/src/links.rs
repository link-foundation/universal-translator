use links_notation::LiNo;
use std::collections::BTreeMap;

pub(crate) type Link = LiNo<String>;
pub(crate) type Fields<'a> = BTreeMap<&'a str, &'a [Link]>;

pub(crate) fn named(link: &Link) -> Result<(&str, &[Link]), String> {
    match link {
        LiNo::Link {
            id: Some(id),
            values,
        } => Ok((id, values)),
        _ => Err("Expected a named link".into()),
    }
}

pub(crate) fn children<'a>(link: &'a Link, expected: &str) -> Result<&'a [Link], String> {
    let (id, values) = named(link)?;
    if id != expected {
        return Err(format!("Expected a {expected} link, received {id}"));
    }
    Ok(values)
}

pub(crate) fn fields(values: &[Link]) -> Result<Fields<'_>, String> {
    let mut fields = BTreeMap::new();
    for value in values {
        let (id, children) = named(value)?;
        if fields.insert(id, children).is_some() {
            return Err(format!("Duplicate field {id}"));
        }
    }
    Ok(fields)
}

pub(crate) fn elements<'a>(fields: &Fields<'a>, name: &str) -> Result<&'a [Link], String> {
    fields
        .get(name)
        .copied()
        .ok_or_else(|| format!("Missing {name}"))
}

pub(crate) fn references(values: &[Link]) -> Result<Vec<String>, String> {
    values
        .iter()
        .map(|value| match value {
            LiNo::Ref(reference) => Ok(reference.clone()),
            _ => Err("Expected a reference".into()),
        })
        .collect()
}

pub(crate) fn reference(values: &[Link]) -> Result<String, String> {
    match values {
        [LiNo::Ref(reference)] => Ok(reference.clone()),
        _ => Err("Expected exactly one reference".into()),
    }
}

pub(crate) fn value(fields: &Fields, name: &str) -> Result<String, String> {
    reference(elements(fields, name)?)
}
