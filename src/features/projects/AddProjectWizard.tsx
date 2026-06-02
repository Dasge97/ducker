import { useState } from 'react';

import type { ManagedProject, ServiceConfig, ServiceKind, ServicePlan, AnalyzeProjectWithAiResult, PortStrategy } from '../../domain/projects';
import { analyzeProjectSnapshotWithAi, collectProjectSnapshot, detectProject } from '../../services/native';
import { Button, Field, IconButton, Input, Spinner } from '../../ui/primitives';
import { Icon } from '../../ui/icons';
import { Overlay, ModalCard, ModalHeader } from '../../ui/overlays';

const SERVICE_KINDS: ServiceKind[] = ['backend', 'frontend', 'database', 'worker', 'custom'];

function basename(path: string): string {
  const parts = path.replace(/[/\\]+$/, '').split(/[/\\]/);
  return parts[parts.length - 1] || 'proyecto';
}

function planToService(s: ServicePlan): ServiceConfig {
  return {
    id: s.command.id || s.id,
    label: s.label,
    kind: s.kind,
    url: undefined,
    enabled: true,
    command: {
      ...s.command,
      id: s.command.id || s.id,
      portStrategy: (s.portStrategy ?? s.command.portStrategy ?? 'argument') as PortStrategy,
      preferredPort: s.preferredPort ?? s.command.preferredPort,
      origin: 'ai',
    },
  };
}

function blankService(): ServiceConfig {
  const id = `svc-${Math.random().toString(36).slice(2, 8)}`;
  return { id, label: 'Servicio', kind: 'custom', enabled: true, command: { id, label: 'Servicio', executable: '', args: [], workingDirectory: '', kind: 'custom', portStrategy: 'argument', origin: 'manual' } };
}

type Step = 'path' | 'analyzing' | 'review';

export function AddProjectWizard({ onClose, onSave, onOpenSnapshot, aiReady }: { onClose: () => void; onSave: (p: ManagedProject) => void; onOpenSnapshot: (path: string) => void; aiReady: boolean }) {
  const [step, setStep] = useState<Step>('path');
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [ai, setAi] = useState<AnalyzeProjectWithAiResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [detectionData, setDetectionData] = useState<ManagedProject['detection'] | null>(null);

  const analyze = async () => {
    if (!path.trim()) return;
    const target = path.trim();
    setStep('analyzing');
    setNote(null);
    setAi(null);
    try {
      // Local detection is instant and gives us the detection flags + a default name.
      const local = await detectProject(target);
      setDetectionData(local.detection);
      setName(basename(target));

      // AI-first when a key is configured; deterministic detection is the fallback.
      if (aiReady) {
        try {
          setNote('Analizando con IA…');
          const snapshot = await collectProjectSnapshot(target);
          const aiResult = await analyzeProjectSnapshotWithAi(snapshot);
          setAi(aiResult);
          setServices(aiResult.plan.services.map(planToService));
          setNote(null); // analysis finished — don't leave the "Analyzing…" note lingering
          setStep('review');
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Distinguish a real availability problem (network/auth) from "the AI ran but found nothing".
          const unreachable = /request failed|rejected|timed out|timeout/i.test(msg);
          setNote(unreachable
            ? `IA no disponible (${msg}). Usando detección local.`
            : 'La IA no encontró servicios ejecutables aquí. Usando detección local.');
        }
      }

      if (local.services.length > 0) {
        setServices(local.services);
      } else {
        setServices([]);
        setNote('No se detectaron servicios en esta carpeta. ¿Has elegido la raíz del proyecto (la que tiene composer.json / package.json / etc.)? Puedes añadirlos manualmente.');
      }
      setStep('review');
    } catch (e) {
      setNote(`Detección incompleta: ${e instanceof Error ? e.message : String(e)}. Añade servicios manualmente.`);
      setServices([]);
      setStep('review');
    }
  };

  const setSvc = (id: string, patch: Partial<ServiceConfig>) => setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const setCmd = (id: string, patch: Partial<ServiceConfig['command']>) => setServices((prev) => prev.map((s) => (s.id === id ? { ...s, command: { ...s.command, ...patch } } : s)));
  const removeSvc = (id: string) => setServices((prev) => prev.filter((s) => s.id !== id));

  const save = () => {
    const cleaned = services
      .filter((s) => s.command.executable.trim())
      .map((s) => ({ ...s, command: { ...s.command, executable: s.command.executable.trim(), workingDirectory: s.command.workingDirectory || path.trim() } }));
    const project: ManagedProject = {
      id: `project-${Date.now()}`,
      name: name.trim() || basename(path.trim()),
      path: path.trim(),
      services: cleaned,
      detection: detectionData ?? { isSymfony: false, hasComposerJson: false, hasBinConsole: false, hasPackageJson: false, hasYarnLock: false, detectedStacks: [] },
      smartPortsEnabled: cleaned.some((s) => s.command.preferredPort != null),
      stackPlan: ai?.plan,
      aiMetadata: ai ? { origin: 'ai', confidence: ai.plan.confidence, assumptions: ai.plan.assumptions } : { origin: 'manual' },
    };
    onSave(project);
  };

  const cols = '1.4fr 92px 1fr 96px 64px';

  return (
    <Overlay onClose={onClose}>
      <ModalCard width={step === 'review' ? 760 : 540}>
        {step === 'path' && (
          <>
            <ModalHeader icon="folderPlus" title="Añadir un proyecto" sub="Apunta Ducker a una carpeta. Detecta el stack y mapea cada servicio." onClose={onClose} />
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Carpeta del proyecto" hint="Ruta local absoluta. Nada sale de tu máquina sin tu permiso.">
                <Input value={path} onChange={setPath} mono icon="folder" placeholder="C:\\Users\\tu\\dev\\mi-proyecto" />
              </Field>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-faint)' }}>
                <Icon name="shieldCheck" size={14} style={{ color: 'var(--st-running)' }} />
                El código fuente nunca se envía. Solo se analizan manifiestos y el árbol de archivos.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" icon="sparkle" disabled={!path.trim()} onClick={analyze}>Analizar stack</Button>
            </div>
          </>
        )}

        {step === 'analyzing' && (
          <>
            <ModalHeader icon="sparkle" title="Analizando proyecto…" sub={path} onClose={onClose} />
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <img src="/ducker-logo.png" width={92} height={92} alt="" style={{ animation: 'bob 2.2s ease-in-out infinite', objectFit: 'contain' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-dim)', fontSize: 13.5 }}>
                <Spinner size={16} />{note ?? 'Detectando servicios y puertos…'}
              </div>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <ModalHeader
              icon="layers"
              title="Revisa el stack detectado"
              sub={<span>{services.length} servicios{ai ? ` · vía IA · confianza ${Math.round(ai.plan.confidence * 100)}%` : ''}</span>}
              onClose={onClose}
            />
            <div style={{ padding: '12px 20px 0', display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Nombre del proyecto"><Input value={name} onChange={setName} /></Field></div>
            </div>
            <div style={{ padding: '10px 0 6px', overflowY: 'auto', flex: 1 }}>
              {note && <div style={{ padding: '0 20px 8px', fontSize: 12, color: 'var(--amber)' }}>{note}</div>}
              <div className="upper" style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '8px 20px', fontSize: 10, color: 'var(--text-ghost)', fontWeight: 700 }}>
                <span>Servicio</span><span>Tipo</span><span>Comando</span><span>Puerto</span><span style={{ textAlign: 'right' }} />
              </div>
              {services.map((s) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 20px', alignItems: 'center', borderTop: '1px solid var(--border-soft)' }}>
                  <input value={s.label} onChange={(e) => setSvc(s.id, { label: e.target.value })} style={{ fontSize: 13.5, fontWeight: 650, padding: '4px 6px' }} />
                  <select value={s.kind} onChange={(e) => setSvc(s.id, { kind: e.target.value as ServiceKind })} style={{ fontSize: 12, padding: '4px 6px' }}>
                    {SERVICE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input
                    className="mono"
                    value={`${s.command.executable} ${s.command.args.join(' ')}`.trim()}
                    onChange={(e) => {
                      const parts = e.target.value.split(' ').filter(Boolean);
                      setCmd(s.id, { executable: parts[0] ?? '', args: parts.slice(1) });
                    }}
                    style={{ fontSize: 11, padding: '4px 6px' }}
                  />
                  <input className="mono" value={s.command.preferredPort ?? ''} onChange={(e) => setCmd(s.id, { preferredPort: e.target.value ? Number(e.target.value) : undefined })} placeholder="—" style={{ fontSize: 12, padding: '4px 6px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <IconButton name="trash" size={14} box={24} danger title="Quitar" onClick={() => removeSvc(s.id)} />
                  </div>
                </div>
              ))}
              <div style={{ padding: '10px 20px' }}>
                <Button size="sm" variant="ghost" icon="plus" onClick={() => setServices((prev) => [...prev, blankService()])}>Añadir servicio</Button>
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-deep)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Icon name="shieldCheck" size={15} style={{ color: 'var(--st-running)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Construido desde manifiestos — <button onClick={() => onOpenSnapshot(path.trim())} style={{ color: 'var(--brand-bright)', fontWeight: 600, textDecoration: 'underline', background: 'none' }}>revisar lo enviado</button>
                </span>
              </div>
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" icon="check" onClick={save}>Guardar proyecto</Button>
            </div>
          </>
        )}
      </ModalCard>
    </Overlay>
  );
}
