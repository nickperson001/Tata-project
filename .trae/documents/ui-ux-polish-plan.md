# Tata Business Suite — UI/UX Refinement Plan (Refined Luxury)

> **For agentic workers:** Follow this plan step-by-step. Each task is a self-contained, safe change. Run typecheck after each task. No logic changes — CSS + presentational JSX only.

**Goal:** Elevate Tata Business Suite's frontend from "functional" to "Refined Luxury" — a premium, trustworthy fintech feel — through centralized CSS, Plus Jakarta Sans typography, and subtle depth. All pages, gradual rollout.

**Architecture:** Centralized CSS in `index.css` (no modules). Plus Jakarta Sans via Google Fonts. Green primary (#10b981) retained. Subtle gradient depth. Desktop-first responsive. All logic untouched.

**Tech Stack:** React 19, Vite 6, TypeScript 6, CSS Variables, chart.js 4, lucide-react, react-chartjs-2

---

## Current State Analysis

**Strengths:**
- Strong CSS variable system already exists (`:root`, `.dark`)
- Chart components (EskalasiChart, ExpenseChart, TopProductsChart) already polished with `useMemo`
- Shared components exist: `PageHeader`, `SectionCard`, `EmptyState`, `FilterBar`, `Modal`, `Badge`, `Skeleton`
- Subnav & bottom nav already have good CSS structure

**Problems to fix:**
1. **Typography:** Inter is generic — no distinctiveness
2. **Inline styles everywhere:** 583+ inline styles across 23 files (StockOverview worst offender)
3. **Inconsistent components:** Some pages use `PageHeader`, others manual `<h2>`; some use `EmptyState`, others plain text
4. **Missing CSS classes:** `.btn-outline`, `.card--warning`, `.input-with-icon` used but not defined
5. **Chart colors hardcoded** (not theme-aware)
6. **Dark mode** has tokens but many components don't use them properly
7. **No loading skeleton consistency** — some pages use different skeleton patterns

---

## Tasks

### Task 1: Add Plus Jakarta Sans font + update typography tokens

**Files:**
- Modify: `src/frontend/src/index.css` (line 1-20 `:root`)

**What:**
- Add `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');` at top of `index.css`
- Update `--font` to `'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`
- Update `body` to inherit from `--font`
- Add heading styles: `h1, h2, h3, h4, h5, h6` with `font-family: var(--font); font-weight: 700; letter-spacing: -0.02em; line-height: 1.3;`
- Verify no `font-family: 'Inter'` hardcoded in any component

**Verification:**
- `npm run typecheck` — PASS
- `grep -r "Inter" src/frontend/src/` — should only appear in `--font` fallback stack
- Visual check: headings should look sharper & more premium

---

### Task 2: Add missing CSS classes for reusable patterns

**Files:**
- Modify: `src/frontend/src/index.css`

**What:**
Add these missing classes (referenced in code but not defined):
- `.btn-outline` — transparent background, border `var(--border)`, hover fills slightly
- `.card--warning` — `border-left: 3px solid var(--warning)`
- `.card--success` — `border-left: 3px solid var(--success)`
- `.card--danger` — `border-left: 3px solid var(--danger)`
- `.input-with-icon` — relative container for icon overlay inputs
- `.finance-tab` — shared class for StockFinance tab buttons
- `.period-bar` / `.period-btn` — already exists, ensure consistent usage
- `.demo-banner` — for demo mode warning banners
- `.sort-icon` — for table sort arrows
- `.category-chip` — for inline category display

**Verification:**
- `npm run typecheck` — PASS
- All new classes use CSS variables (no hardcoded colors)
- Dark mode variants for all new classes

---

### Task 3: StockOverview — polish AiWelcomePopup (convert inline to CSS classes)

**Files:**
- Modify: `src/frontend/src/pages/stock/StockOverview.tsx` (lines 66-191)
- Modify: `src/frontend/src/index.css` (add `.ai-popup-*` classes)

**What:**
- Add CSS classes: `.ai-popup-overlay`, `.ai-popup-card`, `.ai-popup-header`, `.ai-popup-body`, `.ai-popup-badge`
- Replace inline styles in `AiWelcomePopup` with these classes
- **Do not change:** animation logic, typewriter effect, report text, close handler

**Verification:**
- `npm run typecheck` — PASS
- Visual: popup looks identical but uses CSS classes

---

### Task 4: StockOverview — polish bento cards & stat cards

**Files:**
- Modify: `src/frontend/src/pages/stock/StockOverview.tsx` (lines 255-375)
- Modify: `src/frontend/src/index.css`

**What:**
- Add `.bento-stat-clickable` for stat cards with cursor:pointer
- Add `.ov-kpi-loading` for loading opacity state
- Replace inline `cursor: 'pointer'`, `animationDelay` (via CSS `animation-delay` variable), `opacity` inline with CSS classes
- Add `.ov-hero-icon--faded` for hero icon opacity
- Add `.ov-hero-label`, `.ov-hero-number`, `.ov-hero-stats` refinements (larger font, better spacing)

**Verification:**
- `npm run typecheck` — PASS
- Visual: bento grid looks identical

---

### Task 5: StockOverview — polish alert items & empty state

**Files:**
- Modify: `src/frontend/src/pages/stock/StockOverview.tsx` (lines 535-574)
- Modify: `src/frontend/src/index.css`

**What:**
- Replace emoji `📊`, `⚠️` in empty state with lucide-react icons (`BarChart2`, `AlertTriangle`)
- Add `.ov-alert-item--enter` for stagger animation via CSS
- Polish `.ov-empty-card` with subtle gradient background

**Verification:**
- `npm run typecheck` — PASS

---

### Task 6: StockFinance — polish tab navigation (eliminate duplicated inline styles)

**Files:**
- Modify: `src/frontend/src/pages/stock/StockFinance.tsx` (lines 69-98)
- Modify: `src/frontend/src/index.css`

**What:**
- Use `.finance-tab` class for all 4 tab buttons
- Add `.finance-tab--active` for active state
- Replace 4x duplicated inline styles with single class usage
- Add `.finance-tab-icon` for icon styling

**Verification:**
- `npm run typecheck` — PASS
- Tabs look identical

---

### Task 7: StockFinance — polish summary tab & progress bars

**Files:**
- Modify: `src/frontend/src/pages/stock/StockFinance.tsx` (lines 432-588)
- Modify: `src/frontend/src/index.css`

**What:**
- Add `.finance-summary-grid` for summary stat cards
- Use existing `.progress-bar` / `.progress-bar-fill` instead of inline progress bars
- Add `.card--subtle` for low-emphasis cards
- Replace inline `gap: '1rem'` with CSS

**Verification:**
- `npm run typecheck` — PASS

---

### Task 8: StockReport — adopt PageHeader + EmptyState + period-bar

**Files:**
- Modify: `src/frontend/src/pages/stock/StockReport.tsx` (lines 12-150)
- Modify: `src/frontend/src/index.css` (minor)

**What:**
- Import `PageHeader` from `../../components/layout/PageHeader`
- Import `EmptyState` from `../../components/EmptyState`
- Replace manual `<h2>` + `<p>` with `<PageHeader title="Laporan Stok" subtitle="..." />`
- Replace plain text empty state with `<EmptyState icon={<BarChart3 />} title="Belum ada data" text="..." />`
- Replace `btn btn-sm` period selector with `.period-bar` / `.period-btn` pattern
- Use consistent `<h3 className="section-card__title">` for section headings

**Verification:**
- `npm run typecheck` — PASS
- Visual: page header now matches StockOverview style

---

### Task 9: StockProductStats — polish tab navigation + period selector consistency

**Files:**
- Modify: `src/frontend/src/pages/stock/StockProductStats.tsx` (lines 120-133, 219-229)
- Modify: `src/frontend/src/index.css`

**What:**
- Replace inline `borderBottom` tab styles with `.tab-nav` / `.tab-item` classes
- Replace `btn btn-sm btn-ghost` period selector with `.period-bar` / `.period-btn`
- Use consistent section heading classes

**Verification:**
- `npm run typecheck` — PASS

---

### Task 10: StockHistory — adopt FilterBar + EmptyState + PageHeader

**Files:**
- Modify: `src/frontend/src/pages/stock/StockHistory.tsx` (lines 14-149)

**What:**
- Import `FilterBar` from `../../components/FilterBar`
- Import `EmptyState` from `../../components/EmptyState`
- Import `PageHeader` from `../../components/layout/PageHeader`
- Replace manual filter (select + input) with `<FilterBar />`
- Replace plain text empty state with `<EmptyState />`
- Replace manual header with `<PageHeader />`

**Verification:**
- `npm run typecheck` — PASS
- Filter functionality preserved (same props passed to FilterBar)

---

### Task 11: ProductsPage — polish inline styles + channel badge

**Files:**
- Modify: `src/frontend/src/pages/stock/ProductsPage.tsx` (lines 183-290)
- Modify: `src/frontend/src/index.css`

**What:**
- Add `.badge--channel` for channel display in table
- Add `.demo-banner` class for demo mode warning
- Add `.input-icon-wrap` class for search input with icon
- Replace inline styles in channel badge, demo banner, search input

**Verification:**
- `npm run typecheck` — PASS

---

### Task 12: StockBatch — polish summary cards + alert styling

**Files:**
- Modify: `src/frontend/src/pages/stock/StockBatch.tsx` (lines 15-125)
- Modify: `src/frontend/src/index.css`

**What:**
- Add icon to each summary card (Package, DollarSign, AlertTriangle, AlertCircle) — currently plain stat-value
- Add `.card--warning` class for alert section
- Add `.category-chip` class for category breakdown items

**Verification:**
- `npm run typecheck` — PASS

---

### Task 13: Polish shared components (Modal, EmptyState, Badge)

**Files:**
- Modify: `src/frontend/src/components/Modal.tsx`
- Modify: `src/frontend/src/components/EmptyState.tsx`
- Modify: `src/frontend/src/components/Badge.tsx`
- Modify: `src/frontend/src/index.css`

**What:**
- **Modal:** Add backdrop-blur to overlay (already in CSS, verify JSX uses `.overlay` class)
- **EmptyState:** Add animation entrance `fadeIn`, polish icon size/color
- **Badge:** Add `.badge--outline` variant, ensure dark mode support

**Verification:**
- `npm run typecheck` — PASS

---

### Task 14: Polish dark mode tokens & components

**Files:**
- Modify: `src/frontend/src/index.css`

**What:**
- Audit all new classes added in Tasks 2-13 for dark mode support
- Add `.dark` variants for:
  - `.card--warning`, `.card--success`, `.card--danger` (darker bg)
  - `.btn-outline` (lighter border)
  - `.ai-popup-*` (darker card)
  - `.ov-alert-item` already has dark mode — verify
  - Progress bars — ensure gradient works in dark
- Add `.dark .stock-layout` background refinement (darker gradient)
- Add `.dark .sn-item.active` refinement

**Verification:**
- `npm run typecheck` — PASS
- Toggle dark mode — no broken colors

---

### Task 15: Responsive polish (desktop-first refinement)

**Files:**
- Modify: `src/frontend/src/index.css`

**What:**
- Review all new classes for responsive behavior
- Ensure `.bento-grid` works at 1200px, 900px, 600px, 480px breakpoints
- Ensure `.ov-charts` grid doesn't break at narrow viewports
- Ensure table horizontal scroll works on mobile
- Ensure modal doesn't overflow on small screens
- Add `@media (max-width: 480px)` refinements for new classes

**Verification:**
- `npm run typecheck` — PASS
- Test at 375px, 768px, 1024px viewports

---

### Task 16: Final verification & regression check

**Files:**
- No new files

**What:**
- Run `npm run typecheck` — must PASS
- Run `npm test` — must PASS (no test files expected)
- Verify all bug registry items in AGENTS.md Section 6 still intact:
  - #17: `useLocation` in StockLayout — not touched
  - #21: `Settings` import — not touched
  - #25: `Database` import — not touched
  - #26: Tab Keuangan text — not touched (Task 6 only adds class, no style override)
  - Chart components — props identical
- Grep for any hardcoded `#10b981`, `#ef4444`, `#f59e0b` in new CSS — should use variables
- Grep for any new inline styles introduced — should be minimal

**Verification:**
- `npm run typecheck` — PASS
- All bug registry items verified

---

## Assumptions & Decisions

1. **Plus Jakarta Sans** via Google Fonts CDN — adds ~100KB but significantly improves brand feel
2. **Centralized CSS** — all new classes go in `index.css`, no CSS modules
3. **Desktop-first** responsive — target 1024px+, graceful degradation to 480px
4. **Subtle animations** — max 200-300ms, `ease-out` or `cubic-bezier(0.22, 1, 0.36, 1)`
5. **Dark mode** — polish tokens, not full redesign. All new classes get `.dark` variants
6. **No logic changes** — only CSS classes + JSX className swaps. Zero state/query/API changes
7. **Chart colors** — remain hardcoded in components (chart.js doesn't support CSS vars natively), but tooltip/styling uses theme tokens
8. **Font loading** — use `display=swap` for FOUT prevention
9. **Bug registry** — Tasks specifically avoid touching files in AGENTS.md Section 6 bug areas

## Risk Mitigation

- Each task is independently verifiable via `npm run typecheck`
- No task modifies logic, state, or data flow
- CSS-only changes are inherently reversible (git revert single file)
- Tasks 8-11 use existing shared components (already battle-tested)
- Dark mode task (14) comes AFTER light mode is stable
- Final verification (16) explicitly checks all bug registry items
