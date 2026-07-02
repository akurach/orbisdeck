// Git summary + diff via the `git` CLI (mirror of src/main/git.ts behaviour).

use std::process::Command;

use crate::types::{DiffResult, GitCommitSummary, GitSummary};

const DIFF_CAP: usize = 200_000;

fn git(root: &str, args: &[&str]) -> Option<String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        None
    }
}

fn kind_for(xy: &str) -> &'static str {
    if xy == "??" {
        return "untracked";
    }
    if xy.contains('R') {
        "renamed"
    } else if xy.contains('A') {
        "added"
    } else if xy.contains('D') {
        "deleted"
    } else {
        "modified"
    }
}

pub fn summary(root: &str) -> GitSummary {
    let mut s = GitSummary::default();
    if root.is_empty() {
        return s;
    }
    if git(root, &["rev-parse", "--is-inside-work-tree"]).is_none() {
        return s;
    }
    s.is_repo = true;
    s.branch = git(root, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|b| b.trim().to_string())
        .unwrap_or_default();

    if let Some(porc) = git(root, &["status", "--porcelain"]) {
        for line in porc.lines() {
            if line.len() < 3 {
                continue;
            }
            let xy = &line[..2];
            let path = line[3..].trim().to_string();
            // handle "old -> new" for renames
            let path = path.split(" -> ").last().unwrap_or(&path).to_string();
            s.changed += 1;
            let x = xy.chars().next().unwrap_or(' ');
            let y = xy.chars().nth(1).unwrap_or(' ');
            if x != ' ' && x != '?' {
                s.staged += 1;
            }
            if y != ' ' && y != '?' || xy == "??" {
                s.unstaged += 1;
            }
            s.file_status.insert(path, kind_for(xy).to_string());
        }
    }

    if let Some(log) = git(
        root,
        &["log", "-5", "--pretty=%h\x1f%s\x1f%cr", "--no-color"],
    ) {
        for line in log.lines() {
            let parts: Vec<&str> = line.split('\x1f').collect();
            if parts.len() == 3 {
                s.recent.push(GitCommitSummary {
                    hash: parts[0].to_string(),
                    message: parts[1].to_string(),
                    date: parts[2].to_string(),
                });
            }
        }
    }
    s
}

pub fn diff(root: &str, rel_path: Option<String>) -> DiffResult {
    let mut r = DiffResult::default();
    if root.is_empty() {
        return r;
    }
    let mut args = vec!["diff", "--no-color"];
    if let Some(ref p) = rel_path {
        args.push("--");
        args.push(p);
        r.path = p.clone();
    }
    let text = git(root, &args).unwrap_or_default();
    if text.len() > DIFF_CAP {
        r.text = text[..DIFF_CAP].to_string();
        r.truncated = true;
    } else {
        r.text = text;
    }
    r
}
