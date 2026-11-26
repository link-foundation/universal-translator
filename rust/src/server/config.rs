//! Where the server listens. It is configured like the JavaScript one: an
//! option (`--port`, `--host`) wins over the `PORT` and `HOST` variables,
//! which win over a `.lenv` file (lines `PORT: 6000`) in the working
//! directory. The defaults are port 8080 on host 0.0.0.0.

use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// The address the server listens on.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ServeConfiguration {
    pub port: u16,
    pub host: String,
}

/// The variables of a `.lenv` file: one `NAME: value` (or `NAME=value`) per
/// line, a value optionally quoted; `#` starts a comment line.
pub fn read_lenv(text: &str) -> HashMap<String, String> {
    text.lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.starts_with('#') {
                return None;
            }
            let (name, value) = line.split_once([':', '='])?;
            let value = value.trim();
            let unquoted = ['\'', '"']
                .iter()
                .find_map(|quote| value.strip_prefix(*quote)?.strip_suffix(*quote))
                .unwrap_or(value);
            Some((name.trim().to_owned(), unquoted.to_owned()))
        })
        .collect()
}

fn parse_port(text: &str) -> Result<u16, String> {
    text.trim()
        .parse::<u16>()
        .map_err(|_| "The port must be an integer from 0 to 65535".to_owned())
}

/// The value of an option written `--name value` or `--name=value`.
fn option_value(
    argument: &str,
    name: &str,
    rest: &mut std::slice::Iter<'_, String>,
) -> Option<Result<String, String>> {
    if argument == name {
        Some(
            rest.next()
                .cloned()
                .ok_or_else(|| format!("Expected a value for {name}")),
        )
    } else {
        argument
            .strip_prefix(name)
            .and_then(|tail| tail.strip_prefix('='))
            .map(|value| Ok(value.to_owned()))
    }
}

/// The configuration for the arguments after `serve`, the environment and
/// the working directory.
pub fn serve_configuration(
    args: &[String],
    env: &HashMap<String, String>,
    directory: &Path,
) -> Result<ServeConfiguration, String> {
    let (mut port, mut host) = (None, None);
    let mut rest = args.iter();
    while let Some(argument) = rest.next() {
        if let Some(value) = option_value(argument, "--port", &mut rest) {
            port = Some(value?);
        } else if let Some(value) = option_value(argument, "--host", &mut rest) {
            host = Some(value?);
        } else {
            return Err(format!("Unknown argument: {argument}"));
        }
    }
    let lenv = fs::read_to_string(directory.join(".lenv"))
        .map(|text| read_lenv(&text))
        .unwrap_or_default();
    let variable = |name: &str| env.get(name).or_else(|| lenv.get(name)).cloned();
    Ok(ServeConfiguration {
        port: port
            .or_else(|| variable("PORT"))
            .map_or(Ok(8080), |port| parse_port(&port))?,
        host: host
            .or_else(|| variable("HOST"))
            .unwrap_or_else(|| "0.0.0.0".to_owned()),
    })
}
