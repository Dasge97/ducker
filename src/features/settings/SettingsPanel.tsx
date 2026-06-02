import { useEffect, useState } from 'react';
import type { AppSettings } from '../../domain/settings';
import { loadSettings, saveSettings } from '../../services/native';

type Props = {
  onLoaded: (settings: AppSettings) => void;
};

export function SettingsPanel({ onLoaded }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      onLoaded(loaded);
    });
  }, [onLoaded]);

  if (!settings) return null;

  return (
    <section className="panel">
      <h2>Settings</h2>
      <input
        value={settings.editorCommand}
        onChange={(e) => setSettings({ ...settings, editorCommand: e.target.value })}
        placeholder="Editor command"
      />
      <label>
        <input
          type="checkbox"
          checked={settings.confirmRiskyCommands}
          onChange={(e) => setSettings({ ...settings, confirmRiskyCommands: e.target.checked })}
        />
        Confirm risky commands
      </label>
      <h3>AI configuration</h3>
      <label>
        <input
          type="checkbox"
          checked={settings.ai.enabled}
          onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, enabled: e.target.checked } })}
        />
        Enable AI advisor
      </label>
      <input
        value={settings.ai.provider}
        onChange={() => undefined}
        disabled
        placeholder="Provider"
      />
      <input
        value={settings.ai.baseUrl}
        onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, baseUrl: e.target.value } })}
        placeholder="Base URL"
      />
      <input
        value={settings.ai.model}
        onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, model: e.target.value } })}
        placeholder="Model"
      />
      <input
        type="password"
        value={apiKeyInput}
        onChange={(e) => {
          const next = e.target.value;
          setApiKeyInput(next);
          setSettings({
            ...settings,
            ai: {
              ...settings.ai,
              apiKeyConfigured: next.trim().length > 0 || settings.ai.apiKeyConfigured,
              apiKeyMasked: next ? '••••••••' : settings.ai.apiKeyMasked,
            },
          });
        }}
        placeholder={settings.ai.apiKeyConfigured ? `API key guardada (${settings.ai.apiKeyMasked ?? '••••'})` : 'Pega API key'}
      />
      <label>
        <input
          type="checkbox"
          checked={settings.ai.includeSourceSnippets}
          onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, includeSourceSnippets: e.target.checked } })}
        />
        Include source snippets (not recommended)
      </label>
      {settings.ai.storageWarning ? <p className="muted">⚠ {settings.ai.storageWarning}</p> : null}
      <button onClick={async () => {
        const persisted = await saveSettings({ ...settings, ai: { ...settings.ai, apiKeyInput } });
        setApiKeyInput('');
        setSettings(persisted);
        onLoaded(persisted);
      }}>Guardar settings</button>
    </section>
  );
}
