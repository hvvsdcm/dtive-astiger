# DTIVE & ASTIGER — repository rules

Static SPA (Vite + React 19 + TypeScript + Tailwind 4) on Supabase (Auth, Postgres + RLS, Storage).
The full plan and every contract (tokens, routes, schema, interfaces, security) is in
[docs/PLAN.md](docs/PLAN.md). Read it before changing structure or interfaces.

## Commands

```sh
npm run dev          # http://127.0.0.1:5174 (needs .env.local, see .env.example; `supabase start` first)
npm run typecheck    # tsc -b --noEmit
npm run lint         # eslint .
npm run format       # prettier --check .
npm test             # vitest run
npm run build        # tsc -b && vite build
npm run test:db      # pgTAP (supabase test db)
npm run e2e          # playwright
npm run gen:types    # regenerate src/types/database.ts from the local database
npm run favicons     # rebuild public/ icons from brand/logo-source.png
```

Run `npm run typecheck && npm run lint && npm run format && npm test && npm run build` before committing.

## Design

- Colours, type sizes, fonts and motion come only from `src/styles/tokens.css`. The default Tailwind
  palette, radii and shadows are removed on purpose; do not add arbitrary colours.
- `border-radius` is 0 everywhere. No shadows, gradients, emoji, scroll animations or hover zoom.
- No subtitles, helper paragraphs or marketing copy. Labels are short nouns; empty/error states are
  one sentence plus at most one link.
- `font-display` (Bodoni Moda) only for category/lookbook/section titles, the home hero and 404.
  Everything else is `font-sans` (Pretendard), weights 400/500 (600 only for order totals).
- Icons: lucide-react through `components/ui/Icon` (20px, stroke 1.5). Icon-only buttons need
  `aria-label`. Logo: `components/ui/Logo` (CSS mask of `src/assets/logo.svg`, takes currentColor).
- Never draw images in code (SVG paths, canvas, generated art). Use licensed photos and brand files.
- `cn()` only joins classes; it does not resolve conflicts. Do not pass utilities that fight each other.

## Code

- `@/` imports map to `src/`. Shared UI lives in `src/components/ui`, layout in
  `src/components/layout`, features in `src/features/<name>`, admin in `src/admin` (lazy chunk).
- Business details: `src/config/business.ts` only. Environment: `src/config/env.ts` (validated).
- Page titles: render `<title>{pageTitle('…')}</title>` inside the page component.
- Server state through React Query with keys from `src/lib/queryKeys.ts`; Supabase errors shown to
  users through `rpcErrorMessage()` (never raw database messages, never emails/phones in toasts).
- Toasts: `toast()` from `components/ui/toastStore`. Modals/panels: `Dialog` / `Drawer` (native
  `<dialog>`).
- `src/types/database.ts` is generated; do not edit it by hand.

## Security

- Every table has RLS enabled and forced; the UI guard is convenience, the database is the defence.
- Only `VITE_SUPABASE_URL` and the anon/publishable key may reach the client. Never commit `.env*`
  files other than `.env.example`; never use the service_role key in this repo.
- Prices, stock and order state change only inside `security definer` functions.
- No `dangerouslySetInnerHTML` (lint error). External links use `rel="noopener noreferrer"`.
- The Content-Security-Policy is generated in `vite.config.ts` (`%APP_CSP%` in `index.html`) from
  `VITE_SUPABASE_URL`. Add a source there when a new third-party origin is required.
- Hosting is Cloudflare Workers static assets (`wrangler.jsonc`, response headers in `public/_headers`),
  deployed only by `.github/workflows/deploy.yml`; never deploy from a machine with `.env.local`.
