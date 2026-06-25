// Global ~/.claude config: read (settings/permissions/hooks/MCP/commands/CLAUDE.md)
// and guarded writes (settings.json, permissions). Mirror of src/main/claude.ts.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::types::{
    ClaudeCommand, ClaudeHook, ClaudeMcpServer, ClaudePermissions, FileContent, GlobalClaudeConfig,
    OpResult,
};

const CAP: u64 = 512 * 1024;

fn claude_dir() -> PathBuf {
    let mut p = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    p.push(".claude");
    p
}

fn read_json(path: &Path) -> Option<Value> {
    let meta = fs::metadata(path).ok()?;
    if meta.len() > CAP {
        return None;
    }
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

fn parse_permissions(settings: &Option<Value>, local: &Option<Value>) -> ClaudePermissions {
    let mut p = ClaudePermissions::default();
    for src in [settings, local].into_iter().flatten() {
        if let Some(perm) = src.get("permissions") {
            for (key, target) in [
                ("allow", &mut p.allow),
                ("ask", &mut p.ask),
                ("deny", &mut p.deny),
            ] {
                if let Some(arr) = perm.get(key).and_then(|v| v.as_array()) {
                    for r in arr {
                        if let Some(s) = r.as_str() {
                            target.push(s.to_string());
                        }
                    }
                }
            }
        }
    }
    p
}

fn parse_hooks(settings: &Option<Value>) -> Vec<ClaudeHook> {
    let mut out = vec![];
    let Some(hooks) = settings.as_ref().and_then(|s| s.get("hooks")).and_then(|h| h.as_object())
    else {
        return out;
    };
    for (event, entries) in hooks {
        if let Some(arr) = entries.as_array() {
            for entry in arr {
                let matcher = entry
                    .get("matcher")
                    .and_then(|m| m.as_str())
                    .unwrap_or("")
                    .to_string();
                let mut commands = vec![];
                if let Some(hs) = entry.get("hooks").and_then(|h| h.as_array()) {
                    for h in hs {
                        if let Some(c) = h.get("command").and_then(|c| c.as_str()) {
                            commands.push(c.to_string());
                        }
                    }
                }
                out.push(ClaudeHook {
                    event: event.clone(),
                    matcher,
                    commands,
                });
            }
        }
    }
    out
}

fn parse_mcp(src: &Option<Value>, source: &str) -> Vec<ClaudeMcpServer> {
    let mut out = vec![];
    let Some(servers) = src.as_ref().and_then(|s| s.get("mcpServers")).and_then(|m| m.as_object())
    else {
        return out;
    };
    for (name, cfg) in servers {
        let kind = cfg
            .get("type")
            .and_then(|t| t.as_str())
            .unwrap_or(if cfg.get("url").is_some() { "http" } else { "stdio" })
            .to_string();
        let detail = if let Some(url) = cfg.get("url").and_then(|u| u.as_str()) {
            url.to_string()
        } else {
            let cmd = cfg.get("command").and_then(|c| c.as_str()).unwrap_or("");
            let args = cfg
                .get("args")
                .and_then(|a| a.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|x| x.as_str())
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .unwrap_or_default();
            format!("{cmd} {args}").trim().to_string()
        };
        out.push(ClaudeMcpServer {
            name: name.clone(),
            kind,
            detail,
            source: source.to_string(),
        });
    }
    out
}

fn list_commands(dir: &Path, base: &Path) -> Vec<ClaudeCommand> {
    let mut out = vec![];
    let Ok(entries) = fs::read_dir(dir) else {
        return out;
    };
    for e in entries.flatten() {
        let path = e.path();
        if path.extension().and_then(|x| x.to_str()) == Some("md") {
            let rel = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            let name = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let description = fs::read_to_string(&path)
                .ok()
                .and_then(|t| {
                    t.lines()
                        .find(|l| !l.trim().is_empty() && !l.starts_with("---"))
                        .map(|l| l.trim_start_matches('#').trim().to_string())
                })
                .unwrap_or_default();
            out.push(ClaudeCommand {
                name,
                path: rel,
                description,
            });
        }
    }
    out
}

pub fn global() -> GlobalClaudeConfig {
    let dir = claude_dir();
    let mut cfg = GlobalClaudeConfig {
        claude_dir: dir.to_string_lossy().to_string(),
        exists: dir.exists(),
        ..Default::default()
    };
    let settings_path = dir.join("settings.json");
    let local_path = dir.join("settings.local.json");
    let claude_md = dir.join("CLAUDE.md");

    let settings = read_json(&settings_path);
    let local = read_json(&local_path);
    let home_json = dirs::home_dir().and_then(|h| read_json(&h.join(".claude.json")));

    cfg.settings_path = settings_path.to_string_lossy().to_string();
    cfg.settings_text = if settings_path.exists() {
        fs::read_to_string(&settings_path).unwrap_or_default()
    } else {
        String::new()
    };
    cfg.local_settings_path = local_path.to_string_lossy().to_string();
    cfg.local_settings_text = if local_path.exists() {
        fs::read_to_string(&local_path).unwrap_or_default()
    } else {
        String::new()
    };
    cfg.claude_md_path = claude_md.to_string_lossy().to_string();
    cfg.claude_md_text = fs::read_to_string(&claude_md).unwrap_or_default();
    cfg.permissions = parse_permissions(&settings, &local);
    cfg.hooks = {
        let mut h = parse_hooks(&settings);
        h.extend(parse_hooks(&local));
        h
    };
    cfg.mcp_servers = {
        let mut m = parse_mcp(&settings, "settings.json");
        m.extend(parse_mcp(&local, "settings.local.json"));
        m.extend(parse_mcp(&home_json, "~/.claude.json"));
        m
    };
    cfg.commands = list_commands(&dir.join("commands"), &dir);
    cfg
}

pub fn read_file(rel: &str) -> FileContent {
    let dir = claude_dir();
    let abs = dir.join(rel);
    let mut result = FileContent {
        path: rel.to_string(),
        ..Default::default()
    };
    let canon = abs.canonicalize().unwrap_or(abs.clone());
    let root = dir.canonicalize().unwrap_or(dir.clone());
    if canon != root && !canon.starts_with(&root) {
        return result; // escapes ~/.claude
    }
    if let Ok(data) = fs::read(&abs) {
        if data[..data.len().min(8192)].contains(&0) {
            result.binary = true;
        } else {
            result.content = String::from_utf8_lossy(&data).to_string();
        }
    }
    result
}

fn write_atomic(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if path.exists() {
        if let Ok(cur) = fs::read(path) {
            let _ = fs::write(path.with_extension("json.orbisdeck.bak"), cur);
        }
    }
    let tmp = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

pub fn write_settings(text: &str) -> OpResult {
    let parsed: Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(e) => {
            return OpResult {
                ok: false,
                error: format!("Невалидный JSON: {e}"),
            }
        }
    };
    if !parsed.is_object() {
        return OpResult {
            ok: false,
            error: "Ожидался объект настроек".into(),
        };
    }
    match write_atomic(&claude_dir().join("settings.json"), &parsed) {
        Ok(_) => OpResult { ok: true, error: String::new() },
        Err(e) => OpResult { ok: false, error: e },
    }
}

pub fn set_permissions(perms: ClaudePermissions) -> OpResult {
    let path = claude_dir().join("settings.json");
    let mut settings = read_json(&path).unwrap_or(Value::Object(Default::default()));
    if !settings.is_object() {
        settings = Value::Object(Default::default());
    }
    settings["permissions"] = serde_json::json!({
        "allow": perms.allow,
        "ask": perms.ask,
        "deny": perms.deny,
    });
    match write_atomic(&path, &settings) {
        Ok(_) => OpResult { ok: true, error: String::new() },
        Err(e) => OpResult { ok: false, error: e },
    }
}
