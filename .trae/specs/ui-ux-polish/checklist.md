# Checklist

## Typography & Tokens
- [x] Plus Jakarta Sans font loaded from Google Fonts with `display=swap`
- [x] `--font` variable updated to Plus Jakarta Sans
- [x] Global heading styles: `h1-h6` with `font-weight: 700`, `letter-spacing: -0.02em`
- [x] No hardcoded `'Inter'` in any active component

## CSS Classes
- [x] `.btn-outline` class defined with hover + active states
- [x] `.card--warning`, `.card--success`, `.card--danger` classes defined
- [x] `.card--subtle` class defined
- [x] `.finance-tab` + `.finance-tab--active` classes defined
- [x] `.demo-banner` class defined with gradient
- [x] `.sort-icon` class defined
- [x] `.category-chip` class defined with hover state
- [x] `.badge--outline` class defined with dark mode variant
- [x] `.input-icon-wrap` class defined
- [x] `.tbl-scroll` class defined

## StockOverview
- [x] AiPopup: all inline styles replaced with CSS classes
- [x] Empty state: emoji replaced with lucide-react icons (BarChart2, AlertTriangle)

## StockFinance
- [x] Tab buttons: 4x inline styles replaced with `.finance-tab` classes
- [x] Summary: progress bars use `.progress-bar` / `.progress-bar-fill` classes

## StockReport
- [x] Uses `<PageHeader>` component instead of manual `<h2>`
- [x] Uses `<EmptyState>` component
- [x] Period selector uses `.period-bar` / `.period-btn`

## StockProductStats
- [x] Tab nav uses `.tab-nav` / `.tab-item` classes
- [x] Period selector uses `.period-bar` / `.period-btn`

## StockHistory
- [x] Uses `<EmptyState>` component
- [x] Uses `<PageHeader>` component

## ProductsPage
- [x] Channel badge uses `badge badge-green` class
- [x] Demo warning uses `.demo-banner` class
- [x] Search input uses `.input-icon-wrap` class

## StockBatch
- [x] Summary cards have icons (Package, DollarSign, AlertTriangle, AlertCircle)
- [x] Category breakdown uses `.category-chip` class
- [x] Alert section uses `.card--warning` class

## Dark Mode
- [x] `.dark .btn-outline` variant defined
- [x] `.dark .card--warning` / `success` / `danger` variants defined
- [x] `.dark .category-chip` variant defined
- [x] `.dark .ai-popup-*` variants defined (overlay, card, header, title, subtitle, status, line, footer)

## Verification
- [x] `npm run typecheck` — PASS
- [x] `npm test` — PASS (50/50 tests)
- [x] Bug registry #17 (`useLocation`): intact — legitimately used for nav highlighting
- [x] Bug registry #21 (`Settings` import): intact
- [x] Bug registry #25 (`Database` import): intact
- [x] Bug registry #26 (Tab Keuangan text): intact — no `background: none` inline
- [x] No new hardcoded hex colors in new CSS classes
- [x] No new inline styles introduced in StockFinance tabs
