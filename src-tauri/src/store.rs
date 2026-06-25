// Durable project state — one JSON file under the OS app-data dir. Mirrors
// src/main/store.ts: projects keyed by UUID, active project, notes, hook-prompt flag.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::types::{AppState, Project, ProjectSettings};

pub struct Store {
    file: PathBuf,
    pub state: Mutex<AppState>,
}

fn state_file() -> PathBuf {
    let mut dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("com.akurach.orbisdeck");
    let _ = fs::create_dir_all(&dir);
    dir.push("cockpit-state.json");
    dir
}

impl Store {
    pub fn load() -> Self {
        let file = state_file();
        let state = fs::read_to_string(&file)
            .ok()
            .and_then(|t| serde_json::from_str::<AppState>(&t).ok())
            .unwrap_or_default();
        Store {
            file,
            state: Mutex::new(state),
        }
    }

    fn persist(&self, state: &AppState) {
        if let Ok(json) = serde_json::to_string_pretty(state) {
            let tmp = self.file.with_extension("tmp");
            if fs::write(&tmp, json).is_ok() {
                let _ = fs::rename(&tmp, &self.file);
            }
        }
    }

    pub fn get_state(&self) -> AppState {
        self.state.lock().unwrap().clone()
    }

    pub fn project_path(&self, id: &str) -> String {
        self.state
            .lock()
            .unwrap()
            .projects
            .iter()
            .find(|p| p.id == id)
            .map(|p| p.settings.path.clone())
            .unwrap_or_default()
    }

    pub fn project(&self, id: &str) -> Option<Project> {
        self.state
            .lock()
            .unwrap()
            .projects
            .iter()
            .find(|p| p.id == id)
            .cloned()
    }

    pub fn add_project(&self, name: String, settings: ProjectSettings) -> Project {
        let mut st = self.state.lock().unwrap();
        let project = Project {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            settings,
        };
        st.projects.push(project.clone());
        if st.active_project_id.is_none() {
            st.active_project_id = Some(project.id.clone());
        }
        self.persist(&st);
        project
    }

    pub fn update_project(
        &self,
        id: &str,
        name: Option<String>,
        settings: Option<serde_json::Value>,
    ) -> Option<Project> {
        let mut st = self.state.lock().unwrap();
        if let Some(p) = st.projects.iter_mut().find(|p| p.id == id) {
            if let Some(n) = name {
                p.name = n;
            }
            if let Some(patch) = settings {
                // merge patch over current settings
                if let Ok(mut cur) = serde_json::to_value(&p.settings) {
                    if let (Some(curo), Some(patcho)) = (cur.as_object_mut(), patch.as_object()) {
                        for (k, v) in patcho {
                            curo.insert(k.clone(), v.clone());
                        }
                    }
                    if let Ok(merged) = serde_json::from_value::<ProjectSettings>(cur) {
                        p.settings = merged;
                    }
                }
            }
            let updated = p.clone();
            self.persist(&st);
            return Some(updated);
        }
        None
    }

    pub fn remove_project(&self, id: &str) {
        let mut st = self.state.lock().unwrap();
        st.projects.retain(|p| p.id != id);
        if st.active_project_id.as_deref() == Some(id) {
            st.active_project_id = st.projects.first().map(|p| p.id.clone());
        }
        self.persist(&st);
    }

    pub fn set_active(&self, id: Option<String>) {
        let mut st = self.state.lock().unwrap();
        st.active_project_id = id;
        self.persist(&st);
    }

    pub fn reorder(&self, ids: Vec<String>) {
        let mut st = self.state.lock().unwrap();
        let mut next: Vec<Project> = Vec::new();
        for id in &ids {
            if let Some(p) = st.projects.iter().find(|p| &p.id == id) {
                next.push(p.clone());
            }
        }
        for p in &st.projects {
            if !ids.contains(&p.id) {
                next.push(p.clone());
            }
        }
        st.projects = next;
        self.persist(&st);
    }

    pub fn mark_hooks_prompted(&self) {
        let mut st = self.state.lock().unwrap();
        st.agent_hooks_prompted = true;
        self.persist(&st);
    }

    pub fn get_note(&self, id: &str) -> String {
        self.state
            .lock()
            .unwrap()
            .notes
            .get(id)
            .cloned()
            .unwrap_or_default()
    }

    pub fn set_note(&self, id: String, text: String) {
        let mut st = self.state.lock().unwrap();
        if text.is_empty() {
            st.notes.remove(&id);
        } else {
            st.notes.insert(id, text);
        }
        self.persist(&st);
    }
}
