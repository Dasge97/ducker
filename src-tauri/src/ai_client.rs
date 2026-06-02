use reqwest::blocking::Client;
use serde_json::json;

use crate::models::{AiSettings, AnalyzeProjectWithAiResult, SnapshotSummary, StackPlan};

pub fn analyze_with_ai(settings: &AiSettings, api_key: &str, snapshot: SnapshotSummary) -> Result<AnalyzeProjectWithAiResult, String> {
    if !settings.enabled {
        return Err("AI is disabled in settings".to_string());
    }
    if api_key.trim().is_empty() {
        return Err("AI settings incomplete: missing API key".to_string());
    }

    let prompt = format!(
        "Analyze this project snapshot and return ONLY valid JSON with shape {{stackName, confidence, services, assumptions, warnings}}. Snapshot: {}",
        serde_json::to_string(&snapshot).map_err(|e| e.to_string())?
    );

    let body = json!({
        "model": settings.model,
        "messages": [
            {"role": "system", "content": "You are a stack detection advisor. Never execute commands."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"}
    });

    let url = format!("{}/chat/completions", settings.base_url.trim_end_matches('/'));
    let response = Client::new()
        .post(url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .map_err(|e| format!("AI request failed: {e}"))?;

    let value: serde_json::Value = response.json().map_err(|e| format!("Invalid AI response payload: {e}"))?;
    let content = value
        .get("choices").and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or("AI response missing message content")?;

    let parsed: StackPlan = serde_json::from_str(content)
        .map_err(|e| format!("Invalid AI plan JSON. Fallback to manual configuration. Details: {e}"))?;
    validate_stack_plan(&parsed)?;

    Ok(AnalyzeProjectWithAiResult { snapshot, plan: parsed })
}

fn validate_stack_plan(plan: &StackPlan) -> Result<(), String> {
    if plan.stack_name.trim().is_empty() {
        return Err("Invalid AI plan: stackName is required".to_string());
    }
    if !(0.0..=1.0).contains(&plan.confidence) {
        return Err("Invalid AI plan: confidence must be between 0 and 1".to_string());
    }
    if plan.services.is_empty() {
        return Err("Invalid AI plan: at least one service is required".to_string());
    }
    for service in &plan.services {
        if service.id.trim().is_empty() || service.label.trim().is_empty() {
            return Err("Invalid AI plan: every service needs id and label".to_string());
        }
        if !["backend", "frontend", "database", "worker", "custom"].contains(&service.kind.as_str()) {
            return Err(format!("Invalid AI plan: unsupported service kind {}", service.kind));
        }
        if !["argument", "env", "none", "manual"].contains(&service.port_strategy.as_str()) {
            return Err(format!("Invalid AI plan: unsupported port strategy {}", service.port_strategy));
        }
        if service.command.executable.trim().is_empty() || service.command.working_directory.trim().is_empty() {
            return Err("Invalid AI plan: service command needs executable and workingDirectory".to_string());
        }
        if service.command.id.trim().is_empty() || service.command.args.iter().any(|arg| arg.contains('\0')) {
            return Err("Invalid AI plan: command id and args must be safe".to_string());
        }
    }
    Ok(())
}
