import { useEffect, useState } from 'react';
import type { LauncherStateHook } from '../hooks/useLauncherState';

interface MsPrompt {
  userCode: string;
  verificationUri: string;
}

export function AccountsScreen({ state }: { state: LauncherStateHook }): JSX.Element {
  const { accounts, selectedAccountId, refreshAccounts } = state;
  const [nick, setNick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msPrompt, setMsPrompt] = useState<MsPrompt | null>(null);

  async function addOffline() {
    setError(null);
    setBusy(true);
    try {
      await window.balumba.addOfflineAccount(nick);
      setNick('');
      await refreshAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loginMicrosoft() {
    setError(null);
    try {
      const info = await window.balumba.beginMicrosoftLogin();
      setMsPrompt({ userCode: info.userCode, verificationUri: info.verificationUri });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Close the code prompt automatically once an account appears / changes.
  useEffect(() => {
    const off = window.balumba.onMicrosoftLoginDone(() => setMsPrompt(null));
    return off;
  }, []);

  async function select(id: string) {
    await window.balumba.selectAccount(id);
    await refreshAccounts();
  }

  async function remove(id: string) {
    await window.balumba.removeAccount(id);
    await refreshAccounts();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h2 className="text-2xl font-bold text-brass-50">Аккаунты</h2>

      <div className="panel space-y-4 p-5">
        <div className="text-sm font-semibold text-brass-100">Добавить аккаунт</div>

        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Ник (оффлайн)"
            value={nick}
            maxLength={16}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && nick && addOffline()}
          />
          <button className="btn-ghost whitespace-nowrap" disabled={!nick || busy} onClick={addOffline}>
            Добавить ник
          </button>
        </div>

        {state.systemInfo?.microsoftEnabled && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-andesite-600" />
              <span className="text-xs text-andesite-400">или</span>
              <div className="h-px flex-1 bg-andesite-600" />
            </div>

            <button className="btn-primary w-full" onClick={loginMicrosoft}>
              Войти через Microsoft (лицензия)
            </button>
          </>
        )}

        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>

      <div className="panel divide-y divide-andesite-700">
        {accounts.length === 0 && (
          <div className="p-5 text-sm text-andesite-400">Пока нет аккаунтов.</div>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-4">
            <div className="grid h-9 w-9 place-items-center rounded bg-andesite-600 text-sm">
              {a.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 leading-tight">
              <div className="text-sm text-brass-100">{a.username}</div>
              <div className="text-[11px] text-andesite-400">
                {a.type === 'microsoft' ? 'Лицензия Microsoft' : 'Оффлайн'}
              </div>
            </div>
            {selectedAccountId === a.id ? (
              <span className="rounded bg-brass-500/20 px-2 py-1 text-xs text-brass-200 ring-1 ring-brass-600/40">
                Активен
              </span>
            ) : (
              <button className="btn-ghost px-3 py-1 text-xs" onClick={() => select(a.id)}>
                Выбрать
              </button>
            )}
            <button className="btn-danger px-3 py-1 text-xs" onClick={() => remove(a.id)}>
              Удалить
            </button>
          </div>
        ))}
      </div>

      {msPrompt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
          <div className="panel w-full max-w-md space-y-4 p-6 text-center">
            <h3 className="text-lg font-bold text-brass-50">Вход через Microsoft</h3>
            <p className="text-sm text-andesite-300">
              Открой страницу и введи код. После входа окно закроется автоматически.
            </p>
            <div className="rounded-lg bg-andesite-850 py-3 font-mono text-3xl tracking-[0.3em] text-brass-200">
              {msPrompt.userCode}
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                className="btn-ghost"
                onClick={() => navigator.clipboard.writeText(msPrompt.userCode)}
              >
                Скопировать код
              </button>
              <a className="btn-primary" href={msPrompt.verificationUri} target="_blank" rel="noreferrer">
                Открыть страницу входа
              </a>
            </div>
            <button
              className="text-xs text-andesite-400 hover:text-brass-200"
              onClick={() => setMsPrompt(null)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
