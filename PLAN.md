# foobar — Plan

A single-page demo showcasing **AI tab/ghost-text autocomplete** in a SQLite SQL editor for **web-request analytics** data. Everything runs client-side (SQLite WASM in the browser), deployable to GitHub Pages.

## Headline feature
Type SQL in a CodeMirror editor; an OpenRouter model streams a **ghost-text completion** you accept with **Tab**. Schema-aware **dropdown** autocomplete (no AI) runs alongside it. Results render live in a paginated TanStack table as you type (debounced).

---

## Locked decisions
- **Build:** Vite + React 19 + TypeScript, scaffolded with `pnpm create vite` (react-ts template), **pnpm** package manager.
- **UI:** Tailwind CSS + **shadcn/ui** (init via shadcn CLI). Use CLIs for all boilerplate — no hand-editing package.json where a CLI exists.
- **SQLite:** official **`@sqlite.org/sqlite-wasm`**, in-memory, persisted by **snapshotting DB bytes to IndexedDB** (no COOP/COEP needed → works on GitHub Pages).
- **AI:** Vercel **AI SDK** (`ai`) + **`@openrouter/ai-sdk-provider`**, OpenRouter only.
- **Data/table:** TanStack Query + TanStack Table.
- **Editor:** CodeMirror 6 + `@codemirror/lang-sql` (SQLite dialect).
- **Deploy:** GitHub Pages (`base: '/foobar/'`, GitHub Actions workflow).

## What we explicitly are NOT doing
- **Not** using `@gnata-sqlite/codemirror` (it's a JSONata WASM-LSP package — irrelevant to SQL) or any gnata WASM engine.
- **Not** supporting OpenAI/Anthropic providers — OpenRouter only.
- Anomaly→AI feature is built but **default OFF**, controllable by a dropdown.

---

## What we lift from each reference project
- **localwin → `packages/code-editor/src/ai-autocomplete/`** (`codemirror.ts`, `cache.ts`, `types.ts`, `index.ts`): the ghost-text CM6 extension — `StateField` + `Decoration.widget` ghost text, Tab-accept / Esc-reject keymap, debounce, abort, cache, pluggable `provider.provideInlineCompletions()`. Port near-verbatim (it's generic, browser-only). Optionally also its `Cmd/Ctrl+I` inline-edit popover (same file).
- **localwin → provider selector UX** (`provider-model-picker.tsx`, `provider-form.tsx`, `provider-settings.tsx`, `editor-settings-dialog.tsx`, `use-provider-models.ts`, `model-autocomplete.tsx`, `editor-settings-store.ts`): copy the `cmdk`-popover `ProviderSelector` + `ModelPicker`, the `ProviderForm` (API key show/hide, model autocomplete), the Zustand persisted settings store, and the OpenRouter `/models` fetch + localStorage caching. Trim to OpenRouter only.
- **jjjob → `sql-editor.tsx` + `sql-completions.ts`**: `@codemirror/lang-sql` with `schema` namespace for dropdown autocomplete; `Cmd/Ctrl+Enter` to run.
- **jjjob → `column-registry.ts` + `data-table.tsx`**: dynamic columns from arbitrary result shapes + client-side pagination/sort/resize.
- **gnata playground → `worker.ts` seed generator**: `@faker-js/faker` pools + seeded RNG + batched prepared-statement inserts (`BEGIN`/`COMMIT`, 25k batches) for fast deterministic seeding.

---

## Data domain: web-request analytics
`requests` table (one row per HTTP request):
`id, ts (ISO), method, path, status, duration_ms, bytes, ip, country, user_agent, referrer, session_id`.
Optional `endpoints` lookup. Seeded with faker over a date range: realistic path/method mix, status distribution mostly 2xx with some 4xx/5xx (and an intentional cluster of 500s so the **anomaly** feature has something to find). Enables rich demo queries: error rate over time, p95 latency by path, top endpoints, traffic by country.

---

## Module layout
```
src/
  db/        sqlite.ts (init+exec), persistence.ts (IndexedDB snapshot),
             schema.ts, seed.ts (faker, seedIfEmpty, reset), introspect.ts
  editor/    SqlEditor.tsx, sql-completions.ts (schema→namespace),
             ai-autocomplete/ codemirror.ts cache.ts types.ts index.ts (ported),
             ai-autocomplete/provider.ts (OpenRouter InlineAutocompleteProvider),
             ai-autocomplete/prompts.ts (SQL FIM prompt incl. schema)
  providers/ types.ts, store.ts (zustand persist), openrouter-models.ts,
             share.ts (base64 ?provider= encode/decode + import-on-load),
             components/ ProviderSelector, ModelPicker, ProviderForm,
                         ProviderSettingsDialog, ShareProviderButton, SettingsPanel
  query/     useQueryRunner.ts (debounced run-as-you-type), ResultsTable.tsx
  anomaly/   detect.ts (scan results, e.g. 500-spike), analyze.ts (send to OpenRouter; default off)
  lib/       cn.ts, utils
  App.tsx    layout: editor top, provider/settings bar, results table below
```

---

## Build phases
0. **Scaffold** — create-vite (react-ts) in place; pnpm add deps; shadcn init; Tailwind; Vite config (`base`, `optimizeDeps.exclude: ['@sqlite.org/sqlite-wasm']`, `worker.format: 'es'`); GitHub Pages Actions workflow.
1. **SQLite + seed + persistence** — official wasm init; `exec()` wrapper → `{columns, rows}`; analytics schema; faker batched seed; `seedIfEmpty`; IndexedDB snapshot save/restore; **Reset & reseed** controls; schema introspection.
2. **Query + table** — TanStack Query runner with debounce; dynamic-column paginated table; error/row-count/timing UI.
3. **CodeMirror editor** — mount via `useEffect` (codemirror6 + react-useeffect skills), compartments; `lang-sql` SQLite dialect + schema dropdown autocomplete; syntax highlighting/theme; `Cmd/Ctrl+Enter` run + live debounced query.
4. **Provider system (OpenRouter)** — Zustand persisted store; `ProviderForm`; OpenRouter `/models` fetch+cache; `ProviderSelector` + `ModelPicker` (cmdk, copied from localwin); settings dialog; **Share button** → base64 `?provider=` link; on load, decode and add provider if absent.
5. **AI ghost text (centerpiece)** — port localwin extension; OpenRouter `provideInlineCompletions` builds SQL fill-in-the-middle prompt (with schema + cursor context) and calls AI SDK `generateText`; wire settings (enabled/provider/model/debounce); Tab accept / Esc reject; coexists with dropdown autocomplete. (Web Worker offload = optional enhancement; start main-thread.)
6. **Anomaly → AI** — `detect.ts` scans results (default rule: cluster of 500s); dropdown control **default OFF**; when on, send anomalous sample + schema to OpenRouter and show explanation.
7. **Polish & deploy** — frontend-design pass; empty/loading/error states; ship to GitHub Pages.

---

## Key notes / risks
- **Client-side API key:** the OpenRouter key lives in the browser and is embedded (base64) in share links — intended for easy teammate sharing; anyone with the link gets the key. Acceptable for this demo per request.
- **OpenRouter CORS:** browser fetches to `openrouter.ai` work; AI SDK runs client-side.
- **GitHub Pages persistence:** in-memory wasm + IndexedDB snapshot sidesteps OPFS/cross-origin-isolation entirely.
- **Skills engaged during build:** codemirror6, react-dev, react-useeffect, frontend-design, shadcn, tanstack-query-best-practices, typescript-expert.

## Deferred
Web-Worker AI offload; multi-provider support; richer anomaly rules; inline `Cmd+I` AI edit popover (optional, comes free with the ported file).
