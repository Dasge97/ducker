import { useMemo, useState } from 'react';

import type { CommandStatus, ManagedProject } from '../../domain/projects';
import { Button, Divider, Empty, Input, Segmented, StatusDot } from '../../ui/primitives';
import { Icon } from '../../ui/icons';
import { toProjectView, type ProjectView } from '../runtime/serviceView';
import { useRuntime } from '../runtime/RuntimeContext';

type Filter = 'all' | 'running' | 'failed';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'running', label: 'Activos' },
  { value: 'failed', label: 'Con fallos' },
];

function pillStyle(color: string) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color,
    whiteSpace: 'nowrap' as const, flexShrink: 0, padding: '2px 8px', borderRadius: 100,
    background: `color-mix(in oklch, ${color} 14%, transparent)`,
  };
}

function HealthPill({ view }: { view: ProjectView }) {
  const c = view.counts;
  if (c.failed) return <span style={pillStyle('var(--st-failed)')}><StatusDot status="failed" size={6} />{c.failed} con fallo</span>;
  if (c.running) return <span style={pillStyle('var(--st-running)')}><StatusDot status="running" size={6} />{c.running} activos</span>;
  if (c.starting) return <span style={pillStyle('var(--st-starting)')}><StatusDot status="starting" size={6} />{c.starting} arrancando</span>;
  return <span style={{ ...pillStyle('var(--text-faint)'), background: 'transparent' }}>{view.services.length} en reposo</span>;
}

function DotStrip({ view, max = 8 }: { view: ProjectView; max?: number }) {
  const shown = view.services.slice(0, max);
  const extra = view.services.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {shown.map((s) => <span key={s.id} title={`${s.name} · ${s.status}`}><StatusDot status={s.status} size={7} /></span>)}
      {extra > 0 && <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-ghost)' }}>+{extra}</span>}
    </div>
  );
}

function ProjectGridCard({ view, onOpen, onWork }: { view: ProjectView; onOpen: () => void; onWork: () => void }) {
  const [hover, setHover] = useState(false);
  const p = view.project;
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      style={{
        background: 'var(--surface)', border: `1px solid ${hover ? 'var(--border-loud)' : 'var(--border-soft)'}`,
        borderRadius: 'var(--r-md)', padding: 15, cursor: 'pointer', transition: 'border-color .12s, transform .08s',
        transform: hover ? 'translateY(-2px)' : 'none', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 138,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.path}</div>
        </div>
        <HealthPill view={view} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="layers" size={13} style={{ color: 'var(--text-ghost)' }} />{view.stackLabel}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DotStrip view={view} />
          <span style={{ fontSize: 11, color: 'var(--text-ghost)' }}>{view.services.length} svc</span>
        </div>
        {hover && <Button size="sm" variant="amber" icon="bolt" onClick={(e) => { e.stopPropagation(); onWork(); }}>Work</Button>}
      </div>
    </div>
  );
}

function ProjectListRow({ view, onOpen, onWork }: { view: ProjectView; onOpen: () => void; onWork: () => void }) {
  const [hover, setHover] = useState(false);
  const p = view.project;
  const cols = '20px minmax(160px,1.4fr) minmax(120px,1fr) 130px 120px 96px';
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      style={{
        display: 'grid', gridTemplateColumns: cols, alignItems: 'center', gap: 14, padding: '11px 14px', cursor: 'pointer',
        background: hover ? 'var(--surface)' : 'transparent', borderRadius: 'var(--r)',
        boxShadow: hover ? 'inset 0 0 0 1px var(--border-soft)' : 'none', transition: 'background .1s',
      }}
    >
      <span />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 650, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.path}</div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{view.stackLabel}</div>
      <HealthPill view={view} />
      <DotStrip view={view} max={6} />
      <div style={{ textAlign: 'right' }}>
        {hover && <Button size="sm" variant="amber" icon="bolt" onClick={(e) => { e.stopPropagation(); onWork(); }}>Work</Button>}
      </div>
    </div>
  );
}

type Props = {
  projects: ManagedProject[];
  view: 'grid' | 'list';
  setView: (v: 'grid' | 'list') => void;
  onOpen: (p: ManagedProject) => void;
  onAdd: () => void;
  onWork: (p: ManagedProject) => void;
};

export function ProjectsOverview({ projects, view, setView, onOpen, onAdd, onWork }: Props) {
  const { statusOf, tick } = useRuntime();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const views = useMemo(
    () => projects.map((p) => toProjectView(p, statusOf)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, tick],
  );

  const filtered = useMemo(() => {
    let list = views;
    if (filter === 'running') list = list.filter((v) => v.anyRunning);
    else if (filter === 'failed') list = list.filter((v) => (v.counts.failed ?? 0) > 0);
    const t = query.trim().toLowerCase();
    if (t) list = list.filter((v) => (v.project.name + ' ' + v.project.path + ' ' + v.stackLabel).toLowerCase().includes(t));
    return list;
  }, [views, query, filter]);

  const totalRunning = views.reduce((n, v) => n + v.runningCount, 0);
  const cols = '20px minmax(160px,1.4fr) minmax(120px,1fr) 130px 120px 96px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 26px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1>Proyectos</h1>
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 2 }}>
              {projects.length} proyectos · <span style={{ color: totalRunning ? 'var(--st-running)' : 'var(--text-faint)' }}>{totalRunning} servicios activos</span>
            </div>
          </div>
          <Button variant="primary" icon="folderPlus" onClick={onAdd}>Añadir proyecto</Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, maxWidth: 380 }}>
            <Input value={query} onChange={setQuery} placeholder="Buscar proyectos, rutas, stacks…" icon="search" />
          </div>
          <Segmented value={filter} onChange={setFilter} size="sm" options={FILTERS} />
          <div style={{ flex: 1 }} />
          <Segmented value={view} onChange={setView} size="sm" options={[{ value: 'grid', icon: 'grid' }, { value: 'list', icon: 'list' }]} />
        </div>
      </div>
      <Divider />
      <div style={{ flex: 1, overflowY: 'auto', padding: view === 'grid' ? '18px 26px 26px' : '8px 18px 26px' }}>
        {filtered.length === 0 ? (
          <Empty
            icon="search"
            title="Sin coincidencias"
            body={query ? `Nada coincide con “${query}”.` : 'No hay proyectos en este filtro.'}
            action={<Button variant="ghost" size="sm" onClick={() => { setQuery(''); setFilter('all'); }}>Limpiar filtros</Button>}
          />
        ) : view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map((v) => <ProjectGridCard key={v.project.id} view={v} onOpen={() => onOpen(v.project)} onWork={() => onWork(v.project)} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="upper" style={{ display: 'grid', gridTemplateColumns: cols, gap: 14, padding: '4px 14px 8px', fontSize: 10.5, color: 'var(--text-ghost)', fontWeight: 700 }}>
              <span /><span>Proyecto</span><span>Stack</span><span>Estado</span><span>Servicios</span><span style={{ textAlign: 'right' }} />
            </div>
            {filtered.map((v) => <ProjectListRow key={v.project.id} view={v} onOpen={() => onOpen(v.project)} onWork={() => onWork(v.project)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyProjects({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <img src="/ducker-logo.png" alt="Ducker" width={156} height={156} style={{ objectFit: 'contain', animation: 'bob 4s ease-in-out infinite', filter: 'drop-shadow(0 12px 28px oklch(0.65 0.205 332 / 0.32))' }} />
      <h1 style={{ fontSize: 26, marginTop: 18 }}>Pon tus proyectos en marcha</h1>
      <p style={{ fontSize: 14.5, color: 'var(--text-dim)', maxWidth: 440, marginTop: 8, lineHeight: 1.55 }}>
        Apunta Ducker a una carpeta. Detecta el stack, mapea cada servicio a un puerto y te lleva a <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Work Mode</span> en un clic.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <Button variant="primary" size="lg" icon="folderPlus" onClick={onAdd}>Añadir un proyecto</Button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 26, fontSize: 12.5, color: 'var(--text-ghost)' }}>
        o pulsa <kbd>Ctrl</kbd><kbd>K</kbd> en cualquier momento
      </div>
    </div>
  );
}
