import { useState } from 'react';
import type { LauncherStateHook } from '../hooks/useLauncherState';
import { PageHeader } from '../components/PageHeader.js';

type Section = 'game' | 'publish' | 'chicken' | 'about';

export function SettingsScreen({ state }: { state: LauncherStateHook }): JSX.Element {
  const { settings, systemInfo, saveSettings } = state;
  const [section, setSection] = useState<Section>('game');
  const [access, setAccess] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  if (!settings || !systemInfo) {
    return <div className="p-8 text-andesite-400">Загрузка…</div>;
  }

  const maxRamGb = Math.round(settings.maxRamMb / 1024);
  const totalGb = Math.max(2, Math.floor(systemInfo.totalRamMb / 1024));

  async function checkAccess() {
    setAccess('checking');
    setAccess((await window.balumba.checkAdminAccess()) ? 'ok' : 'fail');
  }

  const NAV: { key: Section; label: string }[] = [
    { key: 'game', label: 'Игра' },
    { key: 'publish', label: 'Публикация (админ)' },
    { key: 'chicken', label: 'Петух (ИИ)' },
    { key: 'about', label: 'О программе' },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Настройки" />
      <div className="flex min-h-0 flex-1">
        <aside className="w-52 shrink-0 space-y-1 border-r border-white/5 p-4">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setSection(n.key)}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                section === n.key
                  ? 'bg-brass-500/12 font-medium text-brass-100'
                  : 'text-andesite-400 hover:bg-white/5 hover:text-brass-100'
              }`}
            >
              {n.label}
            </button>
          ))}
        </aside>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {section === 'game' && (
              <>
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
                      value={maxRamGb}
                      className="mt-3 w-full accent-brass-500"
                      onChange={(e) => saveSettings({ maxRamMb: Number(e.target.value) * 1024 })}
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-andesite-500">
                      <span>2 ГБ</span>
                      <span>Всего: {totalGb} ГБ</span>
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
                        saveSettings({ extraJvmArgs: e.target.value.split(/\s+/).filter(Boolean) })
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
              </>
            )}

            {section === 'publish' && (
              <div className="panel space-y-4 p-5">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brass-500"
                    checked={settings.adminMode}
                    onChange={(e) => saveSettings({ adminMode: e.target.checked })}
                  />
                  <span className="text-sm font-semibold text-brass-100">
                    Режим админа (управление и публикация сборки)
                  </span>
                </label>

                {settings.adminMode && (
                  <div className="space-y-3 border-t border-white/5 pt-3">
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
                        <label className="text-xs text-andesite-400">GitHub — репозиторий</label>
                        <input
                          className="input mt-1"
                          placeholder="balcraft"
                          defaultValue={settings.githubRepo}
                          onBlur={(e) => saveSettings({ githubRepo: e.target.value.trim() })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-andesite-400">
                        GitHub — токен (repo){' '}
                        {settings.hasGithubToken && <span className="text-brass-400">✓ сохранён</span>}
                      </label>
                      <input
                        type="password"
                        className="input mt-1 font-mono"
                        placeholder={settings.hasGithubToken ? '•••••••• (новый — заменить)' : 'ghp_…'}
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
                      {access === 'ok' && <span className="text-xs text-brass-400">Доступ есть ✓</span>}
                      {access === 'fail' && <span className="text-xs text-red-400">Нет доступа</span>}
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <label className="text-xs text-andesite-400">Адрес сервера для друзей (IP или домен)</label>
                      <input
                        className="input mt-1 font-mono"
                        placeholder="например, 134.249.137.220"
                        defaultValue={settings.serverPublicAddress}
                        onBlur={(e) => saveSettings({ serverPublicAddress: e.target.value.trim() })}
                      />
                      <span className="mt-1 block text-[11px] text-andesite-500">
                        Вводишь один раз. После «Сборка → Опубликовать» сервер сам появится в списке
                        «Сетевая игра» у всех друзей.
                      </span>
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <label className="text-xs text-andesite-400">
                        Azure Client ID (вход Microsoft, необязательно)
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
            )}

            {section === 'chicken' && (
              <div className="panel space-y-4 p-5">
                <div>
                  <div className="text-sm font-semibold text-brass-100">Петух (ИИ)</div>
                  <p className="mt-1 text-xs text-andesite-400">
                    Бессмертный ИИ-петух живёт на сервере: пиши в чат — отвечает с характером и
                    реально действует (подойти, следовать, заклевать игрока или моба, охранять,
                    выкопать ямку, гулять). Его можно бить — он реагирует, но не умирает. Характер и
                    поведение можно переписать промптом ниже. Мозг работает, пока открыт Gearhaven.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-andesite-400">
                    Ключ Anthropic API{' '}
                    {settings.hasAnthropicKey && <span className="text-brass-400">✓ сохранён</span>}
                  </label>
                  <input
                    type="password"
                    className="input mt-1 font-mono"
                    placeholder={settings.hasAnthropicKey ? '•••••••• (новый — заменить)' : 'sk-ant-…'}
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        saveSettings({ anthropicApiKey: e.target.value.trim() });
                        e.target.value = '';
                      }
                    }}
                  />
                  <span className="mt-1 block text-[11px] text-andesite-500">
                    Хранится зашифрованно на этом ПК. Модель Haiku — стоит копейки за сообщение.
                  </span>
                </div>
                <ChickenPromptEditor
                  value={settings.chickenPrompt ?? ''}
                  fallback={systemInfo.defaultChickenPrompt}
                  onSave={(v) => saveSettings({ chickenPrompt: v })}
                />
                <div className="border-t border-white/5 pt-3 text-[11px] leading-relaxed text-andesite-400">
                  <div className="mb-1 font-semibold text-brass-200">Как включить в игре:</div>
                  1. Положи мод <span className="font-mono text-brass-300">gearhaven-chicken.jar</span> в
                  папку модов (клиент и сервер).<br />
                  2. Впиши ключ выше, запусти сервер — Петух уже там, живёт на сервере сам, висит в
                  табе. Призывать не нужно.<br />
                  3. Хочешь подозвать к себе —{' '}
                  <span className="font-mono text-brass-300">/chicken</span> телепортнёт его к тебе.<br />
                  4. Пиши в чат: «заклюй Васю», «убей скелета», «выкопай ямку», «охраняй меня»,
                  «гуляй» — она поймёт и сделает.
                </div>
              </div>
            )}

            {section === 'about' && (
              <div className="panel space-y-2 p-5 text-sm text-andesite-400">
                <div className="mb-2 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brass-500 text-andesite-900">
                    <span className="text-lg font-black">G</span>
                  </div>
                  <div>
                    <div className="font-semibold text-brass-50">Gearhaven</div>
                    <div className="text-xs text-andesite-500">Create · NeoForge 1.21.1</div>
                  </div>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Editor for the chicken's personality/behaviour prompt. Empty = built-in default. */
function ChickenPromptEditor({
  value,
  fallback,
  onSave,
}: {
  value: string;
  fallback: string;
  onSave: (v: string) => void;
}): JSX.Element {
  const [text, setText] = useState(value);
  const custom = text.trim().length > 0;
  return (
    <div className="border-t border-white/5 pt-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-brass-200">
          Промпт Петуха (характер и поведение)
        </label>
        <button
          className="text-[11px] text-andesite-400 hover:text-brass-200 disabled:opacity-40"
          disabled={!custom}
          onClick={() => {
            setText('');
            onSave('');
          }}
        >
          Сбросить к стандартному
        </button>
      </div>
      <textarea
        className="input mt-1 h-56 resize-y font-mono text-[11px] leading-relaxed"
        placeholder={fallback}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text.trim())}
      />
      <span className="mt-1 block text-[11px] text-andesite-500">
        {custom
          ? 'Используется твой промпт. Опиши характер и как реагировать — можно на любом языке.'
          : 'Пусто — работает стандартный характер (показан серым как подсказка). Начни писать, чтобы переопределить.'}
      </span>
    </div>
  );
}
