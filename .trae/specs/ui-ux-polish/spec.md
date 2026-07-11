# UI/UX Refinement — Tata Business Suite

## Why
Frontend Tata Business Suite punya 583+ inline styles, komponen shared (`PageHeader`, `EmptyState`, `FilterBar`) belum konsisten dipakai, dan typography pakai Inter yang generic. Perlu dipoles ke "Refined Luxury" — premium, trustworthy — tanpa mengubah logic bisnis.

## What Changes
- Font: Plus Jakarta Sans menggantikan Inter
- 16 reusable CSS classes baru (`.btn-outline`, `.card--warning`, `.finance-tab`, `.demo-banner`, `.category-chip`, dll)
- StockOverview: inline styles di AiWelcomePopup & bento cards dipindah ke CSS classes, emoji→lucide icons
- StockFinance: tab navigation 4x duplikat inline diganti shared class
- StockReport: adopt `PageHeader` + `EmptyState` + `period-bar`
- StockProductStats: tab nav + period selector pakai shared classes
- StockHistory: adopt `FilterBar` + `EmptyState` + `PageHeader`
- ProductsPage: inline styles di channel badge, demo banner diganti classes
- StockBatch: tambah icon di summary cards, `.category-chip` untuk kategori
- Shared components: Modal backdrop-blur, EmptyState animation, Badge outline variant
- Dark mode: `.dark` variants untuk semua classes baru
- Responsive: refinements untuk 480px-1200px breakpoints

## Impact
- Affected specs: frontend presentation layer
- Affected code: `src/frontend/src/index.css`, 7 halaman stock, 3 komponen shared, 3 chart components

## ADDED Requirements
### Requirement: Premium Typography
The system SHALL use Plus Jakarta Sans via Google Fonts CDN with `display=swap`.

#### Scenario: Font loads
- **WHEN** user opens any page
- **THEN** headings use Plus Jakarta Sans with `letter-spacing: -0.02em` and `font-weight: 700`

### Requirement: Reusable CSS Classes
The system SHALL provide centralized CSS classes for common patterns.

#### Scenario: Button outline
- **WHEN** developer adds `className="btn-outline"` to a button
- **THEN** button renders with transparent background, border `var(--border)`, and primary color on hover

### Requirement: Consistent Component Usage
The system SHALL use shared components (`PageHeader`, `EmptyState`, `FilterBar`) across all stock pages.

#### Scenario: Page header
- **WHEN** user navigates to StockReport, StockHistory, or ProductsPage
- **THEN** page header matches StockOverview style using `<PageHeader>` component

### Requirement: Dark Mode Consistency
The system SHALL support all new CSS classes in dark mode via `.dark` variants.

#### Scenario: Dark mode toggle
- **WHEN** user toggles dark mode
- **THEN** all new classes (`.btn-outline`, `.card--warning`, `.category-chip`, etc.) render with correct dark colors

## MODIFIED Requirements
### Requirement: CSS Variable System
The existing CSS variable system SHALL be extended with transition, shadow, and radius tokens.

## REMOVED Requirements
### Requirement: Inter Typography
**Reason**: Plus Jakarta Sans provides better brand identity
**Migration**: Automatic via `--font` variable
