import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Static Layouts
import { AdminLayout } from './pages/admin/AdminLayout';
import { StockLayout } from './pages/stock/StockLayout';

// Admin Pages
import { LoginPage } from './pages/admin/LoginPage';
import { OverviewTab } from './pages/admin/OverviewTab';
import { DatabaseTab } from './pages/admin/DatabaseTab';
import { BroadcastTab } from './pages/admin/BroadcastTab';
import { TerminalTab } from './pages/admin/TerminalTab';

// Stock Pages
import { StockOverview } from './pages/stock/StockOverview';
import { ProductsPage } from './pages/stock/ProductsPage';
import { StockMovement } from './pages/stock/StockMovement';
import { StockOpname } from './pages/stock/StockOpname';
import { StockReport } from './pages/stock/StockReport';
import { StockHistory } from './pages/stock/StockHistory';
import { StockPiutang } from './pages/stock/StockPiutang';
import { StockHutang } from './pages/stock/StockHutang';
import { StockFinance } from './pages/stock/StockFinance';
import { StockSlugRedirect } from './pages/stock/StockSlugRedirect';
import { StockSettings } from './pages/stock/StockSettings';
import { StockCategories } from './pages/stock/StockCategories';
import { StockMaterials } from './pages/stock/StockMaterials';
import { StockBatch } from './pages/stock/StockBatch';
import { StockProductStats } from './pages/stock/StockProductStats';
import { StockReturn } from './pages/stock/StockReturn';
import { StockPurchaseReturn } from './pages/stock/StockPurchaseReturn';
import { StockBantuan } from './pages/stock/StockBantuan';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<OverviewTab />} />
          <Route path="database" element={<DatabaseTab />} />
          <Route path="broadcast" element={<BroadcastTab />} />
          <Route path="terminal" element={<TerminalTab />} />
        </Route>
        <Route path="/stock/:slug" element={<StockSlugRedirect />} />
        <Route path="/stock" element={<StockLayout />}>
          <Route index element={<StockOverview />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="movement" element={<StockMovement />} />
          <Route path="opname" element={<StockOpname />} />
          <Route path="retur" element={<StockReturn />} />
          <Route path="retur-beli" element={<StockPurchaseReturn />} />
          <Route path="report" element={<StockReport />} />
          <Route path="history" element={<StockHistory />} />
          <Route path="piutang" element={<StockPiutang />} />
          <Route path="hutang" element={<StockHutang />} />
          <Route path="keuangan" element={<StockFinance />} />
          <Route path="pembukuan" element={<Navigate to="/stock/keuangan" replace />} />
          <Route path="laba-rugi" element={<Navigate to="/stock/keuangan" replace />} />
          <Route path="neraca" element={<Navigate to="/stock/keuangan" replace />} />
          <Route path="buku-besar" element={<Navigate to="/stock/keuangan" replace />} />
          <Route path="arus-kas" element={<Navigate to="/stock/keuangan" replace />} />
          <Route path="neraca-saldo" element={<Navigate to="/stock/keuangan" replace />} />
          <Route path="channels" element={<Navigate to="/stock/keuangan" replace />} />
          <Route path="jurnal" element={<Navigate to="/stock/keuangan" replace />} />
          <Route path="summary" element={<Navigate to="/stock/keuangan" replace />} />
          <Route path="batch" element={<StockBatch />} />
          <Route path="product-stats" element={<StockProductStats />} />
          <Route path="categories" element={<StockCategories />} />
          <Route path="materials" element={<StockMaterials />} />
          <Route path="settings" element={<StockSettings />} />
          <Route path="bantuan" element={<StockBantuan />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
