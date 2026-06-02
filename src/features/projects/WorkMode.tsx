import { useEffect, useState } from 'react';

import type { ManagedProject, SmartLaunchPlan } from '../../domain/projects';
import type { AppSettings } from '../../domain/settings';
import { openEditor, openUrl, planSmartLaunch, startCommand, startSmartLaunch } from '../../services/native';
import { Button, Spinner } from '../../ui/primitives';
import { Icon, type IconName } from '../../ui/icons';
import { Overlay, ModalCard, ModalHeader, ModalFooter } from '../../ui/overlays';
import { useRuntime } from '../runtime/RuntimeContext';
import { toProjectView } from '../runtime/serviceView';

function summaryLine(icon: IconName, title: string, sub: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', flexShrink: 0 }}>
        <Icon name={icon} size={15} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
    </div>
  );
}

export function WorkMode({ project, settings, onClose, onLaunched }: { project: ManagedProject; settings: AppSettings; onClose: () => void; onLaunched: (p: ManagedProject) => void }) {
  const { statusOf } = useRuntime();
  const [plan, setPlan] = useState<SmartLaunchPlan | null>(null);
  const [ack, setAck] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project.smartPortsEnabled) return;
    planSmartLaunch(project.id).then(setPlan).catch(() => setPlan(null));
  }, [project.id, project.smartPortsEnabled]);

  const view = toProjectView(project, statusOf, plan);
  const enabled = view.services.filter((s) => s.enabled);
  const risky = enabled.filter((s) => s.risky);
  const urls = enabled.filter((s) => s.url && s.kind !== 'database').length;
  const blocked = view.hasManualPort;
  const needAck = risky.length > 0 && settings.confirmRiskyCommands;
  const canLaunch = !blocked && (!needAck || ack);

  const launch = async () => {
    setLaunching(true);
    setError(null);
    try {
      // Opening the editor is best-effort — a missing editor shouldn't block launching services.
      try { await openEditor(project.id); } catch { /* editor optional */ }
      if (project.smartPortsEnabled) {
        const p = await startSmartLaunch(project.id);
        if (p.blocked) { setError('Lanzamiento bloqueado: revisa los puertos.'); setLaunching(false); return; }
      } else {
        for (const s of enabled) await startCommand(project.id, s.commandId);
      }
      for (const s of view.services) {
        if (!s.url) continue;
        if (s.kind === 'backend' && !settings.openBackendUrlOnWorkMode) continue;
        if (s.kind === 'frontend' && !settings.openFrontendUrlOnWorkMode) continue;
        await openUrl(s.url);
      }
      onLaunched(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLaunching(false);
    }
  };

  return (
    <Overlay onClose={launching ? undefined : onClose}>
      <ModalCard width={500}>
        <ModalHeader icon="bolt" iconColor="var(--amber)" title={launching ? 'Lanzando Work Mode…' : 'Work Mode'} sub={launching ? project.name : `Arranca todo para ${project.name} de una vez`} onClose={launching ? undefined : onClose} />
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {launching ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, color: 'var(--text-dim)' }}><Spinner size={16} color="var(--amber)" />Abriendo editor, arrancando servicios y URLs…</div>
          ) : (
            <>
              {blocked && (
                <div style={{ padding: 12, borderRadius: 'var(--r)', background: 'var(--st-failed-bg)', border: '1px solid var(--st-failed)', display: 'flex', gap: 10 }}>
                  <Icon name="alert" size={16} style={{ color: 'var(--st-failed)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--st-failed)' }}>Lanzamiento bloqueado — puertos sin resolver</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.5 }}>Hay puertos que no se pueden asignar automáticamente. Resuélvelos antes de lanzar.</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {summaryLine('terminal', `Arrancar ${enabled.length} servicios`, enabled.map((s) => s.name).join(', ') || '—')}
                {settings.editorCommand && summaryLine('edit', 'Abrir editor', settings.editorCommand)}
                {(settings.openBackendUrlOnWorkMode || settings.openFrontendUrlOnWorkMode) && summaryLine('globe', `Abrir ${urls} URLs de servicio`, 'en tu navegador')}
              </div>
              {risky.length > 0 && (
                <div style={{ padding: 12, borderRadius: 'var(--r)', background: 'var(--st-failed-bg)', border: '1px solid var(--st-failed)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--st-failed)' }}>
                    <Icon name="alert" size={15} />{risky.length} comando{risky.length > 1 ? 's' : ''} riesgoso{risky.length > 1 ? 's' : ''}
                  </div>
                  {risky.map((s) => (
                    <div key={s.id} style={{ marginTop: 7, fontSize: 12 }}>
                      <code className="mono" style={{ color: 'var(--text)', background: 'none', border: 'none', padding: 0 }}>{s.name}: {s.executable} {s.args.join(' ')}</code>
                    </div>
                  ))}
                  {needAck && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 11, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-dim)' }}>
                      <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--st-failed)' }} />
                      Entiendo que pueden modificar datos — ejecutarlos igualmente
                    </label>
                  )}
                </div>
              )}
              {error && <div className="error">{error}</div>}
            </>
          )}
        </div>
        {!launching && (
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button variant="amber" icon="bolt" disabled={!canLaunch} onClick={launch}>Lanzar Work Mode</Button>
          </ModalFooter>
        )}
      </ModalCard>
    </Overlay>
  );
}
