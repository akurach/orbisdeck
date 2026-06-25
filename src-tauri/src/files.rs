// Lazy file tree + capped read-only viewer, mirror of src/main/files.ts.

use std::path::{Path, PathBuf};

use base64::Engine;

use crate::types::{DirEntry, FileContent, ImagePreview};

const READ_CAP: u64 = 512 * 1024;
const IMAGE_CAP: u64 = 8 * 1024 * 1024;

const IGNORED: &[&str] = &[
    ".git",
    "node_modules",
    "dist",
    "build",
    "out",
    "release",
    ".next",
    ".nuxt",
    ".turbo",
    ".cache",
    "coverage",
    "target",
];

fn lang_for(ext: &str) -> &'static str {
    match ext {
        "ts" | "tsx" => "typescript",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "json" => "json",
        "md" | "markdown" => "markdown",
        "yml" | "yaml" => "yaml",
        "swift" => "swift",
        "py" => "python",
        "sh" | "zsh" => "bash",
        "css" => "css",
        "html" => "xml",
        "rs" => "rust",
        "toml" => "ini",
        _ => "",
    }
}

fn image_mime(ext: &str) -> Option<&'static str> {
    match ext {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "bmp" => Some("image/bmp"),
        "ico" => Some("image/x-icon"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

/// Resolve a project-relative path, refusing anything that escapes the root.
fn safe_resolve(root: &str, rel: &str) -> Option<PathBuf> {
    let root = Path::new(root);
    let joined = root.join(rel);
    // canonicalize where possible; fall back to lexical check
    let abs = joined.canonicalize().unwrap_or(joined);
    let root_abs = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    if abs == root_abs || abs.starts_with(&root_abs) {
        Some(abs)
    } else {
        None
    }
}

pub fn list_dir(root: &str, rel: &str) -> Vec<DirEntry> {
    if root.is_empty() {
        return vec![];
    }
    let rel = if rel.is_empty() { "." } else { rel };
    let abs = match safe_resolve(root, rel) {
        Some(p) => p,
        None => return vec![],
    };
    let mut out: Vec<DirEntry> = vec![];
    let read = match std::fs::read_dir(&abs) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let root_path = Path::new(root);
    for entry in read.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if IGNORED.contains(&name.as_str()) || name.starts_with(".DS_Store") {
            continue;
        }
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let rel_path = entry
            .path()
            .strip_prefix(root_path)
            .unwrap_or(&entry.path())
            .to_string_lossy()
            .replace('\\', "/");
        out.push(DirEntry {
            name,
            path: rel_path,
            is_dir,
        });
    }
    out.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    out
}

pub fn read_file(root: &str, rel: &str) -> FileContent {
    let ext = rel.rsplit('.').next().unwrap_or("").to_lowercase();
    let mut result = FileContent {
        path: rel.to_string(),
        language: lang_for(&ext).to_string(),
        ..Default::default()
    };
    let abs = match safe_resolve(root, rel) {
        Some(p) => p,
        None => return result,
    };

    if let Some(mime) = image_mime(&ext) {
        let bytes = std::fs::metadata(&abs).map(|m| m.len()).unwrap_or(0);
        if bytes > IMAGE_CAP {
            result.image = Some(ImagePreview {
                data_url: String::new(),
                mime: mime.to_string(),
                bytes,
                too_large: true,
            });
            return result;
        }
        if let Ok(data) = std::fs::read(&abs) {
            let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
            result.image = Some(ImagePreview {
                data_url: format!("data:{};base64,{}", mime, b64),
                mime: mime.to_string(),
                bytes,
                too_large: false,
            });
        }
        return result;
    }

    let data = match std::fs::read(&abs) {
        Ok(d) => d,
        Err(_) => return result,
    };
    let probe_len = data.len().min(8192);
    if data[..probe_len].contains(&0) {
        result.binary = true;
        return result;
    }
    if data.len() as u64 > READ_CAP {
        result.content = String::from_utf8_lossy(&data[..READ_CAP as usize]).to_string();
        result.truncated = true;
    } else {
        result.content = String::from_utf8_lossy(&data).to_string();
    }
    result
}

pub fn is_ignored_path(p: &Path) -> bool {
    p.components().any(|c| {
        let s = c.as_os_str().to_string_lossy();
        IGNORED.contains(&s.as_ref())
    })
}
