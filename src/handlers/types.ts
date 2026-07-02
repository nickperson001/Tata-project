import type { Message, Client } from 'whatsapp-web.js';

export interface MessageHandler {
  handle(msg: Message, client: Client): Promise<boolean>;
}
