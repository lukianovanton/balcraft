import { useState } from 'react';
import { Sidebar, type NavKey } from './components/Sidebar.js';
import { Onboarding } from './components/Onboarding.js';
import { PlayScreen } from './screens/PlayScreen.js';
import { ContentScreen } from './screens/ContentScreen.js';
import { AdminScreen } from './screens/AdminScreen.js';
import { ServerScreen } from './screens/ServerScreen.js';
import { AccountsScreen } from './screens/AccountsScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { useLauncherState } from './hooks/useLauncherState.js';

export default function App(): JSX.Element {
  const [nav, setNav] = useState<NavKey>('play');
  const state = useLauncherState();

  // First-run: no accounts yet → guide the user before showing the launcher.
  if (state.accounts.length === 0) {
    return (
      <Onboarding
        onDone={() => void state.refreshAccounts()}
        microsoftEnabled={state.systemInfo?.microsoftEnabled ?? false}
      />
    );
  }

  const upd = state.launcherUpdate;

  return (
    <div className="flex h-full w-full flex-col bg-gears">
      {upd.phase !== 'idle' && upd.phase !== 'error' && (
        <div className="flex items-center justify-center gap-3 bg-brass-500/15 px-4 py-1.5 text-xs text-brass-100 ring-1 ring-brass-600/30">
          {upd.phase === 'checking' && <span>Проверка обновлений лаунчера…</span>}
          {upd.phase === 'available' && <span>Найдено обновление лаунчера {upd.version} — загружается…</span>}
          {upd.phase === 'downloading' && (
            <span>Загрузка обновления лаунчера… {upd.percent ?? 0}%</span>
          )}
          {upd.phase === 'downloaded' && (
            <>
              <span>Обновление лаунчера {upd.version} готово.</span>
              <button
                className="rounded bg-brass-500 px-2 py-0.5 font-semibold text-andesite-900"
                onClick={() => window.balumba.installLauncherUpdate()}
              >
                Перезапустить
              </button>
            </>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar
          active={nav}
          onNavigate={setNav}
          account={state.selectedAccount}
          serverStatus={state.server.status}
          appVersion={state.systemInfo?.appVersion ?? ''}
          adminMode={state.settings?.adminMode ?? false}
        />
        <main className="flex-1 overflow-y-auto">
          {nav === 'play' && <PlayScreen state={state} />}
          {nav === 'content' && <ContentScreen />}
          {nav === 'admin' && <AdminScreen state={state} />}
          {nav === 'server' && <ServerScreen state={state} />}
          {nav === 'accounts' && <AccountsScreen state={state} />}
          {nav === 'settings' && <SettingsScreen state={state} />}
        </main>
      </div>
    </div>
  );
}
