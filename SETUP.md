# BalumbaCraft — настройка (делается один раз)

Здесь два разовых шага, которые нужны, чтобы заработали **вход через Microsoft** и
**авто-обновление сборки**. Оффлайн-вход и запуск игры работают и без них.

---

## 1. Azure-приложение для входа через Microsoft

Стороннему лаунчеру нужен собственный «Client ID» приложения Azure (бесплатно).

1. Зайди на <https://portal.azure.com> под своим аккаунтом Microsoft.
2. Найди **Microsoft Entra ID** → слева **App registrations** → **New registration**.
3. Заполни:
   - **Name**: `BalumbaCraft Launcher` (любое).
   - **Supported account types**: выбери
     **Personal Microsoft accounts only** (или «…and personal Microsoft accounts»).
   - **Redirect URI**: оставь пустым (мы используем device-code flow).
   - Нажми **Register**.
4. На странице приложения:
   - Скопируй **Application (client) ID** — это и есть нужный Client ID.
   - Слева **Authentication** → включи **Allow public client flows** = **Yes** → **Save**.
     (Это обязательно для device-code без секрета.)
5. Вставь Client ID в код:
   - Файл [apps/launcher/src/main/config.ts](apps/launcher/src/main/config.ts),
     поле `azureClientId: '...'` — замени `CHANGE_ME` на скопированный ID.

Готово. В лаунчере на вкладке **Аккаунты** → «Войти через Microsoft» появится код,
который вводишь на <https://microsoft.com/link>. Лицензия и пиратка (оффлайн-ник)
работают одновременно.

> Примечание: сервер работает в offline-режиме, поэтому лицензия и пиратка заходят
> вместе. Защита от чужих ников — через **вайтлист** на вкладке «Сервер».

---

## 2. GitHub-репозиторий сборки (авто-обновление)

Сюда заливаются моды сборки; лаунчер скачивает их и обновляет у всех при заходе.

1. Создай **публичный** репозиторий на GitHub, например `balumbacraft-pack`.
2. Установи и авторизуй GitHub CLI: <https://cli.github.com> → `gh auth login`.
3. Пропиши репозиторий в двух местах:
   - [pack/pack.meta.json](pack/pack.meta.json) → `github.owner` / `github.repo`.
   - [apps/launcher/src/main/config.ts](apps/launcher/src/main/config.ts) →
     `github.owner` / `github.repo` (замени `CHANGE_ME`).

### Как опубликовать сборку

```bash
# 1) забрать моды из твоего Modrinth-профиля "Сборка" в pack/mods
node tools/pack-publisher/dist/cli.js import

# 2) собрать manifest.json (хеши + классификация клиент/сервер)
node tools/pack-publisher/dist/cli.js build

# 3) залить файлы + манифест в релиз GitHub
node tools/pack-publisher/dist/cli.js publish
```

Файлы адресуются по SHA-1: при повторной публикации заливаются только изменённые
моды. Когда меняешь сборку — повтори `import → build → publish`, и у всех друзей
она обновится при следующем заходе (лаунчер докачивает новое и удаляет убранные моды,
не трогая сохранения и настройки).

### Как поднять версию сборки

Перед публикацией измени `version` в [pack/pack.meta.json](pack/pack.meta.json)
(например `2026.07.16-2`). По этому полю лаунчер понимает, что вышло обновление.
