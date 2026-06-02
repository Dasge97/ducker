import { useEffect, useMemo, useState } from 'react';

import { listPorts, type PortInfo } from '../../services/native';
import { Button, Empty, Input, Spinner } from '../../ui/primitives';
import { Icon } from '../../ui/icons';

// A few well-known dev ports get a friendly label, purely cosmetic.
const KNOWN: Record<number, string> = {
  3000: 'Next.js / Node', 4200: 'Angular', 5173: 'Vite', 5432: 'PostgreSQL', 3306: 'MySQL',
  6379: 'Redis', 8000: 'Symfony / HTTP', 8069: 'Odoo', 8080: 'HTTP alt', 1025: 'Mailer', 1080: 'Mailer UI', 27017: 'MongoDB',
};

const DEV = ['docker', 'node', 'php', 'symfony', 'python', 'java', 'ruby', 'go', 'nginx', 'httpd', 'apache', 'mysqld', 'mariadb', 'postgres', 'pg_ctl', 'redis', 'mongod', 'dotnet', 'caddy', 'vite', 'deno', 'bun'];
const EDITOR = ['code', 'onedrive', 'msedge', 'chrome', 'firefox', 'slack', 'teams', 'discord', 'webview'];

type Category = 'dev' | 'editor' | 'system';

function categorize(p: PortInfo): Category {
  const proc = p.process.toLowerCase();
  if (DEV.some((d) => proc.includes(d)) || KNOWN[p.port]) return 'dev';
  if (EDITOR.some((e) => proc.includes(e))) return 'editor';
  if (p.port >= 49152 || proc === 'system' || proc.includes('svchost') || proc.includes('lsass') || proc.includes('wininit') || proc.includes('services')) return 'system';
  return 'dev';
}

function portColor(p: PortInfo): string {
  const proc = p.process.toLowerCase();
  if (proc.includes('docker')) return 'var(--st-completed)';
  if (proc.includes('node')) return 'var(--st-running)';
  if (proc.includes('php') || proc.includes('symfony')) return 'var(--brand)';
  if (proc === '?' || !proc) return 'var(--text-ghost)';
  return 'var(--amber)';
}

const GROUPS: { key: Category; label: string; defaultOpen: boolean }[] = [
  { key: 'dev', label: 'Desarrollo', defaultOpen: true },
  { key: 'editor', label: 'Editor y herramientas', defaultOpen: true },
  { key: 'system', label: 'Sistema', defaultOpen: false },
];

function PortCard({ p }: { p: PortInfo }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 8, height: 40, borderRadius: 4, background: portColor(p), flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="mono" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)' }}>:{p.port}</div>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.process || '—'}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
          PID <span className="mono">{p.pid}</span>
          {KNOWN[p.port] ? <span style={{ marginLeft: 8, color: 'var(--text-ghost)' }}>· {KNOWN[p.port]}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function PortsView() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<Category, boolean>>({ dev: true, editor: true, system: false });

  const load = () => {
    setLoading(true);
    setError(null);
    listPorts()
      .then((list) => setPorts(list.sort((a, b) => a.port - b.port)))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const grouped = useMemo(() => {
    const t = query.trim().toLowerCase();
    const filtered = t
      ? ports.filter((p) => String(p.port).includes(t) || p.process.toLowerCase().includes(t) || String(p.pid).includes(t))
      : ports;
    const buckets: Record<Category, PortInfo[]> = { dev: [], editor: [], system: [] };
    for (const p of filtered) buckets[categorize(p)].push(p);
    return buckets;
  }, [ports, query]);

  const searching = query.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 26px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1>Puertos</h1>
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 2 }}>
              {loading ? 'Escaneando…' : `${ports.length} puertos en escucha en esta máquina`}
            </div>
          </div>
          <Button variant="default" icon="restart" onClick={load} disabled={loading}>Refrescar</Button>
        </div>
        <div style={{ maxWidth: 380 }}>
          <Input value={query} onChange={setQuery} placeholder="Filtrar por puerto, proceso o PID…" icon="search" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 26px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {loading && ports.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-faint)', padding: 24 }}><Spinner size={16} />Escaneando puertos…</div>
        ) : error ? (
          <Empty icon="alert" title="No se pudieron leer los puertos" body={error} action={<Button size="sm" variant="ghost" onClick={load}>Reintentar</Button>} />
        ) : ports.length === 0 ? (
          <Empty icon="port" title="Sin puertos en escucha" />
        ) : (
          GROUPS.map((g) => {
            const items = grouped[g.key];
            if (items.length === 0) return null;
            const expanded = searching || open[g.key];
            return (
              <section key={g.key}>
                <button
                  onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px 10px', background: 'none', width: '100%' }}
                >
                  <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={15} style={{ color: 'var(--text-faint)' }} />
                  <span className="upper" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{g.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-ghost)', background: 'var(--surface-2)', borderRadius: 100, padding: '1px 8px' }}>{items.length}</span>
                </button>
                {expanded && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {items.map((p) => <PortCard key={`${p.port}-${p.pid}`} p={p} />)}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
