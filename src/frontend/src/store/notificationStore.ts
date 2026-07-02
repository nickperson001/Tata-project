import { create } from 'zustand';

export interface StockAlert {
  id: number;
  product_id: number;
  alert_type: 'low_stock' | 'out_of_stock';
  stock_level: number;
  alerted_at: string;
  resolved_at: string | null;
  products?: { id: number; name: string; sku: string; unit: string; stock_current: number };
}

interface NotificationState {
  alerts: StockAlert[];
  unreadCount: number;
  socketAlertIds: Set<number>;
  setAlerts: (alerts: StockAlert[]) => void;
  addAlert: (alert: StockAlert) => void;
  markAllRead: () => void;
  clearSocket: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  alerts: [],
  unreadCount: 0,
  socketAlertIds: new Set(),

  setAlerts: (alerts) =>
    set({ alerts, unreadCount: alerts.filter((a) => !a.resolved_at).length }),

  addAlert: (alert) =>
    set((state) => ({
      socketAlertIds: new Set(state.socketAlertIds).add(alert.id),
      alerts: [alert, ...state.alerts],
      unreadCount: state.unreadCount + 1,
    })),

  markAllRead: () => set({ unreadCount: 0 }),

  clearSocket: () => set({ socketAlertIds: new Set() }),
}));
