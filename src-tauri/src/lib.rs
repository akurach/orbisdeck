// OrbisDeck native backend (Tauri). Implements the CockpitApi seam as Tauri commands +
// events; the React renderer talks to it via src/renderer/tauri-bridge.ts.

mod agents;
mod claude;
mod detect;
mod docker;
mod files;
mod git;
mod search;
mod store;
mod types;

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_notification::NotificationExt;

use store::Store;
use types::*;

// Set when we raise a "Claude awaits input" notification (projectId, ts). Consumed the next
// time the window gains focus (i.e. the user clicked the notification) to jump to that project.
static PENDING_JUMP: Mutex<Option<(String, u64)>> = Mutex::new(None);
// How long a pending jump stays valid after the notification fires.
const JUMP_TTL_MS: u64 = 20_000;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ---------- terminals ----------

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    _child: Box<dyn portable_pty::Child + Send + Sync>,
    info: TerminalInfo,
    buffer: std::sync::Arc<Mutex<String>>,
}

#[derive(Default)]
struct Pty {
    sessions: Mutex<HashMap<String, Session>>,
}
static COUNTER: AtomicU64 = AtomicU64::new(1);
const MAX_BUFFER: usize = 200_000;

#[derive(Clone, Serialize)]
struct TermData {
    id: String,
    data: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TermExit {
    id: String,
    exit_code: i32,
    /// Which project's terminal exited + what it ran — lets the renderer flag a failed
    /// background run/test/build on that project's tab (M9 W2). Empty when the session was
    /// already gone (user-killed / project removed), which must NOT read as a failure.
    project_id: String,
    command: String,
}

fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into())
}

fn parse_env_text(text: &str) -> HashMap<String, String> {
    let mut env = HashMap::new();
    for raw in text.lines() {
        let mut line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(rest) = line.strip_prefix("export ") {
            line = rest.trim();
        }
        if let Some(eq) = line.find('=') {
            if eq == 0 {
                continue;
            }
            let key = line[..eq].trim().to_string();
            let mut val = line[eq + 1..].trim().to_string();
            if val.len() >= 2 {
                let b = val.as_bytes();
                if (b[0] == b'"' && val.ends_with('"')) || (b[0] == b'\'' && val.ends_with('\'')) {
                    val = val[1..val.len() - 1].to_string();
                }
            }
            env.insert(key, val);
        }
    }
    env
}

fn build_env(root: &str, settings_env: &Option<String>) -> HashMap<String, String> {
    let mut merged = HashMap::new();
    let dotenv = Path::new(root).join(".env");
    if let Ok(meta) = std::fs::metadata(&dotenv) {
        if meta.len() <= 256 * 1024 {
            if let Ok(text) = std::fs::read_to_string(&dotenv) {
                merged.extend(parse_env_text(&text));
            }
        }
    }
    if let Some(t) = settings_env {
        merged.extend(parse_env_text(t)); // manual env overrides .env
    }
    merged
}

#[tauri::command]
fn list_terminals(state: State<Pty>, project_id: String) -> Vec<TerminalInfo> {
    state
        .sessions
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .values()
        .filter(|s| s.info.project_id == project_id)
        .map(|s| s.info.clone())
        .collect()
}

#[tauri::command]
fn get_terminal_buffer(state: State<Pty>, id: String) -> String {
    state
        .sessions
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(&id)
        .map(|s| s.buffer.lock().unwrap_or_else(|e| e.into_inner()).clone())
        .unwrap_or_default()
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
fn spawn_terminal(
    app: AppHandle,
    pty: State<Pty>,
    store: State<Store>,
    project_id: String,
    title: Option<String>,
    command: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<TerminalInfo, String> {
    let project = store.project(&project_id);
    let (path, settings_env, subdir) = match &project {
        Some(p) => (
            p.settings.path.clone(),
            p.settings.env.clone(),
            p.settings.cwd_subdir.clone(),
        ),
        None => (String::new(), None, None),
    };
    let cwd = match subdir {
        Some(s) if !s.is_empty() => Path::new(&path).join(s).to_string_lossy().to_string(),
        _ => path.clone(),
    };

    let sys = native_pty_system();
    let pair = sys
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = default_shell();
    let mut cmd = CommandBuilder::new(&shell);
    match &command {
        Some(c) if !c.is_empty() => {
            cmd.args(["-l", "-c", c]);
        }
        _ => {
            cmd.arg("-l");
        }
    }
    if !cwd.is_empty() {
        cmd.cwd(&cwd);
    }
    cmd.env("TERM", "xterm-256color");
    for (k, v) in build_env(&path, &settings_env) {
        cmd.env(k, v);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let pid = child.process_id().unwrap_or(0);
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let id = format!("t{}", COUNTER.fetch_add(1, Ordering::SeqCst));

    let resolved_command = command.clone().unwrap_or_default();
    let info = TerminalInfo {
        id: id.clone(),
        project_id,
        title: title.unwrap_or_else(|| {
            if resolved_command.is_empty() {
                "shell".into()
            } else {
                resolved_command.clone()
            }
        }),
        command: resolved_command,
        cwd,
        started_at: now_ms(),
        alive: true,
        pid,
    };
    let buffer = std::sync::Arc::new(Mutex::new(String::new()));

    pty.sessions
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(
            id.clone(),
            Session {
                master: pair.master,
                writer,
                _child: child,
                info: info.clone(),
                buffer: buffer.clone(),
            },
        );

    let app2 = app.clone();
    let id2 = id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    {
                        let mut b = buffer.lock().unwrap_or_else(|e| e.into_inner());
                        b.push_str(&data);
                        if b.len() > MAX_BUFFER {
                            // Trim to a char boundary — byte-slicing mid-UTF-8
                            // (e.g. Cyrillic) panics and poisons this mutex.
                            let mut cut = b.len() - MAX_BUFFER;
                            while cut < b.len() && !b.is_char_boundary(cut) {
                                cut += 1;
                            }
                            b.drain(..cut);
                        }
                    }
                    let _ = app2.emit(
                        "term-data",
                        TermData {
                            id: id2.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
        // Capture the real exit code (portable_pty was emitting a hardcoded 0). Poll try_wait
        // without holding the sessions lock across a blocking wait — post-EOF the child is
        // essentially reaped, so the first probe almost always succeeds. If the session is
        // already gone (kill_terminal / remove_project), leave project_id empty so the renderer
        // treats it as a deliberate close, not a failed run.
        // -1 = unknown (gave up after 100 tries, or try_wait errored). Deliberately NOT 0 —
        // the renderer's failed-run signal must not read a hung/un-reaped child as a clean
        // success. Only a real captured status sets a >=0 code.
        let mut exit_code = -1i32;
        let mut project_id = String::new();
        let mut command = String::new();
        for _ in 0..100 {
            let Some(pty) = app2.try_state::<Pty>() else {
                break;
            };
            let mut sessions = pty.sessions.lock().unwrap_or_else(|e| e.into_inner());
            let Some(s) = sessions.get_mut(&id2) else {
                break;
            };
            s.info.alive = false;
            project_id = s.info.project_id.clone();
            command = s.info.command.clone();
            match s._child.try_wait() {
                Ok(Some(status)) => {
                    exit_code = status.exit_code() as i32;
                    break;
                }
                Ok(None) => {
                    drop(sessions);
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                Err(e) => {
                    // A wait error won't fix itself on retry — stop and leave -1 (unknown).
                    eprintln!("[pty] try_wait failed for {id2}: {e}");
                    break;
                }
            }
        }
        let _ = app2.emit(
            "term-exit",
            TermExit {
                id: id2.clone(),
                exit_code,
                project_id,
                command,
            },
        );
    });

    Ok(info)
}

#[tauri::command]
fn write_terminal(state: State<Pty>, id: String, data: String) {
    if let Some(s) = state
        .sessions
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get_mut(&id)
    {
        let _ = s.writer.write_all(data.as_bytes());
        let _ = s.writer.flush();
    }
}

#[tauri::command]
fn resize_terminal(state: State<Pty>, id: String, cols: u16, rows: u16) {
    if let Some(s) = state
        .sessions
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(&id)
    {
        let _ = s.master.resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        });
    }
}

#[tauri::command]
fn kill_terminal(state: State<Pty>, id: String) {
    state
        .sessions
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .remove(&id);
}

// ---------- dialogs / detect ----------

#[tauri::command]
fn pick_directory() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn detect_project_settings(path: String) -> DetectedSettings {
    detect::detect(&path)
}

// ---------- projects ----------

#[tauri::command]
fn get_state(store: State<Store>) -> AppState {
    store.get_state()
}
#[tauri::command]
fn add_project(store: State<Store>, input: Value) -> Project {
    let name = input
        .get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("")
        .to_string();
    let settings: ProjectSettings = input
        .get("settings")
        .and_then(|s| serde_json::from_value(s.clone()).ok())
        .unwrap_or_default();
    store.add_project(name, settings)
}
#[tauri::command]
fn update_project(store: State<Store>, id: String, patch: Value) -> Option<Project> {
    let name = patch
        .get("name")
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());
    let settings = patch.get("settings").cloned();
    store.update_project(&id, name, settings)
}
#[tauri::command]
fn remove_project(store: State<Store>, pty: State<Pty>, id: String) {
    // kill the project's terminals
    let ids: Vec<String> = pty
        .sessions
        .lock()
        .unwrap()
        .values()
        .filter(|s| s.info.project_id == id)
        .map(|s| s.info.id.clone())
        .collect();
    for tid in ids {
        pty.sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&tid);
    }
    store.remove_project(&id);
}
#[tauri::command]
fn set_active_project(store: State<Store>, id: Option<String>) {
    store.set_active(id);
}
#[tauri::command]
fn reorder_projects(store: State<Store>, ids: Vec<String>) {
    store.reorder(ids);
}
#[tauri::command]
fn mark_agent_hooks_prompted(store: State<Store>) {
    store.mark_hooks_prompted();
}
/// Projects whose Claude is currently awaiting input — the latest Notification per project
/// within a freshness window. Lets the renderer seed waiting badges on startup, so a project
/// that was already waiting before the app launched still shows (the live poller only sees
/// events newer than launch). M8.0.
#[tauri::command]
fn get_waiting_projects(store: State<Store>) -> Vec<String> {
    const WAIT_WINDOW_MS: u64 = 6 * 60 * 60 * 1000;
    let since = now_ms().saturating_sub(WAIT_WINDOW_MS);
    let st = store.get_state();
    let mut seen = std::collections::HashSet::new();
    let mut out = vec![];
    for (_ts, cwd, _msg) in agents::read_notifications_since(since) {
        if let Some(p) = st
            .projects
            .iter()
            .find(|p| cwd == p.settings.path || cwd.starts_with(&format!("{}/", p.settings.path)))
        {
            if seen.insert(p.id.clone()) {
                out.push(p.id.clone());
            }
        }
    }
    out
}
/// Per-project attention status (working|waiting|idle) from the hook state/notify logs.
/// Maps each cwd to its project by longest-prefix (so a nested project wins over its parent)
/// and keeps the newest event per project. Projects with no recent events are absent (= idle).
/// M8.1.
#[tauri::command]
fn get_project_states(store: State<Store>) -> std::collections::HashMap<String, String> {
    let st = store.get_state();
    let mut best: std::collections::HashMap<String, (u64, String)> =
        std::collections::HashMap::new();
    for (cwd, ts, status) in agents::latest_cwd_states() {
        let proj = st
            .projects
            .iter()
            .filter(|p| cwd == p.settings.path || cwd.starts_with(&format!("{}/", p.settings.path)))
            .max_by_key(|p| p.settings.path.len());
        if let Some(p) = proj {
            let e = best.entry(p.id.clone()).or_insert((0, String::new()));
            if ts >= e.0 {
                *e = (ts, status);
            }
        }
    }
    best.into_iter().map(|(id, (_, s))| (id, s)).collect()
}
/// Richer per-project attention (M9 W2): status + the latest waiting message + its kind +
/// the event ts (for the longest-waiting queue). Same cwd→project longest-prefix mapping as
/// `get_project_states`; supersedes it in the renderer while that stays for back-compat.
#[tauri::command]
fn get_project_attention(
    store: State<Store>,
) -> std::collections::HashMap<String, ProjectAttention> {
    let st = store.get_state();
    let mut best: std::collections::HashMap<String, (u64, ProjectAttention)> =
        std::collections::HashMap::new();
    for (cwd, ts, status, message) in agents::latest_cwd_attention() {
        let proj = st
            .projects
            .iter()
            .filter(|p| cwd == p.settings.path || cwd.starts_with(&format!("{}/", p.settings.path)))
            .max_by_key(|p| p.settings.path.len());
        if let Some(p) = proj {
            let e = best
                .entry(p.id.clone())
                .or_insert((0, ProjectAttention::default()));
            if ts >= e.0 {
                let kind = if status == "waiting" {
                    let m = message.to_lowercase();
                    if m.contains("permission") || m.contains("разреш") {
                        "permission"
                    } else {
                        "question"
                    }
                } else {
                    ""
                };
                *e = (
                    ts,
                    ProjectAttention {
                        status: status.clone(),
                        message: message.clone(),
                        since: ts,
                        kind: kind.to_string(),
                    },
                );
            }
        }
    }
    best.into_iter().map(|(id, (_, a))| (id, a)).collect()
}
/// Newest prompt the user sent in this project (M9 W3 resume card). Empty when the state
/// log has none (hooks off, or nothing since install).
#[tauri::command]
fn get_last_prompt(store: State<Store>, project_id: String) -> LastPrompt {
    let path = store
        .project(&project_id)
        .map(|p| p.settings.path)
        .unwrap_or_default();
    let (text, ts) = agents::last_prompt(&path);
    LastPrompt { text, ts }
}
/// Global cross-project ripgrep search (M9 W3). Read-only; maps each project's absolute path
/// back to its id so the renderer can jump to the file.
#[tauri::command]
fn search_projects(store: State<Store>, query: String) -> SearchResult {
    let st = store.get_state();
    let projects: Vec<(String, String)> = st
        .projects
        .iter()
        .map(|p| (p.id.clone(), p.settings.path.clone()))
        .collect();
    search::search(&projects, &query)
}
#[tauri::command]
fn get_note(store: State<Store>, project_id: String) -> String {
    store.get_note(&project_id)
}
#[tauri::command]
fn set_note(store: State<Store>, project_id: String, text: String) {
    store.set_note(project_id, text);
}

// ---------- git / files / docker ----------

#[tauri::command]
fn get_git_summary(store: State<Store>, project_id: String) -> GitSummary {
    git::summary(&store.project_path(&project_id))
}
#[tauri::command]
fn get_diff(store: State<Store>, project_id: String, rel_path: Option<String>) -> DiffResult {
    git::diff(&store.project_path(&project_id), rel_path)
}
#[tauri::command]
fn list_dir(store: State<Store>, project_id: String, rel_path: String) -> Vec<DirEntry> {
    files::list_dir(&store.project_path(&project_id), &rel_path)
}
#[tauri::command]
fn read_file(store: State<Store>, project_id: String, rel_path: String) -> FileContent {
    files::read_file(&store.project_path(&project_id), &rel_path)
}
#[tauri::command]
fn get_docker_status(store: State<Store>, project_id: String) -> DockerStatus {
    docker::status(&store.project_path(&project_id))
}
#[tauri::command]
fn docker_action(
    store: State<Store>,
    project_id: String,
    action: String,
    service: Option<String>,
) -> OpResult {
    docker::action(&store.project_path(&project_id), &action, service)
}

// ---------- agents / hooks ----------

#[tauri::command]
fn get_agents(store: State<Store>, project_id: String) -> Vec<AgentInfo> {
    let path = store.project_path(&project_id);
    if agents::status().installed {
        let live = agents::read_events(&path);
        if !live.is_empty() {
            return live;
        }
    }
    agents::get_agents(&path)
}
#[tauri::command]
fn get_agent_hooks_status() -> AgentHooksStatus {
    agents::status()
}
#[tauri::command]
fn install_agent_hooks() -> AgentHooksStatus {
    agents::install()
}
#[tauri::command]
fn uninstall_agent_hooks() -> AgentHooksStatus {
    agents::uninstall()
}

// ---------- claude config ----------

#[tauri::command]
fn get_global_claude() -> GlobalClaudeConfig {
    claude::global()
}
#[tauri::command]
fn get_claude_chain(store: State<Store>, project_id: String) -> Vec<ClaudeChainFile> {
    let st = store.get_state();
    match st.projects.iter().find(|p| p.id == project_id) {
        Some(p) => claude::claude_chain(&p.settings.path, &p.settings.claude_md_path),
        None => vec![],
    }
}
#[tauri::command]
fn get_claude_context_map(store: State<Store>, project_id: String) -> ClaudeContextMap {
    let st = store.get_state();
    match st.projects.iter().find(|p| p.id == project_id) {
        Some(p) => claude::context_map(&p.settings.path, &p.settings.claude_md_path),
        None => claude::context_map("", ""),
    }
}
#[tauri::command]
fn read_claude_file(rel_path: String) -> FileContent {
    claude::read_file(&rel_path)
}
#[tauri::command]
fn write_claude_settings(text: String) -> OpResult {
    claude::write_settings(&text)
}
#[tauri::command]
fn set_claude_permissions(perms: ClaudePermissions) -> OpResult {
    claude::set_permissions(perms)
}

// ---------- file watcher ----------

#[derive(Default)]
struct Watchers(Mutex<HashMap<String, RecommendedWatcher>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FilesChanged {
    project_id: String,
}

#[tauri::command]
fn watch_project(
    app: AppHandle,
    store: State<Store>,
    watchers: State<Watchers>,
    project_id: String,
) {
    let root = store.project_path(&project_id);
    if root.is_empty() {
        return;
    }
    let mut map = watchers.0.lock().unwrap();
    if map.contains_key(&project_id) {
        return;
    }
    let pid = project_id.clone();
    let last = std::sync::Arc::new(Mutex::new(0u64));
    let watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(ev) = res {
            if ev.paths.iter().any(|p| files::is_ignored_path(p)) {
                return;
            }
            // debounce ~400ms
            let mut l = last.lock().unwrap();
            let now = now_ms();
            if now - *l < 400 {
                return;
            }
            *l = now;
            let _ = app.emit(
                "files-changed",
                FilesChanged {
                    project_id: pid.clone(),
                },
            );
        }
    });
    if let Ok(mut w) = watcher {
        if w.watch(Path::new(&root), RecursiveMode::Recursive).is_ok() {
            map.insert(project_id, w);
        }
    }
}

#[tauri::command]
fn unwatch_project(watchers: State<Watchers>, project_id: String) {
    watchers.0.lock().unwrap().remove(&project_id);
}

// A GUI app launched from Finder/Dock inherits a minimal PATH (/usr/bin:/bin:…) — it never
// sources the user's shell profile, so CLIs in /opt/homebrew/bin, /usr/local/bin, Docker
// Desktop, etc. are invisible. Ask the login shell for its real PATH once at startup and adopt
// it, so every Command::new (docker/git/pgrep/lsof) and hook `node` resolves like in a terminal.
#[cfg(target_os = "macos")]
fn adopt_login_shell_path() {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let out = std::process::Command::new(&shell)
        .args(["-ilc", "echo -n __OD_PATH__${PATH}__OD_PATH__"])
        .output();
    if let Ok(out) = out {
        let s = String::from_utf8_lossy(&out.stdout);
        if let (Some(a), Some(b)) = (s.find("__OD_PATH__"), s.rfind("__OD_PATH__")) {
            if b > a {
                let path = &s[a + "__OD_PATH__".len()..b];
                if path.contains('/') {
                    std::env::set_var("PATH", path);
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "macos")]
    adopt_login_shell_path();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(Pty::default())
        .manage(Store::load())
        .manage(Watchers::default())
        .on_window_event(|window, event| {
            // Clicking the OS notification activates the app → focus. If a jump is pending and
            // still fresh, tell the renderer to switch to that project, then clear it.
            if let tauri::WindowEvent::Focused(true) = event {
                let pending = PENDING_JUMP.lock().unwrap().take();
                if let Some((project_id, ts)) = pending {
                    if now_ms().saturating_sub(ts) <= JUMP_TTL_MS {
                        let _ = window.app_handle().emit(
                            "notify-activate",
                            serde_json::json!({ "projectId": project_id }),
                        );
                    }
                }
            }
        })
        .setup(|app| {
            // If hooks were ever installed, refresh them so existing users pick up the M8.1
            // state hooks (UserPromptSubmit/Stop/SessionEnd) without a re-prompt. Idempotent.
            agents::upgrade_hooks_if_present();

            // Notification poller: tail the Notification-hook log, emit a "notify" event
            // (the renderer shows a tab badge). Seeded with "now" so old entries don't replay.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last = now_ms();
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(1500));
                    for (ts, cwd, message) in agents::read_notifications_since(last) {
                        if ts > last {
                            last = ts;
                        }
                        let (project_id, project_name, active_id) = {
                            let store = handle.state::<Store>();
                            let st = store.get_state();
                            let proj = st.projects.iter().find(|p| {
                                cwd == p.settings.path
                                    || cwd.starts_with(&format!("{}/", p.settings.path))
                            });
                            (
                                proj.map(|p| p.id.clone()),
                                proj.map(|p| p.name.clone()),
                                st.active_project_id.clone(),
                            )
                        };
                        let _ = handle.emit(
                            "notify",
                            serde_json::json!({ "projectId": project_id, "cwd": cwd, "message": message }),
                        );

                        // Native OS notification — only when the user isn't already looking at
                        // this project (window unfocused, or a different project is active).
                        let focused = handle
                            .get_webview_window("main")
                            .and_then(|w| w.is_focused().ok())
                            .unwrap_or(false);
                        let looking_here =
                            focused && active_id.is_some() && active_id == project_id;
                        if !looking_here {
                            let title = project_name.unwrap_or_else(|| "OrbisDeck".to_string());
                            let body = if message.is_empty() {
                                "Claude ждёт ответа".to_string()
                            } else {
                                message.clone()
                            };
                            let _ = handle.notification().builder().title(title).body(body).show();
                            if let Some(pid) = project_id.clone() {
                                *PENDING_JUMP.lock().unwrap() = Some((pid, ts));
                            }
                        }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_terminals,
            get_terminal_buffer,
            spawn_terminal,
            write_terminal,
            resize_terminal,
            kill_terminal,
            pick_directory,
            detect_project_settings,
            get_state,
            add_project,
            update_project,
            remove_project,
            set_active_project,
            reorder_projects,
            mark_agent_hooks_prompted,
            get_waiting_projects,
            get_project_states,
            get_project_attention,
            get_last_prompt,
            search_projects,
            get_note,
            set_note,
            get_git_summary,
            get_diff,
            list_dir,
            read_file,
            get_docker_status,
            docker_action,
            get_agents,
            get_agent_hooks_status,
            install_agent_hooks,
            uninstall_agent_hooks,
            get_global_claude,
            get_claude_chain,
            get_claude_context_map,
            read_claude_file,
            write_claude_settings,
            set_claude_permissions,
            watch_project,
            unwatch_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
