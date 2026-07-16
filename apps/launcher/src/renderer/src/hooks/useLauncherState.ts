import { useCallback, useEffect, useState } from 'react';
import type { Account } from '@balumba/core';
import type { LaunchState, LauncherSettings, ServerState } from '../../../shared/ipc';

export interface SystemInfo {
  totalRamMb: number;
  cpuCount: number;
  appVersion: string;
  microsoftEnabled: boolean;
}

const IDLE_LAUNCH: LaunchState = { stage: 'idle', progress: null, error: null };

/** Central renderer-side state, synced with the main process over IPC. */
export function useLauncherState() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [launch, setLaunch] = useState<LaunchState>(IDLE_LAUNCH);
  const [server, setServer] = useState<ServerState>({
    status: 'stopped',
    publicAddress: null,
    players: [],
    whitelist: [],
  });
  const [serverLog, setServerLog] = useState<string[]>([]);

  const refreshAccounts = useCallback(async () => {
    const [list, sel] = await Promise.all([
      window.balumba.listAccounts(),
      window.balumba.getSelectedAccountId(),
    ]);
    setAccounts(list);
    setSelectedAccountId(sel);
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshAccounts();
      setSettings(await window.balumba.getSettings());
      setSystemInfo(await window.balumba.getSystemInfo());
      setLaunch(await window.balumba.getLaunchState());
      setServer(await window.balumba.getServerState());
    })();

    const offLaunch = window.balumba.onLaunchState(setLaunch);
    const offServer = window.balumba.onServerState(setServer);
    const offLog = window.balumba.onServerLog((line) =>
      setServerLog((prev) => [...prev.slice(-500), line]),
    );
    const offMs = window.balumba.onMicrosoftLoginDone(() => {
      void refreshAccounts();
    });
    return () => {
      offLaunch();
      offServer();
      offLog();
      offMs();
    };
  }, [refreshAccounts]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  const saveSettings = useCallback(async (patch: Partial<LauncherSettings>) => {
    setSettings(await window.balumba.saveSettings(patch));
  }, []);

  return {
    accounts,
    selectedAccount,
    selectedAccountId,
    settings,
    systemInfo,
    launch,
    server,
    serverLog,
    refreshAccounts,
    saveSettings,
    setSelectedAccountId,
  };
}

export type LauncherStateHook = ReturnType<typeof useLauncherState>;
