//! An HTTP server around the translator, the twin of js/src/server.js. It
//! speaks a minimal HTTP/1.1 (one request per connection) on a
//! `TcpListener` and has two routes:
//!
//! - `GET /languages` lists the programming and natural languages;
//! - `POST /translate` takes `{source, from (or "auto"), to, fragment?,
//!   mode?, commonLibrary?, commentLanguage?, commentFrom?,
//!   identifierLanguage?, identifierFrom?, layout?, allOrNothing?, rules?}`
//!   and answers `{output, complete, errors, coverage?, lineMap?, regionMap?, detected?}`
//!   or `{error}` with status 400. `lineMap` pairs 0-based source and target
//!   lines of a translation between programming languages.
//!
//! `rules` are Links Notation text (or an object); rules with regular
//! expressions are refused unless the server allows them. A body that is not
//! JSON is answered with "The body is not JSON: " and the message of the
//! Rust parser, which words it differently from `JSON.parse`.

mod api;
mod config;

use std::io::{self, BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

pub use api::{error_json, languages_json, translate_json};
pub use config::{ServeConfiguration, read_lenv, serve_configuration};

use crate::translator::Translator;

/// The largest request body accepted.
const LIMIT: usize = 1024 * 1024;
const BODY_TOO_LARGE: &str = "The request body is larger than 1 MiB";

/// A request line and its headers.
struct Head {
    method: String,
    path: String,
    content_length: usize,
    chunked: bool,
}

fn read_line(reader: &mut impl BufRead) -> io::Result<String> {
    let mut line = String::new();
    reader.read_line(&mut line)?;
    Ok(line.trim_end_matches(['\r', '\n']).to_owned())
}

/// The path of a request target: without the query, the fragment and the
/// scheme and host of an absolute target.
fn path_of(target: &str) -> String {
    let origin = ["http://", "https://"]
        .iter()
        .find_map(|scheme| target.strip_prefix(scheme))
        .map_or(target, |rest| rest.find('/').map_or("/", |at| &rest[at..]));
    origin.split(['?', '#']).next().unwrap_or("/").to_owned()
}

fn read_head(reader: &mut impl BufRead) -> io::Result<Head> {
    let request_line = read_line(reader)?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default().to_owned();
    let path = path_of(parts.next().unwrap_or("/"));
    let (mut content_length, mut chunked) = (0, false);
    loop {
        let line = read_line(reader)?;
        let Some((name, value)) = line.split_once(':') else {
            break;
        };
        match name.trim().to_ascii_lowercase().as_str() {
            "content-length" => content_length = value.trim().parse().unwrap_or(0),
            "transfer-encoding" => chunked = value.to_ascii_lowercase().contains("chunked"),
            _ => {}
        }
    }
    Ok(Head {
        method,
        path,
        content_length,
        chunked,
    })
}

fn read_chunked(reader: &mut impl BufRead) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    loop {
        let size = read_line(reader).map_err(|error| error.to_string())?;
        let size = size.split(';').next().unwrap_or_default().trim();
        let size = usize::from_str_radix(size, 16).map_err(|error| error.to_string())?;
        if size == 0 {
            return Ok(body);
        }
        if body.len() + size > LIMIT {
            return Err(BODY_TOO_LARGE.into());
        }
        let start = body.len();
        body.resize(start + size, 0);
        reader
            .read_exact(&mut body[start..])
            .map_err(|error| error.to_string())?;
        read_line(reader).map_err(|error| error.to_string())?;
    }
}

fn read_body(reader: &mut impl BufRead, head: &Head) -> Result<String, String> {
    let bytes = if head.chunked {
        read_chunked(reader)?
    } else if head.content_length > LIMIT {
        return Err(BODY_TOO_LARGE.into());
    } else {
        let mut bytes = vec![0; head.content_length];
        reader
            .read_exact(&mut bytes)
            .map_err(|error| error.to_string())?;
        bytes
    };
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// The status and JSON body that answer a request.
fn answer(
    reader: &mut impl BufRead,
    head: &Head,
    translator: &Translator,
    allow_regex_rules: bool,
) -> (u16, String) {
    let ok = |body: String| (200, body);
    match (head.method.as_str(), head.path.as_str()) {
        ("OPTIONS", _) => ok("{}".into()),
        ("GET", "/languages") => ok(languages_json()),
        ("POST", "/translate") => read_body(reader, head)
            .and_then(|body| translate_json(translator, &body, allow_regex_rules))
            .map_or_else(|message| (400, error_json(&message)), ok),
        (method, path) => (404, error_json(&format!("No route for {method} {path}"))),
    }
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        400 => "Bad Request",
        _ => "Not Found",
    }
}

fn reply(stream: &mut TcpStream, (status, body): (u16, String)) -> io::Result<()> {
    let body = format!("{body}\n");
    write!(
        stream,
        "HTTP/1.1 {status} {}\r\ncontent-type: application/json; charset=utf-8\r\n\
         access-control-allow-origin: *\r\naccess-control-allow-headers: content-type\r\n\
         content-length: {}\r\nconnection: close\r\n\r\n{body}",
        reason(status),
        body.len()
    )?;
    stream.flush()
}

fn handle(
    mut stream: TcpStream,
    translator: &Translator,
    allow_regex_rules: bool,
) -> io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(30)))?;
    let mut reader = BufReader::new(stream.try_clone()?);
    let head = read_head(&mut reader)?;
    let response = answer(&mut reader, &head, translator, allow_regex_rules);
    reply(&mut stream, response)
}

/// Answer the requests of every connection to `listener`, each on its own
/// thread, until the process ends. Regular expressions in the rules of a
/// request are refused unless `allow_regex_rules` is true.
pub fn serve(listener: &TcpListener, allow_regex_rules: bool) {
    let translator = Arc::new(Translator::new());
    for stream in listener.incoming().flatten() {
        let translator = Arc::clone(&translator);
        thread::spawn(move || handle(stream, &translator, allow_regex_rules));
    }
}
