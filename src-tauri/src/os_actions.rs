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
    let mut command = Command::new(crate::processes::resolve_program(editor_command));
    command.arg(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
