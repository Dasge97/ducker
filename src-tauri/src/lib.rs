mod detection;
mod ai_client;
mod models;
mod os_actions;
mod port_planner;
mod project_snapshot;
mod processes;
mod storage;

use std::sync::Mutex;

use models::{AnalyzeProjectWithAiResult, AppSettings, CommandExecutionState, DetectProjectResult, ManagedProject, SmartLaunchPlan, SnapshotSummary};
use port_planner::PortRegistry;
use processes::ProcessState;

#[derive(serde::Serialize)]
struct AppInfo {
    name: String,
    version: String,
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Ducker".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[derive(Default)]
struct AppState {
    process_state: ProcessState,
    projects_cache: Mutex<Vec<ManagedProject>>,
    port_registry: PortRegistry,
}

#[tauri::command]
fn list_projects(app: tauri::AppHandle) -> Result<Vec<ManagedProject>, String> {
    storage::load_projects(&app)
}

#[tauri::command]
fn save_project(app: tauri::AppHandle, state: tauri::State<'_, AppState>, project: ManagedProject) -> Result<Vec<ManagedProject>, String> {
    let mut projects = storage::load_projects(&app)?;
    if let Some(existing) = projects.iter_mut().find(|p| p.id == project.id) {
        *existing = project;
    } else {
        projects.push(project);
    }
    storage::save_projects(&app, &projects)?;
    *state.projects_cache.lock().map_err(|_| "lock")? = projects.clone();
    Ok(projects)
}

#[tauri::command]
fn delete_project(app: tauri::AppHandle, state: tauri::State<'_, AppState>, project_id: String) -> Result<Vec<ManagedProject>, String> {
    let mut projects = storage::load_projects(&app)?;
    projects.retain(|p| p.id != project_id);
    storage::save_projects(&app, &projects)?;
    *state.projects_cache.lock().map_err(|_| "lock")? = projects.clone();
    Ok(projects)
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<AppSettings, String> { storage::load_settings(&app) }

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<AppSettings, String> { storage::save_settings(&app, &settings) }

#[tauri::command]
fn detect_project(path: String) -> DetectProjectResult { detection::detect_project(&path) }

#[tauri::command]
fn analyze_project_with_ai(app: tauri::AppHandle, path: String) -> Result<AnalyzeProjectWithAiResult, String> {
    let settings = storage::load_settings(&app)?;
    let api_key = storage::load_ai_api_key(&app)?.ok_or("AI settings incomplete: missing API key")?;
    let snapshot = project_snapshot::collect_snapshot(&path, settings.ai.include_source_snippets)?;
    ai_client::analyze_with_ai(&settings.ai, &api_key, snapshot, std::env::consts::OS, &processes::detect_tools())
}

#[tauri::command]
fn analyze_project_snapshot_with_ai(app: tauri::AppHandle, snapshot: SnapshotSummary) -> Result<AnalyzeProjectWithAiResult, String> {
    let settings = storage::load_settings(&app)?;
    let api_key = storage::load_ai_api_key(&app)?.ok_or("AI settings incomplete: missing API key")?;
    ai_client::analyze_with_ai(&settings.ai, &api_key, snapshot, std::env::consts::OS, &processes::detect_tools())
}

#[tauri::command]
fn collect_project_snapshot(app: tauri::AppHandle, path: String) -> Result<SnapshotSummary, String> {
    let settings = storage::load_settings(&app)?;
    project_snapshot::collect_snapshot(&path, settings.ai.include_source_snippets)
}

#[tauri::command]
fn plan_smart_launch(app: tauri::AppHandle, state: tauri::State<'_, AppState>, project_id: String) -> Result<SmartLaunchPlan, String> {
    let projects = storage::load_projects(&app)?;
    let project = projects.iter().find(|p| p.id == project_id).ok_or("Project not found")?;
    Ok(port_planner::plan_launch(project, &state.port_registry, false))
}

#[tauri::command]
fn start_smart_launch(state: tauri::State<'_, AppState>, app: tauri::AppHandle, project_id: String) -> Result<SmartLaunchPlan, String> {
    let projects = storage::load_projects(&app)?;
    let project = projects.iter().find(|p| p.id == project_id).ok_or("Project not found")?;
    let plan = port_planner::plan_launch(project, &state.port_registry, true);
    if plan.blocked {
        return Ok(plan);
    }
    let mut started = Vec::new();
    for service in &plan.services {
        match processes::start_with_command(&state.process_state, &app, &project_id, &service.command_id, &service.adapted_command, &project.path) {
            Ok(_) => started.push(service.command_id.clone()),
            Err(error) => {
                for command_id in started {
                    let _ = processes::stop(&state.process_state, &app, &projects, &project_id, &command_id);
                }
                port_planner::release_project(&project_id, &state.port_registry);
                return Err(error);
            }
        }
    }
    Ok(plan)
}

#[tauri::command]
fn start_command(state: tauri::State<'_, AppState>, app: tauri::AppHandle, project_id: String, command_id: String) -> Result<CommandExecutionState, String> {
    let projects = storage::load_projects(&app)?;
    let project = projects.iter().find(|p| p.id == project_id).ok_or("Project not found")?;
    // With smart ports on, an individual start must use the adapted (reassigned) port too,
    // not just "Work mode" — otherwise it would clash on the original port.
    if project.smart_ports_enabled == Some(true) {
        let command = project.services.iter().map(|s| &s.command).find(|c| c.id == command_id).ok_or("Command not found")?;
        let plan = port_planner::plan_command(&project.id, command, &state.port_registry, true);
        if plan.blocked {
            port_planner::release_command(&project_id, &command_id, &state.port_registry);
            return Err(if plan.warnings.is_empty() { "Smart ports could not assign a port for this command".to_string() } else { plan.warnings.join(" ") });
        }
        return processes::start_with_command(&state.process_state, &app, &project_id, &command_id, &plan.adapted_command, &project.path);
    }
    processes::start(&state.process_state, &app, &projects, &project_id, &command_id)
}

#[tauri::command]
fn stop_command(state: tauri::State<'_, AppState>, app: tauri::AppHandle, project_id: String, command_id: String) -> Result<CommandExecutionState, String> {
    let projects = storage::load_projects(&app)?;
    let state_out = processes::stop(&state.process_state, &app, &projects, &project_id, &command_id)?;
    port_planner::release_command(&project_id, &command_id, &state.port_registry);
    Ok(state_out)
}

#[tauri::command]
fn get_command_log(state: tauri::State<'_, AppState>, project_id: String, command_id: String) -> CommandExecutionState {
    let command_state = processes::get_log(&state.process_state, &project_id, &command_id);
    if command_state.status != "running" && command_state.status != "starting" {
        port_planner::release_command(&project_id, &command_id, &state.port_registry);
    }
    command_state
}

#[tauri::command]
fn open_editor(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
    let settings = storage::load_settings(&app)?;
    let projects = storage::load_projects(&app)?;
    let project = projects.into_iter().find(|p| p.id == project_id).ok_or("Project not found")?;
    os_actions::open_editor(&settings.editor_command, &project.path)
}

#[tauri::command]
fn open_folder(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
    let projects = storage::load_projects(&app)?;
    let project = projects.into_iter().find(|p| p.id == project_id).ok_or("Project not found")?;
    os_actions::open_folder(&project.path)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> { os_actions::open_url(&url) }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            list_projects,
            save_project,
            delete_project,
            load_settings,
            save_settings,
            detect_project,
            collect_project_snapshot,
            analyze_project_with_ai,
            analyze_project_snapshot_with_ai,
            plan_smart_launch,
            start_smart_launch,
            start_command,
            stop_command,
            get_command_log,
            open_editor,
            open_folder,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ducker");
}
