import { useEffect, useState } from 'react';
import type { ManagedProject, CommandConfig, ProjectDetection } from '../../domain/projects';
import { detectProject } from '../../services/native';

type Props = {
  onSubmit: (project: ManagedProject) => Promise<void>;
  editingProject?: ManagedProject | null;
  onCancelEdit?: () => void;
};

const EMPTY_DETECTION: ProjectDetection = {
  isSymfony: false,
  hasComposerJson: false,
  hasBinConsole: false,
  hasPackageJson: false,
  hasYarnLock: false,
};

const commandToArgsText = (command?: CommandConfig) => command?.args.join('\n') ?? '';
const argsTextToArray = (argsText: string) => argsText.split('\n').map((arg) => arg.trim()).filter(Boolean);

const mkCommand = (id: string, label: string, executable: string, argsText: string, workingDirectory: string, kind: CommandConfig['kind'], risky = false): CommandConfig => {
  const command: CommandConfig = {
    id,
    label,
    executable,
    args: argsTextToArray(argsText),
    workingDirectory,
    kind,
    risky,
  };

  if (kind === 'symfony-backend') {
    command.stopCommand = {
      id: `${id}-stop`,
      label: `${label} stop`,
      executable,
      args: ['server:stop'],
      workingDirectory,
      kind,
      risky: false,
    };
  }

  return command;
};

export function ProjectForm({ onSubmit, editingProject, onCancelEdit }: Props) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [detection, setDetection] = useState<ProjectDetection>(EMPTY_DETECTION);
  const [backendExecutable, setBackendExecutable] = useState('');
  const [backendArgs, setBackendArgs] = useState('');
  const [backendUrl, setBackendUrl] = useState('');
  const [backendRisky, setBackendRisky] = useState(false);
  const [frontendExecutable, setFrontendExecutable] = useState('');
  const [frontendArgs, setFrontendArgs] = useState('');
  const [frontendUrl, setFrontendUrl] = useState('');
  const [frontendRisky, setFrontendRisky] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingProject) return;
    setName(editingProject.name);
    setPath(editingProject.path);
    setDetection(editingProject.detection);
    setBackendExecutable(editingProject.backend?.executable ?? '');
    setBackendArgs(commandToArgsText(editingProject.backend));
    setBackendUrl(editingProject.urls.backend ?? '');
    setBackendRisky(editingProject.backend?.risky ?? false);
    setFrontendExecutable(editingProject.frontend?.executable ?? '');
    setFrontendArgs(commandToArgsText(editingProject.frontend));
    setFrontendUrl(editingProject.urls.frontend ?? '');
    setFrontendRisky(editingProject.frontend?.risky ?? false);
  }, [editingProject]);

  const fillDetection = async () => {
    try {
      const result = await detectProject(path);
      setDetection(result.detection);
      if (result.backend) {
        setBackendExecutable(result.backend.executable);
        setBackendArgs(commandToArgsText(result.backend));
        setBackendRisky(result.backend.risky ?? false);
      }
      if (result.frontend) {
        setFrontendExecutable(result.frontend.executable);
        setFrontendArgs(commandToArgsText(result.frontend));
        setFrontendRisky(result.frontend.risky ?? false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const now = Date.now().toString();
    const backend = backendExecutable.trim()
      ? mkCommand('backend', 'Backend Symfony', backendExecutable.trim(), backendArgs, path, 'symfony-backend', backendRisky)
      : undefined;
    const frontend = frontendExecutable.trim()
      ? mkCommand('frontend', 'Frontend Yarn', frontendExecutable.trim(), frontendArgs, path, 'yarn-frontend', frontendRisky)
      : undefined;
    await onSubmit({
      id: editingProject?.id ?? `project-${now}`,
      name,
      path,
      backend,
      frontend,
      urls: { backend: backendUrl || undefined, frontend: frontendUrl || undefined },
      detection,
      runtime: editingProject?.runtime,
    });
    setName('');
    setPath('');
    setDetection(EMPTY_DETECTION);
    setBackendExecutable('');
    setBackendArgs('');
    setBackendUrl('');
    setBackendRisky(false);
    setFrontendExecutable('');
    setFrontendArgs('');
    setFrontendUrl('');
    setFrontendRisky(false);
    onCancelEdit?.();
  };

  return (
    <form className="panel" onSubmit={submit}>
      <h2>{editingProject ? 'Editar proyecto' : 'Añadir proyecto'}</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required />
      <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="Ruta local" required />
      <button type="button" onClick={fillDetection}>Detectar Symfony/Yarn</button>
      <fieldset>
        <legend>Backend Symfony</legend>
        <input value={backendExecutable} onChange={(e) => setBackendExecutable(e.target.value)} placeholder="Ejecutable, ej: symfony" />
        <textarea value={backendArgs} onChange={(e) => setBackendArgs(e.target.value)} placeholder={'Argumentos, uno por línea\nserver:start\n--port=8001\n--daemon'} />
        <input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} placeholder="URL backend, ej: http://127.0.0.1:8001" />
        <label><input type="checkbox" checked={backendRisky} onChange={(e) => setBackendRisky(e.target.checked)} /> Requiere confirmación</label>
      </fieldset>
      <fieldset>
        <legend>Frontend Yarn</legend>
        <input value={frontendExecutable} onChange={(e) => setFrontendExecutable(e.target.value)} placeholder="Ejecutable, ej: yarn" />
        <textarea value={frontendArgs} onChange={(e) => setFrontendArgs(e.target.value)} placeholder={'Argumentos, uno por línea\ndev'} />
        <input value={frontendUrl} onChange={(e) => setFrontendUrl(e.target.value)} placeholder="URL frontend, ej: http://127.0.0.1:5173" />
        <label><input type="checkbox" checked={frontendRisky} onChange={(e) => setFrontendRisky(e.target.checked)} /> Requiere confirmación</label>
      </fieldset>
      <p className="muted">Detección: Symfony {detection.isSymfony ? 'sí' : 'no'} · composer {detection.hasComposerJson ? 'sí' : 'no'} · bin/console {detection.hasBinConsole ? 'sí' : 'no'} · yarn {detection.hasYarnLock ? 'sí' : 'no'}</p>
      <button type="submit">Guardar</button>
      {editingProject ? <button type="button" onClick={onCancelEdit}>Cancelar edición</button> : null}
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
