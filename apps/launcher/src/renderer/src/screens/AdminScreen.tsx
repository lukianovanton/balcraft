import { useCallback, useEffect, useState } from 'react';
import type { ModrinthHit, ModrinthProjectType, MasterEntry } from '@balumba/core';
import type { LauncherStateHook } from '../hooks/useLauncherState';

const TABS: { key: ModrinthProjectType; label: string }[] = [
  { key: 'mod', label: 'Моды' },
  { key: 'resourcepack', label: 'Ресурспаки' },
  { key: 'shader', label: 'Шейдеры' },
];

export function AdminScreen({ state }: { state: LauncherStateHook }): JSX.Element {
  const [tab, setTab] = useState<ModrinthProjectType>('mod');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ModrinthHit[]>([]);
  const [entries, setEntries] = useState<MasterEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const entryIds = new Set(entries.map((e) => e.projectId));

  const [searching, setSearching] = useState(false);

  const refresh = useCallback(async () => {
    setEntries(await window.balumba.listPackEntries());
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const search = useCallback(async () => {
    setSearching(true);
    try {
      setHits(await window.balumba.searchContent(query, tab));
    } finally {
      setSearching(false);
    }
  }, [query, tab]);

  // Auto-load popular items when switching tabs so there's always a browsable list.
  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function add(hit: ModrinthHit) {
    setBusy(hit.project_id);
    setMsg(null);
    try {
      setEntries(await window.balumba.addPackProject(hit.project_id, tab));
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
    const next = e.side === 'both' ? 'client' : 'both';
    setEntries(await window.balumba.setPackSide(e.projectId, next));
  }

  async function importFolder() {
    setMsg('Импорт…');
    const res = await window.balumba.importPackFolder();
    if (!res) {
      setMsg(null);
      return;
    }
    await refresh();
    setMsg(
      `Импортировано ${res.added}. Не распознано на Modrinth: ${res.unresolved.length}` +
        (res.unresolved.length ? ` (${res.unresolved.slice(0, 5).join(', ')}…)` : ''),
    );
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

  const tabEntries = entries.filter((e) => e.type === tab);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brass-50">Общая сборка</h2>
          <p className="text-xs text-andesite-400">
            То, что получают все друзья. Моды берутся с Modrinth CDN — публикуется только манифест.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={importFolder}>
            Импорт из папки
          </button>
          <button className="btn-primary" disabled={publishing} onClick={publish}>
            {publishing ? 'Публикую…' : '⬆ Опубликовать'}
          </button>
        </div>
      </div>

      {msg && <div className="mb-3 rounded-lg bg-andesite-800 px-3 py-2 text-sm text-brass-100">{msg}</div>}

      <div className="mb-3 flex items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-andesite-800 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tab === t.key ? 'bg-brass-500 text-andesite-900' : 'text-andesite-300'
              }`}
            >
              {t.label} ({entries.filter((e) => e.type === t.key).length})
            </button>
          ))}
        </div>
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <input
            className="input"
            placeholder="Найти на Modrinth, чтобы добавить в сборку…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn-ghost" disabled={searching}>
            {searching ? '…' : 'Найти'}
          </button>
        </form>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
        {/* Search → add */}
        <div className="overflow-y-auto pr-1">
          <div className="space-y-2">
            {hits.map((hit) => (
              <div key={hit.project_id} className="panel flex items-center gap-3 p-2.5">
                {hit.icon_url ? (
                  <img src={hit.icon_url} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded bg-andesite-700">🧩</div>
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-brass-100">{hit.title}</span>
                {entryIds.has(hit.project_id) ? (
                  <span className="text-xs text-green-400">в сборке</span>
                ) : (
                  <button
                    className="btn-ghost px-3 py-1 text-xs"
                    disabled={busy === hit.project_id}
                    onClick={() => add(hit)}
                  >
                    {busy === hit.project_id ? '…' : '+ В сборку'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Current pack */}
        <div className="panel flex flex-col overflow-hidden">
          <div className="border-b border-andesite-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-andesite-400">
            В сборке · {TABS.find((t) => t.key === tab)?.label} ({tabEntries.length})
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {tabEntries.length === 0 ? (
              <div className="p-3 text-sm text-andesite-500">Пусто.</div>
            ) : (
              tabEntries.map((e) => (
                <div key={e.projectId} className="row">
                  {e.icon ? (
                    <img src={e.icon} alt="" className="h-7 w-7 rounded object-cover" />
                  ) : (
                    <div className="grid h-7 w-7 place-items-center rounded bg-andesite-700 text-xs">🧩</div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-brass-100" title={e.filename}>
                    {e.title}
                  </span>
                  {e.type === 'mod' && (
                    <button
                      className={`rounded px-2 py-0.5 text-[11px] ${
                        e.side === 'both'
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-andesite-700 text-andesite-300'
                      }`}
                      onClick={() => toggleSide(e)}
                      title="Клиент+сервер / только клиент"
                    >
                      {e.side === 'both' ? 'клиент+сервер' : 'только клиент'}
                    </button>
                  )}
                  <button className="text-red-400 hover:text-red-300" onClick={() => remove(e.projectId)}>
                    ✕
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
