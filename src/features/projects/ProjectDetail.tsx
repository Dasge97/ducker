import { useEffect, useMemo, useRef, useState } from 'react';

import type { ManagedProject, SmartLaunchPlan } from '../../domain/projects';
import { openUrl, planSmartLaunch, startCommand, startSmartLaunch, stopCommand } from '../../services/native';
import { Button, IconButton, Input, Segmented, Spinner, StatusDot, TypeTag, Toggle, Divider } from '../../ui/primitives';
import { Icon } from '../../ui/icons';
import { useRuntime } from '../runtime/RuntimeContext';
import { toProjectView, type ServiceView } from '../runtime/serviceView';

type Toast = (msg: string, kind?: 'ok' | 'danger') => void;

function PortBadge({ s }: { s: ServiceView }) {
  if (s.portState === 'manual') {
    return (
      <span title="El puerto necesita resolución manual" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 'var(--r-sm)', background: 'var(--st-failed-bg)', border: '1px solid var(--st-failed)', color: 'var(--st-failed)', fontSize: 11.5, fontWeight: 600 }}>
        <Icon name="alert" size={12} />puerto
      </span>
    );
  }
  if (s.portState === 'reassigned') {
    return (
      <span title={`Preferido ${s.preferredPort} ocupado → reasignado`} className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--amber)', fontWeight: 600 }}>
        <span style={{ color: 'var(--text-ghost)', textDecoration: 'line-through' }}>{s.preferredPort}</span>
        <Icon name="arrowRight" size={11} />:{s.assignedPort}
      </span>
    );
  }
  if (s.assignedPort) return <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>:{s.assignedPort}</span>;
  return <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-ghost)' }}>—</span>;
}

function ServiceItem({ s, error, liveUrl, selected, onSelect, onToggle, onEdit, onOpenUrl }: { s: ServiceView; error?: string; liveUrl?: string; selected: boolean; onSelect: () => void; onToggle: () => void; onEdit: () => void; onOpenUrl: () => void }) {
  const [hover, setHover] = useState(false);
  const running = s.status === 'running';
  const busy = s.status === 'starting';
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '11px 12px', borderRadius: 'var(--r)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
        background: selected || hover ? 'var(--surface)' : 'transparent',
        boxShadow: selected ? 'inset 0 0 0 1px var(--brand-line)' : hover ? 'inset 0 0 0 1px var(--border-soft)' : 'inset 0 0 0 1px transparent',
        transition: 'background .1s, box-shadow .1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <StatusDot status={s.status} size={9} />
        <span style={{ fontSize: 13.5, fontWeight: 650, flexShrink: 0 }}>{s.name}</span>
        <TypeTag type={s.kind} />
        {s.risky && <span title="Marcado como riesgoso" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--st-failed)', fontSize: 11, fontWeight: 600 }}><Icon name="alert" size={12} />risky</span>}
        <div style={{ flex: 1 }} />
        <div onClick={(e) => e.stopPropagation()}>
          {running || busy ? (
            <Button size="sm" variant="default" icon={busy ? undefined : 'stop'} onClick={onToggle} style={busy ? { color: 'var(--amber)' } : {}}>
              {busy ? <><Spinner size={12} color="var(--amber)" /><span style={{ marginLeft: 6 }}>Parar</span></> : 'Parar'}
            </Button>
          ) : (
            <Button size="sm" variant="default" icon="play" onClick={onToggle} style={{ color: 'var(--st-running)' }}>Arrancar</Button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 18 }}>
        <code className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, background: 'none', border: 'none', padding: 0 }}>
          {s.executable} {s.args.join(' ')}
        </code>
        <PortBadge s={s} />
        {liveUrl && running && (
          <button onClick={(e) => { e.stopPropagation(); onOpenUrl(); }} title={liveUrl} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--brand-bright)', fontWeight: 600, background: 'none' }}>
            <Icon name="external" size={12} />abrir
          </button>
        )}
        <IconButton name="edit" size={14} box={24} title="Editar comando" onClick={(e) => { (e as React.MouseEvent).stopPropagation(); onEdit(); }} />
      </div>
      {s.status === 'failed' && error && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginLeft: 18, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: 'var(--st-failed-bg)', border: '1px solid var(--st-failed)' }}>
          <Icon name="alertCircle" size={14} style={{ color: 'var(--st-failed)', marginTop: 1, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-dim)' }}>{error}</span>
          <Button size="sm" variant="outline" icon="edit" onClick={onEdit}>Editar</Button>
        </div>
      )}
      {selected && s.warnings.length > 0 && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {s.warnings.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11.5, color: s.status === 'failed' ? 'var(--st-failed)' : 'var(--amber)' }}>
              <Icon name="info" size={12} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-dim)' }}>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const LOG_COLORS: Record<string, string> = { info: 'var(--text-dim)', dim: 'var(--text-faint)', ok: 'var(--st-running)', warn: 'var(--amber)', err: 'var(--st-failed)' };

function LogViewer({ project, service }: { project: ManagedProject; service?: ServiceView }) {
  const { logsOf, clearLogs, tick } = useRuntime();
  const [follow, setFollow] = useState(true);
  const [wrap, setWrap] = useState(true);
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<'all' | 'warn' | 'err'>('all');
  const bodyRef = useRef<HTMLDivElement>(null);

  const logs = service ? logsOf(project.id, service.commandId) : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shown = useMemo(() => logs.filter((l) => l.text.trim() !== '' && (level === 'all' || l.level === level) && (!q || l.text.toLowerCase().includes(q.toLowerCase()))), [logs.length, level, q, tick]);

  useEffect(() => { if (follow && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [shown.length, follow]);

  if (!service) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-ghost)', fontSize: 13 }}>Selecciona un servicio para ver sus logs</div>;

  const idle = service.status === 'idle' || service.status === 'stopped';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-deep)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--border-soft)' }}>
        <StatusDot status={service.status} size={9} />
        <span style={{ fontSize: 13, fontWeight: 650 }}>{service.name}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-ghost)' }}>logs</span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 150 }}><Input value={q} onChange={setQ} placeholder="Filtrar" icon="search" style={{ padding: '5px 9px 5px 28px', fontSize: 12 }} /></div>
        <Segmented size="sm" value={level} onChange={setLevel} options={[{ value: 'all', label: 'Todo' }, { value: 'warn', label: 'Warn' }, { value: 'err', label: 'Err' }]} />
        <IconButton name="list" size={15} title="Ajuste de línea" active={wrap} onClick={() => setWrap((w) => !w)} />
        <IconButton name="trash" size={15} title="Limpiar" onClick={() => clearLogs(project.id, service.commandId)} />
      </div>
      <div ref={bodyRef} onWheel={() => setFollow(false)} className="mono" style={{ flex: 1, overflow: 'auto', padding: '8px 0', fontSize: 12, lineHeight: 1.65 }}>
        {idle && logs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-ghost)', fontFamily: 'var(--font-ui)' }}>
            <Icon name="terminal" size={24} />
            <span style={{ fontSize: 13 }}>{service.status === 'stopped' ? 'Servicio parado — sin salida en vivo' : 'Servicio en reposo — arráncalo para ver logs'}</span>
          </div>
        ) : (
          shown.map((l) => (
            <div key={l.id} style={{ display: 'flex', gap: 12, padding: '0 14px', whiteSpace: wrap ? 'pre-wrap' : 'pre' }}>
              <span style={{ color: 'var(--text-ghost)', flexShrink: 0, userSelect: 'none' }}>{l.ts}</span>
              <span style={{ color: LOG_COLORS[l.level] ?? 'var(--text-dim)', flex: wrap ? 1 : 'none' }}>{l.text}</span>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg)' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-ghost)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>$ {service.executable} {service.args.join(' ')}</span>
        <span style={{ fontSize: 11, color: 'var(--text-ghost)', display: 'flex', alignItems: 'center', gap: 6 }}>Seguir<Toggle on={follow} onChange={setFollow} /></span>
      </div>
    </div>
  );
}

type Props = {
  project: ManagedProject;
  onBack: () => void;
  onEditService: (serviceId: string) => void;
  onWork: (p: ManagedProject) => void;
  onDelete: (p: ManagedProject) => void;
  onSnapshot: () => void;
  onToast: Toast;
};

export function ProjectDetail({ project, onBack, onEditService, onWork, onDelete, onSnapshot, onToast }: Props) {
  const { statusOf, errorOf, detectedUrlOf, tick } = useRuntime();
  const [plan, setPlan] = useState<SmartLaunchPlan | null>(null);
  const [menu, setMenu] = useState(false);
  const [selId, setSelId] = useState(project.services[0]?.id);
  const [leftW, setLeftW] = useState(480);
  const paneRef = useRef<HTMLDivElement>(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftW;
    const total = paneRef.current?.clientWidth ?? window.innerWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(300, Math.min(startW + (ev.clientX - startX), total - 360));
      setLeftW(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    setSelId((cur) => cur ?? project.services[0]?.id);
    if (!project.smartPortsEnabled) { setPlan(null); return; }
    planSmartLaunch(project.id).then(setPlan).catch(() => setPlan(null));
  }, [project.id, project.smartPortsEnabled, project.services]);

  const view = useMemo(
    () => toProjectView(project, statusOf, plan),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, plan, tick],
  );
  const selected = view.services.find((s) => s.id === selId) ?? view.services[0];

  const guard = async (fn: () => Promise<unknown>, okMsg?: string) => {
    try { await fn(); if (okMsg) onToast(okMsg); }
    catch (e) { onToast(e instanceof Error ? e.message : String(e), 'danger'); }
  };

  const toggle = (s: ServiceView) => {
    if (s.status === 'running' || s.status === 'starting') return guard(() => stopCommand(project.id, s.commandId));
    return guard(() => startCommand(project.id, s.commandId));
  };
  const startAll = () => {
    if (project.smartPortsEnabled) return guard(async () => {
      const p = await startSmartLaunch(project.id);
      setPlan(p);
      if (p.blocked) onToast('Lanzamiento bloqueado: revisa los puertos', 'danger');
    });
    return guard(() => Promise.all(view.services.filter((s) => s.enabled).map((s) => startCommand(project.id, s.commandId))));
  };
  const stopAll = () => guard(() => Promise.all(view.services.map((s) => stopCommand(project.id, s.commandId))));

  const STATUS_ORDER: ServiceView['status'][] = ['running', 'starting', 'failed', 'completed', 'stopped', 'idle'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconButton name="arrowLeft" title="Volver (Esc)" onClick={onBack} box={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <h1 style={{ fontSize: 19, whiteSpace: 'nowrap', flexShrink: 0 }}>{project.name}</h1>
              <span style={{ fontSize: 12.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{view.stackLabel}</span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>{project.path}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            {view.anyRunning
              ? <Button variant="default" icon="stop" onClick={stopAll}>Parar todo</Button>
              : <Button variant="default" icon="play" onClick={startAll}>Arrancar todo</Button>}
            <Button variant="amber" icon="bolt" onClick={() => onWork(project)}>Work Mode</Button>
            <IconButton name="more" title="Más" onClick={() => setMenu((m) => !m)} box={34} active={menu} />
            {menu && (
              <div onMouseLeave={() => setMenu(false)} style={{ position: 'absolute', top: 40, right: 0, zIndex: 20, width: 210, background: 'var(--bg)', border: '1px solid var(--border-loud)', borderRadius: 'var(--r)', boxShadow: 'var(--shadow-pop)', padding: 5, animation: 'pop-in .12s ease' }}>
                <button onClick={() => { setMenu(false); onSnapshot(); }} style={menuItem()}><Icon name="shield" size={15} style={{ color: 'var(--text-faint)' }} />Revisar snapshot IA</button>
                <Divider style={{ margin: '5px 0' }} />
                <button onClick={() => { setMenu(false); onDelete(project); }} style={{ ...menuItem(), color: 'var(--st-failed)' }}><Icon name="trash" size={15} />Eliminar proyecto</button>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_ORDER.filter((k) => view.counts[k]).map((k) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
              <StatusDot status={k} size={7} /><span className="tnum">{view.counts[k]}</span> {k}
            </span>
          ))}
          <div style={{ flex: 1 }} />
          {view.hasManualPort && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--st-failed)', fontWeight: 600 }}><Icon name="alert" size={13} />Lanzamiento bloqueado — un puerto necesita resolución</span>}
        </div>
      </div>
      <div ref={paneRef} style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: leftW, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="upper" style={{ padding: '12px 16px 6px', fontSize: 10.5, color: 'var(--text-ghost)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap' }}>
            <span>Servicios · {view.services.length}</span>
            {project.smartPortsEnabled && <span>Smart ports</span>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {view.services.length === 0 && <p className="muted" style={{ padding: '8px 12px' }}>Sin servicios. Edita el proyecto para añadirlos.</p>}
            {view.services.map((s) => (
              <ServiceItem
                key={s.id}
                s={s}
                error={errorOf(project.id, s.commandId)}
                liveUrl={detectedUrlOf(project.id, s.commandId) ?? s.url}
                selected={s.id === selId}
                onSelect={() => setSelId(s.id)}
                onToggle={() => toggle(s)}
                onEdit={() => onEditService(s.id)}
                onOpenUrl={() => { const u = detectedUrlOf(project.id, s.commandId) ?? s.url; if (u) guard(() => openUrl(u)); }}
              />
            ))}
          </div>
        </div>
        <div className="splitter" onMouseDown={startResize} title="Arrastra para redimensionar" />
        <div style={{ flex: 1, minWidth: 0 }}><LogViewer project={project} service={selected} /></div>
      </div>
    </div>
  );
}

function menuItem(): React.CSSProperties {
  return { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', borderRadius: 'var(--r-sm)', fontSize: 13, color: 'var(--text)', textAlign: 'left', background: 'none' };
}
