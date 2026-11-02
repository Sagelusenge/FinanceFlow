---
name: Vanguard Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#40000d'
  on-tertiary-container: '#f23d5c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  title:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  numeric-metric:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system establishes an institutional-grade, highly precise, and reassuring aesthetic engineered for modern financial intelligence. It serves founders, finance leaders, and wealth analysts who demand absolute clarity, rapid scannability, and high-trust interactions. 

The aesthetic is Modern Corporate with architectural clarity:
- Pure functional confidence over decorative noise.
- Crisp, layered data surfaces engineered to make dense quantitative metrics legible at a glance.
- Precision framing with hair-thin borders, tactile micro-elevations, and intentional semantic cues.
- Emotional resonance: Calm control, unwavering stability, institutional prestige, and decisive insight.

## Colors
The color architecture relies on a resolute contrast hierarchy centered around deep slate foundations and decisive fiscal semantics:

- **Primary (`#0F172A` - Slate 900):** Anchors brand typography, primary action surfaces, navigation rails, and core tabular data. Signifies authority and permanence.
- **Secondary (`#10B981` - Emerald 500):** Dedicated semantic identifier for positive yield, incoming balance, cash flow growth, surplus metrics, and validated ledger states. Supported by a light tint (`#ECFDF5`) for container backgrounds.
- **Tertiary (`#F43F5E` - Rose 500):** Explicit functional signal for outflows, burn rate, negative variance, high-risk flags, and liability increments. Supported by a light tint (`#FFF1F2`) for warning surface fills.
- **Neutral (`#64748B` - Slate 500):** Governs secondary labels, chart axis ticks, column headers, and structural metadata. Pair with `#1E293B` for primary headings and body-lead contrast.
- **Canvas & Card Architecture:** The global canvas renders on `#F8FAFC` (Slate 50), while interactive modules and cards utilize pristine `#FFFFFF` backed by refined border strokes (`#E2E8F0`).

## Typography
Plus Jakarta Sans is deployed across all typographic layers to unite technical precision with approachable modern geometry. 

- **Tabular Figures:** Always apply `font-variant-numeric: tabular-nums lining-nums` across all numeric displays, financial balances, tables, and metric summaries to prevent layout jitter during data updates.
- **Information Hierarchy:** Headers leverage negative letter-spacing for tight, confident optical weight, balancing the deep navy color profile.
- **Micro-Copy & Financial Labels:** Overline badges and table headers use `label-sm` with uppercase transforms and strict tracking to maintain legibility at low point sizes.

## Layout & Spacing
The layout follows a fluid 12-column dashboard grid constructed on an 8pt modular cadence:

- **Desktop (1280px+):** 12 columns with `gutter: 1.5rem` and `margin: 2rem`. Sidebar takes a fixed 280px column, while content stretches across dynamic financial widgets and analytical panels.
- **Tablet (768px - 1279px):** 8 columns with `gutter: 1.25rem` and `margin: 1.5rem`. Multi-card key metric indicators reflow into 2x2 grids.
- **Mobile (< 768px):** 4 columns with `gutter-mobile: 1rem` and `margin-mobile: 1rem`. Data tables shift to horizontal scroll-lock viewports or card-stacked ledger lists.
- **Component Density:** Core data rows within tables and ledger trees utilize compact vertical padding (`space-sm`) to support high information density without visual crowding.

## Elevation & Depth
Elevation is achieved using sharp low-contrast borders combined with ultra-soft ambient occlusion, avoiding muddy drop shadows:

- **Level 0 (Canvas Base):** Background canvas rendered on `#F8FAFC`.
- **Level 1 (Card & Module Layer):** Pure white (`#FFFFFF`) card surfaces enclosed in a hairline border (`1px solid #E2E8F0`) paired with `shadow-sm` (`0 1px 2px 0 rgba(15, 23, 42, 0.05)`).
- **Level 2 (Popovers, Flyouts & Dropdowns):** `#FFFFFF` surfaces with `1px solid #CBD5E1` border and diffused contextual shadow (`0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`).
- **Level 3 (Modal Overlays & Critical Drawers):** `#FFFFFF` surface elevated over an institutional `#0F172A` backdrop with 40% opacity, utilizing `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`.

## Shapes
The design system pairs `roundedness: 2` with explicit scale expansions to achieve contemporary, tailored cards:

- **Primary Cards & Containers:** Standardized on `rounded-xl` (`1.5rem` / `24px`) to create generous, clean enclosures that counterbalance dense analytical data.
- **Interactive Controls (Inputs, Buttons, Dropdowns):** Styled with `rounded-md` (`0.5rem` / `8px`) or `rounded-lg` (`0.75rem` / `12px`) for crisp geometric precision and touch targets.
- **Badges, Tickers & Delta Indicators:** Fully pill-shaped (`9999px`) to immediately isolate quantitative state changes from structural block containers.

## Components

### Buttons
- **Primary:** Deep navy (`#0F172A`) solid fill, white text, subtle hover shift to `#1E293B`, active state inset shadow. Focus ring: `2px` offset with `#0F172A`.
- **Secondary / Outline:** Pure white surface, `1px solid #E2E8F0` border, text in `#1E293B`. Hover state applies `#F8FAFC` background and `#CBD5E1` border.
- **Destructive:** Solid `#F43F5E` fill or tint button with `#FFF1F2` background, `#F43F5E` label, and `#FDA4AF` outline.

### Metric Cards (KPI Displays)
- Crisp white surface, `rounded-xl` radius, hairline `#E2E8F0` border, and `shadow-sm`.
- Card structure: Eyebrow label in `label-sm` (`#64748B`), large primary metric in `numeric-metric` (`#0F172A`), followed by an inline trend badge.
- Positive trends: Background `#ECFDF5`, text `#10B981`, leading up-arrow icon.
- Negative trends: Background `#FFF1F2`, text `#F43F5E`, leading down-arrow icon.

### Form Inputs & Selects
- Height standard: `40px` (desktop), `44px` (touch-optimized mobile).
- Base state: White background, `1px solid #E2E8F0`, placeholder text `#94A3B8`, value text `#0F172A`.
- Focus state: Border transitions to `#0F172A` with an ambient glow (`box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08)`).

### Transaction Lists & Data Tables
- Header row: `#F8FAFC` surface or transparent, uppercase `label-sm` text (`#64748B`), bottom border `1px solid #E2E8F0`.
- Data rows: `#FFFFFF` base, transitioning to `#F8FAFC` on hover. Row divider is a crisp `1px solid #F1F5F9`.
- Numeric alignment: Right-aligned financial amounts utilizing tabular numeric figures.

### Status Chips & Badges
- Pill geometry with padding `2px 8px`.
- Positive / Settled: `#ECFDF5` background, `#065F46` text, `#A7F3D0` border.
- Expense / Pending Outflow: `#FFF1F2` background, `#9F1239` text, `#FECDD3` border.
- Neutral / In Review: `#F1F5F9` background, `#334155` text, `#CBD5E1` border.

### Checkboxes & Segmented Controls
- Checkboxes: `18px x 18px` with `rounded-sm` corners. Unchecked has a `1.5px solid #CBD5E1` border; checked applies `#0F172A` fill with a white vector checkmark.
- Segmented Control (Time Range Switcher): Enclosed in `#F1F5F9` background with `rounded-lg` wrapper; active segment is white with `rounded-md`, hairline border, and micro-shadow.