use serde::{Deserialize, Serialize};

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub backend: Option<CommandExecutionState>,
    pub frontend: Option<CommandExecutionState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedProject {
    pub id: String,
    pub name: String,
    pub path: String,
    pub backend: Option<CommandConfig>,
    pub frontend: Option<CommandConfig>,
    pub urls: ProjectUrls,
    pub detection: ProjectDetection,
    pub runtime: Option<ProjectRuntimeState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub editor_command: String,
    pub open_backend_url_on_work_mode: bool,
    pub open_frontend_url_on_work_mode: bool,
    pub confirm_risky_commands: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            editor_command: "code".to_string(),
            open_backend_url_on_work_mode: true,
            open_frontend_url_on_work_mode: true,
            confirm_risky_commands: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectProjectResult {
    pub detection: ProjectDetection,
    pub backend: Option<CommandConfig>,
    pub frontend: Option<CommandConfig>,
}
