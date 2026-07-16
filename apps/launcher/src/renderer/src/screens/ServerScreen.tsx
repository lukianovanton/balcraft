import { useEffect, useRef, useState } from 'react';
import type { LauncherStateHook } from '../hooks/useLauncherState';
import type { ServerStatus } from '../../../shared/ipc';

const STATUS_LABEL: Record<ServerStatus, string> = {
  stopped: 'Остановлен',
  starting: 'Запускается…',
  running: 'Работает',
  stopping: 'Останавливается…',
};

export function ServerScreen({ state }: { state: LauncherStateHook }): JSX.Element {
  const { server, serverLog } = state;
  const [cmd, setCmd] = useState('');
  const [nick, setNick] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [serverLog]);

  const running = server.status === 'running';

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brass-50">Локальный сервер</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-andesite-400">
            <span
              className={`h-2 w-2 rounded-full ${
                running ? 'bg-green-400' : server.status === 'stopped' ? 'bg-andesite-400' : 'bg-yellow-400'
              }`}
            />
            {STATUS_LABEL[server.status]}
            {server.publicAddress && (
              <>
                <span className="text-andesite-600">·</span>
                <button
                  className="text-brass-300 underline decoration-dotted"
                  onClick={() => navigator.clipboard.writeText(server.publicAddress!)}
                  title="Скопировать адрес"
                >
                  {server.publicAddress}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {server.status === 'stopped' ? (
            <button className="btn-primary" onClick={() => window.balumba.startServer()}>
              ▶ Запустить
            </button>
          ) : (
            <button
              className="btn-danger"
              disabled={server.status !== 'running'}
              onClick={() => window.balumba.stopServer()}
            >
              ■ Остановить
            </button>
          )}
        </div>
      </div>

      {/* Prominent tunnel / address card */}
      {server.status !== 'stopped' && (
        <div className="panel flex items-center gap-4 p-4">
          {server.publicAddress ? (
            <>
              <div className="text-xs uppercase tracking-wide text-andesite-400">Адрес для друзей</div>
              <div className="selectable flex-1 font-mono text-lg text-brass-100">
                {server.publicAddress}
              </div>
              <button
                className="btn-primary"
                onClick={() => navigator.clipboard.writeText(server.publicAddress!)}
              >
                Копировать
              </button>
            </>
          ) : server.tunnelClaimUrl ? (
            <>
              <div className="flex-1 text-sm text-copper-400">
                Первый запуск: привяжи туннель Playit.gg к аккаунту, чтобы получить адрес.
              </div>
              <a className="btn-primary" href={server.tunnelClaimUrl} target="_blank" rel="noreferrer">
                Привязать туннель
              </a>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-andesite-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
              {server.status === 'running' ? 'Туннель запускается, адрес появится через пару секунд…' : 'Запуск сервера…'}
            </div>
          )}
        </div>
      )}

      {state.settings && (
        <details className="panel px-4 py-2 text-sm" open={server.status === 'stopped'}>
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-andesite-400">
            Настройки сервера{' '}
            <span className="ml-1 text-andesite-500">
              (ОЗУ {Math.round(state.settings.serverRamMb / 1024)} ГБ · дистанция{' '}
              {state.settings.serverViewDistance} · слотов {state.settings.serverMaxPlayers})
            </span>
          </summary>
          <div className="mt-3 grid grid-cols-4 gap-3">
            <label className="col-span-2 text-xs text-andesite-400">
              Память сервера: {Math.round(state.settings.serverRamMb / 1024)} ГБ
              <input
                type="range"
                min={2}
                max={Math.max(4, Math.floor((state.systemInfo?.totalRamMb ?? 8192) / 1024))}
                value={Math.round(state.settings.serverRamMb / 1024)}
                disabled={server.status !== 'stopped'}
                className="mt-1 w-full accent-brass-500"
                onChange={(e) => state.saveSettings({ serverRamMb: Number(e.target.value) * 1024 })}
              />
            </label>
            <label className="text-xs text-andesite-400">
              Дистанция прогрузки
              <input
                type="number"
                min={4}
                max={32}
                value={state.settings.serverViewDistance}
                disabled={server.status !== 'stopped'}
                className="input mt-1"
                onChange={(e) => state.saveSettings({ serverViewDistance: Number(e.target.value) })}
              />
            </label>
            <label className="text-xs text-andesite-400">
              Макс. игроков
              <input
                type="number"
                min={1}
                max={100}
                value={state.settings.serverMaxPlayers}
                disabled={server.status !== 'stopped'}
                className="input mt-1"
                onChange={(e) => state.saveSettings({ serverMaxPlayers: Number(e.target.value) })}
              />
            </label>
            <label className="col-span-3 text-xs text-andesite-400">
              Описание (MOTD)
              <input
                className="input mt-1"
                defaultValue={state.settings.serverMotd}
                disabled={server.status !== 'stopped'}
                onBlur={(e) => state.saveSettings({ serverMotd: e.target.value })}
              />
            </label>
            <label className="flex items-end gap-2 text-xs text-andesite-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brass-500"
                checked={state.settings.serverUseTunnel}
                disabled={server.status !== 'stopped'}
                onChange={(e) => state.saveSettings({ serverUseTunnel: e.target.checked })}
              />
              Туннель Playit.gg
            </label>
          </div>
          {server.status !== 'stopped' && (
            <p className="mt-2 text-[11px] text-andesite-500">
              Настройки применятся при следующем запуске сервера.
            </p>
          )}
        </details>
      )}

      <div className="grid flex-1 grid-cols-3 gap-4 overflow-hidden">
        {/* Console */}
        <div className="panel col-span-2 flex flex-col overflow-hidden">
          <div className="border-b border-andesite-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-andesite-400">
            Консоль
          </div>
          <div
            ref={logRef}
            className="selectable flex-1 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-[12px] leading-relaxed text-andesite-200"
          >
            {serverLog.length === 0 ? (
              <span className="text-andesite-500">Лог сервера появится здесь…</span>
            ) : (
              serverLog.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
          <form
            className="flex gap-2 border-t border-andesite-700 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (cmd.trim()) {
                window.balumba.sendServerCommand(cmd.trim());
                setCmd('');
              }
            }}
          >
            <input
              className="input font-mono"
              placeholder="Команда сервера (напр. say привет)"
              value={cmd}
              disabled={!running}
              onChange={(e) => setCmd(e.target.value)}
            />
            <button className="btn-ghost" disabled={!running}>
              Ввод
            </button>
          </form>
        </div>

        {/* Players + whitelist */}
        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="panel flex-1 overflow-hidden">
            <div className="border-b border-andesite-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-andesite-400">
              Онлайн ({server.players.length})
            </div>
            <div className="space-y-1 p-3 text-sm">
              {server.players.length === 0 ? (
                <span className="text-andesite-500">Никого нет</span>
              ) : (
                server.players.map((p) => (
                  <div key={p} className="text-brass-100">
                    {p}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel flex-1 overflow-hidden">
            <div className="border-b border-andesite-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-andesite-400">
              Вайтлист ({server.whitelist.length})
            </div>
            <div className="flex flex-col p-3">
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Ник"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nick.trim()) {
                      window.balumba.addToWhitelist(nick.trim());
                      setNick('');
                    }
                  }}
                />
                <button
                  className="btn-ghost px-3"
                  onClick={() => {
                    if (nick.trim()) {
                      window.balumba.addToWhitelist(nick.trim());
                      setNick('');
                    }
                  }}
                >
                  +
                </button>
              </div>
              <div className="mt-2 space-y-1 overflow-y-auto text-sm">
                {server.whitelist.map((w) => (
                  <div key={w} className="flex items-center justify-between">
                    <span className="text-brass-100">{w}</span>
                    <button
                      className="text-red-400 hover:text-red-300"
                      onClick={() => window.balumba.removeFromWhitelist(w)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
