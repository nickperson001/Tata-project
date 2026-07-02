import { create } from 'zustand';
import type { Product, OverviewData, FinancialData } from '../types';

interface StockState {
  token: string | null;
  user: { id: string; store_name: string; status: string } | null;
  products: Product[];
  overview: OverviewData | null;
  financial: FinancialData | null;
  isLoading: boolean;

  setToken: (token: string | null) => void;
  setUser: (user: { id: string; store_name: string; status: string }) => void;
  setProducts: (products: Product[]) => void;
  setOverview: (data: OverviewData) => void;
  setFinancial: (data: FinancialData) => void;
  setLoading: (v: boolean) => void;
}

export const useStockStore = create<StockState>((set) => ({
  token: null,
  user: null,
  products: [],
  overview: null,
  financial: null,
  isLoading: true,

  setToken: (token) => set({ token }),
  setUser: (user) => set({ user }),
  setProducts: (products) => set({ products }),
  setOverview: (data) => set({ overview: data }),
  setFinancial: (data) => set({ financial: data }),
  setLoading: (v) => set({ isLoading: v }),
}));
