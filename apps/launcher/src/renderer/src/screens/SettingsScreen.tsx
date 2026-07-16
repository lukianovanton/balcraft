import { useState } from 'react';
import type { LauncherStateHook } from '../hooks/useLauncherState';

export function SettingsScreen({ state }: { state: LauncherStateHook }): JSX.Element {
  const { settings, systemInfo, saveSettings } = state;
  const [access, setAccess] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  if (!settings || !systemInfo) {
    return <div className="p-8 text-andesite-400">Загрузка…</div>;
  }

  async function checkAccess() {
    setAccess('checking');
    const ok = await window.balumba.checkAdminAccess();
    setAccess(ok ? 'ok' : 'fail');
  }

  const maxRamGb = Math.round(settings.maxRamMb / 1024);
  const totalGb = Math.max(2, Math.floor(systemInfo.totalRamMb / 1024));

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h2 className="text-2xl font-bold text-brass-50">Настройки</h2>

      <div className="panel space-y-5 p-5">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-brass-100">Выделенная память</label>
            <span className="text-sm text-brass-300">{maxRamGb} ГБ</span>
          </div>
          <input
            type="range"
            min={2}
            max={totalGb}
            step={1}
            value={maxRamGb}
            className="mt-3 w-full accent-brass-500"
            onChange={(e) => saveSettings({ maxRamMb: Number(e.target.value) * 1024 })}
          />
          <div className="mt-1 flex justify-between text-[11px] text-andesite-500">
            <span>2 ГБ</span>
            <span>Всего в системе: {totalGb} ГБ</span>
          </div>
          <p className="mt-2 text-xs text-andesite-400">
            Для этой сборки рекомендуется 6–8 ГБ. Больше половины ОЗУ выделять не стоит.
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-brass-100">
            Дополнительные аргументы JVM
          </label>
          <input
            className="input mt-2 font-mono"
            placeholder="-XX:+UseG1GC …"
            defaultValue={settings.extraJvmArgs.join(' ')}
            onBlur={(e) =>
              saveSettings({
                extraJvmArgs: e.target.value.split(/\s+/).filter(Boolean),
              })
            }
          />
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brass-500"
            checked={settings.closeOnLaunch}
            onChange={(e) => saveSettings({ closeOnLaunch: e.target.checked })}
          />
          <span className="text-sm text-brass-100">Закрывать лаунчер после запуска игры</span>
        </label>
      </div>

      {/* Admin / distribution */}
      <div className="panel space-y-4 p-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brass-500"
            checked={settings.adminMode}
            onChange={(e) => saveSettings({ adminMode: e.target.checked })}
          />
          <span className="text-sm font-semibold text-brass-100">
            Режим админа (управление и публикация общей сборки)
          </span>
        </label>

        {settings.adminMode && (
          <div className="space-y-3 border-t border-andesite-700 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-andesite-400">GitHub — владелец</label>
                <input
                  className="input mt-1"
                  placeholder="lukianovanton"
                  defaultValue={settings.githubOwner}
                  onBlur={(e) => saveSettings({ githubOwner: e.target.value.trim() })}
                />
              </div>
              <div>
                <label className="text-xs text-andesite-400">GitHub — репозиторий сборки</label>
                <input
                  className="input mt-1"
                  placeholder="balcraft-pack"
                  defaultValue={settings.githubRepo}
                  onBlur={(e) => saveSettings({ githubRepo: e.target.value.trim() })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-andesite-400">
                GitHub — токен (repo, contents:write){' '}
                {settings.hasGithubToken && <span className="text-green-400">✓ сохранён</span>}
              </label>
              <input
                type="password"
                className="input mt-1 font-mono"
                placeholder={settings.hasGithubToken ? '•••••••• (введи новый, чтобы заменить)' : 'ghp_…'}
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    saveSettings({ githubToken: e.target.value.trim() });
                    e.target.value = '';
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost text-xs" onClick={checkAccess}>
                Проверить доступ
              </button>
              {access === 'checking' && <span className="text-xs text-andesite-400">Проверка…</span>}
              {access === 'ok' && <span className="text-xs text-green-400">Доступ есть ✓</span>}
              {access === 'fail' && (
                <span className="text-xs text-red-400">Нет доступа — проверь токен/репозиторий</span>
              )}
            </div>

            <div className="border-t border-andesite-700 pt-3">
              <label className="text-xs text-andesite-400">
                Azure Client ID (для входа Microsoft, необязательно)
              </label>
              <input
                className="input mt-1 font-mono"
                placeholder="xxxxxxxx-xxxx-…"
                defaultValue={settings.azureClientId}
                onBlur={(e) => saveSettings({ azureClientId: e.target.value.trim() })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="panel space-y-1 p-5 text-sm text-andesite-400">
        <div className="flex justify-between">
          <span>Версия лаунчера</span>
          <span className="text-brass-200">v{systemInfo.appVersion}</span>
        </div>
        <div className="flex justify-between">
          <span>Ядер CPU</span>
          <span className="text-brass-200">{systemInfo.cpuCount}</span>
        </div>
        <div className="flex justify-between">
          <span>ОЗУ</span>
          <span className="text-brass-200">{totalGb} ГБ</span>
        </div>
      </div>
    </div>
  );
}
