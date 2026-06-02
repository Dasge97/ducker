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
        project.migrate_legacy();
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
    let mut settings: AppSettings = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let mut secret_path = app_data_dir(app)?;
    secret_path.push("settings.secrets.json");
    if secret_path.exists() {
        let secret_data = fs::read_to_string(secret_path).map_err(|e| e.to_string())?;
        let secret_value: serde_json::Value = serde_json::from_str(&secret_data).map_err(|e| e.to_string())?;
        if let Some(api_key) = secret_value.get("aiApiKey").and_then(|v| v.as_str()) {
            settings.ai.api_key_configured = !api_key.is_empty();
            settings.ai.api_key_masked = Some(mask_key(api_key));
        }
    }
    settings.ai.api_key_input = None;
    Ok(settings)
}

pub fn save_settings<R: Runtime>(app: &tauri::AppHandle<R>, settings: &AppSettings) -> Result<AppSettings, String> {
    let mut path = app_data_dir(app)?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("settings.json");
    let mut persisted = settings.clone();
    let mut api_key_to_store = None;
    if let Some(input) = &persisted.ai.api_key_input {
        if !input.trim().is_empty() {
            api_key_to_store = Some(input.trim().to_string());
            persisted.ai.api_key_configured = true;
            persisted.ai.api_key_masked = Some(mask_key(input));
        }
    }
    persisted.ai.api_key_input = None;
    persisted.ai.storage_warning = Some("API key is stored locally in app-data (v2 pragmatic mode).".to_string());
    fs::write(path, serde_json::to_string_pretty(&persisted).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;

    if let Some(api_key) = api_key_to_store {
        let mut secret_path = app_data_dir(app)?;
        secret_path.push("settings.secrets.json");
        let payload = serde_json::json!({ "aiApiKey": api_key });
        fs::write(secret_path, serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    }
    Ok(persisted)
}

fn mask_key(key: &str) -> String {
    let trimmed = key.trim();
    if trimmed.len() <= 6 {
        return "••••••".to_string();
    }
    format!("{}••••{}", &trimmed[..3], &trimmed[trimmed.len() - 3..])
}

pub fn load_ai_api_key<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Option<String>, String> {
    let mut secret_path = app_data_dir(app)?;
    secret_path.push("settings.secrets.json");
    if !secret_path.exists() {
        return Ok(None);
    }
    let secret_data = fs::read_to_string(secret_path).map_err(|e| e.to_string())?;
    let secret_value: serde_json::Value = serde_json::from_str(&secret_data).map_err(|e| e.to_string())?;
    Ok(secret_value.get("aiApiKey").and_then(|v| v.as_str()).map(ToString::to_string))
}
