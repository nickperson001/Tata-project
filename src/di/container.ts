import { container } from 'tsyringe';

export const TOKENS = {
  StateService: 'IStateService',
  WhatsAppService: 'IWhatsAppService',
  EventBus: 'IEventBus',
  Logger: 'ILogger',
  Supabase: 'SupabaseClient',
  Redis: 'RedisClient',
} as const;

export { container };
