import type { CommandStatus, ServiceKind } from '../domain/projects';
import type { IconName } from './icons';

export type StatusMeta = { label: string; color: string; bg: string; pulse: boolean };

export const STATUS_META: Record<CommandStatus, StatusMeta> = {
  idle: { label: 'Idle', color: 'var(--st-idle)', bg: 'var(--st-idle-bg)', pulse: false },
  starting: { label: 'Starting', color: 'var(--st-starting)', bg: 'var(--st-starting-bg)', pulse: true },
  running: { label: 'Running', color: 'var(--st-running)', bg: 'var(--st-running-bg)', pulse: false },
  completed: { label: 'Completed', color: 'var(--st-completed)', bg: 'var(--st-completed-bg)', pulse: false },
  failed: { label: 'Failed', color: 'var(--st-failed)', bg: 'var(--st-failed-bg)', pulse: false },
  stopped: { label: 'Stopped', color: 'var(--st-stopped)', bg: 'var(--st-stopped-bg)', pulse: false },
};

export type TypeMeta = { label: string; icon: IconName };

export const TYPE_META: Record<ServiceKind, TypeMeta> = {
  backend: { label: 'Backend', icon: 'terminal' },
  frontend: { label: 'Frontend', icon: 'layers' },
  database: { label: 'Database', icon: 'database' },
  worker: { label: 'Worker', icon: 'restart' },
  custom: { label: 'Service', icon: 'box' },
};
