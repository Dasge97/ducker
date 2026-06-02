use std::{collections::HashMap, fs, path::Path};

use crate::models::SnapshotSummary;

const SECRET_PATTERNS: [&str; 7] = [".env", "id_rsa", "id_ed25519", ".pem", "token", "secret", "credentials"];

pub fn collect_snapshot(path: &str, include_source_snippets: bool) -> Result<SnapshotSummary, String> {
    let root = Path::new(path);
    if !root.exists() {
        return Err("Project path does not exist".to_string());
    }

    let mut included_files = Vec::new();
    let mut omitted_files = Vec::new();
    let mut manifests = HashMap::new();
    let mut scripts = HashMap::new();

    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        let full_path = entry.path();
        if is_secret_like(&file_name) {
            omitted_files.push(file_name);
            continue;
        }
        included_files.push(file_name.clone());
        if ["package.json", "composer.json", "vite.config.ts", "webpack.config.js", "Cargo.toml"].contains(&file_name.as_str()) {
            let content = fs::read_to_string(&full_path).unwrap_or_default();
            manifests.insert(file_name.clone(), take_preview(&content));
            if file_name == "package.json" {
                let value: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::Value::Null);
                if let Some(obj) = value.get("scripts").and_then(|v| v.as_object()) {
                    scripts.insert(
                        "package.json".to_string(),
                        obj.iter().map(|(k, v)| format!("{k}: {}", v.as_str().unwrap_or(""))).collect(),
                    );
                }
            }
        }
    }

    if include_source_snippets {
        manifests.insert("_warning".to_string(), "includeSourceSnippets enabled; source snippets may be included in future versions".to_string());
    }

    Ok(SnapshotSummary {
        root_path: root.file_name().and_then(|name| name.to_str()).unwrap_or("<project>").to_string(),
        included_files,
        omitted_files,
        manifests,
        scripts,
    })
}

fn is_secret_like(name: &str) -> bool {
    let lower = name.to_lowercase();
    SECRET_PATTERNS.iter().any(|p| lower.contains(p))
}

fn take_preview(content: &str) -> String {
    content.lines().take(80).collect::<Vec<_>>().join("\n")
}

#[cfg(test)]
mod tests {
    use super::is_secret_like;

    #[test]
    fn detects_secret_patterns() {
        assert!(is_secret_like(".env"));
        assert!(is_secret_like("deploy_key.pem"));
        assert!(is_secret_like("credentials.local.json"));
        assert!(!is_secret_like("package.json"));
    }
}
