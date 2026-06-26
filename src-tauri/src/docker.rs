// Docker management via the `docker` CLI, compose-scoped (mirror of src/main/docker.ts).

use std::path::Path;
use std::process::Command;

use crate::types::{DockerContainer, DockerStatus, OpResult};

const COMPOSE_FILES: &[&str] = &[
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml",
];

fn has_compose(root: &str) -> bool {
    COMPOSE_FILES.iter().any(|f| Path::new(root).join(f).exists())
}

fn docker(root: &str, args: &[&str]) -> Result<String, (bool, String)> {
    match Command::new("docker").current_dir(root).args(args).output() {
        Ok(out) => {
            if out.status.success() {
                Ok(String::from_utf8_lossy(&out.stdout).to_string())
            } else {
                Err((true, String::from_utf8_lossy(&out.stderr).trim().to_string()))
            }
        }
        Err(e) => {
            // ENOENT-ish → docker not found
            let not_found = e.kind() == std::io::ErrorKind::NotFound;
            Err((!not_found, e.to_string()))
        }
    }
}

fn parse_ps(stdout: &str) -> Vec<DockerContainer> {
    let text = stdout.trim();
    if text.is_empty() {
        return vec![];
    }
    let mut rows: Vec<serde_json::Value> = vec![];
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
        if let Some(arr) = v.as_array() {
            rows.extend(arr.clone());
        } else {
            rows.push(v);
        }
    } else {
        for line in text.lines() {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(line.trim()) {
                rows.push(v);
            }
        }
    }
    let get = |r: &serde_json::Value, keys: &[&str]| -> String {
        for k in keys {
            if let Some(s) = r.get(k).and_then(|v| v.as_str()) {
                return s.to_string();
            }
        }
        String::new()
    };
    rows.iter()
        .map(|r| DockerContainer {
            id: get(r, &["ID", "Id"]),
            name: get(r, &["Name", "Names"]),
            service: get(r, &["Service"]),
            state: get(r, &["State"]).to_lowercase(),
            status: get(r, &["Status", "Health"]),
            ports: get(r, &["Ports", "Publishers"]),
        })
        .collect()
}

pub fn status(root: &str) -> DockerStatus {
    let mut s = DockerStatus::default();
    if root.is_empty() {
        return s;
    }
    if !has_compose(root) {
        s.available = true;
        return s;
    }
    match docker(root, &["compose", "ps", "--format", "json", "--all"]) {
        Ok(out) => {
            s.available = true;
            s.has_compose = true;
            s.containers = parse_ps(&out);
        }
        Err((available, msg)) => {
            s.available = available;
            s.has_compose = true;
            s.error = if available {
                msg.chars().take(500).collect()
            } else {
                "docker CLI не найден".to_string()
            };
        }
    }
    s
}

pub fn action(root: &str, action: &str, service: Option<String>) -> OpResult {
    if root.is_empty() || !has_compose(root) {
        return OpResult {
            ok: false,
            error: "нет compose-файла".to_string(),
        };
    }
    let mut args: Vec<String> = vec!["compose".to_string()];
    match action {
        "up" => {
            args.push("up".to_string());
            args.push("-d".to_string());
        }
        "down" => args.push("down".to_string()),
        other => args.push(other.to_string()), // restart | start | stop
    }
    if action != "down" {
        if let Some(svc) = service {
            args.push(svc);
        }
    }
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    match docker(root, &refs) {
        Ok(_) => OpResult {
            ok: true,
            error: String::new(),
        },
        Err((_, msg)) => OpResult {
            ok: false,
            error: msg.chars().take(500).collect(),
        },
    }
}
