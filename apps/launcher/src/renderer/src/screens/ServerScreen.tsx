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

      <div className="grid flex-1 grid-cols-3 gap-4 overflow-hidden">
        {/* Console */}
        <div className="panel col-span-2 flex flex-col overflow-hidden">
          <div className="border-b border-andesite-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-andesite-400">
            Консоль
          </div>
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-[12px] leading-relaxed text-andesite-200"
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
