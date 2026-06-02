export type CommandKind = 'symfony-backend' | 'yarn-frontend' | 'custom';

export type PortStrategy = 'argument' | 'env' | 'none' | 'manual';
export type ServiceKind = 'backend' | 'frontend' | 'database' | 'worker' | 'custom';

export type CommandConfig = {
  id: string;
  label: string;
  executable: string;
  args: string[];
  workingDirectory: string;
  kind: CommandKind;
  stopCommand?: Omit<CommandConfig, 'stopCommand'>;
  risky?: boolean;
  preferredPort?: number;
  portStrategy?: PortStrategy;
  smartPortPattern?: string;
  env?: Record<string, string>;
  origin?: 'manual' | 'ai';
  overriddenByUser?: boolean;
};

export type ServicePlan = {
  id: string;
  label: string;
  kind: ServiceKind;
  command: CommandConfig;
  preferredPort?: number;
  portStrategy: PortStrategy;
};

export type StackPlan = {
  stackName: string;
  confidence: number;
  services: ServicePlan[];
  assumptions: string[];
  warnings: string[];
};

export type SnapshotSummary = {
  rootPath: string;
  includedFiles: string[];
  omittedFiles: string[];
  manifests: Record<string, string>;
  scripts: Record<string, string[]>;
};

export type AnalyzeProjectWithAiResult = {
  snapshot: SnapshotSummary;
  plan: StackPlan;
};

export type SmartLaunchServicePlan = {
  commandId: string;
  assignedPort?: number;
  adaptedCommand: CommandConfig;
  warnings: string[];
  blocked: boolean;
};

export type SmartLaunchPlan = {
  projectId: string;
  services: SmartLaunchServicePlan[];
  reservations: number[];
  warnings: string[];
  blocked: boolean;
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
  smartPortsEnabled?: boolean;
  stackPlan?: StackPlan;
  aiMetadata?: {
    origin: 'manual' | 'ai';
    confidence?: number;
    assumptions?: string[];
  };
};

export type DetectProjectResult = {
  detection: ProjectDetection;
  backend?: CommandConfig;
  frontend?: CommandConfig;
};
