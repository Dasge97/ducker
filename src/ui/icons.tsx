// Ducker icon set — simple geometric line icons (Lucide-style, stroke-based).
import type { CSSProperties } from 'react';

const ICON_PATHS = {
  search: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M21 21l-4.3-4.3',
  plus: 'M12 5v14 M5 12h14',
  play: 'M6 4l14 8-14 8z',
  stop: 'M6 6h12v12H6z',
  pause: 'M7 5v14 M17 5v14',
  restart: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 4v4h4',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6 M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4.2 7.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  folderPlus: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M12 11v6 M9 14h6',
  terminal: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M7 9l3 3-3 3 M13 15h4',
  layers: 'M12 2l9 5-9 5-9-5z M3 12l9 5 9-5 M3 17l9 5 9-5',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M13 13h7v7h-7z M4 13h7v7H4z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  x: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12l5 5L20 6',
  checkCircle: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M8.5 12l2.5 2.5 4.5-5',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  alertCircle: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 8v4 M12 16h.01',
  info: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 11v5 M12 8h.01',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5 M11 18l-6-6 6-6',
  external: 'M14 4h6v6 M20 4l-9 9 M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13 M10 11v6 M14 11v6',
  edit: 'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z M13.5 6.5l3 3',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  link: 'M9 15l6-6 M10.5 6.5l1.7-1.7a4 4 0 0 1 5.7 5.7l-1.7 1.7 M13.5 17.5l-1.7 1.7a4 4 0 0 1-5.7-5.7l1.7-1.7',
  port: 'M12 2v6 M12 16v6 M2 12h6 M16 12h6 M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 3v3 M20.5 4.5h-3 M5 17v3 M6.5 18.5h-3',
  shield: 'M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z',
  shieldCheck: 'M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z M9 12l2 2 4-4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  eyeOff: 'M3 3l18 18 M10.6 10.6a3 3 0 0 0 4.2 4.2 M9.4 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 3.9 M6.6 6.6A18 18 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 2.6-.3',
  file: 'M6 3h7l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M13 3v5h5',
  fileX: 'M6 3h7l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M13 3v5h5 M9 13l4 4 M13 13l-4 4',
  fileCheck: 'M6 3h7l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M13 3v5h5 M9 15l2 2 3-3.5',
  database: 'M12 5c4.4 0 8-1.1 8-2.5S16.4 0 12 0 4 1.1 4 2.5 7.6 5 12 5z M4 2.5v15C4 19 7.6 20 12 20s8-1 8-2.5v-15 M4 10c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5',
  globe: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18',
  cpu: 'M6 6h12v12H6z M9 9h6v6H9z M9 1v3 M15 1v3 M9 20v3 M15 20v3 M1 9h3 M1 15h3 M20 9h3 M20 15h3',
  box: 'M21 8l-9-5-9 5 9 5 9-5z M3 8v8l9 5 M21 8v8l-9 5 M12 13v8',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  dot: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  clock: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 7v5l3 2',
  key: 'M14 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M11 11l-7 7v3h3l1-1v-2h2v-2h2z',
  more: 'M12 5h.01 M12 12h.01 M12 19h.01',
  download: 'M12 3v12 M7 11l5 5 5-5 M5 21h14',
  pin: 'M12 21v-7 M8 3h8l-1 6 3 2H6l3-2z',
  loader: 'M12 3v3 M12 18v3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M3 12h3 M18 12h3 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1',
} as const;

export type IconName = keyof typeof ICON_PATHS;

type IconProps = {
  name: IconName;
  size?: number;
  stroke?: number;
  fill?: boolean;
  style?: CSSProperties;
  className?: string;
};

const FILLED = new Set<IconName>(['play', 'stop', 'dot']);

export function Icon({ name, size = 16, stroke = 1.75, fill = false, style, className }: IconProps) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  const filled = fill || FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block', ...style }}
      className={className}
      aria-hidden
    >
      {d.split(' M').map((seg, i) => (
        <path key={i} d={(i ? 'M' : '') + seg} />
      ))}
    </svg>
  );
}
