import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { Icon, type IconName } from './icons';
import { Button, IconButton } from './primitives';

export function Overlay({ children, onClose, align = 'center', pad = 24 }: { children: ReactNode; onClose?: () => void; align?: 'center' | 'top'; pad?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'absolute', inset: 0, zIndex: 100, background: 'oklch(0.45 0.02 312 / 0.30)',
        backdropFilter: 'blur(2px)', display: 'flex',
        alignItems: align === 'top' ? 'flex-start' : 'center', justifyContent: 'center',
        padding: align === 'top' ? '90px 24px 24px' : pad, animation: 'pop-in .12s ease',
      }}
    >
      {children}
    </div>
  );
}

export function ModalCard({ children, width = 540, style }: { children: ReactNode; width?: number; style?: CSSProperties }) {
  return (
    <div
      role="dialog"
      aria-modal
      style={{
        width: '100%', maxWidth: width, maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg)', border: '1px solid var(--border-loud)', borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-overlay)', animation: 'pop-in .16s cubic-bezier(.2,.8,.3,1)', overflow: 'hidden', ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ModalHeader({ icon, iconColor, title, sub, onClose }: { icon?: IconName; iconColor?: string; title: ReactNode; sub?: ReactNode; onClose?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px 14px', borderBottom: '1px solid var(--border-soft)' }}>
      {icon && (
        <div style={{ width: 34, height: 34, borderRadius: 'var(--r)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconColor ? `color-mix(in oklch, ${iconColor} 16%, transparent)` : 'var(--brand-ghost)', color: iconColor ?? 'var(--brand-bright)' }}>
          <Icon name={icon} size={18} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 2, lineHeight: 1.45 }}>{sub}</div>}
      </div>
      {onClose && <IconButton name="x" title="Cerrar (Esc)" onClick={onClose} />}
    </div>
  );
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
      {children}
    </div>
  );
}

type ConfirmProps = {
  icon?: IconName;
  iconColor?: string;
  title: ReactNode;
  sub?: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'dangerSolid';
  confirmIcon?: IconName;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  typeToConfirm?: string;
};

export function ConfirmDialog({ icon, iconColor, title, sub, body, confirmLabel, confirmVariant = 'primary', confirmIcon, cancelLabel = 'Cancelar', onConfirm, onClose, typeToConfirm }: ConfirmProps) {
  const [typed, setTyped] = useState('');
  const ok = !typeToConfirm || typed === typeToConfirm;
  return (
    <Overlay onClose={onClose}>
      <ModalCard width={460}>
        <ModalHeader icon={icon} iconColor={iconColor} title={title} sub={sub} onClose={onClose} />
        {body && <div style={{ padding: '16px 20px', fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>{body}</div>}
        {typeToConfirm && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 6 }}>
              Escribe <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{typeToConfirm}</span> para confirmar
            </div>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mono"
              style={{ width: '100%', padding: '8px 11px', fontSize: 13.5, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--text)' }}
            />
          </div>
        )}
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={confirmVariant} icon={confirmIcon} disabled={!ok} onClick={onConfirm}>{confirmLabel}</Button>
        </ModalFooter>
      </ModalCard>
    </Overlay>
  );
}
