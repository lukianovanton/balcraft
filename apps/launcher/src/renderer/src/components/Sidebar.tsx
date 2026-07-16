import type { ComponentType, SVGProps } from 'react';
import logo from '../assets/logo.png';
import type { Account } from '@balumba/core';
import type { ServerStatus } from '../../../shared/ipc';
import {
  IconPlay,
  IconMods,
  IconPack,
  IconServer,
  IconUser,
  IconSettings,
} from './Icons.js';

export type NavKey = 'play' | 'content' | 'admin' | 'server' | 'accounts' | 'settings';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const ITEMS: { key: NavKey; label: string; Icon: IconType; adminOnly?: boolean }[] = [
  { key: 'play', label: 'Играть', Icon: IconPlay },
  { key: 'content', label: 'Моды', Icon: IconMods },
  { key: 'admin', label: 'Сборка', Icon: IconPack, adminOnly: true },
  { key: 'server', label: 'Сервер', Icon: IconServer },
  { key: 'accounts', label: 'Аккаунты', Icon: IconUser },
  { key: 'settings', label: 'Настройки', Icon: IconSettings },
];

const STATUS_DOT: Record<ServerStatus, string> = {
  stopped: 'bg-andesite-500',
  starting: 'bg-copper-400 animate-pulse',
  running: 'bg-brass-500',
  stopping: 'bg-copper-400 animate-pulse',
};

interface Props {
  active: NavKey;
  onNavigate: (k: NavKey) => void;
  account: Account | null;
  serverStatus: ServerStatus;
  appVersion: string;
  adminMode: boolean;
}

export function Sidebar({
  active,
  onNavigate,
  account,
  serverStatus,
  appVersion,
  adminMode,
}: Props): JSX.Element {
  const items = ITEMS.filter((i) => !i.adminOnly || adminMode);
  return (
    <aside className="flex w-60 flex-col border-r border-white/5 bg-andesite-900/70 backdrop-blur-md">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <img src={logo} alt="" className="h-10 w-10 rounded-xl" />
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-brass-50">Gearhaven</div>
          <div className="text-[11px] text-andesite-400">Create · NeoForge 1.21.1</div>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {items.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className={`nav-item ${active === key ? 'nav-item-active' : ''}`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span>{label}</span>
            {key === 'server' && (
              <span className={`ml-auto h-2 w-2 rounded-full ${STATUS_DOT[serverStatus]}`} />
            )}
          </button>
        ))}
      </nav>

      <div className="m-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-andesite-700 text-sm font-semibold text-brass-100">
            {account ? account.username.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-brass-50">
              {account ? account.username : 'Нет аккаунта'}
            </div>
            <div className="text-[11px] text-andesite-400">
              {account ? (account.type === 'microsoft' ? 'Лицензия' : 'Оффлайн') : '—'}
            </div>
          </div>
          <span className="ml-auto text-[10px] text-andesite-500">v{appVersion || '0.1.0'}</span>
        </div>
      </div>
    </aside>
  );
}
