import { runBuild } from './build.js';
import { runImport } from './import.js';
import { runPublish } from './publish.js';

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'import':
      await runImport(rest[0]);
      break;
    case 'build':
      await runBuild();
      break;
    case 'publish':
      await runPublish();
      break;
    default:
      console.log(
        [
          'BalumbaCraft pack publisher',
          '',
          'Использование:',
          '  balumba-pack import [путь-к-mods]   Скопировать моды из Modrinth-профиля в pack/mods',
          '  balumba-pack build                  Собрать pack/manifest.json',
          '  balumba-pack publish                Залить файлы + манифест в GitHub Releases (нужен gh)',
        ].join('\n'),
      );
  }
}

main().catch((err) => {
  console.error('Ошибка:', err instanceof Error ? err.message : err);
  process.exit(1);
});
