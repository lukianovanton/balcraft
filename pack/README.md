# pack/ — источник правды сборки BalumbaCraft

Здесь лежит эталонная сборка, из которой `pack-publisher` собирает `manifest.json`
и заливает файлы в GitHub Release. Лаунчер синхронизирует клиентов именно с этой сборкой.

Структура (заполняется в Фазе 4):

```
pack/
├─ mods/          # .jar моды (из Modrinth-профиля "Сборка")
├─ config/        # конфиги, синхронизируемые всем
├─ overrides/     # прочие файлы клиента (при необходимости)
└─ pack.meta.json # версия сборки, версия NeoForge, RAM и т.п.
```

Клиент-только моды (Sodium, Iris, JourneyMap, Jade, Distant Horizons, EntityCulling,
SkinLayers3D, AmbientSounds и т.д.) помечаются `side: client` и не ставятся на сервер.
Контент-моды Create/YUNG's/BoP/Sophisticated идут на обе стороны.
