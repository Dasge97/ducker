use std::{fs, path::Path};

use serde_json::Value;

use crate::models::{CommandConfig, DetectProjectResult, ProjectDetection, ServiceConfig};

/// Layered local stack detection. Each detector inspects the project root and may
/// contribute one or more launchable services. Detection is best-effort and instant;
/// the AI advisor is reserved for projects these heuristics don't cover.
pub fn detect_project(path: &str) -> DetectProjectResult {
    let root = Path::new(path);

    let has_composer_json = root.join("composer.json").exists();
    let has_bin_console = root.join("bin").join("console").exists();
    let has_package_json = root.join("package.json").exists();
    let has_yarn_lock = root.join("yarn.lock").exists();

    let mut services: Vec<ServiceConfig> = Vec::new();
    let mut detected_stacks: Vec<String> = Vec::new();

    // 1) Prefer what the project explicitly declares. A Procfile is authoritative: if present,
    //    skip the convention-based guesses to avoid duplicate/incorrect services.
    let has_procfile = detect_procfile(root, path, &mut services, &mut detected_stacks);
    if !has_procfile {
        detect_php_backend(root, path, has_composer_json, has_bin_console, &mut services, &mut detected_stacks);
        detect_python_backend(root, path, &mut services, &mut detected_stacks);
        detect_ruby_backend(root, path, &mut services, &mut detected_stacks);
        detect_go_backend(root, path, &mut services, &mut detected_stacks);
        detect_rust_backend(root, path, &mut services, &mut detected_stacks);
        detect_dotnet_backend(root, path, &mut services, &mut detected_stacks);
        // Backends that render their own pages treat JS as an asset pipeline, not a web server.
        let backend_serves_assets = detected_stacks.iter().any(|s| s == "symfony" || s == "laravel" || s == "rails");
        detect_js_frontend(root, path, has_package_json, has_yarn_lock, backend_serves_assets, &mut services, &mut detected_stacks);
    }
    // 2) Infrastructure declared via compose is added regardless.
    detect_docker_compose(root, path, &mut services, &mut detected_stacks);
    // 3) Last resort: a Makefile/justfile run target, so unknown stacks still get something.
    if services.is_empty() {
        detect_make_targets(root, path, &mut services, &mut detected_stacks);
    }

    ensure_unique_ids(&mut services);

    let detection = ProjectDetection {
        is_symfony: has_composer_json && has_bin_console,
        has_composer_json,
        has_bin_console,
        has_package_json,
        has_yarn_lock,
        detected_stacks,
    };

    DetectProjectResult { detection, services }
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

fn cmd(id: &str, exe: &str, args: &[&str], cwd: &str, kind: &str, preferred_port: Option<u16>, port_strategy: &str) -> CommandConfig {
    CommandConfig {
        id: id.to_string(),
        label: id.to_string(),
        executable: exe.to_string(),
        args: args.iter().map(|a| a.to_string()).collect(),
        working_directory: cwd.to_string(),
        kind: kind.to_string(),
        stop_command: None,
        risky: Some(false),
        preferred_port,
        port_strategy: Some(port_strategy.to_string()),
        smart_port_pattern: None,
        env: None,
        origin: Some("manual".to_string()),
        overridden_by_user: None,
    }
}

fn svc(id: &str, label: &str, kind: &str, command: CommandConfig, url: Option<&str>) -> ServiceConfig {
    ServiceConfig {
        id: id.to_string(),
        label: label.to_string(),
        kind: kind.to_string(),
        url: url.map(str::to_string),
        enabled: true,
        command,
    }
}

/// Build a command that runs an arbitrary shell command line through the OS shell, so
/// project-declared commands (Procfile, Makefile…) work even with $VARS, pipes, &&, etc.
fn shell_command(id: &str, command_line: &str, cwd: &str) -> CommandConfig {
    let (exe, flag) = if cfg!(windows) { ("cmd", "/C") } else { ("sh", "-c") };
    let mut command = cmd(id, exe, &[], cwd, "custom", None, "none");
    command.args = vec![flag.to_string(), command_line.to_string()];
    command
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// Make sure no two services share an id (port reservation / process keys rely on it).
fn ensure_unique_ids(services: &mut [ServiceConfig]) {
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for service in services.iter_mut() {
        if seen.contains(&service.id) {
            let mut n = 2;
            let base = service.id.clone();
            while seen.contains(&format!("{base}-{n}")) { n += 1; }
            let unique = format!("{base}-{n}");
            service.id = unique.clone();
            service.command.id = unique;
        }
        seen.insert(service.id.clone());
    }
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

fn read_json(root: &Path, name: &str) -> Value {
    fs::read_to_string(root.join(name))
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or(Value::Null)
}

fn file_contains(root: &Path, name: &str, needle: &str) -> bool {
    fs::read_to_string(root.join(name))
        .map(|content| content.to_lowercase().contains(needle))
        .unwrap_or(false)
}

fn has_file_with_ext(root: &Path, ext: &str) -> bool {
    fs::read_dir(root)
        .map(|entries| entries.flatten().any(|e| e.path().extension().and_then(|x| x.to_str()) == Some(ext)))
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

fn detect_php_backend(root: &Path, path: &str, has_composer_json: bool, has_bin_console: bool, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) {
    if has_composer_json && has_bin_console {
        stacks.push("symfony".to_string());
        let mut command = cmd("symfony", "symfony", &["server:start", "--no-tls"], path, "symfony-backend", Some(8000), "argument");
        command.smart_port_pattern = Some("--port".to_string());
        command.stop_command = Some(Box::new(cmd("symfony-stop", "symfony", &["server:stop"], path, "symfony-backend", None, "none")));
        services.push(svc("symfony", "Backend Symfony", "backend", command, Some("http://127.0.0.1:8000")));
    } else if root.join("artisan").exists() {
        stacks.push("laravel".to_string());
        let command = cmd("laravel", "php", &["artisan", "serve"], path, "custom", None, "manual");
        services.push(svc("laravel", "Backend Laravel", "backend", command, Some("http://127.0.0.1:8000")));
    }
}

fn detect_python_backend(root: &Path, path: &str, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) {
    if root.join("manage.py").exists() {
        stacks.push("django".to_string());
        let command = cmd("django", "python", &["manage.py", "runserver"], path, "custom", None, "manual");
        services.push(svc("django", "Backend Django", "backend", command, Some("http://127.0.0.1:8000")));
    } else if file_contains(root, "requirements.txt", "flask") || file_contains(root, "pyproject.toml", "flask") {
        stacks.push("flask".to_string());
        let command = cmd("flask", "flask", &["run"], path, "custom", None, "manual");
        services.push(svc("flask", "Backend Flask", "backend", command, Some("http://127.0.0.1:5000")));
    }
}

fn detect_ruby_backend(root: &Path, path: &str, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) {
    if root.join("bin").join("rails").exists() || file_contains(root, "Gemfile", "rails") {
        stacks.push("rails".to_string());
        let command = cmd("rails", "bin/rails", &["server"], path, "custom", None, "manual");
        services.push(svc("rails", "Backend Rails", "backend", command, Some("http://localhost:3000")));
    }
}

fn detect_go_backend(root: &Path, path: &str, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) {
    if root.join("go.mod").exists() {
        stacks.push("go".to_string());
        let command = cmd("go", "go", &["run", "."], path, "custom", None, "none");
        services.push(svc("go", "Backend Go", "backend", command, None));
    }
}

fn detect_rust_backend(root: &Path, path: &str, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) {
    if root.join("Cargo.toml").exists() {
        stacks.push("rust".to_string());
        let command = cmd("cargo", "cargo", &["run"], path, "custom", None, "none");
        services.push(svc("cargo", "Backend Rust", "backend", command, None));
    }
}

fn detect_dotnet_backend(root: &Path, path: &str, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) {
    if has_file_with_ext(root, "csproj") || has_file_with_ext(root, "sln") {
        stacks.push("dotnet".to_string());
        let command = cmd("dotnet", "dotnet", &["run"], path, "custom", None, "manual");
        services.push(svc("dotnet", "Backend .NET", "backend", command, Some("http://localhost:5000")));
    }
}

fn detect_js_frontend(root: &Path, path: &str, has_package_json: bool, has_yarn_lock: bool, backend_serves_assets: bool, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) {
    if !has_package_json {
        return;
    }
    let package_manager = if has_yarn_lock {
        "yarn"
    } else if root.join("pnpm-lock.yaml").exists() {
        "pnpm"
    } else if root.join("bun.lockb").exists() {
        "bun"
    } else {
        "npm"
    };

    let pkg = read_json(root, "package.json");
    let has_script = |name: &str| pkg.get("scripts").and_then(|s| s.get(name)).is_some();
    let run = |script: &str| -> Vec<String> {
        match package_manager {
            "npm" | "bun" => vec!["run".to_string(), script.to_string()],
            _ => vec![script.to_string()],
        }
    };

    // When a server-rendered backend is present, JS is an asset pipeline (Webpack Encore /
    // Vite build), NOT a standalone frontend server — no port, no URL.
    if backend_serves_assets {
        let Some(script) = ["watch", "dev", "build"].into_iter().find(|s| has_script(s)) else {
            return; // no asset script worth running automatically
        };
        stacks.push("assets".to_string());
        let label = match script { "watch" => "Assets (watch)", "build" => "Assets (build)", _ => "Assets (dev)" };
        let mut command = cmd("assets", package_manager, &[], path, "custom", None, "none");
        command.args = run(script);
        services.push(svc("assets", label, "custom", command, None));
        return;
    }

    // Standalone JS app: a real frontend dev server with a port and URL.
    let script = ["dev", "start", "serve"].into_iter().find(|s| has_script(s)).unwrap_or("dev");
    let (framework, port, port_strategy) = js_framework(&pkg);
    stacks.push(framework.to_string());
    let url = format!("http://localhost:{port}");
    let mut command = cmd("frontend", package_manager, &[], path, "yarn-frontend", Some(port), port_strategy);
    command.args = run(script);
    command.smart_port_pattern = Some("--port".to_string());
    services.push(svc("frontend", "Frontend", "frontend", command, Some(&url)));
}

/// Map JS dependencies to a framework label, conventional dev port, and how its port
/// is configured (CRA reads the `PORT` env var; most others accept `--port`).
fn js_framework(pkg: &Value) -> (&'static str, u16, &'static str) {
    let has = |name: &str| {
        pkg.get("dependencies").and_then(|d| d.get(name)).is_some()
            || pkg.get("devDependencies").and_then(|d| d.get(name)).is_some()
    };
    if has("next") {
        ("next", 3000, "argument")
    } else if has("nuxt") {
        ("nuxt", 3000, "argument")
    } else if has("@angular/core") {
        ("angular", 4200, "argument")
    } else if has("react-scripts") {
        ("create-react-app", 3000, "env")
    } else if has("vite") {
        ("vite", 5173, "argument")
    } else if has("vue") {
        ("vue", 8080, "argument")
    } else {
        ("node", 5173, "argument")
    }
}

/// Read a Procfile (`name: command` per line) — the most explicit, language-agnostic
/// declaration of how to run a project. When present it is authoritative.
fn detect_procfile(root: &Path, path: &str, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) -> bool {
    let content = match fs::read_to_string(root.join("Procfile")) {
        Ok(c) => c,
        Err(_) => return false,
    };
    let mut found = false;
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((name, command_line)) = line.split_once(':') else { continue };
        let (name, command_line) = (name.trim(), command_line.trim());
        if name.is_empty() || command_line.is_empty() {
            continue;
        }
        let kind = match name.to_lowercase().as_str() {
            "web" => "backend",
            "worker" | "queue" | "consumer" | "jobs" => "worker",
            _ => "custom",
        };
        let command = shell_command(name, command_line, path);
        services.push(svc(name, &capitalize(name), kind, command, None));
        found = true;
    }
    if found {
        stacks.push("procfile".to_string());
    }
    found
}

/// Last-resort: surface common run targets from a Makefile / justfile (dev, serve, up…).
fn detect_make_targets(root: &Path, path: &str, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) {
    const RUN_TARGETS: [&str; 7] = ["dev", "serve", "server", "start", "run", "up", "watch"];
    let mut added = false;

    if let Ok(content) = fs::read_to_string(root.join("Makefile")) {
        for line in content.lines() {
            if line.starts_with(' ') || line.starts_with('\t') {
                continue; // recipe body, not a target
            }
            let Some((target, _)) = line.split_once(':') else { continue };
            let target = target.trim();
            if !target.contains(' ') && RUN_TARGETS.contains(&target.to_lowercase().as_str()) {
                let command = shell_command(target, &format!("make {target}"), path);
                services.push(svc(target, &format!("make {target}"), "custom", command, None));
                added = true;
            }
        }
    }

    for justfile in ["justfile", "Justfile", ".justfile"] {
        let Ok(content) = fs::read_to_string(root.join(justfile)) else { continue };
        for line in content.lines() {
            if line.starts_with(' ') || line.starts_with('\t') {
                continue;
            }
            let Some((target, _)) = line.split_once(':') else { continue };
            let target = target.trim();
            if !target.contains(' ') && RUN_TARGETS.contains(&target.to_lowercase().as_str()) {
                let command = shell_command(&format!("just-{target}"), &format!("just {target}"), path);
                services.push(svc(&format!("just-{target}"), &format!("just {target}"), "custom", command, None));
                added = true;
            }
        }
        break;
    }

    if added {
        stacks.push("make".to_string());
    }
}

fn detect_docker_compose(root: &Path, path: &str, services: &mut Vec<ServiceConfig>, stacks: &mut Vec<String>) {
    let has_compose = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]
        .iter()
        .any(|name| root.join(name).exists());
    if has_compose {
        stacks.push("docker-compose".to_string());
        let command = cmd("docker-compose", "docker", &["compose", "up"], path, "custom", None, "none");
        services.push(svc("docker-compose", "Docker Compose", "custom", command, None));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_project(label: &str) -> std::path::PathBuf {
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("ducker-detect-{label}-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn detects_vite_frontend_with_yarn() {
        let dir = temp_project("vite");
        fs::write(dir.join("package.json"), r#"{"scripts":{"dev":"vite"},"devDependencies":{"vite":"^5.0.0"}}"#).unwrap();
        fs::write(dir.join("yarn.lock"), "").unwrap();

        let result = detect_project(dir.to_str().unwrap());
        let frontend = result.services.iter().find(|s| s.kind == "frontend").expect("frontend service");
        assert_eq!(frontend.command.executable, "yarn");
        assert_eq!(frontend.command.args, vec!["dev"]);
        assert_eq!(frontend.command.preferred_port, Some(5173));
        assert!(result.detection.detected_stacks.contains(&"vite".to_string()));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn procfile_is_authoritative_over_conventions() {
        let dir = temp_project("procfile");
        // A Symfony-looking project that ALSO ships a Procfile — the Procfile wins.
        fs::write(dir.join("composer.json"), "{}").unwrap();
        fs::create_dir_all(dir.join("bin")).unwrap();
        fs::write(dir.join("bin").join("console"), "#!/usr/bin/env php").unwrap();
        fs::write(dir.join("Procfile"), "web: php -S 0.0.0.0:8000 -t public\nworker: php bin/console messenger:consume\n").unwrap();

        let result = detect_project(dir.to_str().unwrap());
        assert!(result.detection.detected_stacks.contains(&"procfile".to_string()));
        // Procfile processes become the services; no convention "symfony server:start".
        assert!(result.services.iter().any(|s| s.id == "web" && s.kind == "backend"));
        assert!(result.services.iter().any(|s| s.id == "worker" && s.kind == "worker"));
        assert!(!result.services.iter().any(|s| s.command.executable == "symfony"));
        // Commands run via the OS shell so $VARS / flags survive.
        let web = result.services.iter().find(|s| s.id == "web").unwrap();
        assert!(web.command.executable == "cmd" || web.command.executable == "sh");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn detects_django_backend() {
        let dir = temp_project("django");
        fs::write(dir.join("manage.py"), "# django").unwrap();

        let result = detect_project(dir.to_str().unwrap());
        let backend = result.services.iter().find(|s| s.kind == "backend").expect("backend service");
        assert_eq!(backend.command.executable, "python");
        assert_eq!(backend.command.args, vec!["manage.py", "runserver"]);
        assert!(result.detection.detected_stacks.contains(&"django".to_string()));

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn symfony_treats_js_as_assets_not_a_frontend_server() {
        let dir = temp_project("sf-assets");
        fs::write(dir.join("composer.json"), "{}").unwrap();
        fs::create_dir_all(dir.join("bin")).unwrap();
        fs::write(dir.join("bin").join("console"), "#!/usr/bin/env php").unwrap();
        fs::write(dir.join("package.json"), r#"{"scripts":{"watch":"encore dev --watch","build":"encore production"}}"#).unwrap();
        fs::write(dir.join("yarn.lock"), "").unwrap();

        let result = detect_project(dir.to_str().unwrap());
        assert!(result.services.iter().any(|s| s.kind == "backend" && s.command.executable == "symfony"));
        // No standalone frontend server with a port/URL...
        assert!(!result.services.iter().any(|s| s.kind == "frontend"));
        // ...instead an asset pipeline with no port.
        let assets = result.services.iter().find(|s| s.id == "assets").expect("assets service");
        assert_eq!(assets.command.args, vec!["watch"]);
        assert!(assets.command.preferred_port.is_none());
        assert!(assets.url.is_none());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn detects_npm_with_run_prefix() {
        let dir = temp_project("npm");
        fs::write(dir.join("package.json"), r#"{"scripts":{"start":"node server.js"},"dependencies":{"next":"14.0.0"}}"#).unwrap();
        fs::write(dir.join("package-lock.json"), "{}").unwrap();

        let result = detect_project(dir.to_str().unwrap());
        let frontend = result.services.iter().find(|s| s.kind == "frontend").expect("frontend service");
        assert_eq!(frontend.command.executable, "npm");
        assert_eq!(frontend.command.args, vec!["run", "start"]);
        assert_eq!(frontend.command.preferred_port, Some(3000));

        fs::remove_dir_all(&dir).ok();
    }
}
