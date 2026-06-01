mod detection;
mod models;
mod os_actions;
mod processes;
mod storage;

use std::sync::Mutex;

use models::{AppSettings, CommandExecutionState, DetectProjectResult, ManagedProject};
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
fn start_command(state: tauri::State<'_, AppState>, app: tauri::AppHandle, project_id: String, command_id: String) -> Result<CommandExecutionState, String> {
    let projects = storage::load_projects(&app)?;
    processes::start(&state.process_state, &projects, &project_id, &command_id)
}

#[tauri::command]
fn stop_command(state: tauri::State<'_, AppState>, app: tauri::AppHandle, project_id: String, command_id: String) -> Result<CommandExecutionState, String> {
    let projects = storage::load_projects(&app)?;
    processes::stop(&state.process_state, &projects, &project_id, &command_id)
}

#[tauri::command]
fn get_command_log(state: tauri::State<'_, AppState>, project_id: String, command_id: String) -> CommandExecutionState {
    processes::get_log(&state.process_state, &project_id, &command_id)
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
