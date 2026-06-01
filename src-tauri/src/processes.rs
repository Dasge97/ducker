use std::{collections::{HashMap, VecDeque}, io::{BufRead, BufReader}, process::{Command, Stdio}, sync::{Arc, Mutex}, thread};

use crate::models::{CommandExecutionState, ManagedProject};

#[derive(Clone, Default)]
pub struct ProcessState {
    pub logs: Arc<Mutex<HashMap<String, VecDeque<String>>>>,
    pub statuses: Arc<Mutex<HashMap<String, CommandExecutionState>>>,
    pub children: Arc<Mutex<HashMap<String, u32>>>,
}

fn key(project_id: &str, command_id: &str) -> String { format!("{project_id}:{command_id}") }

fn now() -> String { format!("{:?}", std::time::SystemTime::now()) }

fn push_log(process_state: &ProcessState, k: &str, line: String) {
    if let Ok(mut map) = process_state.logs.lock() {
        let q = map.entry(k.to_string()).or_insert_with(VecDeque::new);
        q.push_back(line);
        while q.len() > 100 { q.pop_front(); }
    }
}

#[cfg(target_os = "windows")]
fn terminate_pid(pid: u32) -> Result<(), String> {
    Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn terminate_pid(pid: u32) -> Result<(), String> {
    Command::new("kill")
        .arg("-TERM")
        .arg(pid.to_string())
        .status()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn start(process_state: &ProcessState, projects: &[ManagedProject], project_id: &str, command_id: &str) -> Result<CommandExecutionState, String> {
    let project = projects.iter().find(|p| p.id == project_id).ok_or("Project not found")?;
    let command = [project.backend.as_ref(), project.frontend.as_ref()].into_iter().flatten().find(|c| c.id == command_id).ok_or("Command not found")?;
    let mut child = Command::new(&command.executable)
        .args(&command.args)
        .current_dir(&command.working_directory)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn().map_err(|e| e.to_string())?;
    let child_id = child.id();
    let k = key(project_id, command_id);
    process_state.children.lock().map_err(|_| "lock")?.insert(k.clone(), child_id);

    if let Some(stdout) = child.stdout.take() {
        let logs = process_state.logs.clone();
        let k2 = k.clone();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Ok(mut map) = logs.lock() {
                    let q = map.entry(k2.clone()).or_insert_with(VecDeque::new);
                    q.push_back(line);
                    while q.len() > 100 { q.pop_front(); }
                }
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let logs = process_state.logs.clone();
        let k2 = k.clone();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if let Ok(mut map) = logs.lock() {
                    let q = map.entry(k2.clone()).or_insert_with(VecDeque::new);
                    q.push_back(format!("[stderr] {line}"));
                    while q.len() > 100 { q.pop_front(); }
                }
            }
        });
    }

    let status = CommandExecutionState { command_id: command_id.to_string(), status: "running".to_string(), recent_logs: vec![], error: None, started_at: Some(now()), finished_at: None };
    process_state.statuses.lock().map_err(|_| "lock")?.insert(k, status.clone());

    let process_state_for_wait = process_state.clone();
    let wait_key = key(project_id, command_id);
    let wait_command_id = command_id.to_string();
    thread::spawn(move || {
        match child.wait() {
            Ok(exit_status) => {
                let status_text = if exit_status.success() { "completed" } else { "failed" };
                let error = if exit_status.success() { None } else { Some(format!("Command exited with status {exit_status}")) };
                if let Some(err) = &error { push_log(&process_state_for_wait, &wait_key, err.clone()); }
                let recent_logs = process_state_for_wait.logs.lock().ok()
                    .and_then(|m| m.get(&wait_key).cloned())
                    .unwrap_or_default()
                    .into_iter()
                    .collect();
                let next = CommandExecutionState {
                    command_id: wait_command_id,
                    status: status_text.to_string(),
                    recent_logs,
                    error,
                    started_at: process_state_for_wait.statuses.lock().ok()
                        .and_then(|m| m.get(&wait_key).and_then(|s| s.started_at.clone())),
                    finished_at: Some(now()),
                };
                if let Ok(mut statuses) = process_state_for_wait.statuses.lock() { statuses.insert(wait_key.clone(), next); }
                if let Ok(mut children) = process_state_for_wait.children.lock() { children.remove(&wait_key); }
            }
            Err(error) => {
                push_log(&process_state_for_wait, &wait_key, format!("[error] {error}"));
            }
        }
    });
    Ok(status)
}

pub fn stop(process_state: &ProcessState, projects: &[ManagedProject], project_id: &str, command_id: &str) -> Result<CommandExecutionState, String> {
    let project = projects.iter().find(|p| p.id == project_id).ok_or("Project not found")?;
    let command = [project.backend.as_ref(), project.frontend.as_ref()].into_iter().flatten().find(|c| c.id == command_id).ok_or("Command not found")?;
    if let Some(stop_command) = &command.stop_command {
        let _ = Command::new(&stop_command.executable).args(&stop_command.args).current_dir(&stop_command.working_directory).status();
    }
    if let Some(pid) = process_state.children.lock().map_err(|_| "lock")?.remove(&key(project_id, command_id)) {
        let _ = terminate_pid(pid);
    }
    let mut status = get_log(process_state, project_id, command_id);
    status.status = "stopped".to_string();
    status.finished_at = Some(now());
    process_state.statuses.lock().map_err(|_| "lock")?.insert(key(project_id, command_id), status.clone());
    Ok(status)
}

pub fn get_log(process_state: &ProcessState, project_id: &str, command_id: &str) -> CommandExecutionState {
    let k = key(project_id, command_id);
    let logs = process_state.logs.lock().ok().and_then(|m| m.get(&k).cloned()).unwrap_or_default();
    let mut status = process_state.statuses.lock().ok().and_then(|m| m.get(&k).cloned()).unwrap_or(CommandExecutionState { command_id: command_id.to_string(), status: "idle".to_string(), recent_logs: vec![], error: None, started_at: None, finished_at: None });
    status.recent_logs = logs.into_iter().collect();
    status
}
