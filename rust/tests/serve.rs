//! The `serve` command: the Rust server answers the same JSON as the
//! JavaScript one (js/src/server.js) for the same requests.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::process::{Child, Command, Stdio};

use serde_json::{Value, json};
use universal_translator::server::serve_configuration;

const ROOT: &str = env!("CARGO_MANIFEST_DIR");

/// A running server process, stopped when it goes out of scope.
struct Server {
    child: Child,
    port: u16,
}

impl Server {
    /// Start `program arguments... serve --port 0 --host 127.0.0.1` and wait
    /// for the line that names the port.
    fn start(program: &str, arguments: &[&str]) -> Server {
        let mut child = Command::new(program)
            .args(arguments)
            .args(["serve", "--port", "0", "--host", "127.0.0.1"])
            .current_dir(ROOT)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap_or_else(|error| panic!("{program}: {error}"));
        let stdout = child.stdout.take().expect("the server output");
        let mut line = String::new();
        BufReader::new(stdout)
            .read_line(&mut line)
            .expect("the line that names the port");
        let port = line
            .trim()
            .rsplit(':')
            .next()
            .and_then(|port| port.parse().ok())
            .unwrap_or_else(|| panic!("no port in {line:?}"));
        Server { child, port }
    }

    /// The status and the body of an answer.
    fn request(&self, method: &str, path: &str, body: &str) -> (u16, String) {
        let mut stream = TcpStream::connect(("127.0.0.1", self.port)).expect("a connection");
        write!(
            stream,
            "{method} {path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n\
             Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .expect("the request");
        let mut answer = String::new();
        stream.read_to_string(&mut answer).expect("the answer");
        let (head, body) = answer.split_once("\r\n\r\n").expect("a head and a body");
        let status = head
            .split_whitespace()
            .nth(1)
            .and_then(|status| status.parse().ok())
            .expect("a status");
        (status, decoded(head, body))
    }

    fn get(&self, path: &str) -> (u16, String) {
        self.request("GET", path, "")
    }

    fn post(&self, path: &str, body: &Value) -> (u16, String) {
        self.request("POST", path, &body.to_string())
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// The body of an answer, with chunked transfer encoding undone.
fn decoded(head: &str, body: &str) -> String {
    if !head
        .to_ascii_lowercase()
        .contains("transfer-encoding: chunked")
    {
        return body.to_owned();
    }
    let mut text = String::new();
    let mut rest = body;
    while let Some((size, tail)) = rest.split_once("\r\n") {
        let size = usize::from_str_radix(size.trim(), 16).unwrap_or(0);
        if size == 0 {
            break;
        }
        text.push_str(&tail[..size]);
        rest = tail[size..].trim_start_matches("\r\n");
    }
    text
}

fn rust_server() -> Server {
    Server::start(env!("CARGO_BIN_EXE_universal-translator"), &[])
}

/// The JavaScript server, or `None` (with the reason on standard error)
/// when Node.js or its packages are not installed.
fn javascript_server() -> Option<Server> {
    if !Path::new(ROOT).join("node_modules/lino-arguments").exists() {
        eprintln!("skipped: the JavaScript packages are not installed (npm install)");
        return None;
    }
    if Command::new("node").arg("--version").output().is_err() {
        eprintln!("skipped: Node.js is not installed");
        return None;
    }
    Some(Server::start("node", &["bin/universal-translator.js"]))
}

const SAMPLE: &str = "function add(a, b) {\n  return a + b;\n}\nconsole.log(add(1, 2));\n";

/// Requests whose answers must be the same bytes on both servers.
fn requests() -> Vec<Value> {
    vec![
        json!({"source": SAMPLE, "from": "javascript", "to": "python"}),
        json!({"source": SAMPLE, "from": "javascript", "to": "rust", "mode": "literal"}),
        json!({"source": SAMPLE, "from": "auto", "to": "python"}),
        json!({"source": SAMPLE, "from": "javascript", "to": "python", "allOrNothing": true}),
        json!({"source": "return a + b;", "from": "javascript", "to": "python", "fragment": true}),
        json!({"source": SAMPLE, "from": "javascript", "to": "python", "layout": "target"}),
        json!({"source": SAMPLE, "from": "javascript", "to": "python@2"}),
        json!({"source": SAMPLE, "from": "javascript", "to": "java", "braces": "next-line", "indent": 2}),
        json!({"source": SAMPLE, "from": "javascript", "to": "rust", "indent": "tab", "allOrNothing": true}),
        json!({"source": "let x = ;\nconsole.log(1);\n", "from": "javascript", "to": "python"}),
        json!({"source": "I see the world.", "from": "english", "to": "russian"}),
        json!({"source": "console.log(1);\n", "from": "javascript", "to": "russian"}),
        json!({"source": "Print 1.\n", "from": "english", "to": "python"}),
        json!({"source": "console.log(1);\n", "from": "javascript", "to": "nasm"}),
        json!({"source": "console.log(1);\n", "from": "javascript", "to": "wat"}),
        json!({"source": SAMPLE, "from": "javascript", "to": "python", "commonLibrary": true}),
    ]
}

/// Requests that are wrong, with the error both servers answer.
fn wrong_requests() -> Vec<Value> {
    vec![
        json!([1, 2]),
        json!({"from": "javascript", "to": "python"}),
        json!({"source": "", "from": "", "to": "python"}),
        json!({"source": "1", "from": "javascript", "to": "python", "mode": "fast"}),
        json!({"source": "1", "from": "javascript", "to": "python", "commentLanguage": 3}),
        json!({"source": "1", "from": "javascript", "to": "python", "layout": "wide"}),
        json!({"source": "1", "from": "javascript", "to": "python", "braces": "below"}),
        json!({"source": "1", "from": "javascript", "to": "python", "indent": 2.5}),
        json!({"source": "1", "from": "javascript", "to": "python", "indent": true}),
        json!({"source": "1", "from": "javascript", "to": "go", "braces": "next-line"}),
        json!({"source": "1", "from": "javascript", "to": "python", "rules": 7}),
        json!({"source": "1", "from": "cobol-77", "to": "python"}),
        json!({
            "source": "x",
            "from": "javascript",
            "to": "python",
            "rules": {"source": [{"from": "x", "to": "y", "regex": true}]}
        }),
    ]
}

fn parsed(body: &str) -> Value {
    serde_json::from_str(body).unwrap_or_else(|error| panic!("{body:?}: {error}"))
}

#[test]
fn answers_the_languages_with_a_json_body() {
    let server = rust_server();
    let (status, body) = server.get("/languages");
    assert_eq!(status, 200);
    let answer = parsed(&body);
    let ids: Vec<&str> = answer["languages"]
        .as_array()
        .expect("languages")
        .iter()
        .filter_map(|language| language["id"].as_str())
        .collect();
    assert!(ids.contains(&"javascript") && ids.contains(&"python"));
    assert!(
        answer["naturalLanguages"]
            .as_array()
            .is_some_and(|languages| !languages.is_empty())
    );
    assert!(body.ends_with("}\n"));
}

#[test]
fn translates_a_request_and_detects_the_source_language() {
    let server = rust_server();
    let (status, body) = server.post(
        "/translate",
        &json!({"source": SAMPLE, "from": "auto", "to": "python"}),
    );
    assert_eq!(status, 200);
    let answer = parsed(&body);
    assert_eq!(answer["detected"], "javascript");
    assert_eq!(answer["complete"], true);
    assert!(
        answer["output"]
            .as_str()
            .is_some_and(|text| text.contains("def add(a, b):"))
    );
    assert!(answer["lineMap"].is_array());
}

#[test]
fn refuses_what_is_wrong_with_status_400() {
    let server = rust_server();
    for request in wrong_requests() {
        let (status, body) = server.post("/translate", &request);
        assert_eq!(status, 400, "{request}");
        assert!(parsed(&body)["error"].is_string(), "{request}");
    }
    let (status, body) = server.request("POST", "/translate", "{not json");
    assert_eq!(status, 400);
    let message = parsed(&body)["error"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    assert!(message.starts_with("The body is not JSON: "), "{message}");
}

#[test]
fn answers_other_routes_and_options() {
    let server = rust_server();
    let (status, body) = server.get("/nothing?a=1");
    assert_eq!(
        (status, body.as_str()),
        (404, "{\"error\":\"No route for GET /nothing\"}\n")
    );
    let (status, body) = server.request("OPTIONS", "/translate", "");
    assert_eq!((status, body.as_str()), (200, "{}\n"));
}

#[test]
fn answers_the_same_bytes_as_the_javascript_server() {
    let Some(javascript) = javascript_server() else {
        return;
    };
    let rust = rust_server();
    assert_eq!(rust.get("/languages"), javascript.get("/languages"));
    for request in requests().into_iter().chain(wrong_requests()) {
        assert_eq!(
            rust.post("/translate", &request),
            javascript.post("/translate", &request),
            "{request}"
        );
    }
    for (method, path) in [
        ("GET", "/nothing"),
        ("POST", "/languages"),
        ("OPTIONS", "/x"),
    ] {
        assert_eq!(
            rust.request(method, path, ""),
            javascript.request(method, path, ""),
            "{method} {path}"
        );
    }
}

fn environment(pairs: &[(&str, &str)]) -> HashMap<String, String> {
    pairs
        .iter()
        .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
        .collect()
}

fn arguments(texts: &[&str]) -> Vec<String> {
    texts.iter().map(|text| (*text).to_owned()).collect()
}

#[test]
fn an_option_wins_over_the_environment_and_the_lenv_file() {
    let folder = std::env::temp_dir().join(format!("serve-lenv-{}", std::process::id()));
    std::fs::create_dir_all(&folder).expect("a folder");
    std::fs::write(folder.join(".lenv"), "PORT: 6000\nHOST: 10.0.0.1\n").expect("a .lenv file");
    let configured = |args: &[&str], env: &[(&str, &str)]| {
        serve_configuration(&arguments(args), &environment(env), &folder)
            .map(|configuration| (configuration.port, configuration.host))
    };
    assert_eq!(configured(&[], &[]), Ok((6000, "10.0.0.1".into())));
    assert_eq!(
        configured(&[], &[("PORT", "7000")]),
        Ok((7000, "10.0.0.1".into()))
    );
    assert_eq!(
        configured(&["--port", "9000", "--host=h"], &[("PORT", "7000")]),
        Ok((9000, "h".into()))
    );
    assert_eq!(
        configured(&["--port", "70000"], &[]),
        Err("The port must be an integer from 0 to 65535".into())
    );
    std::fs::remove_dir_all(&folder).expect("the folder removed");
    let defaults = serve_configuration(&[], &HashMap::new(), &std::env::temp_dir().join("none"));
    assert_eq!(
        defaults.map(|configuration| (configuration.port, configuration.host)),
        Ok((8080, "0.0.0.0".into()))
    );
}
