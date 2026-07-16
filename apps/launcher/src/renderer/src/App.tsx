import { useState } from 'react';
import { Sidebar, type NavKey } from './components/Sidebar.js';
import { Onboarding } from './components/Onboarding.js';
import { PlayScreen } from './screens/PlayScreen.js';
import { ContentScreen } from './screens/ContentScreen.js';
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

  return (
    <div className="flex h-full w-full bg-gears">
      <Sidebar
        active={nav}
        onNavigate={setNav}
        account={state.selectedAccount}
        serverStatus={state.server.status}
        appVersion={state.systemInfo?.appVersion ?? ''}
      />
      <main className="flex-1 overflow-y-auto">
        {nav === 'play' && <PlayScreen state={state} />}
        {nav === 'content' && <ContentScreen />}
        {nav === 'server' && <ServerScreen state={state} />}
        {nav === 'accounts' && <AccountsScreen state={state} />}
        {nav === 'settings' && <SettingsScreen state={state} />}
      </main>
    </div>
  );
}
