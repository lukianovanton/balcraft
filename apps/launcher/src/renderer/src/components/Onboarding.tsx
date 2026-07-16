import { useState } from 'react';
import logo from '../assets/logo.png';

interface Props {
  onDone: () => void;
  microsoftEnabled: boolean;
}

/**
 * First-run welcome shown when there are no accounts yet. Walks a friend through
 * the one thing they must do before playing: pick a name (or sign in).
 */
export function Onboarding({ onDone, microsoftEnabled }: Props): JSX.Element {
  const [nick, setNick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addNick() {
    setError(null);
    setBusy(true);
    try {
      await window.balumba.addOfflineAccount(nick);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function microsoft() {
    setError(null);
    try {
      await window.balumba.beginMicrosoftLogin();
      // completion handled globally; onboarding closes when an account appears
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-andesite-900 bg-gears p-8">
      <div className="panel w-full max-w-lg space-y-6 p-8 text-center">
        <img src={logo} alt="" className="mx-auto h-16 w-16 rounded-2xl shadow-glow" />
        <div>
          <h1 className="text-2xl font-black text-brass-50">Добро пожаловать в Gearhaven</h1>
          <p className="mt-2 text-sm text-andesite-300">
            Приватная Create-сборка на NeoForge 1.21.1. Лаунчер сам поставит Java, Minecraft, моды
            и будет держать сборку в актуальном состоянии. Осталось выбрать имя.
          </p>
        </div>

        <div className="space-y-3 text-left">
          <label className="text-xs font-semibold uppercase tracking-wide text-andesite-400">
            Игровой ник
          </label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Например, Steve"
              value={nick}
              maxLength={16}
              autoFocus
              onChange={(e) => setNick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nick && addNick()}
            />
            <button className="btn-primary whitespace-nowrap" disabled={!nick || busy} onClick={addNick}>
              Продолжить
            </button>
          </div>

          {microsoftEnabled && (
            <>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-andesite-600" />
                <span className="text-xs text-andesite-500">есть лицензия?</span>
                <div className="h-px flex-1 bg-andesite-600" />
              </div>
              <button className="btn-ghost w-full" onClick={microsoft}>
                Войти через Microsoft
              </button>
            </>
          )}

          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>

        <p className="text-[11px] text-andesite-500">
          При первом запуске лаунчер скачает ~2–3 ГБ (Java, игра, моды). Дальше — только обновления.
        </p>
      </div>
    </div>
  );
}
