use std::path::Path;

use crate::models::{CommandConfig, DetectProjectResult, ProjectDetection};

pub fn detect_project(path: &str) -> DetectProjectResult {
    let root = Path::new(path);
    let has_composer_json = root.join("composer.json").exists();
    let has_bin_console = root.join("bin").join("console").exists();
    let has_package_json = root.join("package.json").exists();
    let has_yarn_lock = root.join("yarn.lock").exists();

    let detection = ProjectDetection {
        is_symfony: has_composer_json && has_bin_console,
        has_composer_json,
        has_bin_console,
        has_package_json,
        has_yarn_lock,
    };

    let backend = if detection.is_symfony {
        Some(CommandConfig {
            id: "backend".to_string(),
            label: "Backend Symfony".to_string(),
            executable: "symfony".to_string(),
            args: vec!["server:start".to_string(), "--daemon".to_string()],
            working_directory: path.to_string(),
            kind: "symfony-backend".to_string(),
            stop_command: Some(Box::new(CommandConfig {
                id: "backend-stop".to_string(),
                label: "Backend Symfony stop".to_string(),
                executable: "symfony".to_string(),
                args: vec!["server:stop".to_string()],
                working_directory: path.to_string(),
                kind: "symfony-backend".to_string(),
                stop_command: None,
                risky: Some(false),
            })),
            risky: Some(false),
        })
    } else {
        None
    };

    let frontend = if has_package_json && has_yarn_lock {
        Some(CommandConfig {
            id: "frontend".to_string(),
            label: "Frontend Yarn".to_string(),
            executable: "yarn".to_string(),
            args: vec!["dev".to_string()],
            working_directory: path.to_string(),
            kind: "yarn-frontend".to_string(),
            stop_command: None,
            risky: Some(false),
        })
    } else {
        None
    };

    DetectProjectResult { detection, backend, frontend }
}
