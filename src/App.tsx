import { useEffect, useState } from 'react';

import type { AppSettings } from './domain/settings';
import { DEFAULT_SETTINGS } from './domain/settings';
import type { ManagedProject } from './domain/projects';
import { getAppInfo, type AppInfo } from './services/native';
import { Dashboard } from './features/dashboard/Dashboard';
import { ProjectForm } from './features/projects/ProjectForm';
import { useProjects } from './features/projects/useProjects';
import { SettingsPanel } from './features/settings/SettingsPanel';

export function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [editingProject, setEditingProject] = useState<ManagedProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { projects, loading, error: projectsError, upsert, remove } = useProjects();

  useEffect(() => {
    getAppInfo()
      .then(setAppInfo)
      .catch((nativeError: unknown) => {
        setError(nativeError instanceof Error ? nativeError.message : String(nativeError));
      });
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Ducker MVP</p>
        <h1>Gestor local para proyectos Symfony/Yarn</h1>
        <p>CRUD, detección, dashboard y comandos nativos desde una frontera tipada.</p>
        <div className="status-row">
          <span>{appInfo ? `${appInfo.name} ${appInfo.version}` : 'Cargando info nativa...'}</span>
          {error ? <span className="error">Native boundary error: {error}</span> : null}
          {projectsError ? <span className="error">Project error: {projectsError}</span> : null}
        </div>
      </section>
      <ProjectForm onSubmit={upsert} editingProject={editingProject} onCancelEdit={() => setEditingProject(null)} />
      <SettingsPanel onLoaded={setSettings} />
      {loading ? <section className="panel">Cargando proyectos...</section> : <Dashboard projects={projects} onDelete={remove} onEdit={setEditingProject} settings={settings ?? DEFAULT_SETTINGS} confirmRiskyCommands={settings?.confirmRiskyCommands ?? true} />}
    </main>
  );
}
