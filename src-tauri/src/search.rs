// Global cross-project search via ripgrep (M9 W3). Read-only: shells to `rg` per project,
// literal (fixed-string) smart-case match, respects .gitignore, caps results hard. Stays
// inside the control-center role — it locates, it doesn't edit. `rg` missing → available:false.

use std::process::Command;

use crate::types::{SearchMatch, SearchResult};

const PER_PROJECT: usize = 12;
const TOTAL_CAP: usize = 80;
const TEXT_CAP: usize = 240;

/// `projects` is (project_id, absolute_path). Empty/whitespace query → empty result.
pub fn search(projects: &[(String, String)], query: &str) -> SearchResult {
    let mut res = SearchResult::default();
    let q = query.trim();
    if q.is_empty() {
        res.available = true;
        return res;
    }

    for (id, path) in projects {
        if path.is_empty() || res.matches.len() >= TOTAL_CAP {
            continue;
        }
        // -F literal, -S smart-case, -n line numbers, --no-heading -H filename per line,
        // -m cap per file, --color never. Path last so rg prints absolute paths we can strip.
        let out = Command::new("rg")
            .current_dir(path)
            .args([
                "-F",
                "-S",
                "-n",
                "--no-heading",
                "-H",
                "--color",
                "never",
                "-m",
                "3",
                "-e",
                q,
                path.as_str(),
            ])
            .output();
        let out = match out {
            Ok(o) => o,
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    // rg not installed — report once and stop (every project would fail alike).
                    res.available = false;
                    res.error = "ripgrep (rg) не найден".to_string();
                    return res;
                }
                continue;
            }
        };
        res.available = true;
        // rg exits 1 on "no matches" — not an error; only stderr on a real failure.
        let stdout = String::from_utf8_lossy(&out.stdout);
        let mut hits = 0usize;
        for line in stdout.lines() {
            if hits >= PER_PROJECT || res.matches.len() >= TOTAL_CAP {
                res.truncated = true;
                break;
            }
            if let Some(m) = parse_line(id, path, line) {
                res.matches.push(m);
                hits += 1;
            }
        }
    }
    res
}

/// Parse `rg -n -H` output: `<abs-file>:<line>:<text>`. Windows-style drive colons don't
/// occur on macOS; split on the first two colons after the known path prefix.
fn parse_line(project_id: &str, root: &str, line: &str) -> Option<SearchMatch> {
    // Strip the project root prefix so we keep only "<rel>:<line>:<text>".
    let rest = line.strip_prefix(root)?.trim_start_matches('/');
    let (file, after) = rest.split_once(':')?;
    let (num, text) = after.split_once(':')?;
    let line_no: u32 = num.trim().parse().ok()?;
    if file.is_empty() {
        return None;
    }
    let mut t = text.trim().to_string();
    if t.chars().count() > TEXT_CAP {
        t = t.chars().take(TEXT_CAP).collect::<String>() + "…";
    }
    Some(SearchMatch {
        project_id: project_id.to_string(),
        file: file.to_string(),
        line: line_no,
        text: t,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_line_strips_root_and_splits() {
        let m = parse_line("p1", "/home/u/proj", "/home/u/proj/src/main.rs:42:  let x = 1;")
            .unwrap();
        assert_eq!(m.project_id, "p1");
        assert_eq!(m.file, "src/main.rs");
        assert_eq!(m.line, 42);
        assert_eq!(m.text, "let x = 1;");
    }

    #[test]
    fn parse_line_rejects_foreign_or_malformed() {
        // path not under the given root
        assert!(parse_line("p1", "/home/u/proj", "/etc/passwd:1:root").is_none());
        // missing line number
        assert!(parse_line("p1", "/home/u/proj", "/home/u/proj/a.txt:hello").is_none());
    }
}
