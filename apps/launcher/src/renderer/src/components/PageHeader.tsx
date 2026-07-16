import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: ReactNode;
  /** Right-aligned actions (buttons, status). */
  actions?: ReactNode;
}

/** Consistent page header used across screens for a unified structure. */
export function PageHeader({ title, subtitle, actions }: Props): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 px-8 py-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-brass-50">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-andesite-400">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

interface TabsProps<T extends string> {
  tabs: { key: T; label: string; badge?: number | string }[];
  active: T;
  onChange: (k: T) => void;
}

/** Underline-style tab bar (Modrinth-like). */
export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>): JSX.Element {
  return (
    <div className="flex gap-1 border-b border-white/5 px-8">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`relative -mb-px flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            active === t.key
              ? 'text-brass-50'
              : 'text-andesite-400 hover:text-brass-100'
          }`}
        >
          {t.label}
          {t.badge !== undefined && (
            <span
              className={`chip ${
                active === t.key ? 'bg-brass-500/15 text-brass-300' : 'bg-white/5 text-andesite-400'
              }`}
            >
              {t.badge}
            </span>
          )}
          {active === t.key && (
            <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brass-500" />
          )}
        </button>
      ))}
    </div>
  );
}

/** Segmented control (pill group) for compact filters. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
  className?: string;
}): JSX.Element {
  return (
    <div className={`inline-flex gap-1 rounded-lg bg-black/20 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.key ? 'bg-brass-500 text-andesite-900' : 'text-andesite-300 hover:text-brass-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
