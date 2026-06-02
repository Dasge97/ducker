import { useEffect, useMemo, useRef, useState } from 'react';

import type { CommandStatus } from '../domain/projects';
import { Icon, type IconName } from './icons';
import { Kbd, StatusDot } from './primitives';
import { Overlay } from './overlays';

export type Command = {
  id: string;
  group?: string;
  icon?: IconName;
  dot?: CommandStatus;
  label: string;
  detail?: string;
  keywords?: string;
  shortcut?: string[];
  run: () => void;
};

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return commands;
    return commands.filter((c) => (c.label + ' ' + (c.group ?? '') + ' ' + (c.keywords ?? '')).toLowerCase().includes(t));
  }, [q, commands]);

  useEffect(() => { setSel(0); }, [q]);

  const run = (c?: Command) => { if (!c) return; onClose(); c.run(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[sel]); }
  };

  const groups: { name: string; items: Command[] }[] = [];
  filtered.forEach((c) => {
    const name = c.group ?? 'Acciones';
    let g = groups.find((x) => x.name === name);
    if (!g) { g = { name, items: [] }; groups.push(g); }
    g.items.push(c);
  });
  let flatIndex = -1;

  return (
    <Overlay onClose={onClose} align="top">
      <div
        onKeyDown={onKey}
        style={{ width: '100%', maxWidth: 580, background: 'var(--bg)', border: '1px solid var(--border-loud)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-overlay)', overflow: 'hidden', animation: 'pop-in .16s cubic-bezier(.2,.8,.3,1)', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--border-soft)' }}>
          <Icon name="search" size={17} style={{ color: 'var(--text-faint)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Escribe un comando o busca proyectos…"
            style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 15, color: 'var(--text)', padding: 0 }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div style={{ overflowY: 'auto', padding: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Sin comandos</div>
          ) : (
            groups.map((g) => (
              <div key={g.name} style={{ marginBottom: 4 }}>
                <div className="upper" style={{ fontSize: 10.5, color: 'var(--text-ghost)', fontWeight: 700, padding: '8px 10px 4px' }}>{g.name}</div>
                {g.items.map((c) => {
                  flatIndex++;
                  const idx = flatIndex;
                  const active = idx === sel;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setSel(idx)}
                      onClick={() => run(c)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 'var(--r)', background: active ? 'var(--surface-2)' : 'transparent', textAlign: 'left', boxShadow: active ? 'inset 0 0 0 1px var(--border)' : 'none' }}
                    >
                      <span style={{ color: active ? 'var(--brand-bright)' : 'var(--text-faint)', display: 'flex' }}>
                        {c.dot ? <StatusDot status={c.dot} size={9} /> : <Icon name={c.icon ?? 'arrowRight'} size={16} />}
                      </span>
                      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>
                        {c.label}
                        {c.detail && <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 11.5, marginLeft: 8 }}>{c.detail}</span>}
                      </span>
                      {c.shortcut && <span style={{ display: 'flex', gap: 3 }}>{c.shortcut.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 14px', borderTop: '1px solid var(--border-soft)', fontSize: 11.5, color: 'var(--text-ghost)', background: 'var(--bg-deep)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Kbd>↑</Kbd><Kbd>↓</Kbd> navegar</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Kbd>↵</Kbd> ejecutar</span>
        </div>
      </div>
    </Overlay>
  );
}
