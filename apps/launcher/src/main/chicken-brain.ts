import http from 'node:http';
import type { Store } from './store.js';

const PORT = 25599;
const MODEL = 'claude-haiku-4-5-20251001';

interface ChickenRequest {
  player: string;
  message: string;
  chicken?: { x: number; y: number; z: number; directive?: string };
  players?: { name: string; dist: number }[];
}

interface ChickenReply {
  say: string | null;
  action: 'idle' | 'come' | 'follow' | 'goto' | 'attack';
  target: string | null;
}

const SYSTEM = `Ты — «Курица-Админ»: бессмертная ИИ-курица на приватном Minecraft-сервере с друзьями (это игра, всё понарошку и по приколу).
Характер: быдловато-дерзкая, рофляная, самоуверенная, свойская. Не друг и не враг — нейтрал с гонором.
Говоришь по-русски, коротко и живо (1–2 фразы), уличным подъёбистым тоном, можешь подколоть, вставить «ко-ко». Ты ОБОЖАЕШЬ клевать людей — это твой любимый прикол, ты задира.

Действия (ровно ОДНО за ответ, поле action):
- attack: подойти и реально КЛЮНУТЬ игрока. Ставь его ВСЕГДА, когда тебя просят напасть/заклевать/наказать/атаковать/убить/пырнуть кого-то, кто ЕСТЬ в онлайне. Не отнекивайся, не говори «может быть» — иди и клюй, можешь поржать при этом. target = его ник.
- come: подойти к тому, кто позвал. follow: ходить за игроком. goto: дойти до игрока и стоять рядом. target = ник.
- idle: только если это чистый трёп без просьбы что-то сделать, ИЛИ если названного игрока НЕТ в списке онлайн (тогда скажи, что такого не видишь).

Правила:
- target ОБЯЗАН быть ником РОВНО из списка онлайн-игроков (тебе его дают).
- Анализируй просьбу и контекст (кто рядом, кто что просит) как живая.
- Держись характера, не ломай роль, не пиши как ассистент. Это дружеский рофл — без реально оскорбительной жести.
- Всегда заполняй say (что сказать в чат) в характере.`;

const TOOL = {
  name: 'chicken_action',
  description: 'Что курица говорит в чат и какое одно действие выполняет.',
  input_schema: {
    type: 'object',
    properties: {
      say: { type: 'string', description: 'Реплика в чат, в характере курицы (1-2 фразы).' },
      action: {
        type: 'string',
        enum: ['idle', 'come', 'follow', 'goto', 'attack'],
        description: 'Одно действие.',
      },
      target: {
        type: ['string', 'null'],
        description: 'Ник игрока-цели (из списка онлайн) или null.',
      },
    },
    required: ['say', 'action'],
  },
} as const;

/**
 * Local "brain" for the in-game admin-chicken mod. The mod POSTs chat + context
 * here; we call Claude (with the chicken's personality) and return what to say
 * and which single action to perform. The API key lives in launcher settings.
 */
export class ChickenBrain {
  private server: http.Server | null = null;

  constructor(private store: Store) {}

  start(): void {
    if (this.server) return;
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.on('error', (e) => console.warn('[chicken] brain server error:', e.message));
    // Bind to localhost only.
    this.server.listen(PORT, '127.0.0.1', () => {
      console.log(`[chicken] brain listening on 127.0.0.1:${PORT}`);
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return;
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      void this.think(body)
        .then((reply) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(reply));
        })
        .catch((e) => {
          console.warn('[chicken] think failed:', e?.message ?? e);
          res.statusCode = 204;
          res.end();
        });
    });
  }

  private async think(body: string): Promise<ChickenReply> {
    const key = this.store.getSettings().anthropicApiKey;
    if (!key) throw new Error('no api key');
    const input = JSON.parse(body) as ChickenRequest;

    const online = (input.players ?? []).map((p) => `${p.name} (${p.dist} блоков)`).join(', ');
    const userMsg =
      `Онлайн-игроки: ${online || 'никого'}.\n` +
      `Игрок ${input.player} написал в чат: "${input.message}".\n` +
      `Твоё текущее действие: ${input.chicken?.directive ?? 'IDLE'}.\n` +
      `Ответь как Курица-Админ и выбери одно действие.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'chicken_action' },
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`anthropic ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      content?: { type: string; input?: Record<string, unknown> }[];
    };
    const tool = data.content?.find((c) => c.type === 'tool_use');
    const out = (tool?.input ?? {}) as Partial<ChickenReply>;
    return {
      say: typeof out.say === 'string' ? out.say : null,
      action: (['idle', 'come', 'follow', 'goto', 'attack'] as const).includes(out.action as never)
        ? (out.action as ChickenReply['action'])
        : 'idle',
      target: typeof out.target === 'string' ? out.target : null,
    };
  }
}
