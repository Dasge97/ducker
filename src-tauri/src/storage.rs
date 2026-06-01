use std::{fs, path::PathBuf};

use tauri::{Manager, Runtime};

use crate::models::{AppSettings, ManagedProject};

fn app_data_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

pub fn load_projects<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Vec<ManagedProject>, String> {
    let mut path = app_data_dir(app)?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("projects.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut projects: Vec<ManagedProject> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    for project in &mut projects {
        project.runtime = None;
    }
    Ok(projects)
}

pub fn save_projects<R: Runtime>(app: &tauri::AppHandle<R>, projects: &[ManagedProject]) -> Result<(), String> {
    let mut path = app_data_dir(app)?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("projects.json");
    fs::write(path, serde_json::to_string_pretty(projects).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

pub fn load_settings<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<AppSettings, String> {
    let mut path = app_data_dir(app)?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("settings.json");
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

pub fn save_settings<R: Runtime>(app: &tauri::AppHandle<R>, settings: &AppSettings) -> Result<AppSettings, String> {
    let mut path = app_data_dir(app)?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("settings.json");
    fs::write(path, serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(settings.clone())
}
