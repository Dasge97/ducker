// Hide the console window on Windows release builds (GUI app, not a console app).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ducker_lib::run();
}
