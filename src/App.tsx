import { useEffect, useMemo, useState } from 'react';

import type { AppSettings } from './domain/settings';
import { DEFAULT_SETTINGS } from './domain/settings';
import type { ManagedProject, ServiceConfig } from './domain/projects';
import { getAppInfo, loadSettings, type AppInfo } from './services/native';
import { useProjects } from './features/projects/useProjects';
import { ProjectsOverview, EmptyProjects } from './features/projects/ProjectsOverview';
import { ProjectDetail } from './features/projects/ProjectDetail';
import { AddProjectWizard } from './features/projects/AddProjectWizard';
import { CommandEditor } from './features/projects/CommandEditor';
import { SnapshotReview } from './features/projects/SnapshotReview';
import { WorkMode } from './features/projects/WorkMode';
import { SettingsView } from './features/settings/SettingsView';
import { Titlebar } from './ui/Titlebar';
import { IconButton } from './ui/primitives';
import { Icon, type IconName } from './ui/icons';
import { CommandPalette, type Command } from './ui/CommandPalette';
import { ConfirmDialog } from './ui/overlays';
import { useRuntime } from './features/runtime/RuntimeContext';

type Route = 'projects' | 'detail' | 'settings';
type Modal =
  | { type: 'add' }
  | { type: 'cmd'; projectId: string; serviceId: string }
  | { type: 'snapshot'; path: string }
  | { type: 'work'; project: ManagedProject }
  | { type: 'delete'; project: ManagedProject }
  | null;

function RailButton({ icon, label, active, onClick }: { icon: IconName; label: string; active: boolean; onClick: () => void }) {
  return (
    <div className="rail-btn">
      <IconButton name={icon} title={label} active={active} onClick={onClick} box={40} size={19} style={active ? { background: 'var(--brand-ghost)', color: 'var(--brand-bright)' } : undefined} />
      {active && <span className="rail-active-bar" />}
    </div>
  );
}

export function App() {
  const { statusOf, tick } = useRuntime();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [route, setRoute] = useState<Route>('projects');
  const [curId, setCurId] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [palette, setPalette] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'danger' } | null>(null);
  const { projects, loading, error: projectsError, upsert, remove } = useProjects();

  useEffect(() => {
    getAppInfo().then(setAppInfo).catch(() => undefined);
    loadSettings().then(setSettings).catch(() => undefined);
  }, []);

  const current = projects.find((p) => p.id === curId) ?? null;
  const showToast = (msg: string, kind: 'ok' | 'danger' = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2600); };

  const openProject = (p: ManagedProject) => { setCurId(p.id); setRoute('detail'); };
  const goProjects = () => { setRoute('projects'); setCurId(null); };
  const closeModal = () => setModal(null);

  // ── keyboard: palette + escape-to-back ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); return; }
      if (e.key === 'Escape' && !palette && !modal && (route === 'detail' || route === 'settings')) goProjects();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [palette, modal, route]);

  const runningCount = useMemo(
    () => projects.reduce((n, p) => n + p.services.filter((s) => statusOf(p.id, s.command.id) === 'running').length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, tick],
  );

  // ── command palette ──
  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { id: 'add', group: 'Acciones', icon: 'folderPlus', label: 'Añadir un proyecto', shortcut: ['Ctrl', 'N'], keywords: 'nuevo importar', run: () => setModal({ type: 'add' }) },
      { id: 'settings', group: 'Acciones', icon: 'gear', label: 'Abrir settings', keywords: 'preferencias ai', run: () => setRoute('settings') },
      { id: 'all', group: 'Acciones', icon: 'list', label: 'Ver todos los proyectos', run: goProjects },
      { id: 'view', group: 'Vista', icon: view === 'grid' ? 'list' : 'grid', label: `Cambiar a vista ${view === 'grid' ? 'lista' : 'cuadrícula'}`, run: () => setView(view === 'grid' ? 'list' : 'grid') },
    ];
    projects.forEach((p) => {
      const counts: Record<string, number> = {};
      p.services.forEach((s) => { const st = statusOf(p.id, s.command.id); counts[st] = (counts[st] ?? 0) + 1; });
      const dot = counts.failed ? 'failed' : counts.running ? 'running' : counts.starting ? 'starting' : 'idle';
      base.push({ id: 'open-' + p.id, group: 'Ir a proyecto', label: p.name, detail: p.path, dot: dot as Command['dot'], keywords: p.path, run: () => openProject(p) });
      base.push({ id: 'work-' + p.id, group: 'Work Mode', icon: 'bolt', label: 'Work Mode · ' + p.name, keywords: 'lanzar ' + p.path, run: () => setModal({ type: 'work', project: p }) });
    });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, view, tick]);

  // ── modal handlers ──
  const onSaveNew = async (project: ManagedProject) => {
    await upsert(project);
    closeModal();
    showToast(`Añadido ${project.name}`);
    openProject(project);
  };
  const onSaveCommand = async (updated: ServiceConfig) => {
    if (!modal || modal.type !== 'cmd') return;
    const project = projects.find((p) => p.id === modal.projectId);
    if (!project) return;
    await upsert({ ...project, services: project.services.map((s) => (s.id === updated.id ? updated : s)) });
    closeModal();
    showToast(`Comando "${updated.label}" guardado`);
  };
  const onDeleteProject = async (p: ManagedProject) => {
    await remove(p.id);
    closeModal();
    goProjects();
    showToast(`Eliminado ${p.name}`, 'danger');
  };

  const projectsEmpty = !loading && projects.length === 0;
  const editingService = modal?.type === 'cmd'
    ? projects.find((p) => p.id === modal.projectId)?.services.find((s) => s.id === modal.serviceId)
    : undefined;

  return (
    <div className="app-root">
      <Titlebar runningCount={runningCount} onOpenPalette={() => setPalette(true)} />
      {projectsError && <div className="app-error-bar"><span>Project error: {projectsError}</span></div>}
      <div className="app-body">
        <nav className="rail">
          <RailButton icon="folder" label="Proyectos" active={route !== 'settings'} onClick={goProjects} />
          <RailButton icon="bolt" label="Work Mode" active={false} onClick={() => { if (current) setModal({ type: 'work', project: current }); else setPalette(true); }} />
          <div style={{ flex: 1 }} />
          <RailButton icon="gear" label="Settings" active={route === 'settings'} onClick={() => setRoute('settings')} />
        </nav>
        <main className="app-main" key={route + (curId ?? '')}>
          {route === 'settings' ? (
            <SettingsView onSaved={setSettings} appInfo={appInfo ? `${appInfo.name} ${appInfo.version}` : undefined} />
          ) : route === 'detail' && current ? (
            <ProjectDetail
              project={current}
              onBack={goProjects}
              onEditService={(serviceId) => setModal({ type: 'cmd', projectId: current.id, serviceId })}
              onWork={(p) => setModal({ type: 'work', project: p })}
              onDelete={(p) => setModal({ type: 'delete', project: p })}
              onSnapshot={() => setModal({ type: 'snapshot', path: current.path })}
              onToast={showToast}
            />
          ) : projectsEmpty ? (
            <EmptyProjects onAdd={() => setModal({ type: 'add' })} />
          ) : (
            <ProjectsOverview projects={projects} view={view} setView={setView} onOpen={openProject} onAdd={() => setModal({ type: 'add' })} onWork={(p) => setModal({ type: 'work', project: p })} />
          )}
        </main>
      </div>

      {palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}
      {modal?.type === 'add' && <AddProjectWizard onClose={closeModal} onSave={onSaveNew} onOpenSnapshot={(path) => setModal({ type: 'snapshot', path })} aiReady={!!(settings?.ai.enabled && settings?.ai.apiKeyConfigured)} />}
      {modal?.type === 'snapshot' && <SnapshotReview path={modal.path} onClose={closeModal} />}
      {modal?.type === 'cmd' && editingService && <CommandEditor service={editingService} onClose={closeModal} onSave={onSaveCommand} />}
      {modal?.type === 'work' && <WorkMode project={modal.project} settings={settings ?? DEFAULT_SETTINGS} onClose={closeModal} onLaunched={(p) => { closeModal(); openProject(p); showToast(`${p.name} en marcha`); }} />}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          icon="trash"
          iconColor="var(--st-failed)"
          title="Eliminar proyecto"
          sub={modal.project.name}
          body={<span>Esto quita <b style={{ color: 'var(--text)' }}>{modal.project.name}</b> de Ducker. Tus archivos en disco no se tocan — solo se borra la configuración del proyecto.</span>}
          typeToConfirm={modal.project.name}
          confirmLabel="Eliminar proyecto"
          confirmVariant="dangerSolid"
          confirmIcon="trash"
          onConfirm={() => onDeleteProject(modal.project)}
          onClose={closeModal}
        />
      )}

      {toast && (
        <div style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 200, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 16px', borderRadius: 100, animation: 'pop-in .2s ease', background: 'var(--surface-2)', border: '1px solid var(--border-loud)', boxShadow: 'var(--shadow-pop)', fontSize: 13, fontWeight: 600 }}>
          <Icon name={toast.kind === 'danger' ? 'trash' : 'check'} size={15} style={{ color: toast.kind === 'danger' ? 'var(--st-failed)' : 'var(--st-running)' }} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
