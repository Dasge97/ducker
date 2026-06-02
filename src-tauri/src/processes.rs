use std::{collections::{HashMap, VecDeque}, io::{BufRead, BufReader}, net::TcpStream, process::{Command, Stdio}, sync::{Arc, Mutex}, thread, time::Duration};

use tauri::{AppHandle, Emitter};

use crate::models::{CommandExecutionState, ManagedProject};
use crate::models::CommandConfig;
use crate::port_planner;

#[derive(Clone, Default)]
pub struct ProcessState {
    pub logs: Arc<Mutex<HashMap<String, VecDeque<String>>>>,
    pub statuses: Arc<Mutex<HashMap<String, CommandExecutionState>>>,
    pub children: Arc<Mutex<HashMap<String, u32>>>,
}

fn key(project_id: &str, command_id: &str) -> String { format!("{project_id}:{command_id}") }

/// Resolve a bare program name to a real, spawnable executable on Windows.
/// `Command::new` only finds `.exe`, but tools like `code`/`yarn`/`npm` are `.cmd` (or `.ps1`)
/// shims on PATH. We search PATH for an executable extension (.exe/.cmd/.bat/.com) and return
/// its full path. `.ps1` is intentionally skipped (it can't be spawned directly). No-op elsewhere.
#[cfg(windows)]
pub fn resolve_program(program: &str) -> String {
    use std::path::Path;
    let p = Path::new(program);
    if p.is_absolute() || program.contains('\\') || program.contains('/') || p.extension().is_some() {
        return program.to_string();
    }
    let exts = [".exe", ".cmd", ".bat", ".com"];
    if let Some(paths) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&paths) {
            for ext in exts {
                let candidate = dir.join(format!("{program}{ext}"));
                if candidate.is_file() {
                    return candidate.to_string_lossy().into_owned();
                }
            }
        }
    }
    program.to_string()
}
#[cfg(not(windows))]
pub fn resolve_program(program: &str) -> String { program.to_string() }

/// Is a CLI available on PATH? Used to tell the AI advisor what this machine can actually run.
pub fn tool_available(program: &str) -> bool {
    #[cfg(windows)]
    {
        resolve_program(program) != program
    }
    #[cfg(not(windows))]
    {
        if let Some(paths) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&paths) {
                if dir.join(program).is_file() {
                    return true;
                }
            }
        }
        false
    }
}

/// The subset of common dev CLIs present on this machine.
pub fn detect_tools() -> Vec<String> {
    const TOOLS: [&str; 19] = [
        "symfony", "php", "composer", "node", "npm", "yarn", "pnpm", "bun", "docker",
        "python", "python3", "go", "cargo", "dotnet", "ruby", "bundle", "rails", "make", "just",
    ];
    TOOLS.iter().filter(|t| tool_available(t)).map(|t| t.to_string()).collect()
}

/// Prevent a console window from flashing/staying open when spawning child processes on Windows.
#[cfg(windows)]
fn hide_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
}
#[cfg(not(windows))]
fn hide_window(_command: &mut Command) {}

fn now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis().to_string())
        .unwrap_or_default()
}

/// Strip ANSI/VT100 escape sequences (color codes etc.) so logs render cleanly in the UI.
fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                chars.next();
                while let Some(&n) = chars.peek() {
                    chars.next();
                    if ('@'..='~').contains(&n) { break; }
                }
            }
            // lone ESC or other escapes: dropped
        } else {
            out.push(c);
        }
    }
    out
}

/// Push a line into the bounded log buffer (last 100 lines) and stream it to the UI.
fn record_log(process_state: &ProcessState, app: &AppHandle, project_id: &str, command_id: &str, k: &str, line: String) {
    let line = strip_ansi(&line);
    if let Ok(mut map) = process_state.logs.lock() {
        let q = map.entry(k.to_string()).or_insert_with(VecDeque::new);
        q.push_back(line.clone());
        while q.len() > 100 { q.pop_front(); }
    }
    let _ = app.emit("ducker-log", serde_json::json!({ "projectId": project_id, "commandId": command_id, "line": line }));
}

fn emit_status(app: &AppHandle, project_id: &str, state: &CommandExecutionState) {
    let _ = app.emit("ducker-status", serde_json::json!({ "projectId": project_id, "state": state }));
}

fn port_reachable(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

/// The Symfony local server is a self-managed daemon (one per directory): a second
/// `server:start` just reports "already running" and ignores the requested port. We detect
/// that command so we can stop any stale server first and stop it cleanly afterwards.
fn is_symfony_serve(command: &CommandConfig) -> bool {
    command.executable.to_lowercase().contains("symfony")
        && command.args.iter().any(|a| a == "server:start" || a == "serve")
}

/// Remove Symfony's stale per-project server state. Symfony records the last port in
/// ~/.symfony5/var/<hash>.pid and, on the next `server:start`, "reuses" it if *anything* answers
/// there — even an unrelated process (e.g. another project's Docker container on that port).
/// Clearing it for this project only (matched by directory) makes `server:start` honor our port.
fn clear_symfony_registry(project_dir: &str) {
    use std::path::Path;
    let home = match std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
        Some(h) => h,
        None => return,
    };
    let var_dir = Path::new(&home).join(".symfony5").join("var");
    let entries = match std::fs::read_dir(&var_dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    let target = std::fs::canonicalize(project_dir).ok();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("pid") {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        let dir = serde_json::from_str::<serde_json::Value>(&content)
            .ok()
            .and_then(|v| v.get("dir").and_then(|d| d.as_str()).map(str::to_string));
        let Some(dir) = dir else { continue };
        let same = (std::fs::canonicalize(&dir).ok() == target && target.is_some()) || dir.eq_ignore_ascii_case(project_dir);
        if same {
            let _ = std::fs::remove_file(&path);
            if let Some(stem) = path.file_stem() {
                let _ = std::fs::remove_dir_all(var_dir.join(stem));
            }
        }
    }
}

fn symfony_server_stop(cwd: &str) {
    // Stop any live server for this directory…
    let mut c = Command::new(resolve_program("symfony"));
    c.args(["server:stop"]).current_dir(cwd);
    hide_window(&mut c);
    let _ = c.status();
    // …then drop its (possibly stale) registry entry so the next start picks the requested port.
    clear_symfony_registry(cwd);
}

/// Resolve a command's working directory against the project root. AI/manual commands often
/// store "." (or a relative subpath); without this they'd run in Ducker's own directory.
fn resolve_cwd(working_directory: &str, project_root: &str) -> String {
    use std::path::Path;
    let wd = working_directory.trim();
    if wd.is_empty() || wd == "." {
        return project_root.to_string();
    }
    let p = Path::new(wd);
    if p.is_absolute() {
        wd.to_string()
    } else {
        Path::new(project_root).join(wd).to_string_lossy().into_owned()
    }
}

#[cfg(target_os = "windows")]
fn terminate_pid(pid: u32) -> Result<(), String> {
    let mut command = Command::new("taskkill");
    command.args(["/PID", &pid.to_string(), "/T", "/F"]);
    hide_window(&mut command);
    command.status().map_err(|e| e.to_string())?;
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

pub fn start(process_state: &ProcessState, app: &AppHandle, projects: &[ManagedProject], project_id: &str, command_id: &str) -> Result<CommandExecutionState, String> {
    let project = projects.iter().find(|p| p.id == project_id).ok_or("Project not found")?;
    let command = project.services.iter().map(|s| &s.command).find(|c| c.id == command_id).ok_or("Command not found")?;
    start_with_command(process_state, app, project_id, command_id, command, &project.path)
}

pub fn start_with_command(process_state: &ProcessState, app: &AppHandle, project_id: &str, command_id: &str, command: &CommandConfig, project_root: &str) -> Result<CommandExecutionState, String> {
    let resolved_cwd = resolve_cwd(&command.working_directory, project_root);
    // Clear any stale Symfony server for this directory so our chosen port is actually used.
    if is_symfony_serve(command) {
        symfony_server_stop(&resolved_cwd);
    }
    let mut command_builder = Command::new(resolve_program(&command.executable));
    command_builder
        .args(&command.args)
        .current_dir(&resolved_cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(env) = &command.env {
        command_builder.envs(env);
    }
    hide_window(&mut command_builder);
    let mut child = command_builder
        .spawn()
        .map_err(|e| format!("Could not start \"{}\" in {}: {e}", command.executable, resolved_cwd))?;
    let child_id = child.id();
    let k = key(project_id, command_id);
    process_state.children.lock().map_err(|_| "lock")?.insert(k.clone(), child_id);

    // First log line: the exact command and working directory actually used.
    record_log(process_state, app, project_id, command_id, &k, format!("$ {} {}", command.executable, command.args.join(" ")));
    record_log(process_state, app, project_id, command_id, &k, format!("· cwd: {resolved_cwd}"));

    let effective_port = port_planner::effective_port(command);

    if let Some(stdout) = child.stdout.take() {
        let process_state = process_state.clone();
        let app = app.clone();
        let k2 = k.clone();
        let project_id = project_id.to_string();
        let command_id = command_id.to_string();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                record_log(&process_state, &app, &project_id, &command_id, &k2, line);
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let process_state = process_state.clone();
        let app = app.clone();
        let k2 = k.clone();
        let project_id = project_id.to_string();
        let command_id = command_id.to_string();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                record_log(&process_state, &app, &project_id, &command_id, &k2, format!("[stderr] {line}"));
            }
        });
    }

    // With a known port we wait until it is listening before reporting "running";
    // without one we cannot probe readiness, so we optimistically report "running".
    let initial_status = if effective_port.is_some() { "starting" } else { "running" };
    let status = CommandExecutionState { command_id: command_id.to_string(), status: initial_status.to_string(), recent_logs: vec![], error: None, started_at: Some(now()), finished_at: None };
    process_state.statuses.lock().map_err(|_| "lock")?.insert(k.clone(), status.clone());
    emit_status(app, project_id, &status);

    // Readiness probe: upgrade starting -> running once the port accepts connections.
    if let Some(port) = effective_port {
        let process_state = process_state.clone();
        let app = app.clone();
        let k2 = k.clone();
        let project_id = project_id.to_string();
        thread::spawn(move || {
            for _ in 0..80 {
                if port_reachable(port) {
                    let snapshot = {
                        let mut statuses = match process_state.statuses.lock() { Ok(s) => s, Err(_) => return };
                        match statuses.get_mut(&k2) {
                            Some(state) if state.status == "starting" => {
                                state.status = "running".to_string();
                                Some(state.clone())
                            }
                            _ => return, // already terminal or stopped; leave it
                        }
                    };
                    if let Some(state) = snapshot { emit_status(&app, &project_id, &state); }
                    return;
                }
                thread::sleep(Duration::from_millis(250));
            }
        });
    }

    let process_state_for_wait = process_state.clone();
    let app_for_wait = app.clone();
    let wait_key = key(project_id, command_id);
    let wait_command_id = command_id.to_string();
    let wait_project_id = project_id.to_string();
    let wait_port = effective_port;
    thread::spawn(move || {
        match child.wait() {
            Ok(exit_status) => {
                // A user-initiated stop already wrote the final status; don't clobber it.
                let current = process_state_for_wait.statuses.lock().ok().and_then(|m| m.get(&wait_key).map(|s| s.status.clone()));
                if current.as_deref() == Some("stopped") { return; }

                // Daemonized servers (e.g. `symfony server:start --daemon`) exit immediately
                // while the real server keeps listening. Give the port a short grace period.
                let daemon_alive = exit_status.success() && match wait_port {
                    Some(port) => {
                        let mut alive = false;
                        for _ in 0..8 {
                            if port_reachable(port) { alive = true; break; }
                            thread::sleep(Duration::from_millis(250));
                        }
                        alive
                    }
                    None => false,
                };

                let (status_text, error) = if daemon_alive {
                    ("running", None)
                } else if exit_status.success() {
                    ("completed", None)
                } else {
                    ("failed", Some(format!("Command exited with status {exit_status}")))
                };
                if let Some(err) = &error {
                    record_log(&process_state_for_wait, &app_for_wait, &wait_project_id, &wait_command_id, &wait_key, err.clone());
                }
                let recent_logs = process_state_for_wait.logs.lock().ok()
                    .and_then(|m| m.get(&wait_key).cloned())
                    .unwrap_or_default()
                    .into_iter()
                    .collect();
                let started_at = process_state_for_wait.statuses.lock().ok()
                    .and_then(|m| m.get(&wait_key).and_then(|s| s.started_at.clone()));
                let next = CommandExecutionState {
                    command_id: wait_command_id,
                    status: status_text.to_string(),
                    recent_logs,
                    error,
                    started_at,
                    finished_at: if daemon_alive { None } else { Some(now()) },
                };
                if let Ok(mut statuses) = process_state_for_wait.statuses.lock() { statuses.insert(wait_key.clone(), next.clone()); }
                // Keep the child entry for daemons so `stop` still runs the stop_command.
                if !daemon_alive {
                    if let Ok(mut children) = process_state_for_wait.children.lock() { children.remove(&wait_key); }
                }
                emit_status(&app_for_wait, &wait_project_id, &next);
            }
            Err(error) => {
                record_log(&process_state_for_wait, &app_for_wait, &wait_project_id, &wait_command_id, &wait_key, format!("[error] {error}"));
            }
        }
    });
    Ok(status)
}

pub fn stop(process_state: &ProcessState, app: &AppHandle, projects: &[ManagedProject], project_id: &str, command_id: &str) -> Result<CommandExecutionState, String> {
    let project = projects.iter().find(|p| p.id == project_id).ok_or("Project not found")?;
    let command = project.services.iter().map(|s| &s.command).find(|c| c.id == command_id).ok_or("Command not found")?;

    // Mark "stopped" up-front so the process-exit watcher doesn't relabel this user-initiated
    // stop as "failed" when the killed process reports a non-zero exit code.
    let mut status = get_log(process_state, project_id, command_id);
    status.status = "stopped".to_string();
    status.finished_at = Some(now());
    process_state.statuses.lock().map_err(|_| "lock")?.insert(key(project_id, command_id), status.clone());
    emit_status(app, project_id, &status);

    // Kill the tracked process tree first (stops the foreground server + worker cleanly).
    if let Some(pid) = process_state.children.lock().map_err(|_| "lock")?.remove(&key(project_id, command_id)) {
        let _ = terminate_pid(pid);
    }
    // Cleanup: explicit stop command, then Symfony's daemon/registry.
    if let Some(stop_command) = &command.stop_command {
        let mut c = Command::new(resolve_program(&stop_command.executable));
        c.args(&stop_command.args).current_dir(resolve_cwd(&stop_command.working_directory, &project.path));
        hide_window(&mut c);
        let _ = c.status();
    }
    if is_symfony_serve(command) {
        symfony_server_stop(&resolve_cwd(&command.working_directory, &project.path));
    }
    Ok(status)
}

pub fn get_log(process_state: &ProcessState, project_id: &str, command_id: &str) -> CommandExecutionState {
    let k = key(project_id, command_id);
    let logs = process_state.logs.lock().ok().and_then(|m| m.get(&k).cloned()).unwrap_or_default();
    let mut status = process_state.statuses.lock().ok().and_then(|m| m.get(&k).cloned()).unwrap_or(CommandExecutionState { command_id: command_id.to_string(), status: "idle".to_string(), recent_logs: vec![], error: None, started_at: None, finished_at: None });
    status.recent_logs = logs.into_iter().collect();
    status
}
