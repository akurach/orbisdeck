// Rust mirror of src/shared/types.ts. serde renames to camelCase so payloads match
// exactly what the React renderer (CockpitApi) expects.

use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RunTarget {
    pub name: String,
    pub command: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pre_launch: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub path: String,
    pub run_command: String,
    pub test_command: String,
    pub build_command: String,
    pub docs_path: String,
    pub claude_md_path: String,
    #[serde(default)]
    pub auto_launch_command: String,
    #[serde(default)]
    pub env: Option<String>,
    #[serde(default)]
    pub cwd_subdir: Option<String>,
    #[serde(default)]
    pub run_targets: Option<Vec<RunTarget>>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub settings: ProjectSettings,
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    #[serde(default)]
    pub projects: Vec<Project>,
    #[serde(default)]
    pub active_project_id: Option<String>,
    #[serde(default)]
    pub agent_hooks_prompted: bool,
    #[serde(default)]
    pub notes: std::collections::HashMap<String, String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalInfo {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub command: String,
    pub cwd: String,
    pub started_at: u64,
    pub alive: bool,
    pub pid: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImagePreview {
    pub data_url: String,
    pub mime: String,
    pub bytes: u64,
    pub too_large: bool,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub language: String,
    pub truncated: bool,
    pub binary: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<ImagePreview>,
}

#[derive(Clone, Serialize)]
pub struct GitCommitSummary {
    pub hash: String,
    pub message: String,
    pub date: String,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitSummary {
    pub is_repo: bool,
    pub branch: String,
    pub changed: u32,
    pub staged: u32,
    pub unstaged: u32,
    pub recent: Vec<GitCommitSummary>,
    pub file_status: std::collections::HashMap<String, String>,
}

#[derive(Clone, Serialize, Default)]
pub struct DiffResult {
    pub path: String,
    pub text: String,
    pub truncated: bool,
    pub binary: bool,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DetectedSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub test_command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub build_command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub docs_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub claude_md_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<String>,
    pub sources: Vec<String>,
}

#[derive(Clone, Serialize, Default)]
pub struct DockerContainer {
    pub id: String,
    pub name: String,
    pub service: String,
    pub state: String,
    pub status: String,
    pub ports: String,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DockerStatus {
    pub available: bool,
    pub has_compose: bool,
    pub containers: Vec<DockerContainer>,
    pub error: String,
}

#[derive(Clone, Serialize)]
pub struct AgentInfo {
    pub id: String,
    #[serde(rename = "type")]
    pub agent_type: String,
    pub description: String,
    pub status: String,
    #[serde(rename = "startedAt")]
    pub started_at: u64,
    #[serde(rename = "endedAt")]
    pub ended_at: u64,
}

#[derive(Clone, Serialize)]
pub struct AgentHooksStatus {
    pub installed: bool,
}

/// Per-project attention (M9 W2): the status plus, for `waiting`, the latest Notification
/// text and its classified kind. `message`/`kind` are empty for working/idle.
#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAttention {
    /// working | waiting | idle
    pub status: String,
    /// the waiting Notification text, "" otherwise
    pub message: String,
    /// epoch ms of the winning event (drives the longest-waiting queue order)
    pub since: u64,
    /// permission | question | "" — classified from the message for typed waiting
    pub kind: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ClaudePermissions {
    pub allow: Vec<String>,
    pub ask: Vec<String>,
    pub deny: Vec<String>,
}

#[derive(Clone, Serialize)]
pub struct ClaudeHook {
    pub event: String,
    pub matcher: String,
    pub commands: Vec<String>,
}

#[derive(Clone, Serialize)]
pub struct ClaudeMcpServer {
    pub name: String,
    pub kind: String,
    pub detail: String,
    pub source: String,
}

#[derive(Clone, Serialize)]
pub struct ClaudeCommand {
    pub name: String,
    pub path: String,
    pub description: String,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GlobalClaudeConfig {
    pub claude_dir: String,
    pub exists: bool,
    pub settings_text: String,
    pub settings_path: String,
    pub local_settings_text: String,
    pub local_settings_path: String,
    pub claude_md_text: String,
    pub claude_md_path: String,
    pub permissions: ClaudePermissions,
    pub hooks: Vec<ClaudeHook>,
    #[serde(rename = "mcpServers")]
    pub mcp_servers: Vec<ClaudeMcpServer>,
    pub commands: Vec<ClaudeCommand>,
    // skills + agents reuse the ClaudeCommand shape (name/path/description) so they can be
    // listed and opened via readClaudeFile, exactly like commands.
    pub skills: Vec<ClaudeCommand>,
    pub agents: Vec<ClaudeCommand>,
}

#[derive(Clone, Serialize)]
pub struct OpResult {
    pub ok: bool,
    pub error: String,
}

/// M9 W3 resume card: the newest prompt the user sent in a project + its epoch-ms ts.
#[derive(Clone, Serialize, Default)]
pub struct LastPrompt {
    pub text: String,
    pub ts: u64,
}

// --- M9 W3: global cross-project search (ripgrep) ---

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub project_id: String,
    /// project-relative file path (forward slashes)
    pub file: String,
    pub line: u32,
    /// the matching line text, trimmed + capped
    pub text: String,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub matches: Vec<SearchMatch>,
    /// rg present & runnable
    pub available: bool,
    /// results were capped
    pub truncated: bool,
    pub error: String,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeChainFile {
    pub path: String,
    pub content: String,
    pub depth: u32,
    pub missing: bool,
    pub truncated: bool,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMapNode {
    pub id: String,
    /// claudemd | import | settings | permissions | hook | mcp | skill | agent | command
    pub kind: String,
    /// global | project
    pub scope: String,
    pub label: String,
    pub detail: String,
    /// project-only: "added" | "override" | "" (none)
    pub delta: String,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMapEdge {
    pub from: String,
    pub to: String,
    /// import | registers | override
    pub kind: String,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeContextMap {
    pub nodes: Vec<ClaudeMapNode>,
    pub edges: Vec<ClaudeMapEdge>,
}
