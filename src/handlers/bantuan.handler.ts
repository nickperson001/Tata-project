import { injectable } from 'tsyringe';
import type { Message, Client } from 'whatsapp-web.js';
import type { MessageHandler } from './types';

const HELP_KEYWORDS = [
  'bantuan', 'menu', 'help', 'cara', 'panduan', 'petunjuk',
  '?', 'tutorial', 'tolong', 'tanya', 'nanya',
  'bingung', 'gimana', 'caranya', 'bagaimana', 'how',
  'halo', 'hai', 'selamat', 'ping', 'test', 'coba', 'tes',
];

@injectable()
export class BantuanHandler implements MessageHandler {
  async handle(msg: Message, _client: Client): Promise<boolean> {
    const text = (msg.body || '').trim().toLowerCase();

    const isHelp = HELP_KEYWORDS.some((kw) => {
      if (kw === text) return true;
      if (text.startsWith(kw + ' ') || text.startsWith(kw + '\n')) return true;
      return false;
    });

    if (!isHelp) return false;

    // Fallback to legacy handler
    return false;
  }
}
