import { useCallback, useEffect, useState } from 'react';
import type { ModrinthHit, ModrinthProjectType, UserContentEntry } from '@balumba/core';
import { PageHeader } from '../components/PageHeader.js';
import { IconSearch, IconDownload, IconTrash, IconPlus } from '../components/Icons.js';

const TYPES: { key: ModrinthProjectType; label: string }[] = [
  { key: 'mod', label: 'Моды' },
  { key: 'resourcepack', label: 'Ресурспаки' },
  { key: 'shader', label: 'Шейдеры' },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function ContentScreen(): JSX.Element {
  const [type, setType] = useState<ModrinthProjectType>('mod');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ModrinthHit[]>([]);
  const [installed, setInstalled] = useState<UserContentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instFilter, setInstFilter] = useState('');

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
      setHits(await window.balumba.searchContent(query, type));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [query, type]);

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function install(hit: ModrinthHit) {
    setBusyId(hit.project_id);
    setError(null);
    try {
      await window.balumba.installContent(hit.project_id, type);
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
    .filter((i) => i.type === type)
    .filter((i) => i.title.toLowerCase().includes(instFilter.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Моды"
        subtitle="Личные дополнения — не влияют на общую сборку и не затираются обновлением"
      />

      <div className="flex min-h-0 flex-1">
        {/* Filter rail */}
        <aside className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/5 p-4">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-andesite-400">
              Тип
            </div>
            <div className="space-y-1">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    type === t.key
                      ? 'bg-brass-500/12 font-medium text-brass-100'
                      : 'text-andesite-400 hover:bg-white/5 hover:text-brass-100'
                  }`}
                >
                  {t.label}
                  <span className="text-[11px] text-andesite-500">
                    {installed.filter((i) => i.type === t.key).length || ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-andesite-400">
                Установлено ({tabInstalled.length})
              </span>
            </div>
            <input
              className="input mb-2 h-8 py-1 text-xs"
              placeholder="Фильтр…"
              value={instFilter}
              onChange={(e) => setInstFilter(e.target.value)}
            />
            <div className="space-y-1">
              {tabInstalled.length === 0 ? (
                <div className="px-1 text-xs text-andesite-500">Пусто</div>
              ) : (
                tabInstalled.map((i) => (
                  <div key={i.projectId} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
                    <span className="min-w-0 flex-1 truncate text-xs text-brass-100" title={i.title}>
                      {i.title}
                    </span>
                    <button
                      className="text-andesite-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      onClick={() => remove(i.projectId)}
                      title="Удалить"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex min-h-0 flex-1 flex-col">
          <form
            className="flex gap-2 border-b border-white/5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-andesite-400" />
              <input
                className="input pl-9"
                placeholder={`Поиск: ${TYPES.find((t) => t.key === type)?.label.toLowerCase()}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn-ghost" disabled={loading}>
              {loading ? '…' : 'Найти'}
            </button>
          </form>

          {error && <div className="px-4 pt-3 text-sm text-red-400">{error}</div>}

          <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto p-4">
            {hits.map((hit) => {
              const isInstalled = installedIds.has(hit.project_id);
              const busy = busyId === hit.project_id;
              return (
                <div
                  key={hit.project_id}
                  className="panel flex gap-3 p-3.5 transition-colors hover:border-white/10"
                >
                  {hit.icon_url ? (
                    <img src={hit.icon_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-andesite-700 text-andesite-400">
                      <IconDownload className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-semibold text-brass-50">{hit.title}</span>
                      <span className="shrink-0 text-[11px] text-andesite-500">{hit.author}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 flex-1 text-xs leading-relaxed text-andesite-400">
                      {hit.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] text-andesite-400">
                        <IconDownload className="h-3.5 w-3.5" /> {fmt(hit.downloads)}
                      </span>
                      <div className="ml-auto">
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
                            {busy ? 'Ставлю…' : (
                              <>
                                <IconPlus className="h-3.5 w-3.5" /> Установить
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && hits.length === 0 && (
              <div className="col-span-2 grid place-items-center py-16 text-sm text-andesite-500">
                Ничего не найдено.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
