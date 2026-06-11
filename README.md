# foobar

A single-page demo of **AI tab / ghost-text autocomplete** for SQL, over **web-request analytics** data — everything runs client-side in the browser (SQLite compiled to WASM), so it deploys to GitHub Pages as static files.

Type SQL in the CodeMirror editor and an OpenRouter model streams a **ghost-text completion** you accept with **Tab**. Schema-aware **dropdown** autocomplete runs alongside it, and results render in a paginated table that updates as you type.

## Features

- **SQLite in the browser** — `@sqlite.org/sqlite-wasm`, in-memory, snapshotted to IndexedDB so data survives reloads (no server, no cross-origin-isolation headers needed).
- **Seeded analytics data** — a `requests` table generated with `@faker-js/faker` (deterministic), including an intentional 5xx error spike.
- **AI ghost text** — Copilot-style inline completions from any OpenRouter model via the Vercel AI SDK. `Tab` accepts, `Esc` dismisses, `⌘I` opens an inline "ask AI to edit" prompt.
- **Schema autocomplete** — `@codemirror/lang-sql` dropdown completions driven by the live DB schema (no AI required).
- **Run-as-you-type** — read-only queries execute debounced through TanStack Query; mutations require an explicit `⌘↵` so a half-typed `DELETE` can't run.
- **Bring-your-own provider** — add an OpenRouter API key + model; everything is stored locally.
- **Share links** — copy a link that base64-encodes the model + key in a `?provider=` param. Opening it imports the provider automatically (and strips the param). Handy for sharing a ready-to-go setup with teammates.
- **Anomaly → AI** — optional (default **off**): detect 5xx spikes and send them to the model for a diagnosis + follow-up queries. Dropdown-controlled (off / manual / auto).
- Light + dark themes, TanStack Table results (sort, paginate, dynamic columns).

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · shadcn/ui (radix) · CodeMirror 6 · TanStack Query + Table · `@sqlite.org/sqlite-wasm` · Vercel AI SDK + `@openrouter/ai-sdk-provider` · Zustand.

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:5173/foobar/
pnpm build    # type-check + production build to dist/
pnpm preview
```

## Using AI autocomplete

1. Click the **AI** control in the header → **Add provider**.
2. Paste an [OpenRouter API key](https://openrouter.ai/keys) and pick a model (the catalog loads from OpenRouter).
3. Toggle **AI autocomplete** on, then start typing SQL. Ghost text appears after a short pause — press `Tab` to accept.

> The API key lives in your browser (localStorage) and is embedded in share links. This is a demo — don't use a production key.

## Deploy

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`. The Vite `base` is set to `/foobar/`; change it in `vite.config.ts` if you rename the repo.
