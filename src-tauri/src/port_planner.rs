use std::{collections::{HashMap, HashSet}, net::TcpListener, sync::{Arc, Mutex}};

use crate::models::{CommandConfig, ManagedProject, SmartLaunchPlan, SmartLaunchServicePlan};

#[derive(Clone, Default)]
pub struct PortRegistry {
    pub reserved: Arc<Mutex<HashMap<String, u16>>>,
}

pub fn plan_launch(project: &ManagedProject, registry: &PortRegistry, reserve_ports: bool) -> SmartLaunchPlan {
    let mut services = Vec::new();
    let mut warnings = Vec::new();
    let mut reservations = Vec::new();
    let mut blocked = false;

    for command in project.services.iter().filter(|s| s.enabled).map(|s| &s.command) {
        let svc = plan_command(&project.id, command, registry, reserve_ports);
        if svc.blocked {
            blocked = true;
            warnings.extend(svc.warnings.clone());
        } else if reserve_ports {
            if let Some(port) = svc.assigned_port {
                reservations.push(port);
            }
        }
        services.push(svc);
    }

    if blocked && reserve_ports {
        release_project(&project.id, registry);
        reservations.clear();
    }

    SmartLaunchPlan {
        project_id: project.id.clone(),
        services,
        reservations,
        warnings,
        blocked,
    }
}

/// Plan (and optionally reserve) the port for a single command, returning the adapted command.
/// Used both by the full launch plan and by starting an individual service with smart ports on.
pub fn plan_command(project_id: &str, command: &CommandConfig, registry: &PortRegistry, reserve_ports: bool) -> SmartLaunchServicePlan {
    // Services that explicitly manage no port (asset watchers, docker compose, build tasks…)
    // don't take part in port planning and must never block a launch.
    if command.port_strategy.as_deref() == Some("none") {
        return SmartLaunchServicePlan {
            command_id: command.id.clone(),
            assigned_port: None,
            adapted_command: command.clone(),
            warnings: Vec::new(),
            blocked: false,
        };
    }
    let preferred = command.preferred_port.or_else(|| infer_port(command)).or_else(|| default_port(command));
    let mut warning_list = Vec::new();
    let mut adapted = command.clone();
    let mut assigned = preferred;
    let mut local_blocked = false;

    if let Some(port) = preferred {
        let picked = if can_reserve(port, registry) { port } else { next_available(port + 1, registry) };
        if picked != port {
            warning_list.push(format!("Port {port} already in use/reserved. Reassigned to {picked}."));
        }
        assigned = Some(picked);
        match adapt_command_port(&adapted, picked) {
            Some(next) => adapted = next,
            None => {
                warning_list.push("Command cannot be adapted safely; manual resolution required".to_string());
                local_blocked = true;
            }
        }
        if reserve_ports && !local_blocked {
            reserve(format!("{project_id}:{}", command.id), picked, registry);
        }
    }

    SmartLaunchServicePlan {
        command_id: command.id.clone(),
        assigned_port: assigned,
        adapted_command: adapted,
        warnings: warning_list,
        blocked: local_blocked,
    }
}

pub fn release_project(project_id: &str, registry: &PortRegistry) {
    if let Ok(mut map) = registry.reserved.lock() {
        map.retain(|k, _| !k.starts_with(project_id));
    }
}

pub fn release_command(project_id: &str, command_id: &str, registry: &PortRegistry) {
    let prefix = format!("{project_id}:{command_id}");
    if let Ok(mut map) = registry.reserved.lock() {
        map.retain(|k, _| k != &prefix);
    }
}

fn can_reserve(port: u16, registry: &PortRegistry) -> bool {
    let reserved = registry.reserved.lock().ok().map(|m| m.values().copied().collect::<HashSet<_>>()).unwrap_or_default();
    !reserved.contains(&port) && TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn next_available(start: u16, registry: &PortRegistry) -> u16 {
    for port in start..=u16::MAX {
        if can_reserve(port, registry) {
            return port;
        }
    }
    start
}

fn reserve(key: String, port: u16, registry: &PortRegistry) {
    if let Ok(mut map) = registry.reserved.lock() {
        map.insert(key, port);
    }
}

/// Best-effort guess of the port a command will listen on: explicit preferred port,
/// then a port parsed from its args, then a sensible default for known stacks.
pub fn effective_port(command: &CommandConfig) -> Option<u16> {
    // A "none" strategy means the service doesn't listen on a managed port — don't probe one.
    if command.port_strategy.as_deref() == Some("none") {
        return None;
    }
    // Prefer the port actually present in the args (it reflects smart-port adaptation),
    // then the configured preferred port, then a stack default.
    infer_port(command).or(command.preferred_port).or_else(|| default_port(command))
}

fn infer_port(command: &CommandConfig) -> Option<u16> {
    let mut iter = command.args.iter().peekable();
    while let Some(arg) = iter.next() {
        if let Some(value) = arg.strip_prefix("--port=") { return value.parse().ok(); }
        if arg == "--port" || arg == "-p" { return iter.peek().and_then(|value| value.parse().ok()); }
    }
    None
}

fn default_port(command: &CommandConfig) -> Option<u16> {
    if command.kind == "symfony-backend" || command.executable.eq_ignore_ascii_case("symfony") { return Some(8000); }
    if command.kind == "yarn-frontend" || ["yarn", "npm", "pnpm", "bun"].contains(&command.executable.to_lowercase().as_str()) { return Some(5173); }
    None
}

fn adapt_command_port(command: &CommandConfig, assigned_port: u16) -> Option<CommandConfig> {
    let mut adapted = command.clone();
    if adapted.port_strategy.as_deref() == Some("env") {
        let mut env = adapted.env.clone().unwrap_or_default();
        env.insert("PORT".to_string(), assigned_port.to_string());
        adapted.env = Some(env);
        return Some(adapted);
    }
    if matches!(adapted.port_strategy.as_deref(), Some("manual") | Some("none")) {
        return None;
    }
    let exe = adapted.executable.to_lowercase();
    if exe == "symfony" || adapted.kind == "symfony-backend" {
        let mut has_port = false;
        let mut next_args = Vec::new();
        let mut skip_next = false;
        for arg in &adapted.args {
            if skip_next { skip_next = false; continue; }
            if arg.starts_with("--port=") {
                has_port = true;
                next_args.push(format!("--port={assigned_port}"));
            } else if arg == "--port" || arg == "-p" {
                has_port = true;
                next_args.push(arg.clone());
                next_args.push(assigned_port.to_string());
                skip_next = true;
            } else {
                next_args.push(arg.clone());
            }
        }
        adapted.args = next_args;
        if !has_port {
            adapted.args.push(format!("--port={assigned_port}"));
        }
        return Some(adapted);
    }
    if exe == "yarn" || exe == "npm" || exe == "pnpm" || exe == "bun" || adapted.kind == "yarn-frontend" {
        let mut next_args = Vec::new();
        let mut updated = false;
        let mut skip_next = false;
        for arg in &adapted.args {
            if skip_next { skip_next = false; continue; }
            if arg.starts_with("--port=") {
                next_args.push(format!("--port={assigned_port}"));
                updated = true;
            } else if arg == "--port" || arg == "-p" {
                next_args.push(arg.clone());
                next_args.push(assigned_port.to_string());
                updated = true;
                skip_next = true;
            } else {
                next_args.push(arg.clone());
            }
        }
        if !updated {
            if exe == "npm" && adapted.args.first().map(|a| a.as_str()) == Some("run") {
                next_args.push("--".to_string());
            }
            next_args.push("--port".to_string());
            next_args.push(assigned_port.to_string());
        }
        adapted.args = next_args;
        return Some(adapted);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ProjectDetection, ServiceConfig};

    #[test]
    fn symfony_gets_port_argument() {
        let c = CommandConfig { id: "backend".into(), label: "b".into(), executable: "symfony".into(), args: vec!["server:start".into()], working_directory: ".".into(), kind: "symfony-backend".into(), stop_command: None, risky: None, preferred_port: Some(8000), port_strategy: None, smart_port_pattern: None, env: None, origin: None, overridden_by_user: None };
        let out = adapt_command_port(&c, 8010).expect("adapted");
        assert!(out.args.iter().any(|a| a == "--port=8010"));
    }

    #[test]
    fn unknown_command_not_adapted() {
        let c = CommandConfig { id: "x".into(), label: "x".into(), executable: "python".into(), args: vec!["app.py".into()], working_directory: ".".into(), kind: "custom".into(), stop_command: None, risky: None, preferred_port: Some(8000), port_strategy: None, smart_port_pattern: None, env: None, origin: None, overridden_by_user: None };
        assert!(adapt_command_port(&c, 8010).is_none());
    }

    #[test]
    fn reservation_created_when_adaptable() {
        let backend = CommandConfig { id: "backend".into(), label: "b".into(), executable: "symfony".into(), args: vec!["server:start".into()], working_directory: ".".into(), kind: "symfony-backend".into(), stop_command: None, risky: None, preferred_port: Some(8000), port_strategy: None, smart_port_pattern: None, env: None, origin: None, overridden_by_user: None };
        let project = ManagedProject {
            id: "p1".into(), name: "p1".into(), path: ".".into(),
            services: vec![ServiceConfig { id: "backend".into(), label: "b".into(), kind: "backend".into(), url: None, enabled: true, command: backend }],
            detection: ProjectDetection::default(), runtime: None, smart_ports_enabled: Some(true), stack_plan: None, ai_metadata: None,
            backend: None, frontend: None, urls: None,
        };
        let registry = PortRegistry::default();
        let plan = plan_launch(&project, &registry, true);
        assert_eq!(plan.services.len(), 1);
        assert!(!plan.blocked);
    }
}
