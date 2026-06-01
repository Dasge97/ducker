import { useEffect, useState } from 'react';
import type { AppSettings } from '../../domain/settings';
import { loadSettings, saveSettings } from '../../services/native';

type Props = {
  onLoaded: (settings: AppSettings) => void;
};

export function SettingsPanel({ onLoaded }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);

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
      <button onClick={async () => {
        const persisted = await saveSettings(settings);
        setSettings(persisted);
        onLoaded(persisted);
      }}>Guardar settings</button>
    </section>
  );
}
