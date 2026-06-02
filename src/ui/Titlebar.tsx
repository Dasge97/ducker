import { getCurrentWindow } from '@tauri-apps/api/window';

import { Icon } from './icons';
import { Kbd } from './primitives';

const appWindow = getCurrentWindow();

// Windows-style window control. Close gets a red hover; the others a neutral hover.
function WindowControl({ kind, onClick }: { kind: 'min' | 'max' | 'close'; onClick: () => void }) {
  const label = kind === 'min' ? 'Minimizar' : kind === 'max' ? 'Maximizar' : 'Cerrar';
  return (
    <button
      className={`win-ctl${kind === 'close' ? ' win-ctl-close' : ''}`}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
        {kind === 'min' && <rect x="1" y="5.25" width="9" height="1" fill="currentColor" />}
        {kind === 'max' && <rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />}
        {kind === 'close' && <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.1" />}
      </svg>
    </button>
  );
}

type Props = {
  runningCount: number;
  onOpenPalette: () => void;
};

export function Titlebar({ runningCount, onOpenPalette }: Props) {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand">
        <img src="/ducker-mark.png" alt="Ducker" className="titlebar-logo" />
        <span className="titlebar-name">Ducker</span>
      </div>

      <button className="titlebar-search" onClick={onOpenPalette}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="search" size={14} />
          Buscar proyectos o ejecutar un comando
        </span>
        <span style={{ display: 'flex', gap: 3 }}>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="titlebar-status">
        <span className={`tb-dot${runningCount ? ' on' : ''}`} />
        <span className="tnum">{runningCount} running</span>
      </div>

      <div className="titlebar-controls">
        <WindowControl kind="min" onClick={() => void appWindow.minimize()} />
        <WindowControl kind="max" onClick={() => void appWindow.toggleMaximize()} />
        <WindowControl kind="close" onClick={() => void appWindow.close()} />
      </div>
    </div>
  );
}
