import type { ManagedProject } from '../../domain/projects';
import type { AppSettings } from '../../domain/settings';
import { openEditor, openUrl, startCommand, startSmartLaunch } from '../../services/native';
import { ProjectCard } from './ProjectCard';

type Props = {
  projects: ManagedProject[];
  onDelete: (projectId: string) => Promise<void>;
  onEdit: (project: ManagedProject) => void;
  settings: AppSettings;
  confirmRiskyCommands: boolean;
};

export function Dashboard({ projects, onDelete, onEdit, settings, confirmRiskyCommands }: Props) {
  const runWorkMode = async (project: ManagedProject) => {
    const riskyCommands = [project.backend, project.frontend].filter((command) => command?.risky);
    if (confirmRiskyCommands && riskyCommands.length > 0 && !window.confirm('Work mode incluye comandos marcados como riesgosos. ¿Continuar?')) return;
    await openEditor(project.id);
    if (project.smartPortsEnabled) {
      const plan = await startSmartLaunch(project.id);
      if (plan.blocked) {
        window.alert(`Smart launch blocked:\n${plan.warnings.join('\n')}`);
        return;
      }
    } else {
      if (project.backend) await startCommand(project.id, project.backend.id);
      if (project.frontend) await startCommand(project.id, project.frontend.id);
    }
    if (settings.openBackendUrlOnWorkMode && project.urls.backend) await openUrl(project.urls.backend);
    if (settings.openFrontendUrlOnWorkMode && project.urls.frontend) await openUrl(project.urls.frontend);
  };

  if (projects.length === 0) {
    return <section className="panel"><h2>Sin proyectos</h2><p className="muted">Añade uno para empezar.</p></section>;
  }

  return (
    <section className="grid">
      {projects.map((project) => (
        <div key={project.id}>
          <ProjectCard project={project} onDelete={onDelete} onEdit={onEdit} confirmRiskyCommands={confirmRiskyCommands} />
          <button onClick={() => runWorkMode(project)}>Work mode</button>
        </div>
      ))}
    </section>
  );
}
