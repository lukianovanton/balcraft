import { useEffect, useRef, useState } from 'react';
import type { LauncherStateHook } from '../hooks/useLauncherState';
import type { ServerStatus } from '../../../shared/ipc';
import { PageHeader, Tabs } from '../components/PageHeader.js';
import { IconCopy, IconPlus, IconTrash } from '../components/Icons.js';

const STATUS: Record<ServerStatus, { label: string; dot: string }> = {
  stopped: { label: 'Остановлен', dot: 'bg-andesite-500' },
  starting: { label: 'Запускается…', dot: 'bg-copper-400 animate-pulse' },
  running: { label: 'Работает', dot: 'bg-brass-500' },
  stopping: { label: 'Останавливается…', dot: 'bg-copper-400 animate-pulse' },
};

type Tab = 'overview' | 'console' | 'players' | 'whitelist';

export function ServerScreen({ state }: { state: LauncherStateHook }): JSX.Element {
  const { server, serverLog, settings } = state;
  const [tab, setTab] = useState<Tab>('overview');
  const [cmd, setCmd] = useState('');
  const [nick, setNick] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [serverLog]);

  const running = server.status === 'running';
  const stopped = server.status === 'stopped';
  const st = STATUS[server.status];

  const numField = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    min: number,
    max: number,
  ) => (
    <label className="text-xs text-andesite-400">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={!stopped}
        className="input mt-1"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Сервер"
        subtitle={
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${st.dot}`} /> {st.label}
          </span>
        }
        actions={
          stopped ? (
            <button className="btn-primary" onClick={() => window.balumba.startServer()}>
              ▶ Запустить
            </button>
          ) : (
            <button
              className="btn-danger"
              disabled={!running}
              onClick={() => window.balumba.stopServer()}
            >
              ■ Остановить
            </button>
          )
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Обзор' },
          { key: 'console', label: 'Консоль' },
          { key: 'players', label: 'Игроки', badge: server.players.length },
          { key: 'whitelist', label: 'Вайтлист', badge: server.whitelist.length },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {/* OVERVIEW */}
        {tab === 'overview' && settings && (
          <div className="mx-auto max-w-3xl space-y-4">
            {server.publicAddress && (
              <div className="panel flex items-center gap-4 p-4">
                <div className="text-xs uppercase tracking-wide text-andesite-400">Адрес сервера</div>
                <div className="selectable flex-1 font-mono text-lg text-brass-100">
                  {server.publicAddress}
                </div>
                <button
                  className="btn-ghost"
                  onClick={() => navigator.clipboard.writeText(server.publicAddress!)}
                >
                  <IconCopy className="h-4 w-4" /> Копировать
                </button>
              </div>
            )}

            <div className="panel p-5">
              <div className="mb-4 text-sm font-semibold text-brass-100">Настройки сервера</div>
              <div className="grid grid-cols-2 gap-4">
                <label className="col-span-2 text-xs text-andesite-400">
                  Память сервера: {Math.round(settings.serverRamMb / 1024)} ГБ
                  <input
                    type="range"
                    min={2}
                    max={Math.max(4, Math.floor((state.systemInfo?.totalRamMb ?? 8192) / 1024))}
                    value={Math.round(settings.serverRamMb / 1024)}
                    disabled={!stopped}
                    className="mt-2 w-full accent-brass-500"
                    onChange={(e) => state.saveSettings({ serverRamMb: Number(e.target.value) * 1024 })}
                  />
                </label>
                {numField('Дистанция прогрузки', settings.serverViewDistance, (n) =>
                  state.saveSettings({ serverViewDistance: n }), 4, 32)}
                {numField('Макс. игроков', settings.serverMaxPlayers, (n) =>
                  state.saveSettings({ serverMaxPlayers: n }), 1, 100)}
                <label className="col-span-2 text-xs text-andesite-400">
                  Описание (MOTD)
                  <input
                    className="input mt-1"
                    defaultValue={settings.serverMotd}
                    disabled={!stopped}
                    onBlur={(e) => state.saveSettings({ serverMotd: e.target.value })}
                  />
                </label>
              </div>
              {!stopped && (
                <p className="mt-3 text-[11px] text-andesite-500">
                  Настройки применятся при следующем запуске сервера.
                </p>
              )}
            </div>
          </div>
        )}

        {/* CONSOLE */}
        {tab === 'console' && (
          <div className="flex h-full flex-col">
            <div
              ref={logRef}
              className="selectable panel flex-1 overflow-y-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-relaxed text-andesite-200"
            >
              {serverLog.length === 0 ? (
                <span className="text-andesite-500">Лог сервера появится здесь…</span>
              ) : (
                serverLog.map((l, i) => <div key={i}>{l}</div>)
              )}
            </div>
            <form
              className="mt-3 flex gap-2"
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
        )}

        {/* PLAYERS */}
        {tab === 'players' && (
          <div className="mx-auto max-w-2xl">
            {server.players.length === 0 ? (
              <div className="grid place-items-center py-16 text-sm text-andesite-500">
                Сейчас никого нет онлайн
              </div>
            ) : (
              <div className="panel divide-y divide-white/5">
                {server.players.map((p) => (
                  <div key={p} className="flex items-center gap-3 p-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-andesite-700 text-sm text-brass-100">
                      {p.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-brass-100">{p}</span>
                    <span className="ml-auto h-2 w-2 rounded-full bg-brass-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WHITELIST */}
        {tab === 'whitelist' && (
          <div className="mx-auto max-w-2xl space-y-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (nick.trim()) {
                  window.balumba.addToWhitelist(nick.trim());
                  setNick('');
                }
              }}
            >
              <input
                className="input"
                placeholder="Ник игрока"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
              />
              <button className="btn-primary">
                <IconPlus className="h-4 w-4" /> Добавить
              </button>
            </form>
            {server.whitelist.length === 0 ? (
              <div className="grid place-items-center py-12 text-sm text-andesite-500">
                Вайтлист пуст — добавь ники друзей
              </div>
            ) : (
              <div className="panel divide-y divide-white/5">
                {server.whitelist.map((w) => (
                  <div key={w} className="flex items-center gap-3 p-3">
                    <span className="text-brass-100">{w}</span>
                    <button
                      className="ml-auto text-andesite-500 hover:text-red-400"
                      onClick={() => window.balumba.removeFromWhitelist(w)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
