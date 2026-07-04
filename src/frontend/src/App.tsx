import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
const StockPembukuan = lazy(() => import('./pages/stock/StockPembukuan').then(m => ({ default: m.StockPembukuan })));
const StockLabaRugi = lazy(() => import('./pages/stock/StockLabaRugi').then(m => ({ default: m.StockLabaRugi })));
const StockNeraca = lazy(() => import('./pages/stock/StockNeraca').then(m => ({ default: m.StockNeraca })));
const StockBukuBesar = lazy(() => import('./pages/stock/StockBukuBesar').then(m => ({ default: m.StockBukuBesar })));
const StockArusKas = lazy(() => import('./pages/stock/StockArusKas').then(m => ({ default: m.StockArusKas })));
const StockTrialBalance = lazy(() => import('./pages/stock/StockTrialBalance').then(m => ({ default: m.StockTrialBalance })));
const StockSlugRedirect = lazy(() => import('./pages/stock/StockSlugRedirect').then(m => ({ default: m.StockSlugRedirect })));
const StockSettings = lazy(() => import('./pages/stock/StockSettings').then(m => ({ default: m.StockSettings })));
const StockCategories = lazy(() => import('./pages/stock/StockCategories').then(m => ({ default: m.StockCategories })));
const StockBatch = lazy(() => import('./pages/stock/StockBatch').then(m => ({ default: m.StockBatch })));
const StockSummary = lazy(() => import('./pages/stock/StockSummary').then(m => ({ default: m.StockSummary })));
const StockProductStats = lazy(() => import('./pages/stock/StockProductStats').then(m => ({ default: m.StockProductStats })));
const StockChannels = lazy(() => import('./pages/stock/StockChannels').then(m => ({ default: m.StockChannels })));
const StockJurnal = lazy(() => import('./pages/stock/StockJurnal').then(m => ({ default: m.StockJurnal })));
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
            <Route path="report" element={<StockReport />} />
            <Route path="history" element={<StockHistory />} />
            <Route path="piutang" element={<StockPiutang />} />
            <Route path="hutang" element={<StockHutang />} />
            <Route path="pembukuan" element={<StockPembukuan />} />
            <Route path="laba-rugi" element={<StockLabaRugi />} />
            <Route path="neraca" element={<StockNeraca />} />
            <Route path="buku-besar" element={<StockBukuBesar />} />
            <Route path="arus-kas" element={<StockArusKas />} />
            <Route path="neraca-saldo" element={<StockTrialBalance />} />
            <Route path="batch" element={<StockBatch />} />
            <Route path="summary" element={<StockSummary />} />
            <Route path="product-stats" element={<StockProductStats />} />
            <Route path="channels" element={<StockChannels />} />
            <Route path="jurnal" element={<StockJurnal />} />
            <Route path="categories" element={<StockCategories />} />
            <Route path="settings" element={<StockSettings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
