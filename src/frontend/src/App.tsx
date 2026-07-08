import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PageLoader } from './components/PageLoader';

// Static Layouts
import { AdminLayout } from './pages/admin/AdminLayout';
import { StockLayout } from './pages/stock/StockLayout';

// Lazy Pages
const LoginPage = lazy(() => import('./pages/admin/LoginPage').then(m => ({ default: m.LoginPage })));
const OverviewTab = lazy(() => import('./pages/admin/OverviewTab').then(m => ({ default: m.OverviewTab })));
const DatabaseTab = lazy(() => import('./pages/admin/DatabaseTab').then(m => ({ default: m.DatabaseTab })));
const BroadcastTab = lazy(() => import('./pages/admin/BroadcastTab').then(m => ({ default: m.BroadcastTab })));
const TerminalTab = lazy(() => import('./pages/admin/TerminalTab').then(m => ({ default: m.TerminalTab })));

const StockOverview = lazy(() => import('./pages/stock/StockOverview').then(m => ({ default: m.StockOverview })));
const ProductsPage = lazy(() => import('./pages/stock/ProductsPage').then(m => ({ default: m.ProductsPage })));
const StockMovement = lazy(() => import('./pages/stock/StockMovement').then(m => ({ default: m.StockMovement })));
const StockOpname = lazy(() => import('./pages/stock/StockOpname').then(m => ({ default: m.StockOpname })));
const StockReport = lazy(() => import('./pages/stock/StockReport').then(m => ({ default: m.StockReport })));
const StockHistory = lazy(() => import('./pages/stock/StockHistory').then(m => ({ default: m.StockHistory })));
const StockPiutang = lazy(() => import('./pages/stock/StockPiutang').then(m => ({ default: m.StockPiutang })));
const StockHutang = lazy(() => import('./pages/stock/StockHutang').then(m => ({ default: m.StockHutang })));
const StockFinance = lazy(() => import('./pages/stock/StockFinance').then(m => ({ default: m.StockFinance })));
const StockSlugRedirect = lazy(() => import('./pages/stock/StockSlugRedirect').then(m => ({ default: m.StockSlugRedirect })));
const StockSettings = lazy(() => import('./pages/stock/StockSettings').then(m => ({ default: m.StockSettings })));
const StockCategories = lazy(() => import('./pages/stock/StockCategories').then(m => ({ default: m.StockCategories })));
const StockBatch = lazy(() => import('./pages/stock/StockBatch').then(m => ({ default: m.StockBatch })));
const StockProductStats = lazy(() => import('./pages/stock/StockProductStats').then(m => ({ default: m.StockProductStats })));
const StockNotifications = lazy(() => import('./pages/stock/Notifications').then(m => ({ default: m.Notifications })));
const StockReturn = lazy(() => import('./pages/stock/StockReturn').then(m => ({ default: m.StockReturn })));
const StockPurchaseReturn = lazy(() => import('./pages/stock/StockPurchaseReturn').then(m => ({ default: m.StockPurchaseReturn })));
const StockTransfer = lazy(() => import('./pages/stock/StockTransfer').then(m => ({ default: m.StockTransfer })));
const StockBantuan = lazy(() => import('./pages/stock/StockBantuan').then(m => ({ default: m.StockBantuan })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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
            <Route path="transfer" element={<StockTransfer />} />
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
            <Route path="settings" element={<StockSettings />} />
            <Route path="notifications" element={<StockNotifications />} />
            <Route path="bantuan" element={<StockBantuan />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
