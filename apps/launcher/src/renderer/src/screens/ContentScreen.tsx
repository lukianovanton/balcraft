import { useCallback, useEffect, useState } from 'react';
import type { ModrinthHit, ModrinthProjectType, UserContentEntry } from '@balumba/core';

const TABS: { key: ModrinthProjectType; label: string }[] = [
  { key: 'mod', label: 'Моды' },
  { key: 'resourcepack', label: 'Ресурспаки' },
  { key: 'shader', label: 'Шейдеры' },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ContentScreen(): JSX.Element {
  const [tab, setTab] = useState<ModrinthProjectType>('mod');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ModrinthHit[]>([]);
  const [installed, setInstalled] = useState<UserContentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installedFilter, setInstalledFilter] = useState('');

  const installedIds = new Set(installed.map((i) => i.projectId));

  const refreshInstalled = useCallback(async () => {
    setInstalled(await window.balumba.listInstalledContent());
  }, []);

  useEffect(() => {
    void refreshInstalled();
  }, [refreshInstalled]);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHits(await window.balumba.searchContent(query, tab));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  // Auto-search when switching tabs (shows popular items for empty query).
  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function install(hit: ModrinthHit) {
    setBusyId(hit.project_id);
    setError(null);
    try {
      await window.balumba.installContent(hit.project_id, tab);
      await refreshInstalled();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(projectId: string) {
    setBusyId(projectId);
    try {
      await window.balumba.removeContent(projectId);
      await refreshInstalled();
    } finally {
      setBusyId(null);
    }
  }

  const tabInstalled = installed
    .filter((i) => i.type === tab)
    .filter((i) => i.title.toLowerCase().includes(installedFilter.toLowerCase()));

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-brass-50">Менеджер сборки</h2>
        <div className="flex gap-1 rounded-lg bg-andesite-800 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === t.key ? 'bg-brass-500 text-andesite-900' : 'text-andesite-300 hover:text-brass-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          className="input"
          placeholder={`Поиск: ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-ghost" disabled={loading}>
          {loading ? '…' : 'Найти'}
        </button>
      </form>

      {error && <div className="mb-3 text-sm text-red-400">{error}</div>}

      <div className="grid flex-1 grid-cols-3 gap-4 overflow-hidden">
        {/* Search results */}
        <div className="col-span-2 overflow-y-auto pr-1">
          <div className="space-y-2">
            {hits.map((hit) => {
              const isInstalled = installedIds.has(hit.project_id);
              const busy = busyId === hit.project_id;
              return (
                <div key={hit.project_id} className="panel flex items-center gap-3 p-3">
                  {hit.icon_url ? (
                    <img src={hit.icon_url} alt="" className="h-12 w-12 rounded-md object-cover" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-md bg-andesite-700 text-lg">
                      🧩
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-brass-100">{hit.title}</span>
                      <span className="shrink-0 text-[11px] text-andesite-500">
                        ⬇ {fmt(hit.downloads)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-andesite-400">{hit.description}</div>
                  </div>
                  {isInstalled ? (
                    <button
                      className="btn-danger px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => remove(hit.project_id)}
                    >
                      {busy ? '…' : 'Удалить'}
                    </button>
                  ) : (
                    <button
                      className="btn-primary px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => install(hit)}
                    >
                      {busy ? 'Ставлю…' : 'Установить'}
                    </button>
                  )}
                </div>
              );
            })}
            {!loading && hits.length === 0 && (
              <div className="p-6 text-center text-sm text-andesite-500">Ничего не найдено.</div>
            )}
          </div>
        </div>

        {/* Installed panel */}
        <div className="panel flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-andesite-700 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-andesite-400">
              Установлено ({tabInstalled.length})
            </span>
            <input
              className="input ml-auto h-7 max-w-[55%] py-1 text-xs"
              placeholder="Фильтр…"
              value={installedFilter}
              onChange={(e) => setInstalledFilter(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-3">
            {tabInstalled.length === 0 ? (
              <div className="text-sm text-andesite-500">Пусто. Установи что-нибудь слева.</div>
            ) : (
              tabInstalled.map((i) => (
                <div key={i.projectId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-brass-100" title={i.title}>
                    {i.title}
                  </span>
                  <button
                    className="shrink-0 text-red-400 hover:text-red-300"
                    onClick={() => remove(i.projectId)}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-andesite-700 p-3 text-[11px] text-andesite-500">
            Твои личные дополнения не затираются обновлением сборки. Для игры на общем сервере
            добавляй только клиентские вещи (шейдеры, ресурспаки, миникарты).
          </div>
        </div>
      </div>
    </div>
  );
}
