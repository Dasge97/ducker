use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub enabled: bool,
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub api_key_configured: bool,
    pub api_key_masked: Option<String>,
    #[serde(default)]
    pub api_key_input: Option<String>,
    pub include_source_snippets: bool,
    pub storage_warning: Option<String>,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: "openai-compatible".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4o-mini".to_string(),
            api_key_configured: false,
            api_key_masked: None,
            api_key_input: None,
            include_source_snippets: false,
            storage_warning: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandConfig {
    pub id: String,
    pub label: String,
    pub executable: String,
    pub args: Vec<String>,
    pub working_directory: String,
    pub kind: String,
    pub stop_command: Option<Box<CommandConfig>>,
    pub risky: Option<bool>,
    #[serde(default)]
    pub preferred_port: Option<u16>,
    #[serde(default)]
    pub port_strategy: Option<String>,
    #[serde(default)]
    pub smart_port_pattern: Option<String>,
    #[serde(default)]
    pub env: Option<std::collections::HashMap<String, String>>,
    #[serde(default)]
    pub origin: Option<String>,
    #[serde(default)]
    pub overridden_by_user: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectUrls {
    pub backend: Option<String>,
    pub frontend: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetection {
    pub is_symfony: bool,
    pub has_composer_json: bool,
    pub has_bin_console: bool,
    pub has_package_json: bool,
    pub has_yarn_lock: bool,
    #[serde(default)]
    pub detected_stacks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandExecutionState {
    pub command_id: String,
    pub status: String,
    pub recent_logs: Vec<String>,
    pub error: Option<String>,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRuntimeState {
    #[serde(default)]
    pub services: std::collections::HashMap<String, CommandExecutionState>,
}

fn default_true() -> bool { true }

/// A single runnable unit of a project (backend, frontend, database, worker, ...).
/// The `command` carries how to launch it; the service wraps it with a semantic role.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceConfig {
    pub id: String,
    pub label: String,
    /// Semantic role: backend | frontend | database | worker | custom
    pub kind: String,
    pub command: CommandConfig,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedProject {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub services: Vec<ServiceConfig>,
    pub detection: ProjectDetection,
    pub runtime: Option<ProjectRuntimeState>,
    #[serde(default)]
    pub smart_ports_enabled: Option<bool>,
    #[serde(default)]
    pub stack_plan: Option<StackPlan>,
    #[serde(default)]
    pub ai_metadata: Option<AiProjectMetadata>,

    // ---- Legacy fields (read-only, kept for one-time migration of old projects.json) ----
    #[serde(default, skip_serializing)]
    pub backend: Option<CommandConfig>,
    #[serde(default, skip_serializing)]
    pub frontend: Option<CommandConfig>,
    #[serde(default, skip_serializing)]
    pub urls: Option<ProjectUrls>,
}

impl ManagedProject {
    /// Convert the old `backend`/`frontend`/`urls` shape into the new `services` list.
    /// No-op for projects already stored in the new format.
    pub fn migrate_legacy(&mut self) {
        if !self.services.is_empty() {
            self.backend = None;
            self.frontend = None;
            self.urls = None;
            return;
        }
        let urls = self.urls.take().unwrap_or_default();
        if let Some(command) = self.backend.take() {
            self.services.push(ServiceConfig {
                id: command.id.clone(),
                label: command.label.clone(),
                kind: "backend".to_string(),
                url: urls.backend.clone(),
                enabled: true,
                command,
            });
        }
        if let Some(command) = self.frontend.take() {
            self.services.push(ServiceConfig {
                id: command.id.clone(),
                label: command.label.clone(),
                kind: "frontend".to_string(),
                url: urls.frontend.clone(),
                enabled: true,
                command,
            });
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub editor_command: String,
    pub open_backend_url_on_work_mode: bool,
    pub open_frontend_url_on_work_mode: bool,
    pub confirm_risky_commands: bool,
    #[serde(default)]
    pub ai: AiSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            editor_command: "code".to_string(),
            open_backend_url_on_work_mode: true,
            open_frontend_url_on_work_mode: true,
            confirm_risky_commands: true,
            ai: AiSettings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServicePlan {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub command: CommandConfig,
    pub preferred_port: Option<u16>,
    pub port_strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StackPlan {
    pub stack_name: String,
    pub confidence: f32,
    pub services: Vec<ServicePlan>,
    pub assumptions: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSummary {
    pub root_path: String,
    pub included_files: Vec<String>,
    pub omitted_files: Vec<String>,
    pub manifests: std::collections::HashMap<String, String>,
    pub scripts: std::collections::HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeProjectWithAiResult {
    pub snapshot: SnapshotSummary,
    pub plan: StackPlan,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProjectMetadata {
    pub origin: String,
    pub confidence: Option<f32>,
    pub assumptions: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartLaunchServicePlan {
    pub command_id: String,
    pub assigned_port: Option<u16>,
    pub adapted_command: CommandConfig,
    pub warnings: Vec<String>,
    pub blocked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartLaunchPlan {
    pub project_id: String,
    pub services: Vec<SmartLaunchServicePlan>,
    pub reservations: Vec<u16>,
    pub warnings: Vec<String>,
    pub blocked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectProjectResult {
    pub detection: ProjectDetection,
    pub services: Vec<ServiceConfig>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_legacy_backend_frontend_into_services() {
        // An old projects.json entry: backend + frontend + urls, no `services`.
        let legacy = serde_json::json!({
            "id": "p1",
            "name": "Legacy",
            "path": "/tmp/p1",
            "backend": {
                "id": "backend", "label": "Backend", "executable": "symfony",
                "args": ["server:start"], "workingDirectory": "/tmp/p1", "kind": "symfony-backend"
            },
            "frontend": {
                "id": "frontend", "label": "Frontend", "executable": "yarn",
                "args": ["dev"], "workingDirectory": "/tmp/p1", "kind": "yarn-frontend"
            },
            "urls": { "backend": "http://127.0.0.1:8000", "frontend": "http://localhost:5173" },
            "detection": {
                "isSymfony": true, "hasComposerJson": true, "hasBinConsole": true,
                "hasPackageJson": true, "hasYarnLock": true
            }
        });

        let mut project: ManagedProject = serde_json::from_value(legacy).expect("deserialize legacy");
        project.migrate_legacy();

        assert_eq!(project.services.len(), 2);
        let backend = project.services.iter().find(|s| s.kind == "backend").expect("backend service");
        assert_eq!(backend.command.executable, "symfony");
        assert_eq!(backend.url.as_deref(), Some("http://127.0.0.1:8000"));
        let frontend = project.services.iter().find(|s| s.kind == "frontend").expect("frontend service");
        assert_eq!(frontend.command.executable, "yarn");
        // Legacy fields are cleared so they are never written back to disk.
        assert!(project.backend.is_none() && project.frontend.is_none() && project.urls.is_none());
    }

    #[test]
    fn migrate_is_noop_for_new_format() {
        let mut project = ManagedProject {
            id: "p2".into(), name: "New".into(), path: "/tmp/p2".into(),
            services: vec![ServiceConfig {
                id: "db".into(), label: "Postgres".into(), kind: "database".into(), url: None, enabled: true,
                command: CommandConfig {
                    id: "db".into(), label: "db".into(), executable: "docker".into(),
                    args: vec!["compose".into(), "up".into()], working_directory: "/tmp/p2".into(),
                    kind: "custom".into(), stop_command: None, risky: None, preferred_port: None,
                    port_strategy: None, smart_port_pattern: None, env: None, origin: None, overridden_by_user: None,
                },
            }],
            detection: ProjectDetection::default(), runtime: None, smart_ports_enabled: None,
            stack_plan: None, ai_metadata: None, backend: None, frontend: None, urls: None,
        };
        project.migrate_legacy();
        assert_eq!(project.services.len(), 1);
        assert_eq!(project.services[0].kind, "database");
    }
}
