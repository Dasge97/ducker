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
    #[serde(default)]
    pub smart_ports_enabled: Option<bool>,
    #[serde(default)]
    pub stack_plan: Option<StackPlan>,
    #[serde(default)]
    pub ai_metadata: Option<AiProjectMetadata>,
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
    pub backend: Option<CommandConfig>,
    pub frontend: Option<CommandConfig>,
}
