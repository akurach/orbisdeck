// Claude sub-agents + the opt-in hooks integration. Mirror of src/main/agents.ts and
// src/main/agent-hooks.ts: agents come from the session transcript and, when the hooks
// are installed, from a live event log; notifications come from a Notification hook.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde_json::Value;

use crate::types::{AgentHooksStatus, AgentInfo, OpResult};

const READ_CAP: usize = 8 * 1024 * 1024;
const MAX_SESSIONS: usize = 3;
const RECENT_MS: u64 = 2 * 60 * 60 * 1000;
const NOTIFY_RUNNING_MS: u64 = 6 * 60 * 60 * 1000;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn claude_dir() -> PathBuf {
    let mut p = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    p.push(".claude");
    p
}
fn od_dir() -> PathBuf {
    claude_dir().join("orbisdeck")
}
fn settings_file() -> PathBuf {
    claude_dir().join("settings.json")
}
fn hook_path() -> PathBuf {
    od_dir().join("hook.mjs")
}
const HOOK_MARKER: &str = "orbisdeck/hook.mjs";

fn encode_project_dir(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    trimmed
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect()
}

// ---------- transcript-based agents ----------

fn recent_transcripts(project_path: &str) -> Vec<PathBuf> {
    let dir = claude_dir()
        .join("projects")
        .join(encode_project_dir(project_path));
    let mut files: Vec<(PathBuf, SystemTime)> = vec![];
    if let Ok(rd) = fs::read_dir(&dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.extension().and_then(|x| x.to_str()) == Some("jsonl") {
                if let Ok(m) = e.metadata().and_then(|m| m.modified()) {
                    files.push((p, m));
                }
            }
        }
    }
    files.sort_by(|a, b| b.1.cmp(&a.1));
    files
        .into_iter()
        .take(MAX_SESSIONS)
        .map(|(p, _)| p)
        .collect()
}

fn tail_read(path: &Path) -> Option<String> {
    let data = fs::read(path).ok()?;
    let s = if data.len() > READ_CAP {
        &data[data.len() - READ_CAP..]
    } else {
        &data[..]
    };
    Some(String::from_utf8_lossy(s).to_string())
}

// Hook event logs (agents.jsonl / notify.jsonl) are append-only with no rotation, yet the
// notify poller rereads them every ~1.5s. Read only the tail, and compact the file in place
// (atomic tmp+rename) once it grows past the rotate threshold, so the hot path never rereads
// an unbounded file. A few appends racing the rename may be dropped — acceptable for an
// event log whose only consumers are "recent state" queries.
const LOG_TAIL_CAP: usize = 256 * 1024;
const LOG_ROTATE_AT: u64 = 1024 * 1024;

fn read_log_capped(path: &Path) -> String {
    let Ok(data) = fs::read(path) else {
        return String::new();
    };
    let truncated = data.len() > LOG_TAIL_CAP;
    let slice = if truncated {
        &data[data.len() - LOG_TAIL_CAP..]
    } else {
        &data[..]
    };
    // when we cut mid-stream, drop the partial leading line so the first parse doesn't fail
    let start = if truncated {
        slice
            .iter()
            .position(|&b| b == b'\n')
            .map(|i| i + 1)
            .unwrap_or(0)
    } else {
        0
    };
    let kept = &slice[start..];
    if data.len() as u64 > LOG_ROTATE_AT {
        let tmp = path.with_extension("jsonl.tmp");
        if fs::write(&tmp, kept).is_ok() {
            let _ = fs::rename(&tmp, path);
        }
    }
    String::from_utf8_lossy(kept).to_string()
}

pub fn get_agents(project_path: &str) -> Vec<AgentInfo> {
    if project_path.is_empty() {
        return vec![];
    }
    use std::collections::{HashMap, HashSet};
    let mut agents: HashMap<String, AgentInfo> = HashMap::new();
    let mut finished: HashSet<String> = HashSet::new();

    for transcript in recent_transcripts(project_path) {
        let Some(text) = tail_read(&transcript) else {
            continue;
        };
        for line in text.lines() {
            if line.trim().is_empty() {
                continue;
            }
            let Ok(row) = serde_json::from_str::<Value>(line) else {
                continue;
            };
            let content = row
                .get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array());
            let Some(content) = content else { continue };
            for block in content {
                let btype = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
                if btype == "tool_use" {
                    let name = block.get("name").and_then(|n| n.as_str()).unwrap_or("");
                    if name == "Task" || name == "Agent" {
                        let id = block
                            .get("id")
                            .and_then(|i| i.as_str())
                            .unwrap_or("")
                            .to_string();
                        if id.is_empty() {
                            continue;
                        }
                        let input = block.get("input");
                        let agent_type = input
                            .and_then(|i| i.get("subagent_type"))
                            .and_then(|t| t.as_str())
                            .unwrap_or("agent")
                            .to_string();
                        let description = input
                            .and_then(|i| i.get("description"))
                            .and_then(|d| d.as_str())
                            .unwrap_or("")
                            .to_string();
                        agents.insert(
                            id.clone(),
                            AgentInfo {
                                id,
                                agent_type,
                                description,
                                status: "running".into(),
                                started_at: 0,
                                ended_at: 0,
                            },
                        );
                    }
                } else if btype == "tool_result" {
                    if let Some(rid) = block.get("tool_use_id").and_then(|i| i.as_str()) {
                        finished.insert(rid.to_string());
                    }
                }
            }
        }
    }

    let cutoff = now_ms().saturating_sub(RECENT_MS);
    let mut out: Vec<AgentInfo> = agents
        .into_values()
        .map(|mut a| {
            a.status = if finished.contains(&a.id) {
                "done".into()
            } else {
                "running".into()
            };
            a
        })
        .filter(|a| a.status == "running" || a.started_at == 0 || a.started_at >= cutoff)
        .collect();
    out.sort_by(|x, y| {
        if x.status != y.status {
            return if x.status == "running" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        y.started_at.cmp(&x.started_at)
    });
    out
}

// ---------- live claude detection (for interrupted agents) ----------

static LIVE_CACHE: Mutex<Option<(Instant, Vec<String>)>> = Mutex::new(None);

fn live_claude_cwds() -> Vec<String> {
    let mut cache = LIVE_CACHE.lock().unwrap();
    if let Some((ts, ref cwds)) = *cache {
        if ts.elapsed().as_millis() < 3000 {
            return cwds.clone();
        }
    }
    let mut cwds = vec![];
    if let Ok(out) = Command::new("pgrep").args(["-x", "claude"]).output() {
        for pid in String::from_utf8_lossy(&out.stdout).split_whitespace() {
            if let Ok(lsof) = Command::new("lsof")
                .args(["-a", "-p", pid, "-d", "cwd", "-Fn"])
                .output()
            {
                for line in String::from_utf8_lossy(&lsof.stdout).lines() {
                    if let Some(rest) = line.strip_prefix('n') {
                        cwds.push(rest.to_string());
                    }
                }
            }
        }
    }
    *cache = Some((Instant::now(), cwds.clone()));
    cwds
}

fn project_has_live_claude(project_path: &str) -> bool {
    live_claude_cwds()
        .iter()
        .any(|c| c == project_path || c.starts_with(&format!("{project_path}/")))
}

// ---------- hooks integration ----------

const HOOK_SCRIPT: &str = r#"import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const mode = process.argv[2] // 'start' | 'stop' | 'notify' | 'busy' | 'idle'
let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  let p = {}
  try { p = JSON.parse(raw) } catch {}
  const dir = join(homedir(), '.claude', 'orbisdeck')
  try { mkdirSync(dir, { recursive: true }) } catch {}
  if (mode === 'notify') {
    const line = JSON.stringify({ ts: Date.now(), cwd: p.cwd || '', session: p.session_id || '', message: p.message || 'Claude ждёт ответа' }) + '\n'
    try { appendFileSync(join(dir, 'notify.jsonl'), line) } catch {}
  } else if (mode === 'busy' || mode === 'idle') {
    // attention state: working between UserPromptSubmit (busy) and Stop/SessionEnd (idle).
    // On busy also capture the prompt text (capped) for the per-project resume card (M9 W3).
    const prompt = mode === 'busy' ? String(p.prompt || '').slice(0, 500) : ''
    const line = JSON.stringify({ ts: Date.now(), cwd: p.cwd || '', session: p.session_id || '', kind: mode, prompt }) + '\n'
    try { appendFileSync(join(dir, 'state.jsonl'), line) } catch {}
  } else {
    const ti = p.tool_input || {}
    const line = JSON.stringify({ event: mode, ts: Date.now(), cwd: p.cwd || '', session: p.session_id || '', type: ti.subagent_type || '', description: ti.description || '' }) + '\n'
    try { appendFileSync(join(dir, 'agents.jsonl'), line) } catch {}
  }
  process.stdout.write('{}')
})
"#;

fn read_settings_value() -> Value {
    fs::read_to_string(settings_file())
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_else(|| Value::Object(Default::default()))
}

fn write_settings_value(v: &Value) -> Result<(), String> {
    let path = settings_file();
    let _ = fs::create_dir_all(claude_dir());
    if path.exists() {
        if let Ok(cur) = fs::read(&path) {
            let _ = fs::write(path.with_extension("json.orbisdeck.bak"), cur);
        }
    }
    let tmp = path.with_extension("json.tmp");
    fs::write(
        &tmp,
        serde_json::to_string_pretty(v).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

fn entry_is_ours(entry: &Value) -> bool {
    entry
        .get("hooks")
        .and_then(|h| h.as_array())
        .map(|arr| {
            arr.iter().any(|h| {
                h.get("command")
                    .and_then(|c| c.as_str())
                    .map(|c| c.contains(HOOK_MARKER))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

pub fn status() -> AgentHooksStatus {
    if !hook_path().exists() {
        return AgentHooksStatus { installed: false };
    }
    let s = read_settings_value();
    let has = |event: &str| {
        s.get("hooks")
            .and_then(|h| h.get(event))
            .and_then(|e| e.as_array())
            .map(|arr| arr.iter().any(entry_is_ours))
            .unwrap_or(false)
    };
    AgentHooksStatus {
        installed: has("PreToolUse")
            && has("SubagentStop")
            && has("UserPromptSubmit")
            && has("Stop"),
    }
}

fn hook_cmd(mode: &str) -> String {
    format!("node \"$HOME/.claude/orbisdeck/hook.mjs\" {mode}")
}

pub fn install() -> AgentHooksStatus {
    let _ = fs::create_dir_all(od_dir());
    let _ = fs::write(hook_path(), HOOK_SCRIPT);

    let mut s = read_settings_value();
    if !s.is_object() {
        s = Value::Object(Default::default());
    }
    let hooks = s
        .as_object_mut()
        .unwrap()
        .entry("hooks")
        .or_insert_with(|| Value::Object(Default::default()));

    let ensure = |hooks: &mut Value, event: &str, entry: Value| {
        let arr = hooks
            .as_object_mut()
            .unwrap()
            .entry(event)
            .or_insert_with(|| Value::Array(vec![]));
        let already = arr
            .as_array()
            .map(|a| a.iter().any(entry_is_ours))
            .unwrap_or(false);
        if !already {
            arr.as_array_mut().unwrap().push(entry);
        }
    };
    ensure(
        hooks,
        "PreToolUse",
        serde_json::json!({ "matcher": "Task|Agent", "hooks": [{ "type": "command", "command": hook_cmd("start") }] }),
    );
    ensure(
        hooks,
        "SubagentStop",
        serde_json::json!({ "hooks": [{ "type": "command", "command": hook_cmd("stop") }] }),
    );
    ensure(
        hooks,
        "Notification",
        serde_json::json!({ "hooks": [{ "type": "command", "command": hook_cmd("notify") }] }),
    );
    // M8.1 attention state: working between a prompt and the stop, idle on end.
    ensure(
        hooks,
        "UserPromptSubmit",
        serde_json::json!({ "hooks": [{ "type": "command", "command": hook_cmd("busy") }] }),
    );
    ensure(
        hooks,
        "Stop",
        serde_json::json!({ "hooks": [{ "type": "command", "command": hook_cmd("idle") }] }),
    );
    ensure(
        hooks,
        "SessionEnd",
        serde_json::json!({ "hooks": [{ "type": "command", "command": hook_cmd("idle") }] }),
    );

    let _ = write_settings_value(&s);
    AgentHooksStatus { installed: true }
}

/// If the hooks were ever installed, re-run install() to add any newly-introduced hooks and
/// refresh the script. Idempotent (ensure() only adds what's missing). Called on startup so
/// existing users get the M8.1 state hooks without being re-prompted.
pub fn upgrade_hooks_if_present() {
    if hook_path().exists() {
        let _ = install();
    }
}

pub fn uninstall() -> AgentHooksStatus {
    let mut s = read_settings_value();
    if let Some(hooks) = s.get_mut("hooks").and_then(|h| h.as_object_mut()) {
        for key in [
            "PreToolUse",
            "SubagentStop",
            "Notification",
            "UserPromptSubmit",
            "Stop",
            "SessionEnd",
        ] {
            if let Some(arr) = hooks.get_mut(key).and_then(|a| a.as_array_mut()) {
                arr.retain(|e| !entry_is_ours(e));
            }
        }
        let empties: Vec<String> = hooks
            .iter()
            .filter(|(_, v)| v.as_array().map(|a| a.is_empty()).unwrap_or(false))
            .map(|(k, _)| k.clone())
            .collect();
        for k in empties {
            hooks.remove(&k);
        }
    }
    let _ = write_settings_value(&s);
    let _ = fs::remove_file(hook_path());
    AgentHooksStatus { installed: false }
}

pub fn read_events(project_path: &str) -> Vec<AgentInfo> {
    let path = od_dir().join("agents.jsonl");
    let text = read_log_capped(&path);
    if text.is_empty() {
        return vec![];
    }
    let cutoff = now_ms().saturating_sub(NOTIFY_RUNNING_MS);
    let mut open: Vec<AgentInfo> = vec![];
    let mut done: Vec<AgentInfo> = vec![];
    let mut seq = 0u64;
    for line in text.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(e) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let cwd = e.get("cwd").and_then(|c| c.as_str()).unwrap_or("");
        if cwd != project_path && !cwd.starts_with(&format!("{project_path}/")) {
            continue;
        }
        let ts = e.get("ts").and_then(|t| t.as_u64()).unwrap_or(0);
        if ts != 0 && ts < cutoff {
            continue;
        }
        match e.get("event").and_then(|x| x.as_str()) {
            Some("start") => {
                seq += 1;
                open.push(AgentInfo {
                    id: format!("ev-{ts}-{seq}"),
                    agent_type: e
                        .get("type")
                        .and_then(|t| t.as_str())
                        .unwrap_or("agent")
                        .to_string(),
                    description: e
                        .get("description")
                        .and_then(|d| d.as_str())
                        .unwrap_or("")
                        .to_string(),
                    status: "running".into(),
                    started_at: ts,
                    ended_at: 0,
                });
            }
            Some("stop") => {
                if !open.is_empty() {
                    let mut a = open.remove(0);
                    a.status = "done".into();
                    a.ended_at = ts;
                    done.push(a);
                }
            }
            _ => {}
        }
    }
    let alive = project_has_live_claude(project_path);
    let mut out: Vec<AgentInfo> = open
        .into_iter()
        .map(|mut a| {
            if !alive {
                a.status = "interrupted".into();
            }
            a
        })
        .collect();
    done.reverse();
    out.extend(done);
    out
}

/// Notification events newer than `since` (epoch ms): (ts, cwd, message).
pub fn read_notifications_since(since: u64) -> Vec<(u64, String, String)> {
    let path = od_dir().join("notify.jsonl");
    let text = read_log_capped(&path);
    if text.is_empty() {
        return vec![];
    }
    let mut out = vec![];
    for line in text.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(e) = serde_json::from_str::<Value>(line) {
            let ts = e.get("ts").and_then(|t| t.as_u64()).unwrap_or(0);
            if ts > since {
                out.push((
                    ts,
                    e.get("cwd")
                        .and_then(|c| c.as_str())
                        .unwrap_or("")
                        .to_string(),
                    e.get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("")
                        .to_string(),
                ));
            }
        }
    }
    out
}

/// Latest attention status per cwd: (cwd, ts, status) where status ∈ working|waiting|idle.
/// Merges state.jsonl (busy→working / idle) and notify.jsonl (waiting); newest event per cwd
/// wins. A `working` whose event is older than STALE_MS is downgraded to idle — a crash
/// backstop so a session that died without a Stop hook doesn't hang as "working" forever.
/// M8.1. (lib.rs maps cwd→project via longest-prefix and reduces per project.)
pub fn latest_cwd_states() -> Vec<(String, u64, String)> {
    use std::collections::HashMap;
    const STALE_MS: u64 = 30 * 60 * 1000;
    let now = now_ms();
    let mut latest: HashMap<String, (u64, String)> = HashMap::new();
    let mut consider = |ts: u64, cwd: &str, status: &str| {
        if cwd.is_empty() {
            return;
        }
        let e = latest.entry(cwd.to_string()).or_insert((0, String::new()));
        if ts >= e.0 {
            *e = (ts, status.to_string());
        }
    };

    let states = read_log_capped(&od_dir().join("state.jsonl"));
    for line in states.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(e) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let ts = e.get("ts").and_then(|t| t.as_u64()).unwrap_or(0);
        let cwd = e.get("cwd").and_then(|c| c.as_str()).unwrap_or("");
        let status = match e.get("kind").and_then(|k| k.as_str()).unwrap_or("") {
            "busy" => "working",
            "idle" => "idle",
            _ => continue,
        };
        consider(ts, cwd, status);
    }

    let notifs = read_log_capped(&od_dir().join("notify.jsonl"));
    for line in notifs.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(e) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let ts = e.get("ts").and_then(|t| t.as_u64()).unwrap_or(0);
        let cwd = e.get("cwd").and_then(|c| c.as_str()).unwrap_or("");
        consider(ts, cwd, "waiting");
    }

    latest
        .into_iter()
        .map(|(cwd, (ts, mut status))| {
            if status == "working" && now.saturating_sub(ts) > STALE_MS {
                status = "idle".to_string();
            }
            (cwd, ts, status)
        })
        .collect()
}

/// Newest captured prompt for a project's cwd subtree (M9 W3 resume card): (text, ts).
/// Reads the `busy` events (UserPromptSubmit) from state.jsonl; ("", 0) when none.
pub fn last_prompt(project_path: &str) -> (String, u64) {
    if project_path.is_empty() {
        return (String::new(), 0);
    }
    let prefix = format!("{project_path}/");
    let states = read_log_capped(&od_dir().join("state.jsonl"));
    let mut best: (String, u64) = (String::new(), 0);
    for line in states.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(e) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if e.get("kind").and_then(|k| k.as_str()) != Some("busy") {
            continue;
        }
        let cwd = e.get("cwd").and_then(|c| c.as_str()).unwrap_or("");
        if cwd != project_path && !cwd.starts_with(&prefix) {
            continue;
        }
        let prompt = e.get("prompt").and_then(|p| p.as_str()).unwrap_or("");
        if prompt.is_empty() {
            continue;
        }
        let ts = e.get("ts").and_then(|t| t.as_u64()).unwrap_or(0);
        if ts >= best.1 {
            best = (prompt.to_string(), ts);
        }
    }
    best
}

/// Like `latest_cwd_states` but also carries the waiting `message` (empty for working/idle):
/// (cwd, ts, status, message). Powers the per-project attention preview + typed waiting (M9 W2).
pub fn latest_cwd_attention() -> Vec<(String, u64, String, String)> {
    use std::collections::HashMap;
    const STALE_MS: u64 = 30 * 60 * 1000;
    let now = now_ms();
    // cwd -> (ts, status, message)
    let mut latest: HashMap<String, (u64, String, String)> = HashMap::new();
    let mut consider = |ts: u64, cwd: &str, status: &str, message: &str| {
        if cwd.is_empty() {
            return;
        }
        let e = latest
            .entry(cwd.to_string())
            .or_insert((0, String::new(), String::new()));
        if ts >= e.0 {
            *e = (ts, status.to_string(), message.to_string());
        }
    };

    let states = read_log_capped(&od_dir().join("state.jsonl"));
    for line in states.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(e) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let ts = e.get("ts").and_then(|t| t.as_u64()).unwrap_or(0);
        let cwd = e.get("cwd").and_then(|c| c.as_str()).unwrap_or("");
        let status = match e.get("kind").and_then(|k| k.as_str()).unwrap_or("") {
            "busy" => "working",
            "idle" => "idle",
            _ => continue,
        };
        consider(ts, cwd, status, "");
    }

    let notifs = read_log_capped(&od_dir().join("notify.jsonl"));
    for line in notifs.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(e) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let ts = e.get("ts").and_then(|t| t.as_u64()).unwrap_or(0);
        let cwd = e.get("cwd").and_then(|c| c.as_str()).unwrap_or("");
        let msg = e.get("message").and_then(|m| m.as_str()).unwrap_or("");
        consider(ts, cwd, "waiting", msg);
    }

    latest
        .into_iter()
        .map(|(cwd, (ts, mut status, mut message))| {
            if status == "working" && now.saturating_sub(ts) > STALE_MS {
                status = "idle".to_string();
                message = String::new();
            }
            (cwd, ts, status, message)
        })
        .collect()
}

#[allow(dead_code)]
pub fn ignore() -> OpResult {
    OpResult {
        ok: true,
        error: String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    // HOME is process-global; both tests repoint it, so serialize them (cargo runs a
    // binary's tests on parallel threads).
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn write_lines(path: &Path, lines: &[String]) {
        let mut f = fs::File::create(path).unwrap();
        for l in lines {
            writeln!(f, "{l}").unwrap();
        }
    }

    #[test]
    fn latest_states_merges_prioritizes_recency_and_staleness() {
        let _g = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        // Point HOME at a temp dir so od_dir() resolves there — never touch real logs.
        let tmp = std::env::temp_dir().join(format!("orbisdeck-test-{}", std::process::id()));
        let od = tmp.join(".claude").join("orbisdeck");
        fs::create_dir_all(&od).unwrap();
        std::env::set_var("HOME", &tmp);

        let now = now_ms();
        write_lines(
            &od.join("state.jsonl"),
            &[
                // A: busy then idle (idle newer) -> idle
                format!(r#"{{"ts":{},"cwd":"/proj/a","kind":"busy"}}"#, now - 5000),
                format!(r#"{{"ts":{},"cwd":"/proj/a","kind":"idle"}}"#, now - 1000),
                // B: recent busy -> working
                format!(r#"{{"ts":{},"cwd":"/proj/b","kind":"busy"}}"#, now - 2000),
                // D: busy but >30min old -> staleness backstop -> idle
                format!(
                    r#"{{"ts":{},"cwd":"/proj/d","kind":"busy"}}"#,
                    now - 31 * 60 * 1000
                ),
            ],
        );
        write_lines(
            &od.join("notify.jsonl"),
            // C: waiting via Notification
            &[format!(
                r#"{{"ts":{},"cwd":"/proj/c","message":"x"}}"#,
                now - 1500
            )],
        );

        let states: std::collections::HashMap<String, String> = latest_cwd_states()
            .into_iter()
            .map(|(c, _, s)| (c, s))
            .collect();

        assert_eq!(states.get("/proj/a").map(String::as_str), Some("idle"));
        assert_eq!(states.get("/proj/b").map(String::as_str), Some("working"));
        assert_eq!(states.get("/proj/c").map(String::as_str), Some("waiting"));
        assert_eq!(states.get("/proj/d").map(String::as_str), Some("idle"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn attention_carries_waiting_message_and_clears_it_on_working() {
        let _g = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("orbisdeck-att-{}", std::process::id()));
        let od = tmp.join(".claude").join("orbisdeck");
        fs::create_dir_all(&od).unwrap();
        std::env::set_var("HOME", &tmp);

        let now = now_ms();
        write_lines(
            &od.join("state.jsonl"),
            // W: busy (working) — message must be empty
            &[format!(
                r#"{{"ts":{},"cwd":"/proj/w","kind":"busy"}}"#,
                now - 1000
            )],
        );
        write_lines(
            &od.join("notify.jsonl"),
            // Q: waiting with a message that should survive to the renderer
            &[format!(
                r#"{{"ts":{},"cwd":"/proj/q","message":"Claude needs your permission to use Bash"}}"#,
                now - 800
            )],
        );

        let att: std::collections::HashMap<String, (String, String)> = latest_cwd_attention()
            .into_iter()
            .map(|(c, _, s, m)| (c, (s, m)))
            .collect();

        let q = att.get("/proj/q").unwrap();
        assert_eq!(q.0, "waiting");
        assert!(q.1.contains("permission"));
        let w = att.get("/proj/w").unwrap();
        assert_eq!(w.0, "working");
        assert_eq!(w.1, "");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn last_prompt_picks_newest_in_subtree() {
        let _g = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("orbisdeck-lp-{}", std::process::id()));
        let od = tmp.join(".claude").join("orbisdeck");
        fs::create_dir_all(&od).unwrap();
        std::env::set_var("HOME", &tmp);

        let now = now_ms();
        write_lines(
            &od.join("state.jsonl"),
            &[
                format!(
                    r#"{{"ts":{},"cwd":"/proj/a","kind":"busy","prompt":"old"}}"#,
                    now - 5000
                ),
                format!(
                    r#"{{"ts":{},"cwd":"/proj/a/sub","kind":"busy","prompt":"newest"}}"#,
                    now - 1000
                ),
                // a different project must not bleed in
                format!(
                    r#"{{"ts":{},"cwd":"/proj/b","kind":"busy","prompt":"other"}}"#,
                    now
                ),
                // idle carries no prompt
                format!(
                    r#"{{"ts":{},"cwd":"/proj/a","kind":"idle","prompt":""}}"#,
                    now - 500
                ),
            ],
        );

        let (text, ts) = last_prompt("/proj/a");
        assert_eq!(text, "newest");
        assert!(ts > 0);
        assert_eq!(last_prompt("/nope").0, "");

        let _ = fs::remove_dir_all(&tmp);
    }
}
