use std::process::Command;

pub fn open_url(url: &str) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn open_folder(path: &str) -> Result<(), String> {
    open::that(path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn open_editor(editor_command: &str, path: &str) -> Result<(), String> {
    Command::new(editor_command)
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
