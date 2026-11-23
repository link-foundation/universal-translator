//! Measures which pinned JavaScript and Rust sources the upstream portable
//! core can translate semantically. Accepts the framed source stream used by
//! examples/translation/verify-corpus.py. No source programs are executed.

use std::io::{self, BufRead, Read};

use meta_language::translate_program;

fn main() -> io::Result<()> {
    let mut input = io::stdin().lock();
    let mut totals = [0; 2];
    let mut translated = [0; 2];
    let mut skipped = [0; 2];
    while !input.fill_buf()?.is_empty() {
        let mut header = [0; 8];
        input.read_exact(&mut header)?;
        let path_length = u32::from_le_bytes(header[..4].try_into().unwrap()) as usize;
        let source_length = u32::from_le_bytes(header[4..].try_into().unwrap()) as usize;
        let mut path = vec![0; path_length];
        input.read_exact(&mut path)?;
        let path = std::str::from_utf8(&path).map_err(io::Error::other)?;
        let language = path.split('/').nth(1).unwrap_or_default();
        let (index, target) = match language {
            "JavaScript" => (0, "Rust"),
            "Rust" => (1, "JavaScript"),
            _ => {
                io::copy(
                    &mut (&mut input).take(source_length as u64),
                    &mut io::sink(),
                )?;
                continue;
            }
        };
        totals[index] += 1;
        // Keep this exploratory run bounded even for unusually large sources.
        if source_length > 24 * 1024 {
            skipped[index] += 1;
            io::copy(
                &mut (&mut input).take(source_length as u64),
                &mut io::sink(),
            )?;
            continue;
        }
        let mut source = vec![0; source_length];
        input.read_exact(&mut source)?;
        let source = std::str::from_utf8(&source).map_err(io::Error::other)?;
        let result = translate_program(source, language, target).map_err(io::Error::other)?;
        if result.semantics().is_some() {
            println!("{path}");
            translated[index] += 1;
        }
    }
    for (index, language) in ["JavaScript", "Rust"].into_iter().enumerate() {
        println!(
            "{language}\t{} semantic candidates\t{} sources\t{} skipped by size",
            translated[index], totals[index], skipped[index]
        );
    }
    Ok(())
}
