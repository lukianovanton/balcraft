import { useCallback, useEffect, useState } from 'react';
import type { ModrinthHit, ModrinthProjectType, MasterEntry } from '@balumba/core';
import type { LauncherStateHook } from '../hooks/useLauncherState';
import { PageHeader } from '../components/PageHeader.js';
import { IconSearch, IconDownload, IconPlus, IconTrash } from '../components/Icons.js';

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

export function AdminScreen({ state }: { state: LauncherStateHook }): JSX.Element {
  const [type, setType] = useState<ModrinthProjectType>('mod');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ModrinthHit[]>([]);
  const [entries, setEntries] = useState<MasterEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [packFilter, setPackFilter] = useState('');

  const entryIds = new Set(entries.map((e) => e.projectId));

  const refresh = useCallback(async () => {
    setEntries(await window.balumba.listPackEntries());
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const search = useCallback(async () => {
    setSearching(true);
    try {
      setHits(await window.balumba.searchContent(query, type));
    } finally {
      setSearching(false);
    }
  }, [query, type]);
  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function add(hit: ModrinthHit) {
    setBusy(hit.project_id);
    setMsg(null);
    try {
      setEntries(await window.balumba.addPackProject(hit.project_id, type));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }
  async function remove(projectId: string) {
    setEntries(await window.balumba.removePackProject(projectId));
  }
  async function toggleSide(e: MasterEntry) {
    setEntries(await window.balumba.setPackSide(e.projectId, e.side === 'both' ? 'client' : 'both'));
  }
  async function importFolder() {
    setMsg('Импорт…');
    const res = await window.balumba.importPackFolder();
    if (!res) return setMsg(null);
    await refresh();
    setMsg(`Импортировано ${res.added}. Не распознано на Modrinth: ${res.unresolved.length}`);
  }
  async function publish() {
    setPublishing(true);
    setMsg(null);
    try {
      const r = await window.balumba.publishPack();
      setMsg(
        `Опубликовано: версия ${r.version}, файлов ${r.fileCount}` +
          (r.addedDeps ? `, авто-добавлено зависимостей: ${r.addedDeps}` : '') +
          '. У всех обновится при запуске.',
      );
      await state.refreshPackStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  const tabEntries = entries
    .filter((e) => e.type === type)
    .filter((e) => e.title.toLowerCase().includes(packFilter.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Общая сборка"
        subtitle="То, что получают все друзья. Моды берутся с Modrinth CDN — публикуется только манифест."
        actions={
          <>
            <button className="btn-ghost" onClick={importFolder}>
              Импорт из папки
            </button>
            <button className="btn-primary" disabled={publishing} onClick={publish}>
              {publishing ? 'Публикую…' : '⬆ Опубликовать'}
            </button>
          </>
        }
      />

      {msg && (
        <div className="mx-6 mt-3 rounded-lg border border-white/5 bg-white/[0.03] px-4 py-2 text-sm text-brass-100">
          {msg}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Type rail */}
        <aside className="w-52 shrink-0 space-y-1 border-r border-white/5 p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-andesite-400">
            Тип
          </div>
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
                {entries.filter((e) => e.type === t.key).length || ''}
              </span>
            </button>
          ))}
        </aside>

        {/* Catalog (add) */}
        <div className="flex min-h-0 flex-1 flex-col border-r border-white/5">
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
                placeholder="Найти на Modrinth, чтобы добавить…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn-ghost" disabled={searching}>
              {searching ? '…' : 'Найти'}
            </button>
          </form>
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {hits.map((hit) => (
              <div key={hit.project_id} className="panel flex items-center gap-3 p-3">
                {hit.icon_url ? (
                  <img src={hit.icon_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-andesite-700 text-andesite-400">
                    <IconDownload className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-brass-50">{hit.title}</div>
                  <div className="flex items-center gap-1 text-[11px] text-andesite-400">
                    <IconDownload className="h-3 w-3" /> {fmt(hit.downloads)}
                  </div>
                </div>
                {entryIds.has(hit.project_id) ? (
                  <span className="chip bg-brass-500/15 text-brass-300">в сборке</span>
                ) : (
                  <button
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busy === hit.project_id}
                    onClick={() => add(hit)}
                  >
                    {busy === hit.project_id ? '…' : (
                      <>
                        <IconPlus className="h-3.5 w-3.5" /> В сборку
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* In pack */}
        <div className="flex w-80 shrink-0 flex-col">
          <div className="flex items-center gap-2 border-b border-white/5 p-4">
            <span className="text-sm font-semibold text-brass-100">В сборке ({tabEntries.length})</span>
            <input
              className="input ml-auto h-8 w-32 py-1 text-xs"
              placeholder="Фильтр…"
              value={packFilter}
              onChange={(e) => setPackFilter(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-3">
            {tabEntries.length === 0 ? (
              <div className="px-2 py-4 text-sm text-andesite-500">Пусто.</div>
            ) : (
              tabEntries.map((e) => (
                <div key={e.projectId} className="row group">
                  {e.icon ? (
                    <img src={e.icon} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-andesite-700 text-andesite-400">
                      <IconDownload className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-brass-100" title={e.filename}>
                    {e.title}
                  </span>
                  {e.type === 'mod' && (
                    <button
                      className={`chip ${
                        e.side === 'both'
                          ? 'bg-brass-500/15 text-brass-300'
                          : 'bg-white/5 text-andesite-400'
                      }`}
                      onClick={() => toggleSide(e)}
                      title="Клиент+сервер / только клиент"
                    >
                      {e.side === 'both' ? 'клиент+сервер' : 'клиент'}
                    </button>
                  )}
                  <button
                    className="text-andesite-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    onClick={() => remove(e.projectId)}
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
