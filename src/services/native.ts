import { invoke } from '@tauri-apps/api/core';
import type {
  ManagedProject,
  DetectProjectResult,
  CommandExecutionState,
  AnalyzeProjectWithAiResult,
  SmartLaunchPlan,
  SnapshotSummary,
} from '../domain/projects';
import type { AppSettings } from '../domain/settings';

export type AppInfo = {
  name: string;
  version: string;
};

export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>('get_app_info');
}

export async function listProjects(): Promise<ManagedProject[]> {
  return invoke<ManagedProject[]>('list_projects');
}

export async function saveProject(project: ManagedProject): Promise<ManagedProject[]> {
  return invoke<ManagedProject[]>('save_project', { project });
}

export async function deleteProject(projectId: string): Promise<ManagedProject[]> {
  return invoke<ManagedProject[]>('delete_project', { projectId });
}

export async function detectProject(path: string): Promise<DetectProjectResult> {
  return invoke<DetectProjectResult>('detect_project', { path });
}

export async function startCommand(projectId: string, commandId: string): Promise<CommandExecutionState> {
  return invoke<CommandExecutionState>('start_command', { projectId, commandId });
}

export async function stopCommand(projectId: string, commandId: string): Promise<CommandExecutionState> {
  return invoke<CommandExecutionState>('stop_command', { projectId, commandId });
}

export async function getCommandLog(projectId: string, commandId: string): Promise<CommandExecutionState> {
  return invoke<CommandExecutionState>('get_command_log', { projectId, commandId });
}

export async function openEditor(projectId: string): Promise<void> {
  return invoke('open_editor', { projectId });
}

export async function openFolder(projectId: string): Promise<void> {
  return invoke('open_folder', { projectId });
}

export async function openUrl(url: string): Promise<void> {
  return invoke('open_url', { url });
}

export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('load_settings');
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>('save_settings', { settings });
}

export async function analyzeProjectWithAi(path: string): Promise<AnalyzeProjectWithAiResult> {
  return invoke<AnalyzeProjectWithAiResult>('analyze_project_with_ai', { path });
}

export async function analyzeProjectSnapshotWithAi(snapshot: SnapshotSummary): Promise<AnalyzeProjectWithAiResult> {
  return invoke<AnalyzeProjectWithAiResult>('analyze_project_snapshot_with_ai', { snapshot });
}

export async function collectProjectSnapshot(path: string): Promise<SnapshotSummary> {
  return invoke<SnapshotSummary>('collect_project_snapshot', { path });
}

export async function planSmartLaunch(projectId: string): Promise<SmartLaunchPlan> {
  return invoke<SmartLaunchPlan>('plan_smart_launch', { projectId });
}

export async function startSmartLaunch(projectId: string): Promise<SmartLaunchPlan> {
  return invoke<SmartLaunchPlan>('start_smart_launch', { projectId });
}
