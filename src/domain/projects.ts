export type CommandKind = 'symfony-backend' | 'yarn-frontend' | 'custom';

export type CommandConfig = {
  id: string;
  label: string;
  executable: string;
  args: string[];
  workingDirectory: string;
  kind: CommandKind;
  stopCommand?: Omit<CommandConfig, 'stopCommand'>;
  risky?: boolean;
};

export type ProjectUrls = {
  backend?: string;
  frontend?: string;
};

export type ProjectDetection = {
  isSymfony: boolean;
  hasComposerJson: boolean;
  hasBinConsole: boolean;
  hasPackageJson: boolean;
  hasYarnLock: boolean;
};

export type CommandStatus = 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';

export type CommandExecutionState = {
  commandId: string;
  status: CommandStatus;
  recentLogs: string[];
  error?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type ProjectRuntimeState = {
  backend?: CommandExecutionState;
  frontend?: CommandExecutionState;
};

export type ManagedProject = {
  id: string;
  name: string;
  path: string;
  backend?: CommandConfig;
  frontend?: CommandConfig;
  urls: ProjectUrls;
  detection: ProjectDetection;
  runtime?: ProjectRuntimeState;
};

export type DetectProjectResult = {
  detection: ProjectDetection;
  backend?: CommandConfig;
  frontend?: CommandConfig;
};
