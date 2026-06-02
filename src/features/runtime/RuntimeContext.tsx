import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { listen } from '@tauri-apps/api/event';

import type { CommandExecutionState, CommandStatus } from '../../domain/projects';

export type LogLevel = 'info' | 'dim' | 'ok' | 'warn' | 'err';
export type LogLine = { id: number; level: LogLevel; ts: string; text: string };

type StatusEvent = { projectId: string; state: CommandExecutionState };
type LogEvent = { projectId: string; commandId: string; line: string };

type RuntimeValue = {
  statusOf: (projectId: string, commandId: string) => CommandStatus;
  errorOf: (projectId: string, commandId: string) => string | undefined;
  logsOf: (projectId: string, commandId: string) => LogLine[];
  clearLogs: (projectId: string, commandId: string) => void;
  /** Increments whenever any status/log changes, so consumers can re-render. */
  tick: number;
};

const RuntimeContext = createContext<RuntimeValue | null>(null);

const keyOf = (projectId: string, commandId: string) => `${projectId}:${commandId}`;

function classify(line: string): LogLevel {
  // Classify by content, not by the stderr stream — many tools (Symfony, Vite…) log
  // normal INFO/DEBUG to stderr, which shouldn't all look like warnings.
  const lower = line.toLowerCase();
  if (/\b(error|fatal|panic|exception)\b|exited with|\|\s*error/.test(lower)) return 'err';
  if (/\b(warning|deprecated)\b|\|\s*warn/.test(lower)) return 'warn';
  if (/\[ok\]|\b(ready|listening|compiled|started|succeed|success)\b/.test(lower)) return 'ok';
  if (/\|\s*info\b/.test(lower)) return 'info';
  return 'dim';
}

function nowTs(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const statuses = useRef<Record<string, CommandExecutionState>>({});
  const logs = useRef<Record<string, LogLine[]>>({});
  const logId = useRef(1);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => (t + 1) % 1_000_000);

  useEffect(() => {
    const unStatus = listen<StatusEvent>('ducker-status', ({ payload }) => {
      statuses.current[keyOf(payload.projectId, payload.state.commandId)] = payload.state;
      bump();
    });
    const unLog = listen<LogEvent>('ducker-log', ({ payload }) => {
      const k = keyOf(payload.projectId, payload.commandId);
      const list = logs.current[k] ?? (logs.current[k] = []);
      list.push({ id: logId.current++, level: classify(payload.line), ts: nowTs(), text: payload.line });
      if (list.length > 500) list.splice(0, list.length - 500);
      bump();
    });
    return () => {
      void unStatus.then((off) => off());
      void unLog.then((off) => off());
    };
  }, []);

  const value: RuntimeValue = {
    statusOf: (p, c) => statuses.current[keyOf(p, c)]?.status ?? 'idle',
    errorOf: (p, c) => statuses.current[keyOf(p, c)]?.error || undefined,
    logsOf: (p, c) => logs.current[keyOf(p, c)] ?? [],
    clearLogs: (p, c) => {
      logs.current[keyOf(p, c)] = [];
      bump();
    },
    tick,
  };

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error('useRuntime must be used within RuntimeProvider');
  return ctx;
}
