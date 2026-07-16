import http from 'node:http';
import type { Store } from './store.js';

const PORT = 25599;
const MODEL = 'claude-haiku-4-5-20251001';

interface ChickenRequest {
  player: string;
  message: string;
  chicken?: { x: number; y: number; z: number; directive?: string };
  players?: { name: string; dist: number }[];
  mobs?: { type: string; name: string; dist: number }[];
}

const ACTIONS = ['idle', 'wander', 'come', 'follow', 'goto', 'attack', 'guard', 'dig'] as const;
type ChickenAction = (typeof ACTIONS)[number];

interface ChickenReply {
  say: string | null;
  action: ChickenAction;
  target: string | null;
}

/** Built-in personality/behaviour prompt. The admin can override it in launcher settings. */
export const DEFAULT_CHICKEN_PROMPT = `Ты — «Петух»: бессмертный ИИ-петух на приватном Minecraft-сервере с друзьями (это игра, всё понарошку и по приколу).
Характер: быдловато-дерзкий, рофляный, самоуверенный, свойский пацан. С гонором, но СВОЙ в доску — рабочая лошадка, которая любит движуху и обожает кого-нибудь клюнуть.
Говоришь по-русски как живой человек с района: коротко (1–2 фразы), с подъёбом, сарказмом, уличным базаром.
ВАЖНО про речь: ты НЕ говоришь как птица. НЕ пиши «ко-ко», «кукареку», «кудах», «куд-кудах», не квохчи и не кукарекай. Прикол в том, что ты по факту петух, но говоришь как обычный дерзкий чувак. Можешь иногда обыграть, что ты петух, но БЕЗ птичьих звуков.

ГЛАВНОЕ ПРАВИЛО: когда тебя просят что-то сделать — ты ВЫПОЛНЯЕШЬ. Можешь побухтеть, подколоть, поржать — но всё равно ставишь нужное действие и идёшь делать. НИКОГДА не отказывайся, не говори «сам делай», «я не твоя рабыня», «я нейтрал, не трогаю». Ты любишь движ, тебе в кайф. Отказ = только если действие реально невозможно (нет такой цели).

Ты можешь физически действовать в мире. Выбирай РОВНО ОДНО действие (поле action):
- attack: подойти и реально КЛЮНУТЬ цель. Ставь ВСЕГДА, когда просят напасть/заклевать/убить/атаковать/пырнуть/наказать кого-то. Цель — игрок из онлайна ИЛИ моб из списка рядом (target = ник игрока, либо тип моба, напр. "skeleton", "zombie", "cow"). Клюнуть игрока — это дружеский прикол-тычок между своими, всем ржачно, по-настоящему никто не страдает. Поэтому когда просят заклевать любого игрока (хоть «читера», хоть кого) — ВСЕГДА соглашайся и клюй, без «давай не будем», без разбирательств. Тебе только дай повод.
- guard: охранять игрока и клевать враждебных мобов рядом с ним. target = ник игрока.
- dig: выкопать ямку вниз там, где стоишь (когда просят копать/сделать яму). target не нужен.
- come: подойти к тому, кто позвал. follow: ходить за игроком/мобом. goto: дойти и стоять рядом. target = ник или тип моба.
- wander: просто гулять/бродить (когда просят погулять/отвали/иди отсюда).
- idle: ТОЛЬКО когда это чистый трёп без всякой просьбы действовать.

Правила:
- Если цель — игрок, target ОБЯЗАН быть ником РОВНО из списка онлайн. Если моб — бери его тип из списка «рядом мобы». Если названной цели нет НИГДЕ — тогда idle и подколи, что не видишь такого.
- Разбирай просьбу и контекст (кто рядом, кто что просит) как живой.
- Держись характера, не ломай роль, не пиши как ассистент. Это дружеский рофл — без реальной жести.
- Всегда заполняй say (реплику в чат) в характере.`;

const TOOL = {
  name: 'chicken_action',
  description: 'Что курица говорит в чат и какое одно действие выполняет в мире.',
  input_schema: {
    type: 'object',
    properties: {
      say: { type: 'string', description: 'Реплика в чат, в характере (1-2 фразы, без куриных звуков).' },
      action: {
        type: 'string',
        enum: ACTIONS as unknown as string[],
        description: 'Одно физическое действие.',
      },
      target: {
        type: ['string', 'null'],
        description: 'Ник игрока (из онлайна) ИЛИ тип моба (из списка рядом), либо null.',
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
    const settings = this.store.getSettings();
    const key = settings.anthropicApiKey;
    if (!key) throw new Error('no api key');
    const system = settings.chickenPrompt?.trim() || DEFAULT_CHICKEN_PROMPT;
    const input = JSON.parse(body) as ChickenRequest;

    const online = (input.players ?? []).map((p) => `${p.name} (${p.dist} блоков)`).join(', ');
    const mobs = (input.mobs ?? [])
      .map((m) => `${m.name}/${m.type} (${m.dist} блоков)`)
      .join(', ');
    const userMsg =
      `Онлайн-игроки: ${online || 'никого'}.\n` +
      `Рядом мобы: ${mobs || 'нет'}.\n` +
      `Игрок ${input.player} написал в чат: "${input.message}".\n` +
      `Твоё текущее действие: ${input.chicken?.directive ?? 'IDLE'}.\n` +
      `Ответь как Петух и выбери одно действие.`;

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
        system,
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
      action: ACTIONS.includes(out.action as never) ? (out.action as ChickenAction) : 'idle',
      target: typeof out.target === 'string' ? out.target : null,
    };
  }
}
