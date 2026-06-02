import { useState } from 'react';

import type { ServiceConfig, ServiceKind, PortStrategy } from '../../domain/projects';
import { Button, Divider, Field, IconButton, Input, Segmented, Toggle } from '../../ui/primitives';
import { Icon } from '../../ui/icons';
import { Overlay, ModalCard, ModalHeader, ModalFooter } from '../../ui/overlays';

const KINDS: ServiceKind[] = ['backend', 'frontend', 'database', 'worker', 'custom'];

const PORT_STRATEGIES: { value: PortStrategy; label: string }[] = [
  { value: 'argument', label: '--port' },
  { value: 'env', label: 'PORT env' },
  { value: 'none', label: 'Ninguno' },
  { value: 'manual', label: 'Manual' },
];

type EnvPair = { key: string; value: string };

const recordToPairs = (env?: Record<string, string>): EnvPair[] => Object.entries(env ?? {}).map(([key, value]) => ({ key, value }));
const pairsToRecord = (pairs: EnvPair[]): Record<string, string> | undefined => {
  const entries = pairs.filter((p) => p.key.trim());
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries.map((p) => [p.key.trim(), p.value]));
};

function portHint(strategy: PortStrategy): string {
  if (strategy === 'argument') return 'El puerto se inyecta como argumento (--port). Smart ports puede reasignarlo.';
  if (strategy === 'env') return 'El puerto se pasa por la variable de entorno PORT.';
  if (strategy === 'manual') return 'No se adapta automáticamente; lo gestionas tú.';
  return 'Sin gestión de puerto.';
}

export function CommandEditor({ service, onClose, onSave }: { service: ServiceConfig; onClose: () => void; onSave: (s: ServiceConfig) => void }) {
  const [label, setLabel] = useState(service.label);
  const [kind, setKind] = useState<ServiceKind>(service.kind);
  const [url, setUrl] = useState(service.url ?? '');
  const [executable, setExecutable] = useState(service.command.executable);
  const [cwd, setCwd] = useState(service.command.workingDirectory);
  const [args, setArgs] = useState<string[]>([...service.command.args]);
  const [strategy, setStrategy] = useState<PortStrategy>(service.command.portStrategy ?? 'argument');
  const [preferredPort, setPreferredPort] = useState<number | undefined>(service.command.preferredPort);
  const [env, setEnv] = useState<EnvPair[]>(recordToPairs(service.command.env));
  const [risky, setRisky] = useState(service.command.risky ?? false);

  const setArg = (i: number, v: string) => setArgs((p) => p.map((a, j) => (j === i ? v : a)));
  const setEnvAt = (i: number, patch: Partial<EnvPair>) => setEnv((p) => p.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const save = () => {
    onSave({
      ...service,
      label,
      kind,
      url: url.trim() || undefined,
      command: {
        ...service.command,
        label,
        executable: executable.trim(),
        workingDirectory: cwd,
        args: args.map((a) => a.trim()).filter(Boolean),
        portStrategy: strategy,
        preferredPort,
        env: pairsToRecord(env),
        risky,
      },
    });
  };

  return (
    <Overlay onClose={onClose}>
      <ModalCard width={560}>
        <ModalHeader icon="terminal" title={<span>Editar comando · <span style={{ color: 'var(--brand-bright)' }}>{label}</span></span>} sub="Define cómo arranca este servicio y cómo se elige su puerto." onClose={onClose} />
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><Field label="Nombre"><Input value={label} onChange={setLabel} /></Field></div>
            <div style={{ flex: '0 0 150px' }}>
              <Field label="Tipo">
                <select value={kind} onChange={(e) => setKind(e.target.value as ServiceKind)} style={{ width: '100%', padding: '8px 11px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: '0 0 160px' }}><Field label="Ejecutable"><Input value={executable} onChange={setExecutable} mono /></Field></div>
            <div style={{ flex: 1 }}><Field label="Directorio de trabajo" hint="Relativo o absoluto"><Input value={cwd} onChange={setCwd} mono icon="folder" /></Field></div>
          </div>

          <Field label="Argumentos" right={<Button size="sm" variant="ghost" icon="plus" onClick={() => setArgs((p) => [...p, ''])}>Añadir arg</Button>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {args.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-ghost)', padding: '4px 2px' }}>Sin argumentos</div>}
              {args.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-ghost)', width: 18 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}><Input value={a} onChange={(v) => setArg(i, v)} mono style={{ padding: '6px 10px' }} /></div>
                  <IconButton name="x" size={14} box={28} title="Quitar" onClick={() => setArgs((p) => p.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
          </Field>
          <div style={{ padding: '9px 11px', borderRadius: 'var(--r)', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)' }}>
            <div className="upper" style={{ fontSize: 10, color: 'var(--text-ghost)', fontWeight: 700, marginBottom: 4 }}>Vista previa</div>
            <code className="mono" style={{ fontSize: 12.5, color: 'var(--text)', background: 'none', border: 'none', padding: 0 }}>$ {executable} {args.filter(Boolean).join(' ')}</code>
          </div>

          <Divider />
          <Field label="Estrategia de puerto" hint={portHint(strategy)}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Segmented value={strategy} onChange={setStrategy} options={PORT_STRATEGIES} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-faint)' }}>
                Preferido
                <input value={preferredPort ?? ''} onChange={(e) => setPreferredPort(e.target.value ? Number(e.target.value) : undefined)} placeholder="—" className="mono" style={{ width: 70, padding: '7px 9px', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 13 }} />
              </div>
            </div>
          </Field>
          <Field label="URL del servicio" hint="Se abre en Work Mode cuando el servicio está activo">
            <Input value={url} onChange={setUrl} mono icon="link" placeholder="http://localhost:3000" />
          </Field>

          <Divider />
          <Field label="Variables de entorno" right={<Button size="sm" variant="ghost" icon="plus" onClick={() => setEnv((p) => [...p, { key: '', value: '' }])}>Añadir var</Button>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {env.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-ghost)', padding: '4px 2px' }}>Sin variables</div>}
              {env.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ flex: '0 0 150px' }}><Input value={e.key} onChange={(v) => setEnvAt(i, { key: v })} mono placeholder="KEY" style={{ padding: '6px 9px' }} /></div>
                  <div style={{ flex: 1 }}><Input value={e.value} onChange={(v) => setEnvAt(i, { value: v })} mono placeholder="valor" style={{ padding: '6px 9px' }} /></div>
                  <IconButton name="x" size={14} box={28} title="Quitar" onClick={() => setEnv((p) => p.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
          </Field>

          <Divider />
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <Toggle on={risky} onChange={setRisky} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="alert" size={14} style={{ color: 'var(--st-failed)' }} />Marcar como riesgoso</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 1 }}>Requiere confirmación antes de ejecutar en Work Mode</div>
            </div>
          </label>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={save}>Guardar comando</Button>
        </ModalFooter>
      </ModalCard>
    </Overlay>
  );
}
