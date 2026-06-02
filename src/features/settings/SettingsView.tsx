import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { AppSettings } from '../../domain/settings';
import { loadSettings, saveSettings } from '../../services/native';
import { Button, Divider, Field, Input, Toggle } from '../../ui/primitives';
import { Icon, type IconName } from '../../ui/icons';

function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2, lineHeight: 1.45 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
        <Icon name={icon} size={16} style={{ color: 'var(--brand-bright)' }} />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</span>
      </div>
      <div style={{ padding: '4px 18px' }}>{children}</div>
    </div>
  );
}

export function SettingsView({ onSaved, appInfo }: { onSaved: (s: AppSettings) => void; appInfo?: string }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadSettings().then(setSettings).catch(() => undefined); }, []);

  if (!settings) return <div style={{ padding: 40, color: 'var(--text-faint)' }}>Cargando settings…</div>;

  const set = (patch: Partial<AppSettings>) => { setSettings({ ...settings, ...patch }); setSaved(false); };
  const setAi = (patch: Partial<AppSettings['ai']>) => { setSettings({ ...settings, ai: { ...settings.ai, ...patch } }); setSaved(false); };
  const ai = settings.ai;

  const save = async () => {
    setSaving(true);
    try {
      const persisted = await saveSettings({ ...settings, ai: { ...settings.ai, apiKeyInput } });
      setSettings(persisted);
      setApiKeyInput('');
      onSaved(persisted);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const keyDisplay = apiKeyInput
    ? (showKey ? apiKeyInput : '•'.repeat(Math.min(apiKeyInput.length, 20)))
    : ai.apiKeyConfigured ? (ai.apiKeyMasked ?? '••••••••') : '';

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 26px 60px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1>Settings</h1>
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 2 }}>Almacenado localmente en esta máquina{appInfo ? ` · ${appInfo}` : ''}</div>
          </div>
          <Button variant="primary" icon={saved ? 'check' : undefined} disabled={saving} onClick={save}>{saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar settings'}</Button>
        </div>

        <SectionCard icon="edit" title="General">
          <Row title="Comando del editor" sub="Usado por Work Mode para abrir la carpeta del proyecto">
            <div style={{ width: 240 }}><Input value={settings.editorCommand} onChange={(v) => set({ editorCommand: v })} mono icon="terminal" /></div>
          </Row>
          <Divider />
          <Row title="Confirmar comandos riesgosos" sub="Preguntar antes de ejecutar comandos marcados como riesgosos (migraciones, resets…)">
            <Toggle on={settings.confirmRiskyCommands} onChange={(v) => set({ confirmRiskyCommands: v })} />
          </Row>
        </SectionCard>

        <SectionCard icon="bolt" title="Work Mode">
          <Row title="Abrir URL del backend" sub="Abre la URL del backend al entrar en Work Mode">
            <Toggle on={settings.openBackendUrlOnWorkMode} onChange={(v) => set({ openBackendUrlOnWorkMode: v })} />
          </Row>
          <Divider />
          <Row title="Abrir URL del frontend" sub="Abre la URL del frontend al entrar en Work Mode">
            <Toggle on={settings.openFrontendUrlOnWorkMode} onChange={(v) => set({ openFrontendUrlOnWorkMode: v })} />
          </Row>
        </SectionCard>

        <SectionCard icon="sparkle" title="Detección de stack con IA">
          <Row title="Habilitar detección IA" sub="Usa un modelo para inferir servicios, comandos y puertos desde los manifiestos">
            <Toggle on={ai.enabled} onChange={(v) => setAi({ enabled: v })} />
          </Row>
          {ai.enabled && (
            <>
              <Divider />
              <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Base URL" hint="Endpoint compatible con OpenAI (provider, gateway self-hosted…)">
                  <Input value={ai.baseUrl} onChange={(v) => setAi({ baseUrl: v })} mono icon="link" />
                </Field>
                <Field label="Modelo">
                  <Input value={ai.model} onChange={(v) => setAi({ model: v })} mono />
                </Field>
                <Field
                  label="API key"
                  right={<button onClick={() => setShowKey((s) => !s)} style={{ fontSize: 11.5, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4, background: 'none' }}><Icon name={showKey ? 'eyeOff' : 'eye'} size={13} />{showKey ? 'Ocultar' : 'Mostrar'}</button>}
                >
                  <Input value={showKey ? apiKeyInput : keyDisplay} onChange={setApiKeyInput} mono icon="key" type={showKey ? 'text' : 'text'} placeholder={ai.apiKeyConfigured ? 'API key guardada — escribe para reemplazar' : 'Pega tu API key'} />
                </Field>
                <div style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 'var(--r)', background: 'var(--st-running-bg)', border: '1px solid var(--st-running)' }}>
                  <Icon name="shieldCheck" size={15} style={{ color: 'var(--st-running)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                    <b style={{ color: 'var(--text)' }}>Privacidad:</b> solo se envían manifiestos, config y un árbol de archivos por nombre para la detección.
                  </span>
                </div>
                {ai.storageWarning && (
                  <div style={{ display: 'flex', gap: 10, padding: '11px 13px', borderRadius: 'var(--r)', background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                    <Icon name="key" size={15} style={{ color: 'var(--text-faint)', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>{ai.storageWarning}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
