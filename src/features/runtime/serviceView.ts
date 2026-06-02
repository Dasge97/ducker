import type { CommandStatus, ManagedProject, ServiceConfig, ServiceKind, SmartLaunchPlan } from '../../domain/projects';

export type PortState = 'ok' | 'reassigned' | 'manual';

/** Keep a user's URL (including its path, e.g. /app/) but point it at the assigned port. */
function withAssignedPort(rawUrl: string, port: number): string {
  try {
    const u = new URL(rawUrl);
    u.port = String(port);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

export type ServiceView = {
  id: string;
  commandId: string;
  name: string;
  kind: ServiceKind;
  status: CommandStatus;
  executable: string;
  args: string[];
  cwd: string;
  url?: string;
  risky: boolean;
  enabled: boolean;
  preferredPort?: number;
  assignedPort?: number;
  portState: PortState;
  warnings: string[];
};

/**
 * Adapt a backend ServiceConfig into the richer shape the UI renders, folding in the
 * live status and (optionally) a smart-launch plan that resolves real assigned ports.
 */
export function toServiceView(
  project: ManagedProject,
  service: ServiceConfig,
  status: CommandStatus,
  plan?: SmartLaunchPlan | null,
): ServiceView {
  const cmd = service.command;
  const planned = plan?.services.find((s) => s.commandId === cmd.id);

  let assignedPort = cmd.preferredPort;
  let portState: PortState = 'ok';
  if (planned) {
    assignedPort = planned.assignedPort ?? assignedPort;
    if (planned.blocked) portState = 'manual';
    else if (planned.assignedPort && cmd.preferredPort && planned.assignedPort !== cmd.preferredPort) portState = 'reassigned';
  }

  const warnings = planned?.warnings ?? [];

  // Web-facing services should have a URL even when none was stored (AI plans omit it).
  // Derive it from the live/assigned port so Work Mode can open the right address.
  const webFacing = service.kind === 'backend' || service.kind === 'frontend';
  let url = service.url;
  if (webFacing && assignedPort) {
    // Respect a user-set URL (keep its path like /app/) but reflect the assigned port.
    url = service.url ? withAssignedPort(service.url, assignedPort) : `http://localhost:${assignedPort}`;
  }

  return {
    id: service.id,
    commandId: cmd.id,
    name: service.label || cmd.label || service.kind,
    kind: service.kind,
    status,
    executable: cmd.executable,
    args: cmd.args ?? [],
    cwd: cmd.workingDirectory,
    url,
    risky: cmd.risky ?? false,
    enabled: service.enabled,
    preferredPort: cmd.preferredPort,
    assignedPort,
    portState,
    warnings,
  };
}

export type ProjectView = {
  project: ManagedProject;
  services: ServiceView[];
  stackLabel: string;
  counts: Partial<Record<CommandStatus, number>>;
  runningCount: number;
  hasManualPort: boolean;
  anyRunning: boolean;
};

export function toProjectView(
  project: ManagedProject,
  statusOf: (projectId: string, commandId: string) => CommandStatus,
  plan?: SmartLaunchPlan | null,
): ProjectView {
  const services = project.services.map((s) => toServiceView(project, s, statusOf(project.id, s.command.id), plan));
  const counts: Partial<Record<CommandStatus, number>> = {};
  for (const s of services) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const stackLabel = project.detection.detectedStacks.length
    ? project.detection.detectedStacks.join(' · ')
    : (project.stackPlan?.stackName ?? (services.map((s) => s.kind).join(' · ') || 'Sin stack'));
  return {
    project,
    services,
    stackLabel,
    counts,
    runningCount: counts.running ?? 0,
    hasManualPort: services.some((s) => s.portState === 'manual'),
    anyRunning: services.some((s) => s.status === 'running' || s.status === 'starting'),
  };
}
