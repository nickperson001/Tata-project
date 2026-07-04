import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './pages/admin/LoginPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { OverviewTab } from './pages/admin/OverviewTab';
import { DatabaseTab } from './pages/admin/DatabaseTab';
import { BroadcastTab } from './pages/admin/BroadcastTab';
import { TerminalTab } from './pages/admin/TerminalTab';
import { StockLayout } from './pages/stock/StockLayout';
import { StockOverview } from './pages/stock/StockOverview';
import { ProductsPage } from './pages/stock/ProductsPage';
import { StockMovement } from './pages/stock/StockMovement';
import { StockOpname } from './pages/stock/StockOpname';
import { StockReport } from './pages/stock/StockReport';
import { StockHistory } from './pages/stock/StockHistory';
import { StockPiutang } from './pages/stock/StockPiutang';
import { StockHutang } from './pages/stock/StockHutang';
import { StockPembukuan } from './pages/stock/StockPembukuan';
import { StockLabaRugi } from './pages/stock/StockLabaRugi';
import { StockNeraca } from './pages/stock/StockNeraca';
import { StockBukuBesar } from './pages/stock/StockBukuBesar';
import { StockArusKas } from './pages/stock/StockArusKas';
import { StockTrialBalance } from './pages/stock/StockTrialBalance';
import { StockSlugRedirect } from './pages/stock/StockSlugRedirect';
import { StockSettings } from './pages/stock/StockSettings';
import { StockCategories } from './pages/stock/StockCategories';
import { StockBatch } from './pages/stock/StockBatch';
import { StockSummary } from './pages/stock/StockSummary';
import { StockProductStats } from './pages/stock/StockProductStats';
import { StockChannels } from './pages/stock/StockChannels';
import { StockJurnal } from './pages/stock/StockJurnal';
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
    </BrowserRouter>
  );
}
