# BalumbaCraft Launcher

Собственный лаунчер для приватной Create-сборки на **NeoForge 1.21.1**. Автоматически ставит
Java, Minecraft, NeoForge и синхронизирует моды/конфиги у всех друзей при заходе. Умеет поднимать
локальный сервер с туннелем Playit.gg и управлять им.

## Стек

- **Electron + React + TypeScript + Vite** (electron-vite), Tailwind (тема Create).
- Пакеты монорепо:
  - `packages/core` — движок установки MC/NeoForge, Java, sync, утилиты (без Electron).
  - `apps/launcher` — десктоп-приложение (main + preload + renderer).
  - `tools/pack-publisher` — CLI генерации `manifest.json` и публикации сборки в GitHub Releases.
  - `pack/` — эталонная сборка (источник правды).

## Разработка

```bash
npm install            # установить зависимости всех воркспейсов
npm run dev            # собрать core и запустить лаунчер в dev-режиме
npm run typecheck      # проверка типов
npm run build:win      # собрать NSIS-инсталлятор под Windows
```

## Статус по фазам — всё готово ✅

- [x] Фаза 1 — скелет монорепо, UI-каркас, IPC.
- [x] Фаза 2 — Java 21 + ванилла 1.21.1 (проверено запуском).
- [x] Фаза 3 — NeoForge 1.21.1 + запуск модового клиента.
- [x] Фаза 4 — sync-движок + pack-publisher (проверено на 164 модах).
- [x] Фаза 5 — авторизация (оффлайн + Microsoft device-code).
- [x] Фаза 6 — локальный сервер + Playit.gg (сервер стартует со 130 модами).
- [x] Фаза 7 — полировка UI + онбординг друга.
- [x] Фаза 8 — NSIS-установщик + авто-обновление лаунчера.

## Что настроить перед раздачей друзьям

См. [SETUP.md](SETUP.md): один раз завести **Azure Client ID** (вход Microsoft) и
**публичный GitHub-репозиторий** сборки (авто-обновление), затем опубликовать сборку:

```bash
node tools/pack-publisher/dist/cli.js import   # моды из Modrinth → pack/mods
node tools/pack-publisher/dist/cli.js build     # manifest.json
node tools/pack-publisher/dist/cli.js publish   # залить в GitHub Releases
```

Готовый установщик: `apps/launcher/release/BalumbaCraft-Setup-<версия>.exe`.
> Установщик не подписан — при первом запуске Windows SmartScreen покажет
> предупреждение: «Подробнее» → «Выполнить в любом случае».
