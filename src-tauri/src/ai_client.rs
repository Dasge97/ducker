use std::{collections::HashMap, time::Duration};

use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::json;

use crate::models::{AiSettings, AnalyzeProjectWithAiResult, CommandConfig, ServicePlan, SnapshotSummary, StackPlan};

const SCHEMA_HINT: &str = r#"Return ONLY a JSON object with this EXACT schema (no markdown, no prose):
{
  "stackName": "string, e.g. 'Symfony + Vite + Postgres'",
  "confidence": 0.0,
  "services": [
    {
      "id": "short-id",
      "label": "Human label",
      "kind": "backend | frontend | database | worker | custom",
      "command": {
        "id": "short-id",
        "label": "Human label",
        "executable": "program, e.g. symfony or yarn",
        "args": ["array", "of", "string", "args"],
        "workingDirectory": ".",
        "kind": "custom"
      },
      "preferredPort": 8000,
      "portStrategy": "argument | env | none | manual"
    }
  ],
  "assumptions": ["short strings"],
  "warnings": ["short strings"]
}
Rules:
- "services" MUST be an array of objects exactly as above — NEVER plain strings.
- Use ONLY executables present in the machine's available CLIs list below (or scripts the
  project itself defines via its package manager). If the ideal tool is not available, pick a
  working alternative that IS available.
- Prefer the framework's native run command WHEN that CLI is available:
    Symfony  -> "symfony" ["server:start","--no-tls"]; if "symfony" is NOT available, use "php" ["-S","localhost:8000","-t","public"];
    Laravel  -> "php" ["artisan","serve"];
    Django   -> "python" ["manage.py","runserver"];
    Rails    -> "bin/rails" ["server"];
    Node app -> the package.json dev script via the available package manager (yarn/npm/pnpm/bun).
- For server-rendered backends (Symfony, Laravel, Rails) that bundle assets, model the JS
  build as a "custom" service running the build/watch script, with portStrategy "none" and
  preferredPort null — it is NOT a separate web server.
- Use portStrategy "argument" when the port is a CLI flag, "env" for a PORT env var, otherwise "none".
- Only include services that should run for local development."#;

pub fn analyze_with_ai(settings: &AiSettings, api_key: &str, snapshot: SnapshotSummary, os: &str, tools: &[String]) -> Result<AnalyzeProjectWithAiResult, String> {
    if !settings.enabled {
        return Err("AI is disabled in settings".to_string());
    }
    if api_key.trim().is_empty() {
        return Err("AI settings incomplete: missing API key".to_string());
    }

    let available = if tools.is_empty() { "(unknown)".to_string() } else { tools.join(", ") };
    let environment = format!("Target machine: OS = {os}. Available CLIs on PATH: {available}.");
    let prompt = format!(
        "{SCHEMA_HINT}\n\n{environment}\n\nProject snapshot (manifests + file tree, no source code):\n{}",
        serde_json::to_string(&snapshot).map_err(|e| e.to_string())?
    );

    let body = json!({
        "model": settings.model,
        "messages": [
            {"role": "system", "content": "You are a stack detection advisor for a local dev tool. You never execute commands. You output only a single valid JSON object."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"}
    });

    let url = format!("{}/chat/completions", settings.base_url.trim_end_matches('/'));
    let client = Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .map_err(|e| format!("AI request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let detail = response.text().unwrap_or_default();
        let detail = detail.chars().take(300).collect::<String>();
        return Err(format!("AI request rejected ({status}): {detail}"));
    }

    let value: serde_json::Value = response.json().map_err(|e| format!("Invalid AI response payload: {e}"))?;
    let content = value
        .get("choices").and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or("AI response missing message content")?;

    let ai: AiPlan = serde_json::from_str(content)
        .map_err(|e| format!("AI returned malformed JSON. Details: {e}"))?;
    let plan = build_plan(ai);
    validate_stack_plan(&plan)?;

    Ok(AnalyzeProjectWithAiResult { snapshot, plan })
}

// ---------------------------------------------------------------------------
// Tolerant deserialization of the model's output, then normalization to StackPlan.
// Models vary; we accept missing/extra fields and a command nested or flattened.
// ---------------------------------------------------------------------------

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AiCommand {
    #[serde(default)]
    executable: Option<String>,
    #[serde(default)]
    args: Option<Vec<String>>,
    #[serde(default)]
    working_directory: Option<String>,
    #[serde(default)]
    env: Option<HashMap<String, String>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AiService {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    label: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    command: Option<AiCommand>,
    // Some models flatten these onto the service instead of nesting under "command".
    #[serde(default)]
    executable: Option<String>,
    #[serde(default)]
    args: Option<Vec<String>>,
    #[serde(default)]
    preferred_port: Option<u16>,
    #[serde(default)]
    port_strategy: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AiPlan {
    #[serde(default)]
    stack_name: Option<String>,
    #[serde(default)]
    confidence: Option<f32>,
    #[serde(default)]
    services: Vec<AiService>,
    #[serde(default)]
    assumptions: Vec<String>,
    #[serde(default)]
    warnings: Vec<String>,
}

fn normalize_kind(kind: Option<&str>) -> String {
    match kind.unwrap_or("").to_lowercase().as_str() {
        "backend" | "api" | "server" => "backend",
        "frontend" | "web" | "client" | "ui" => "frontend",
        "database" | "db" => "database",
        "worker" | "queue" | "job" | "cron" | "scheduler" => "worker",
        _ => "custom",
    }
    .to_string()
}

fn normalize_strategy(strategy: Option<&str>) -> String {
    match strategy.unwrap_or("").to_lowercase().as_str() {
        "argument" | "arg" | "flag" | "cli" => "argument",
        "env" | "environment" => "env",
        "manual" => "manual",
        _ => "none",
    }
    .to_string()
}

fn build_plan(ai: AiPlan) -> StackPlan {
    let mut services = Vec::new();
    for (index, svc) in ai.services.into_iter().enumerate() {
        let command = svc.command.unwrap_or_default();
        let executable = command.executable.or(svc.executable).unwrap_or_default().trim().to_string();
        if executable.is_empty() {
            continue; // a service we can't run is useless; drop it
        }
        let kind = normalize_kind(svc.kind.as_deref());
        let id = svc.id.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| format!("{kind}-{index}"));
        let label = svc.label.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| id.clone());
        let args = command.args.or(svc.args).unwrap_or_default();
        let working_directory = command.working_directory.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| ".".to_string());
        let port_strategy = normalize_strategy(svc.port_strategy.as_deref());

        let command = CommandConfig {
            id: id.clone(),
            label: label.clone(),
            executable,
            args,
            working_directory,
            kind: "custom".to_string(),
            stop_command: None,
            risky: Some(false),
            preferred_port: svc.preferred_port,
            port_strategy: Some(port_strategy.clone()),
            smart_port_pattern: None,
            env: command.env,
            origin: Some("ai".to_string()),
            overridden_by_user: None,
        };

        services.push(ServicePlan {
            id,
            label,
            kind,
            command,
            preferred_port: svc.preferred_port,
            port_strategy,
        });
    }

    StackPlan {
        stack_name: ai.stack_name.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "Detected stack".to_string()),
        confidence: ai.confidence.unwrap_or(0.6).clamp(0.0, 1.0),
        services,
        assumptions: ai.assumptions,
        warnings: ai.warnings,
    }
}

fn validate_stack_plan(plan: &StackPlan) -> Result<(), String> {
    if plan.services.is_empty() {
        return Err("AI plan has no runnable services".to_string());
    }
    for service in &plan.services {
        if service.command.args.iter().any(|arg| arg.contains('\0')) {
            return Err("Invalid AI plan: command args must be safe".to_string());
        }
    }
    Ok(())
}
