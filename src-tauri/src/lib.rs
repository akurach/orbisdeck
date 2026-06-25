// OrbisDeck Tauri spike — native backend.
// Goal of the spike: prove the riskiest native piece (a pty bridged to xterm in the
// webview) works in Rust/Tauri, and that the React renderer runs unchanged behind a
// window.cockpit adapter. Only terminals are implemented natively here; the rest of
// CockpitApi is stubbed on the JS side.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    // Keep the child alive; dropping the handle can reap/kill the process.
    _child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Default)]
struct PtyState {
    sessions: Mutex<HashMap<String, Session>>,
}

static COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Serialize)]
struct TermData {
    id: String,
    data: String,
}

#[derive(Clone, Serialize)]
struct TermExit {
    id: String,
    #[serde(rename = "exitCode")]
    exit_code: i32,
}

fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}

#[tauri::command]
fn spawn_terminal(
    app: AppHandle,
    state: State<PtyState>,
    cwd: String,
    command: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let sys = native_pty_system();
    let pair = sys
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    // Like the Electron side: a bare command runs through the login shell so PATH
    // and aliases resolve; otherwise spawn an interactive login shell.
    let shell = default_shell();
    let mut cmd = CommandBuilder::new(&shell);
    match command {
        Some(c) if !c.is_empty() => {
            cmd.args(["-l", "-c", &c]);
        }
        _ => {
            cmd.arg("-l");
        }
    }
    if !cwd.is_empty() {
        cmd.cwd(cwd);
    }
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = format!("t{}", COUNTER.fetch_add(1, Ordering::SeqCst));
    eprintln!("[orbisdeck] spawn_terminal id={id} cwd ok, shell={shell}");

    state.sessions.lock().unwrap().insert(
        id.clone(),
        Session {
            master: pair.master,
            writer,
            _child: child,
        },
    );

    // Reader thread: stream pty output to the webview as it arrives.
    let app2 = app.clone();
    let id2 = id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app2.emit("term-data", TermData { id: id2.clone(), data });
                }
                Err(_) => break,
            }
        }
        let _ = app2.emit("term-exit", TermExit { id: id2.clone(), exit_code: 0 });
        if let Some(state) = app2.try_state::<PtyState>() {
            state.sessions.lock().unwrap().remove(&id2);
        }
    });

    Ok(id)
}

#[tauri::command]
fn write_terminal(state: State<PtyState>, id: String, data: String) {
    if let Some(s) = state.sessions.lock().unwrap().get_mut(&id) {
        let _ = s.writer.write_all(data.as_bytes());
        let _ = s.writer.flush();
    }
}

#[tauri::command]
fn resize_terminal(state: State<PtyState>, id: String, cols: u16, rows: u16) {
    if let Some(s) = state.sessions.lock().unwrap().get(&id) {
        let _ = s.master.resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        });
    }
}

#[tauri::command]
fn kill_terminal(state: State<PtyState>, id: String) {
    // Dropping the master closes the pty; the child receives SIGHUP.
    state.sessions.lock().unwrap().remove(&id);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyState::default())
        .invoke_handler(tauri::generate_handler![
            spawn_terminal,
            write_terminal,
            resize_terminal,
            kill_terminal
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
