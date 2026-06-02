use std::process::Command;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct PortInfo {
    pub port: u16,
    pub pid: u32,
    #[serde(default)]
    pub process: String,
}

/// List the TCP ports currently in LISTEN state with the owning process.
#[cfg(windows)]
pub fn list_listening_ports() -> Result<Vec<PortInfo>, String> {
    use std::os::windows::process::CommandExt;
    let script = "Get-NetTCPConnection -State Listen | ForEach-Object { $pr = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; [pscustomobject]@{ port = [int]$_.LocalPort; pid = [int]$_.OwningProcess; process = $(if ($pr) { $pr.ProcessName } else { '?' }) } } | Sort-Object port -Unique | ConvertTo-Json -Compress";
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| e.to_string())?;
    parse(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(windows))]
pub fn list_listening_ports() -> Result<Vec<PortInfo>, String> {
    // Best-effort on Unix; returns an empty list if `lsof` isn't available.
    let output = Command::new("sh")
        .arg("-c")
        .arg("lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $1, $2, $9}'")
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout);
    let mut ports = Vec::new();
    for line in text.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 { continue; }
        let port = parts[2].rsplit(':').next().and_then(|p| p.parse::<u16>().ok());
        let pid = parts[1].parse::<u32>().ok();
        if let (Some(port), Some(pid)) = (port, pid) {
            ports.push(PortInfo { port, pid, process: parts[0].to_string() });
        }
    }
    ports.sort_by_key(|p| p.port);
    ports.dedup_by_key(|p| p.port);
    Ok(ports)
}

fn parse(json: &str) -> Result<Vec<PortInfo>, String> {
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let value: serde_json::Value = serde_json::from_str(trimmed).map_err(|e| e.to_string())?;
    // ConvertTo-Json yields a single object for one row and an array for many.
    let items = match value {
        serde_json::Value::Array(items) => items,
        other => vec![other],
    };
    Ok(items.into_iter().filter_map(|item| serde_json::from_value(item).ok()).collect())
}
