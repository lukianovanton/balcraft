import type { LauncherStateHook } from '../hooks/useLauncherState';
import type { LaunchStage } from '../../../shared/ipc';

const STAGE_LABEL: Record<LaunchStage, string> = {
  idle: 'Готов к запуску',
  checking: 'Проверка файлов…',
  'installing-java': 'Установка Java…',
  'installing-minecraft': 'Установка Minecraft…',
  'installing-loader': 'Установка NeoForge…',
  'syncing-pack': 'Синхронизация сборки…',
  launching: 'Запуск игры…',
  running: 'Игра запущена',
  error: 'Ошибка',
};

export function PlayScreen({ state }: { state: LauncherStateHook }): JSX.Element {
  const { launch, selectedAccount } = state;
  const busy = launch.stage !== 'idle' && launch.stage !== 'error' && launch.stage !== 'running';
  const running = launch.stage === 'running';
  const pct = launch.progress?.progress != null ? Math.round(launch.progress.progress * 100) : null;

  const canPlay = !!selectedAccount && !busy && !running;
  const playLabel = running ? '● Игра запущена' : busy ? 'Подготовка…' : '▶  Играть';

  return (
    <div className="relative flex h-full flex-col">
      {/* Hero */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-andesite-800/40 via-andesite-900/70 to-andesite-900" />
        <div className="relative flex h-full flex-col justify-end p-10">
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-copper-400">
            Приватная сборка
          </div>
          <h1 className="text-5xl font-black tracking-tight text-brass-50 drop-shadow">
            BalumbaCraft
          </h1>
          <p className="mt-2 max-w-lg text-sm text-andesite-400">
            Create-сборка на NeoForge 1.21.1. Лаунчер сам обновит моды до актуальной версии перед
            заходом.
          </p>
        </div>
      </div>

      {/* Launch bar */}
      <div className="border-t border-andesite-600 bg-andesite-850/95 px-8 py-5">
        <div className="flex items-center gap-6">
          <button
            className="btn-primary h-14 min-w-[190px] text-lg"
            disabled={!canPlay}
            onClick={() => window.balumba.play()}
          >
            {playLabel}
          </button>

          <div className="flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-brass-100">{STAGE_LABEL[launch.stage]}</span>
              {pct != null && <span className="text-andesite-400">{pct}%</span>}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-andesite-700">
              <div
                className={`h-full rounded-full transition-all ${
                  launch.stage === 'error' ? 'bg-red-600' : 'bg-brass-500'
                }`}
                style={{ width: pct != null ? `${pct}%` : busy ? '35%' : '0%' }}
              />
            </div>
            {launch.progress?.detail && (
              <div className="mt-1 truncate text-xs text-andesite-500">
                {launch.progress.detail}
              </div>
            )}
            {launch.stage === 'error' && launch.error && (
              <div className="mt-1 text-xs text-red-400">{launch.error}</div>
            )}
          </div>

          {busy && (
            <button className="btn-ghost" onClick={() => window.balumba.cancelLaunch()}>
              Отмена
            </button>
          )}
        </div>

        {!selectedAccount && (
          <div className="mt-3 text-xs text-copper-400">
            Сначала добавь аккаунт во вкладке «Аккаунты».
          </div>
        )}
      </div>
    </div>
  );
}
