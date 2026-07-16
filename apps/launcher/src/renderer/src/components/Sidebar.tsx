import type { Account } from '@balumba/core';
import type { ServerStatus } from '../../../shared/ipc';

export type NavKey = 'play' | 'content' | 'admin' | 'server' | 'accounts' | 'settings';

const ITEMS: { key: NavKey; label: string; icon: string; adminOnly?: boolean }[] = [
  { key: 'play', label: 'Играть', icon: '▶' },
  { key: 'content', label: 'Моды', icon: '🧩' },
  { key: 'admin', label: 'Сборка', icon: '📦', adminOnly: true },
  { key: 'server', label: 'Сервер', icon: '🛠' },
  { key: 'accounts', label: 'Аккаунты', icon: '👤' },
  { key: 'settings', label: 'Настройки', icon: '⚙' },
];

const STATUS_DOT: Record<ServerStatus, string> = {
  stopped: 'bg-andesite-400',
  starting: 'bg-yellow-400 animate-pulse',
  running: 'bg-green-400',
  stopping: 'bg-yellow-400 animate-pulse',
};

interface Props {
  active: NavKey;
  onNavigate: (k: NavKey) => void;
  account: Account | null;
  serverStatus: ServerStatus;
  appVersion: string;
  adminMode: boolean;
}

export function Sidebar({ active, onNavigate, account, serverStatus, appVersion, adminMode }: Props): JSX.Element {
  const items = ITEMS.filter((i) => !i.adminOnly || adminMode);
  return (
    <aside className="flex w-56 flex-col border-r border-andesite-600/60 bg-andesite-900/75 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-brass-500 text-lg font-black text-andesite-900 shadow-glow">
          B
        </div>
        <div className="leading-tight">
          <div className="font-semibold tracking-wide text-brass-100">BalumbaCraft</div>
          <div className="text-[11px] text-andesite-400">Create · NeoForge 1.21.1</div>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              active === item.key
                ? 'bg-brass-500/15 text-brass-100 ring-1 ring-brass-600/40'
                : 'text-andesite-400 hover:bg-andesite-700 hover:text-brass-100'
            }`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
            {item.key === 'server' && (
              <span className={`ml-auto h-2 w-2 rounded-full ${STATUS_DOT[serverStatus]}`} />
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-andesite-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded bg-andesite-600 text-sm">
            {account ? account.username.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm text-brass-100">
              {account ? account.username : 'Нет аккаунта'}
            </div>
            <div className="text-[11px] text-andesite-400">
              {account ? (account.type === 'microsoft' ? 'Лицензия' : 'Оффлайн') : '—'}
            </div>
          </div>
        </div>
        <div className="mt-2 text-center text-[10px] text-andesite-500">v{appVersion || '0.1.0'}</div>
      </div>
    </aside>
  );
}
