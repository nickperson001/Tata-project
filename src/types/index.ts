// ── Bot State ──
export type BotStatus =
  | 'Initializing'
  | 'QR_READY'
  | 'Authenticated'
  | 'AUTH_FAILED'
  | 'Ready'
  | 'Disconnected'
  | 'ERROR'
  | 'Reconnecting'
  | 'Processing';

export interface BotState {
  botStatus: BotStatus;
  currentQR: string;
  pairingCode: string;
  clientReady: boolean;
  maintenanceMode: boolean;
  waRetryCount: number;
  isInitializing: boolean;
  isBotRunning: boolean;
  waDestroyLock: boolean;
}

// ── User & Subscription ──
export type SubscriptionTier = 'demo' | 'pro' | 'unlimited';

export interface User {
  id: string;
  store_name: string;
  slug: string;
  status: SubscriptionTier;
  subscription_expiry: string | null;
  dashboard_token: string | null;
  created_at: string;
}

export interface UserRow {
  id: string;
  store_name: string;
  slug: string | null;
  status: string;
  subscription_expiry: string | null;
  dashboard_token: string | null;
  created_at: string;
}

// ── Dialog State ──
export interface DialogState<T = unknown> {
  data: T;
  createdAt: number;
  ttl: number;
}

export interface SaleDialogData {
  products: Product[];
  qty: number;
  query: string;
  channel: string;
}

export interface ClassificationDialogData {
  message: string;
  image?: string;
}

export interface TxConfirmationData {
  type: string;
  amount: number;
  description: string;
  channel: string;
}

export interface ProductSelectionData {
  products: Product[];
  action: string;
  additionalData?: Record<string, unknown>;
}

// ── Products ──
export interface Product {
  id: string;
  user_id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price_buy: number;
  price_sell: number;
  stock_current: number;
  stock_min: number;
}

// ── Socket Events ──
export interface BotUpdateEvent {
  status?: BotStatus;
  ready?: boolean;
  qr?: string;
  pairingCode?: string;
}

export interface SystemLogEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
  memory: string;
}

// ── Log Entry ──
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
  memory: string;
}

// ── Broadcast ──
export type BroadcastTarget = 'all' | 'demo' | 'pro' | 'unlimited';

export interface BroadcastJob {
  jobId: string;
  message: string;
  target: BroadcastTarget;
  userIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  sent: number;
  failed: number;
  total: number;
}

// ── Onboarding ──
export interface OnboardingState {
  step: number;
  storeName?: string;
  storeCategory?: string;
  timestamp: number;
}

// ── Cache Entry ──
export interface CacheEntry<T = unknown> {
  val: T;
  ts: number;
  ttl: number;
}

// ── Maintenance Mode ──
export interface MaintenanceMode {
  active: boolean;
  message: string;
}

// ── Pagination ──
export interface PaginationMeta {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

// ── Bot Events ──
export const BOT_EVENTS = {
  STATE_CHANGED: 'bot:state_changed',
  QR_RECEIVED: 'bot:qr_received',
  AUTHENTICATED: 'bot:authenticated',
  DISCONNECTED: 'bot:disconnected',
  MESSAGE_RECEIVED: 'bot:message_received',
  LOG: 'bot:log',
} as const;

// ── Health ──
export interface HealthResponse {
  status: 'healthy' | 'degraded';
  uptime: number;
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}
