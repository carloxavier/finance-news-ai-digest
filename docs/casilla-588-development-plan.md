# Casilla 588 — development plan

A port of the Claude Design handoff `Calculadora de Dividendos` into a
production app, shipped as a new standalone repo and product
(`casilla588.es`). This document captures the plan; implementation lives
elsewhere.

---

## 1. What we are building

A single-page calculator that tells a Spanish dividend investor how much
of the foreign-withholding tax on their dividends they can recover via
**casilla 588 of Modelo 100** of the IRPF, plus how much extra is stuck
at origin and would need a separate reclaim. The hero animates a
4-step tutorial; the body lets the user compose a portfolio (manual
entry or paste); the result block leads with one large number; a ledger
and a country breakdown justify it; a waitlist CTA captures emails for
the future automated product. A "Sobre los datos" view lists every
country tax rate with its BOE/AEAT source.

**Naming and brand** (from the chat transcript): wordmark `Casilla 588`,
domain `casilla588.es`, tagline framing around "calculadora de doble
imposición sobre dividendos extranjeros". The number "588" is the
recognition signal for the target user (cazadividendos) — keep it
prominent in masthead, title, meta tags.

**Scope decisions** (confirmed):

- **Standalone repo + product**, not a route inside this repo.
- **Email CTA writes to a new dedicated `casilla_waitlist` table** (not
  the existing digest subscribers).
- **Editorial style only.** Drop the Tweaks panel and the
  Terminal/Boletín variants and the density toggle from the prototype.

## 2. Source materials

The handoff bundle is at:
`https://api.anthropic.com/v1/design/h/V0lVqZbUUNdoYlshVgFBcA?open_file=index.html`
(downloads as `Calculadora de Dividendos-handoff.tar.gz`, ~264 KB).

Key files to mirror behavior from:

| File | Role |
|---|---|
| `project/index.html` | Document head, font/script imports, mount point. |
| `project/app.jsx` | All UI components: `Masthead`, `DocHead`, `DemoPreview` (static, replaced by animation), `InputSection`, `KeyMoment`, `Ledger`, `CountryBreakdown`, `CTA`, `SourcesPage`, `Footer`, `App`. |
| `project/demo-animation.jsx` | The 14-second hero tutorial: timeline, easing helpers, 4 steps (manual add → paste → reveal cifra → CTA pulse), with pause/restart controls. |
| `project/data.js` | `COUNTRIES` (7 countries, nominal vs treaty rates, notes), `TICKERS` (33 entries), `SAMPLE_PORTFOLIO`, `calcPosition`, `calcPortfolio`, `fmtEur`, `fmtPct`, `IRPF_RATE = 0.19`. |
| `project/styles.css` | Design tokens, paper-grain effect, layout, all component styles, responsive breakpoints (760px, 540px). |
| `project/tweaks-panel.jsx` | **Skip** — design-only scaffolding, not for production. |
| `chats/chat1.md` | Intent + iteration history. The hero animation requirement and the "remove auto-loaded portfolio" decision both come from here. |

## 3. Recommended stack

The prototype uses React 18 UMD + Babel-in-browser + plain CSS. For
production we want the same React surface but a real toolchain:

- **Vite 5 + React 18 + TypeScript (strict)**.
- **Plain CSS or CSS Modules**, not Tailwind. The design depends on
  CSS variables for tokens and on hand-tuned editorial type — Tailwind
  would obscure both. (One CSS file is fine; the prototype is already
  organized as one and is ~1.5k lines, which is small.)
- **No UI component library.** The widgets (autocomplete, textarea,
  table, segmented bar) are bespoke and small.
- **Google Fonts**: Source Serif 4, Inter, JetBrains Mono — same
  imports as the prototype.
- **Hosting**: Cloudflare Pages or Netlify, custom domain
  `casilla588.es`. (GitHub Pages works too but custom-domain TLS plus
  edge function for the waitlist is friendlier on CF/Netlify.)
- **Backend**: a new Supabase project. Postgres for the waitlist
  table, one Edge Function (Deno) for the public insert. Recommended
  over piggybacking on the finance-news-ai-digest Supabase project so
  the products keep separate billing and access boundaries.

## 4. Repository layout (target)

```
casilla-588/
├── README.md                  # public-facing readme + dev quickstart
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html                 # ports project/index.html (no UMD/Babel)
├── public/
│   └── og-image.png           # social card with "588 €/año" mock
├── src/
│   ├── main.tsx               # ReactDOM root
│   ├── App.tsx                # top-level shell + route between calc and sources
│   ├── components/
│   │   ├── Masthead.tsx
│   │   ├── DocHead.tsx
│   │   ├── DemoAnimation.tsx  # ports demo-animation.jsx
│   │   ├── InputSection.tsx
│   │   ├── KeyMoment.tsx
│   │   ├── Ledger.tsx
│   │   ├── CountryBreakdown.tsx
│   │   ├── WaitlistCTA.tsx
│   │   ├── SourcesPage.tsx
│   │   └── Footer.tsx
│   ├── data/
│   │   ├── countries.ts       # COUNTRIES, typed
│   │   ├── tickers.ts         # TICKERS, typed
│   │   └── samplePortfolio.ts
│   ├── domain/
│   │   ├── calc.ts            # calcPosition, calcPortfolio (pure)
│   │   ├── parse.ts           # parsePastedText
│   │   └── format.ts          # fmtEur, fmtPct
│   ├── api/
│   │   └── waitlist.ts        # POST to Supabase edge function
│   ├── styles/
│   │   ├── tokens.css         # :root vars (paper, ink, accent, type, gaps)
│   │   ├── base.css           # reset, body, grain, typography utilities
│   │   ├── layout.css         # .page, .section, .section-head, masthead
│   │   ├── doc-head.css
│   │   ├── input.css
│   │   ├── positions.css
│   │   ├── key-moment.css
│   │   ├── ledger.css
│   │   ├── country.css
│   │   ├── cta.css
│   │   ├── sources.css
│   │   ├── footer.css
│   │   └── demo-anim.css
│   ├── hooks/
│   │   └── useReducedMotion.ts
│   └── __tests__/             # unit tests (Vitest)
└── supabase/
    ├── migrations/
    │   └── 0001_casilla_waitlist.sql
    └── functions/
        └── waitlist-signup/
            └── index.ts
```

## 5. Component port plan

For each component below: **what it does**, **gotchas while porting**,
**typing notes**.

### 5.1 `Masthead`
- Wordmark "Casilla 588" with the "588" rendered in mono-accent.
- Single nav link toggles `<SourcesPage />` vs the calculator view (in
  prototype this is local state; can be a `<Link>` on `/sobre-los-datos`
  if we want share-able URLs — recommended, makes SEO trivially better).

### 5.2 `DocHead`
- H1 with one italicized accent word (`<em>retienen</em>`). The
  `text-wrap: balance` on H1 and `text-wrap: pretty` on the lede
  matter; preserve them.
- Meta strip: "sin signup · sin tracking · todo client-side", BOE
  source line, "Datos verificados <date>". The verified-date string
  should be a build-time constant fed from `data/countries.ts` so it
  cannot drift from the rate table.

### 5.3 `DemoAnimation` (the hero)
This is the single most complex component. The prototype uses a
`requestAnimationFrame` loop driven by a 14.4-second timeline (`TL`
object), with derived booleans for which input is "focused", which
key was just typed, which positions have "landed".

Port plan:

- Keep the `TL` constant verbatim (`demo-animation.jsx:20-53`) as a
  typed `Timeline` record.
- Keep helpers: `clamp`, `easeOutCubic`, `easeInOut`, `typed`,
  `rampUp`, `rampDown`, `pulseAround`, `stepAt`. Move to
  `domain/animation.ts` as pure functions (testable).
- The component holds `t` in state and updates via rAF. **Important**:
  call `setT` inside `requestAnimationFrame`, not on a fixed interval,
  so it stays in sync with display refresh.
- **Reduced motion**: if `useReducedMotion()` returns true, render the
  end-state of step 4 (positions populated, cifra revealed, CTA
  visible) statically and skip the rAF loop. Pause/restart controls
  still visible but no-op.
- **Pause/restart**: keep `togglePause` and `restart`. The clock-keeping
  trick (`startRef = performance.now() - pausedAt`) must be preserved or
  resume jumps.
- The result animation pulls live numbers from `calcPortfolio(ANIM_POSITIONS)`
  computed once via `useMemo`. Type the return.
- Visibility on mobile: the prototype collapses the two-column stage
  to one column at `760px`. Verify the animation still reads at 360px
  width (the textarea typing and the positions-list landing in
  particular).

### 5.4 `InputSection`
- Two panels side by side, "Manual" and "Pegado masivo", in a CSS
  grid that becomes single-column under 760px.
- Manual mode: ticker input with autocomplete (`startsWith(t)` or
  name-includes), shares input, "AGREGAR" button. Keyboard: Arrow
  Up/Down through suggestions, Enter selects highlighted, Escape
  closes. Preserve `onMouseDown` (not `onClick`) on suggestions —
  the prototype relies on this so blur fires after selection.
- Paste mode: textarea + `parsePastedText` + per-line error list (cap
  shown at 4, "+N más").
- Empty state below: "Aún no has añadido nada. Empieza por una
  posición arriba — o carga la cartera de ejemplo para trastear." —
  preserve the loaded-example link as escape hatch.
- Position rows have a `✕` remove button. On mobile the row collapses
  to a stacked layout (see `.position-row` media query in `styles.css`).
- Expose the section's anchor ref upward so the demo CTA can `scrollTo` +
  focus the ticker input.

### 5.5 `KeyMoment`
- Renders nothing if portfolio is empty.
- The `figure` div is the design's hero number: Source Serif at weight
  300, ~9rem on desktop, currency glyph on the left and `/año` on the
  right both as smaller mono labels.
- The annotation row underneath summarizes Bruto / Retenido / IRPF tras
  deducción / Neto / Exceso (red). Order matters — it tells the story.

### 5.6 `Ledger`
- Wide table with horizontal scroll on mobile.
- Each row uses `data-label` attributes so a CSS rule can render the
  table as stacked cards under 700px (keep this — it's the only way
  to make a 9-column table usable on phones).
- Totals row pinned at the bottom with `<tr class="totals">`.
- "588" abbreviation tag has a tooltip via `<abbr title="…">`. Keep it.

### 5.7 `CountryBreakdown`
- Single horizontal stacked bar segmented by country, with per-country
  legend below (name + bruto + recuperable in green).
- Each segment has class `cseg-${country}` whose color comes from
  `styles.css`. Need to add CSS classes for any new country code we
  ever support.

### 5.8 `WaitlistCTA`
- Form with email input + checkbox "guarda esta cartera".
- Client-side: validate email regex (the prototype's regex is fine —
  `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), then POST to the edge function.
- Confirmation state: replaces the form with a green check + message;
  message wording branches on whether the cartera was saved.
- On error from edge function: render an inline `.error-text` and
  leave the form usable.
- See §7 for the API shape.

### 5.9 `SourcesPage`
- Renders one card per entry in `COUNTRIES`, with name, ISO code, the
  two rates, and the `note` field.
- Footer paragraph cites BOE article numbers verbatim. Keep them in a
  constant in `data/sources.ts` so updates are atomic.

### 5.10 `Footer`
- Two paragraphs, mono small-caps caveat about not-tax-advice and
  attribution. Verify the copy is final before launch — it is product
  voice.

## 6. Data layer

### 6.1 Types
```ts
// data/countries.ts
export type CountryCode = "US"|"UK"|"NL"|"DE"|"CH"|"FR"|"IT";
export interface CountryInfo {
  name: string;
  flag: CountryCode;     // for now == code
  nominal: number;       // 0..1
  treaty: number;        // 0..1
  note: string;          // human-language explanation
  source: string;        // BOE-A-... reference
}
export const COUNTRIES: Record<CountryCode, CountryInfo> = { /* ... */ };
export const RATES_VERIFIED_AT = "2025-11-12";
export const RATES_NEXT_REVIEW = "2026-02-12";
```

```ts
// data/tickers.ts
export interface Ticker {
  t: string; name: string;
  country: CountryCode;
  div: number; ccy: "USD"|"EUR"|"CHF"|"GBP";
  divEur: number;
}
export const TICKERS: Ticker[] = [ /* 33 entries */ ];
```

### 6.2 Calc (pure)
Keep the formulas exactly. Per the prototype, per position:
```
bruto             = shares * divEur
retOrigen         = bruto * nominal
recuperable588    = bruto * treaty
excesoOrigen      = max(0, bruto * (nominal - treaty))
irpfTeorico       = bruto * IRPF_RATE
irpfTrasDeduccion = max(0, irpfTeorico - recuperable588)
netoFinal         = bruto - retOrigen - irpfTrasDeduccion
```
`IRPF_RATE = 0.19` (first IRPF bracket up to €6k — caveat in source
file). For v1 keep it constant; document in the Sources page that we
ignore the higher brackets.

### 6.3 Parse (pure)
Port `parsePastedText`: split on newlines, regex
`^([A-Za-z0-9.\-]+)[\s,;:|]+(\d+(?:[.,]\d+)?)`, validate ticker is in
`TICKERS`, validate `shares > 0`. Return `{ positions, errors[] }`.

### 6.4 Format (pure)
Port `fmtEur`/`fmtPct` with `toLocaleString("es-ES")`. Lock locale
to `es-ES` regardless of browser — the design depends on Spanish
thousand separators.

## 7. Backend (Supabase)

### 7.1 Schema — migration `0001_casilla_waitlist.sql`
```sql
create table public.casilla_waitlist (
  id           bigserial primary key,
  email        text not null,
  email_norm   text generated always as (lower(trim(email))) stored,
  portfolio    jsonb,                       -- nullable; only present if user opted in
  user_agent   text,
  ip_hash      text,                        -- sha256 of (ip || daily_salt) for abuse, not PII
  created_at   timestamptz not null default now()
);

create unique index casilla_waitlist_email_norm_idx
  on public.casilla_waitlist (email_norm);

-- row-level security: the table is only written/read by the service
-- role inside the edge function; deny everything from anon/auth.
alter table public.casilla_waitlist enable row level security;
-- (no policies = no access)
```
The `portfolio` JSONB shape is `{ positions: [{ t: string, shares: number }], snapshot_at: ISO }`.

### 7.2 Edge function — `waitlist-signup`
```
POST /functions/v1/waitlist-signup
body: { email: string, portfolio?: { positions: Position[] } }
```
- Validate email server-side (same regex).
- Insert with conflict-on-email_norm: do nothing (idempotent — second
  signup of the same email is a 200, no error).
- Hash IP with a daily-rotated salt env var; store the hash, not the
  IP. Deny if more than 5 distinct emails from the same hash in 24h.
- Returns `{ ok: true }`. Never echoes the email back.
- CORS: `Access-Control-Allow-Origin: https://casilla588.es` only.

### 7.3 Future automation (out of scope for v1)
The CTA copy promises a future "weekly cartera analysis email". That
needs (a) a way to refresh ticker dividend data, (b) cron + email
sender (Resend), (c) per-user unsubscribe tokens. Punt to a v2 doc;
the schema above leaves room (`portfolio` JSONB is the seed).

## 8. Design tokens & styling

Lift these directly from `styles.css:6-45` into `tokens.css`:

- **Paper palette**: `--paper #f5f1e8`, `--paper-2 #ece6d6`,
  `--paper-3 #e3dbc6`.
- **Ink palette**: `--ink #1a1814`, `--ink-2 #4a4438`, `--ink-3 #7a7264`,
  `--ink-4 #a89f8c`, plus rule lines.
- **Accent**: `--accent #a8462e` (terracota óxido), `--accent-deep #7a3220`,
  `--accent-tint rgba(168,70,46,0.08)`. Applied to: italic accent words,
  hover underlines, the "588" in masthead, primary button background,
  "AGREGAR"/"Apuntar"/"Probar con mi cartera" CTAs, the recoverable
  number in the ledger column.
- **Signal colors**: `--good #2f6f4e` (recuperable), `--warn #b88a1a`,
  `--bad #8b3a2e` (exceso a reclamar).
- **Type stack**: `--serif Source Serif 4`, `--sans Inter`, `--mono JetBrains Mono`.
- **Gaps**: a 6-step scale (`--gap-xs 4 → --gap-2xl 64`).
- **Layout widths**: `--col-narrow 760` (text), `--col-wide 1120` (page).

**Drop**: `body[data-style="terminal"]`, `body[data-style="boletin"]`,
`body[data-density="compact"]` — Editorial only.

**Keep**: the SVG paper-grain effect at `body::before` (it is what
makes the design feel like paper, not a webpage). It's a tiny inline
data URL — no asset cost.

**Country segment colors**: each CountryCode has a `.cseg-XX`
background color. List today: US, UK, NL, DE, CH, FR, IT. When new
countries are added the rule must be added to `country.css`.

## 9. Animation timeline (reference)

For the implementer, the steps the hero animation walks through:

| Window (ms) | What happens |
|---|---|
| 0–600 | Empty input panel visible, paste panel dim. |
| 600–1200 | "KO" types into ticker field. |
| 1300–2000 | Autocomplete dropdown appears, KO row highlights. |
| 2000–2300 | Selection commits (KO stays in field). |
| 2300–3000 | "500" types into shares field. |
| 3400–3650 | "Añadir" button pressed state. |
| 3600–4000 | First position lands in cartera column (slide-in from right). |
| 4000–4500 | Manual panel dims, paste panel becomes active. |
| 4500–6900 | Paste textarea types `JNJ 200\nNESN 250\nROG 50\nALV 30`. |
| 7300–7550 | "Procesar" pressed. |
| 7500–8200 | Remaining 4 positions land sequentially (130 ms stagger). |
| 8200–9800 | Result block fades in, big number counts up to recuperable total. |
| 9800–10800 | Country bar fills in segment by segment. |
| 11200–12500 | CTA button pulses (terracota glow ring). |
| 14400 | Loop end → restart. |

Per-step labels at the top: "Añade una posición manualmente" → "O
pega tu cartera entera de golpe" → "Mira cuánto recuperarías cada
año" → "Pruébalo con tu cartera real".

## 10. Responsive plan

- **≥1120px**: full design as drawn. Page max width 1120, body
  padding 56px.
- **760px–1119px**: page padding scales from 16 to 56 via
  `clamp(16px, 4vw, 56px)`. Two-column input grid still side by side
  until 760, then stacks.
- **540px–760px**: input grid one column; demo animation stage one
  column; ledger gets horizontal scroll.
- **<540px**: row-input collapses to two-up grid with the button on
  its own row; position rows collapse to stacked label/value pairs;
  ledger renders as cards using the `data-label` trick.

Mobile-first checks before launch:
- 360px Samsung Galaxy S width.
- iPhone SE 375x667.
- iPad portrait 768x1024.

## 11. Accessibility

- All inputs have `<label htmlFor>` (already in prototype).
- The country bar has `role="img"` + `aria-label` summarizing
  composition. Keep it; for screen readers add an `<ul>` sibling that
  visually-hides but lists `country: pct` so the data is also linear.
- Autocomplete needs ARIA: `role="listbox"` on the `<ul>` (already
  there), `role="option"` + `aria-selected` on each `<li>`, and the
  ticker input needs `aria-controls`, `aria-expanded`, `aria-activedescendant`.
- `<abbr title="Casilla 588 del Modelo 100">588</abbr>` already
  exposes the expansion to AT.
- Demo animation must respect `prefers-reduced-motion: reduce` (see
  §5.3).
- Color contrast: terracota on paper passes AA at body sizes; verify
  the `--ink-3` and `--ink-4` greys on `--paper` (specifically the
  meta-strip, mono labels, and table secondary text) — these are the
  most likely WCAG misses. Run axe before launch.
- Pause/restart controls on the animation must be keyboard-reachable
  with visible focus rings.

## 12. SEO & social

- `<title>`: "Casilla 588 — Calculadora de retención fiscal sobre
  dividendos extranjeros" (already in `index.html`).
- Meta description: one sentence framing "casilla 588 / Modelo 100 /
  doble imposición / dividendos extranjeros". Target keyword:
  "casilla 588 IRPF dividendos extranjeros".
- Open Graph: `og:image` = pre-rendered card with the cifra-grande
  treatment. Build script can render this from the React tree once
  via Playwright.
- Sitemap.xml with `/` and `/sobre-los-datos`.
- robots.txt allow all.
- No analytics for v1 — the hero copy promises "sin tracking". If
  anonymous counts are needed later, use server-side log aggregation,
  not a client beacon.

## 13. Testing

Three layers, mirroring how this repo's `docs/testing.md` splits them:

**Unit (Vitest)** — pure-domain coverage:
- `calcPosition` for one row of each country code (US, UK with 0%
  treaty, DE with reclaimable exceso, CH with the largest exceso,
  FR with treaty > nominal edge case, IT with the disputed delta).
- `calcPortfolio` aggregates correctly across mixed countries; the
  totals row matches the sum of children.
- `parsePastedText`: separators (space, comma, semicolon, colon),
  decimals with comma vs dot, unknown ticker, zero shares, garbage
  line — every error type asserted.
- `fmtEur` / `fmtPct` produce Spanish locale strings deterministically
  regardless of `process.env.LANG`.

**Component (RTL + Vitest)**:
- `InputSection`: typing a ticker shows suggestions; ArrowDown +
  Enter selects; "Añadir" pushes a row; remove button removes.
- `WaitlistCTA`: invalid email shows error; valid email POSTs once;
  second submit after success is a no-op (or shows confirmation
  state again).
- `DemoAnimation`: with reduced-motion forced, the end-state renders
  immediately and rAF is never scheduled.

**E2E smoke (Playwright)** — a single happy path:
1. Land on `/`, hero animation visible.
2. Click "Probar con mi cartera" → page scrolls to input, ticker
   field focused.
3. Type `KO` + `100`, press Añadir → position row appears, key
   moment renders a non-zero recuperable.
4. Toggle to paste mode, paste 3 lines, Procesar → 4 positions in
   cartera total.
5. Submit waitlist with a fake email → confirmation appears.
6. Navigate to `/sobre-los-datos` → 7 country cards visible.

## 14. Performance budget

- First contentful paint < 1.5s on Slow 4G.
- Total JS bundle (gzipped) < 60 KB. The prototype's animation is the
  riskiest piece; if rAF + per-frame React rerenders push CPU too
  high, switch to a single CSS-keyframes timeline driving `--t` via
  one `setTimeout` per phase. Defer this optimization until measured.
- Fonts: subset Source Serif and Inter to Latin only; preload the
  display weight (300) of Source Serif because the cifra-grande is
  above the fold.
- The grain SVG is inlined as data URL — fine, ~400 bytes.

## 15. Phased milestones

A reasonable build order; each phase is one commit/PR boundary.

**P0 — Repo bootstrap (½ day)**
- New repo, Vite + React + TS scaffolding, prettier/eslint, CI
  (lint, typecheck, test, build).
- `tokens.css` + `base.css` checked in; index page renders Source Serif
  H1 to confirm fonts.

**P1 — Static design system (1 day)**
- Port `Masthead`, `DocHead`, `Footer`. No state.
- Port all tokens, layout, base, doc-head, footer styles.
- Design QA: open at 360 / 768 / 1280 / 1920 widths; compare to
  prototype.

**P2 — Calculator core (1.5 days)**
- Port `data/`, `domain/calc.ts`, `domain/parse.ts`, `domain/format.ts`
  with full unit tests.
- Port `InputSection`, `KeyMoment`, `Ledger`, `CountryBreakdown`.
- Wire local state in `App.tsx`; verify with `SAMPLE_PORTFOLIO`.

**P3 — Sources page (½ day)**
- Port `SourcesPage` + the BOE references constant.
- Add `/sobre-los-datos` route (or in-app toggle if React Router is
  overkill — recommend the route for SEO).

**P4 — Hero animation (1.5 days)**
- Port timeline + helpers as pure functions, with unit tests on
  `stepAt`, `typed`, `rampUp`, `pulseAround`.
- Port `DemoAnimation` component with rAF loop and pause/restart.
- Implement `useReducedMotion` and the static fallback render.
- Cross-browser check: Safari macOS, Safari iOS, Firefox, Chrome.

**P5 — Waitlist backend (1 day)**
- Create new Supabase project.
- Migration `0001_casilla_waitlist.sql` (see §7.1).
- Edge function `waitlist-signup` with rate limit + CORS.
- Frontend `api/waitlist.ts` + wire `WaitlistCTA`.
- Smoke test the round-trip from a deployed preview.

**P6 — Production hardening (1 day)**
- Accessibility pass (axe, keyboard-only walkthrough, screen reader
  on the hero animation).
- SEO meta + OG image.
- Playwright smoke in CI.
- Lighthouse: ≥95 on perf/a11y/best-practices/SEO at mobile.
- Hook `casilla588.es` to the host (CF Pages or Netlify), configure
  TLS, set canonical URL.

**P7 — Launch (½ day)**
- Soft-launch to Cazadividendos forum / Reddit /r/Finanzas / X.
- Monitor waitlist signups, crash logs.
- Plan v2 (the automated weekly analysis) once signal exists.

Total: ~7 working days of focused build, plus launch.

## 16. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Tax data goes stale.** Rates change at ministerial level; the user trusts our number. | A `RATES_VERIFIED_AT` constant is rendered in the masthead and Sources page; calendarize a quarterly review with a single PR pattern (one file: `data/countries.ts`). Set a stale-threshold of 6 months — past that, render a banner. |
| **The IRPF 19% simplification is wrong for higher earners.** Anyone in the 21–28% IRPF brackets is under-recuperando in our number. | Ship v1 with explicit caveat in the lede + Sources page. v2: add a "tu IRPF marginal" toggle (19/21/23/27/28). |
| **rAF animation pegs the CPU on low-end mobile.** | Profile on a Moto G; if frame budget overruns 16 ms, drop to 30 fps timer or fall back to pure-CSS timeline. |
| **Email spam through the waitlist endpoint.** | IP-hash + daily salt + 5/day limit (§7.2); cap insert size; reject portfolio JSON > 4 KB. |
| **Domain `casilla588.es` unavailable.** | Fall back to `casilla588.com` / `lacasilla588.es`. The wordmark survives either. |
| **Ticker list is only top-30, will frustrate long-tail users.** | Show explicit copy under the input ("autocompletado sobre los 30 tickers más comunes") — already present in prototype. v2: paid-tier tickers via OpenFIGI or per-user ticker submissions. |
| **AEAT may dispute the IT 11-point delta interpretation.** | Note already present in `COUNTRIES.IT.note`; surface that note as inline footnote on the Italy line of the ledger. |

## 17. Out of scope for v1

- Real-time dividend data (we ship a snapshot).
- Multi-currency display toggle (Euro only).
- Account / login (everything client-side; cartera lives in
  `localStorage` only if we want refresh-survival; not in v1).
- Multi-language (Spanish only — the brand is Spanish-tax-specific).
- The promised "weekly automated analysis" — captured as v2.
- Higher IRPF bracket logic — captured as v2.
- Tweaks panel — explicitly dropped per scope decision §1.

## 18. Open follow-ups before P0

- Confirm domain availability and registrar.
- Confirm Supabase organization / billing for the new project.
- Decide hosting: Cloudflare Pages vs Netlify (both work; pick one).
- Decide whether `localStorage` cartera persistence is part of v1 (cheap; recommended).
