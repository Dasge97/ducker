import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { Icon, type IconName } from './icons';
import { STATUS_META, TYPE_META } from './meta';
import type { CommandStatus, ServiceKind } from '../domain/projects';

type ButtonVariant = 'primary' | 'default' | 'ghost' | 'outline' | 'danger' | 'dangerSolid' | 'amber';
type Size = 'sm' | 'md' | 'lg';

const BTN_SIZES: Record<Size, CSSProperties> = {
  sm: { padding: '5px 9px', fontSize: 12.5, gap: 6, height: 28 },
  md: { padding: '7px 13px', fontSize: 13.5, gap: 7, height: 34 },
  lg: { padding: '10px 18px', fontSize: 15, gap: 8, height: 42 },
};

const BTN_VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--brand)', color: 'var(--on-brand)', border: '1px solid transparent' },
  default: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
  ghost: { background: 'transparent', color: 'var(--text-dim)', border: '1px solid transparent' },
  outline: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-loud)' },
  danger: { background: 'var(--st-failed-bg)', color: 'var(--st-failed)', border: '1px solid var(--st-failed)' },
  dangerSolid: { background: 'var(--st-failed)', color: 'var(--on-brand)', border: '1px solid transparent' },
  amber: { background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber)' },
};

type ButtonProps = {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  title?: string;
  full?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
};

export function Button({ children, variant = 'default', size = 'md', icon, iconRight, onClick, disabled, title, full, type = 'button', style }: ButtonProps) {
  const s = BTN_SIZES[size];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-btn={variant}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: s.gap, padding: s.padding, height: s.height, fontSize: s.fontSize,
        fontWeight: 600, borderRadius: 'var(--r)', whiteSpace: 'nowrap',
        transition: 'background .12s, border-color .12s, opacity .12s, transform .04s',
        opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        width: full ? '100%' : undefined, letterSpacing: '0.005em',
        ...BTN_VARIANTS[variant], ...style,
      }}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children != null && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

type IconButtonProps = {
  name: IconName;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  active?: boolean;
  danger?: boolean;
  style?: CSSProperties;
  box?: number;
};

export function IconButton({ name, size = 16, onClick, title, active, danger, style, box = 30 }: IconButtonProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: box, height: box, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--r-sm)', flexShrink: 0,
        color: danger ? 'var(--st-failed)' : active ? 'var(--brand-bright)' : hover ? 'var(--text)' : 'var(--text-faint)',
        background: hover ? (danger ? 'var(--st-failed-bg)' : 'var(--surface-2)') : active ? 'var(--brand-ghost)' : 'transparent',
        transition: 'all .12s', ...style,
      }}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

export function StatusDot({ status, size = 8 }: { status: CommandStatus; size?: number }) {
  const m = STATUS_META[status] ?? STATUS_META.idle;
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', background: m.color, flexShrink: 0,
        boxShadow: status === 'running' ? `0 0 0 3px ${m.bg}` : 'none',
        animation: m.pulse ? 'pulse-dot 1.1s ease-in-out infinite' : 'none',
      }}
    />
  );
}

export function StatusBadge({ status, size = 'md' }: { status: CommandStatus; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status] ?? STATUS_META.idle;
  const small = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: small ? '2px 7px 2px 6px' : '3px 9px 3px 7px',
        borderRadius: 100, background: m.bg, color: m.color,
        fontSize: small ? 11 : 12, fontWeight: 600, letterSpacing: '0.01em',
        border: `1px solid ${m.color}`, whiteSpace: 'nowrap',
      }}
    >
      <StatusDot status={status} size={small ? 6 : 7} />
      {m.label}
    </span>
  );
}

export function TypeTag({ type }: { type: ServiceKind }) {
  const m = TYPE_META[type] ?? TYPE_META.custom;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px 2px 6px',
        borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', border: '1px solid var(--border-soft)',
        color: 'var(--text-dim)', fontSize: 11.5, fontWeight: 600,
      }}
    >
      <Icon name={m.icon} size={12} />
      {m.label}
    </span>
  );
}

export function ConfidenceMeter({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? 'var(--st-running)' : value >= 0.7 ? 'var(--amber)' : 'var(--st-failed)';
  const label = value >= 0.85 ? 'High' : value >= 0.7 ? 'Medium' : 'Low';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }} title={`AI confidence: ${pct}%`}>
      <span style={{ display: 'flex', gap: 2 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ width: 3, height: 11, borderRadius: 1, background: i < Math.round(value * 5) ? color : 'var(--surface-3)' }} />
        ))}
      </span>
      {showLabel && <span className="mono" style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>}
    </span>
  );
}

export function Field({ label, hint, children, htmlFor, right }: { label?: string; hint?: ReactNode; children: ReactNode; htmlFor?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {(label || right) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          {label && <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)' }}>{label}</label>}
          {right}
        </div>
      )}
      {children}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

type InputProps = {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  id?: string;
  icon?: IconName;
  style?: CSSProperties;
  type?: string;
  readOnly?: boolean;
};

export function Input({ value, onChange, placeholder, mono, id, icon, style, type = 'text', readOnly }: InputProps) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {icon && (
        <span style={{ position: 'absolute', left: 10, color: 'var(--text-faint)', pointerEvents: 'none' }}>
          <Icon name={icon} size={15} />
        </span>
      )}
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={mono ? 'mono' : ''}
        style={{
          width: '100%', padding: icon ? '8px 11px 8px 32px' : '8px 11px', fontSize: 13.5,
          background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 'var(--r)',
          color: 'var(--text)', transition: 'border-color .12s', ...style,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      />
    </div>
  );
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!on)}
      style={{
        width: 38, height: 22, borderRadius: 100, padding: 2, flexShrink: 0,
        background: on ? 'var(--brand)' : 'var(--surface-3)', transition: 'background .15s',
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center',
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(16px)' : 'translateX(0)', transition: 'transform .15s', boxShadow: '0 1px 2px rgba(0,0,0,.4)' }} />
    </button>
  );
}

type SegOption<T extends string> = { value: T; label?: string; icon?: IconName };

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: { options: SegOption<T>[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 2, gap: 2 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={opt.label}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: size === 'sm' ? '4px 9px' : '6px 12px',
              fontSize: size === 'sm' ? 12 : 13, fontWeight: 600, borderRadius: 'var(--r-sm)',
              background: active ? 'var(--surface-2)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-faint)',
              boxShadow: active ? 'inset 0 0 0 1px var(--border)' : 'none', transition: 'all .12s',
            }}
          >
            {opt.icon && <Icon name={opt.icon} size={14} />}
            {opt.label && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Panel({ children, style, pad = 16 }: { children: ReactNode; style?: CSSProperties; pad?: number }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: pad, ...style }}>
      {children}
    </div>
  );
}

export function Spinner({ size = 16, color = 'var(--brand-bright)' }: { size?: number; color?: string }) {
  return (
    <span style={{ width: size, height: size, display: 'inline-block', borderRadius: '50%', border: `2px solid ${color}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
  );
}

export function Divider({ vertical, style }: { vertical?: boolean; style?: CSSProperties }) {
  return (
    <div style={vertical ? { width: 1, alignSelf: 'stretch', background: 'var(--border-soft)', ...style } : { height: 1, width: '100%', background: 'var(--border-soft)', ...style }} />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

export function Empty({ icon = 'box', title, body, action }: { icon?: IconName; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', gap: 12, color: 'var(--text-faint)' }}>
      <div style={{ width: 46, height: 46, borderRadius: 'var(--r-md)', background: 'var(--surface)', border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
        <Icon name={icon} size={22} />
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-dim)' }}>{title}</div>
      {body && <div style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>{body}</div>}
      {action}
    </div>
  );
}
