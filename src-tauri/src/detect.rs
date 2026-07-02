// Infer run/test/build (+ docs/CLAUDE.md/.env) from an existing project's structure.
// Mirror of src/main/detect.ts — conservative, only emits recognised markers.

use std::path::Path;

use crate::types::DetectedSettings;

fn is_file(root: &str, name: &str) -> bool {
    Path::new(root).join(name).is_file()
}
fn is_dir(root: &str, name: &str) -> bool {
    Path::new(root).join(name).is_dir()
}

fn js_manager(root: &str) -> &'static str {
    if is_file(root, "pnpm-lock.yaml") {
        "pnpm"
    } else if is_file(root, "yarn.lock") {
        "yarn"
    } else if is_file(root, "bun.lockb") {
        "bun"
    } else {
        "npm"
    }
}

fn run_script(mgr: &str, script: &str) -> String {
    if mgr == "yarn" {
        format!("yarn {script}")
    } else {
        format!("{mgr} run {script}")
    }
}

pub fn detect(root: &str) -> DetectedSettings {
    let mut out = DetectedSettings::default();
    if root.is_empty() || !Path::new(root).is_dir() {
        return out;
    }

    // package.json
    if is_file(root, "package.json") {
        if let Ok(text) = std::fs::read_to_string(Path::new(root).join("package.json")) {
            if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&text) {
                let mgr = js_manager(root);
                out.sources.push(format!("package.json ({mgr})"));
                let scripts = pkg.get("scripts").and_then(|s| s.as_object());
                let has = |k: &str| scripts.map(|s| s.contains_key(k)).unwrap_or(false);
                for k in ["dev", "start", "serve"] {
                    if has(k) {
                        out.run_command = Some(run_script(mgr, k));
                        break;
                    }
                }
                if has("test") {
                    out.test_command = Some(if mgr == "yarn" {
                        "yarn test".into()
                    } else {
                        format!("{mgr} test")
                    });
                }
                for k in ["build", "compile"] {
                    if has(k) {
                        out.build_command = Some(run_script(mgr, k));
                        break;
                    }
                }
            }
        }
    }

    // Makefile
    if is_file(root, "Makefile") {
        if let Ok(text) = std::fs::read_to_string(Path::new(root).join("Makefile")) {
            out.sources.push("Makefile".into());
            let targets: Vec<String> = text
                .lines()
                .filter_map(|l| {
                    l.split_once(':').and_then(|(t, _)| {
                        let t = t.trim();
                        if !t.is_empty()
                            && t.chars().all(|c| c.is_alphanumeric() || "._-".contains(c))
                        {
                            Some(t.to_string())
                        } else {
                            None
                        }
                    })
                })
                .collect();
            if out.run_command.is_none() && targets.iter().any(|t| t == "run") {
                out.run_command = Some("make run".into());
            }
            if out.test_command.is_none() && targets.iter().any(|t| t == "test") {
                out.test_command = Some("make test".into());
            }
            if out.build_command.is_none() && targets.iter().any(|t| t == "build") {
                out.build_command = Some("make build".into());
            }
        }
    }

    if is_file(root, "Cargo.toml") {
        out.sources.push("Cargo.toml".into());
        out.run_command.get_or_insert("cargo run".into());
        out.test_command.get_or_insert("cargo test".into());
        out.build_command.get_or_insert("cargo build".into());
    }
    if is_file(root, "go.mod") {
        out.sources.push("go.mod".into());
        out.run_command.get_or_insert("go run .".into());
        out.test_command.get_or_insert("go test ./...".into());
        out.build_command.get_or_insert("go build ./...".into());
    }
    if is_file(root, "pyproject.toml") || is_file(root, "setup.py") {
        out.sources.push(
            if is_file(root, "pyproject.toml") {
                "pyproject.toml"
            } else {
                "setup.py"
            }
            .into(),
        );
        out.test_command.get_or_insert("pytest".into());
    }
    if COMPOSE_PRESENT.iter().any(|f| is_file(root, f)) {
        out.sources.push("docker compose".into());
        out.run_command.get_or_insert("docker compose up".into());
        out.build_command
            .get_or_insert("docker compose build".into());
    }

    // .env surfaced
    if is_file(root, ".env") {
        if let Ok(meta) = std::fs::metadata(Path::new(root).join(".env")) {
            if meta.len() <= 256 * 1024 {
                if let Ok(text) = std::fs::read_to_string(Path::new(root).join(".env")) {
                    let t = text.trim();
                    if !t.is_empty() {
                        out.env = Some(t.to_string());
                        out.sources.push(".env".into());
                    }
                }
            }
        }
    }

    if is_file(root, "CLAUDE.md") {
        out.claude_md_path = Some("./CLAUDE.md".into());
        out.sources.push("CLAUDE.md".into());
    }
    if is_dir(root, "docs") {
        out.docs_path = Some("docs/".into());
        out.sources.push("docs/".into());
    }
    out
}

const COMPOSE_PRESENT: &[&str] = &[
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml",
];
