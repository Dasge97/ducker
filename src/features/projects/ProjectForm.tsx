import { useEffect, useState } from 'react';
import type { ManagedProject, CommandConfig, ProjectDetection, AnalyzeProjectWithAiResult, ServicePlan, SnapshotSummary } from '../../domain/projects';
import { analyzeProjectSnapshotWithAi, collectProjectSnapshot, detectProject } from '../../services/native';

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
  const [aiResult, setAiResult] = useState<AnalyzeProjectWithAiResult | null>(null);
  const [snapshotPreview, setSnapshotPreview] = useState<SnapshotSummary | null>(null);
  const [smartPortsEnabled, setSmartPortsEnabled] = useState(false);
  const [backendAiCommand, setBackendAiCommand] = useState<CommandConfig | undefined>();
  const [frontendAiCommand, setFrontendAiCommand] = useState<CommandConfig | undefined>();

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
    setSmartPortsEnabled(editingProject.smartPortsEnabled ?? false);
    setAiResult(editingProject.stackPlan ? {
      snapshot: { rootPath: editingProject.path, includedFiles: [], omittedFiles: [], manifests: {}, scripts: {} },
      plan: editingProject.stackPlan,
    } : null);
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
      ? { ...mkCommand('backend', 'Backend Symfony', backendExecutable.trim(), backendArgs, path, 'symfony-backend', backendRisky), preferredPort: backendAiCommand?.preferredPort, portStrategy: backendAiCommand?.portStrategy ?? 'argument', origin: aiResult ? 'ai' as const : 'manual' as const, overriddenByUser: aiResult ? commandToArgsText(backendAiCommand) !== backendArgs || backendAiCommand?.executable !== backendExecutable.trim() : false }
      : undefined;
    const frontend = frontendExecutable.trim()
      ? { ...mkCommand('frontend', 'Frontend Yarn', frontendExecutable.trim(), frontendArgs, path, 'yarn-frontend', frontendRisky), preferredPort: frontendAiCommand?.preferredPort, portStrategy: frontendAiCommand?.portStrategy ?? 'argument', origin: aiResult ? 'ai' as const : 'manual' as const, overriddenByUser: aiResult ? commandToArgsText(frontendAiCommand) !== frontendArgs || frontendAiCommand?.executable !== frontendExecutable.trim() : false }
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
      smartPortsEnabled,
      stackPlan: aiResult?.plan,
      aiMetadata: aiResult ? { origin: 'ai', confidence: aiResult.plan.confidence, assumptions: aiResult.plan.assumptions } : { origin: 'manual' },
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
    setAiResult(null);
    setSnapshotPreview(null);
    setBackendAiCommand(undefined);
    setFrontendAiCommand(undefined);
    setSmartPortsEnabled(false);
    onCancelEdit?.();
  };

  const applyServiceSuggestion = (service: ServicePlan) => {
    const command = service.command;
    if (service.kind === 'backend') {
      setBackendExecutable(command.executable);
      setBackendArgs(commandToArgsText(command));
      setBackendRisky(command.risky ?? false);
      setBackendAiCommand({ ...command, preferredPort: service.preferredPort ?? command.preferredPort, portStrategy: service.portStrategy ?? command.portStrategy });
    }
    if (service.kind === 'frontend') {
      setFrontendExecutable(command.executable);
      setFrontendArgs(commandToArgsText(command));
      setFrontendRisky(command.risky ?? false);
      setFrontendAiCommand({ ...command, preferredPort: service.preferredPort ?? command.preferredPort, portStrategy: service.portStrategy ?? command.portStrategy });
    }
  };

  const previewSnapshot = async () => {
    setError(null);
    try {
      setSnapshotPreview(await collectProjectSnapshot(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runAiAnalyze = async () => {
    setError(null);
    if (!snapshotPreview) {
      setError('Primero revisa el snapshot que se enviará a la IA.');
      return;
    }
    try {
      const result = await analyzeProjectSnapshotWithAi(snapshotPreview);
      setAiResult(result);
      result.plan.services.forEach(applyServiceSuggestion);
      setSmartPortsEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <form className="panel" onSubmit={submit}>
      <h2>{editingProject ? 'Editar proyecto' : 'Añadir proyecto'}</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" required />
      <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="Ruta local" required />
      <button type="button" onClick={fillDetection}>Detectar Symfony/Yarn</button>
      <button type="button" onClick={previewSnapshot}>Previsualizar snapshot IA</button>
      <button type="button" onClick={runAiAnalyze}>Analyze with AI</button>
      <label><input type="checkbox" checked={smartPortsEnabled} onChange={(e) => setSmartPortsEnabled(e.target.checked)} /> Smart ports enabled</label>
      {snapshotPreview ? (
        <section className="panel">
          <h3>Snapshot que se enviará a IA</h3>
          <p className="muted">Incluidos: {snapshotPreview.includedFiles.length} · Omitidos: {snapshotPreview.omittedFiles.length}</p>
          <details><summary>Archivos incluidos</summary><pre>{snapshotPreview.includedFiles.join('\n')}</pre></details>
          <details><summary>Archivos omitidos</summary><pre>{snapshotPreview.omittedFiles.join('\n')}</pre></details>
          <details><summary>Manifiestos enviados</summary><pre>{Object.entries(snapshotPreview.manifests).map(([file, content]) => `${file}\n${content}`).join('\n\n')}</pre></details>
          <details><summary>Scripts enviados</summary><pre>{Object.entries(snapshotPreview.scripts).map(([file, scripts]) => `${file}\n${scripts.join('\n')}`).join('\n\n')}</pre></details>
          <p className="muted">No se envía código fuente completo por defecto.</p>
        </section>
      ) : null}
      {aiResult ? (
        <section className="panel">
          <h3>AI snapshot summary</h3>
          <p className="muted">Incluidos: {aiResult.snapshot.includedFiles.length} · Omitidos: {aiResult.snapshot.omittedFiles.length}</p>
          <details><summary>Archivos omitidos</summary><pre>{aiResult.snapshot.omittedFiles.join('\n')}</pre></details>
          <h3>AI plan: {aiResult.plan.stackName}</h3>
          <p className="muted">Confidence: {aiResult.plan.confidence}</p>
          {aiResult.plan.assumptions.length ? <pre>{aiResult.plan.assumptions.join('\n')}</pre> : null}
          {aiResult.plan.warnings.length ? <pre>{aiResult.plan.warnings.join('\n')}</pre> : null}
        </section>
      ) : null}
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
