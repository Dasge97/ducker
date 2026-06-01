import { useState } from 'react';

import type { CommandExecutionState, ManagedProject } from '../../domain/projects';
import { getCommandLog, openEditor, openFolder, openUrl, startCommand, stopCommand } from '../../services/native';

type Props = {
  project: ManagedProject;
  onDelete: (projectId: string) => Promise<void>;
  onEdit: (project: ManagedProject) => void;
  confirmRiskyCommands: boolean;
};

export function ProjectCard({ project, onDelete, onEdit, confirmRiskyCommands }: Props) {
  const [backendState, setBackendState] = useState<CommandExecutionState | undefined>(project.runtime?.backend);
  const [frontendState, setFrontendState] = useState<CommandExecutionState | undefined>(project.runtime?.frontend);
  const [error, setError] = useState<string | null>(null);

  const setCommandState = (commandId: string, state: CommandExecutionState) => {
    if (project.backend?.id === commandId) setBackendState(state);
    if (project.frontend?.id === commandId) setFrontendState(state);
  };

  const runAction = async (action: () => Promise<void | CommandExecutionState>) => {
    setError(null);
    try {
      const result = await action();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  };

  const runStart = async (commandId: string, risky?: boolean) => {
    if (risky && confirmRiskyCommands && !window.confirm('Este comando está marcado como riesgoso. ¿Continuar?')) return;
    const result = await runAction(() => startCommand(project.id, commandId));
    if (result) setCommandState(commandId, result);
  };

  const runStop = async (commandId: string) => {
    const result = await runAction(() => stopCommand(project.id, commandId));
    if (result) setCommandState(commandId, result);
  };

  const refreshLog = async (commandId: string) => {
    const result = await runAction(() => getCommandLog(project.id, commandId));
    if (result) setCommandState(commandId, result);
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar ${project.name}?`)) return;
    await runAction(() => onDelete(project.id));
  };

  const renderState = (label: string, state?: CommandExecutionState) => (
    <section className="command-state">
      <strong>{label}: {state?.status ?? 'idle'}</strong>
      {state?.error ? <p className="error">{state.error}</p> : null}
      {state?.recentLogs?.length ? <pre>{state.recentLogs.slice(-8).join('\n')}</pre> : <p className="muted">Sin logs recientes.</p>}
    </section>
  );

  return (
    <article className="panel">
      <h3>{project.name}</h3>
      <p className="muted">{project.path}</p>
      <div className="row">
        {project.backend ? <button onClick={() => runStart(project.backend!.id, project.backend?.risky)}>Start backend</button> : null}
        {project.frontend ? <button onClick={() => runStart(project.frontend!.id, project.frontend?.risky)}>Start frontend</button> : null}
        {project.backend ? <button onClick={() => runStop(project.backend!.id)}>Stop backend</button> : null}
        {project.frontend ? <button onClick={() => runStop(project.frontend!.id)}>Stop frontend</button> : null}
      </div>
      <div className="row">
        <button onClick={() => runAction(() => openEditor(project.id))}>Open editor</button>
        <button onClick={() => runAction(() => openFolder(project.id))}>Open folder</button>
        {project.urls.backend ? <button onClick={() => runAction(() => openUrl(project.urls.backend!))}>Open backend URL</button> : null}
        {project.urls.frontend ? <button onClick={() => runAction(() => openUrl(project.urls.frontend!))}>Open frontend URL</button> : null}
      </div>
      <div className="row">
        {project.backend ? <button onClick={() => refreshLog(project.backend!.id)}>Refresh backend logs</button> : null}
        {project.frontend ? <button onClick={() => refreshLog(project.frontend!.id)}>Refresh frontend logs</button> : null}
        <button onClick={() => onEdit(project)}>Edit</button>
      </div>
      {project.backend ? renderState('Backend', backendState) : null}
      {project.frontend ? renderState('Frontend', frontendState) : null}
      {error ? <p className="error">{error}</p> : null}
      <button className="danger" onClick={remove}>Delete</button>
    </article>
  );
}
