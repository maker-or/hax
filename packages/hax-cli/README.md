# @hax/cli

Hax CLI for signing in with Hax (browser + local callback), connecting ChatGPT (OpenAI Codex) via OAuth, and storing credentials in Convex.

## Requirements

- Node 20+
- Environment variables (typically in the **repo root** `.env` / `.env.local`):
  - `NEXT_PUBLIC_WORKOS_REDIRECT_URI` — WorkOS redirect URL; its **origin** is used for `/desktop-auth/*` routes.
  - `VITE_CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL for authenticated mutations.
- Optional: `HAX_DESKTOP_CALLBACK_PORT` — local OAuth callback port (default `1455`).

## Usage

From the monorepo root (after `bun install`):

```bash
bun run cli:build
bun run cli -- --help
bun run cli -- menu
bun run cli -- login
bun run cli -- connect chatgpt
bun run cli -- logout
bun run cli -- status
bun run cli -- update
```

You can also run `node packages/hax-cli/bin/run.js` directly.

Running with **no arguments** is the same as `hax menu` (auth gate + interactive provider menu).

## Update notifications

After commands, the CLI may check npm for a newer `@hax/cli` version (at most once per 24 hours, cached under your config dir).

- Disable: `NO_UPDATE_NOTIFIER=1` or pass `--no-update-notifier` on commands.
- Upgrade: `hax update` (tries `bun add -g` then `npm install -g`), or install manually:
  - `bun add -g @hax/cli@latest`
  - `npm install -g @hax/cli@latest`

## Scripts

| Script      | Description              |
| ----------- | ------------------------ |
| `bun run build`     | Clean `dist/`, then compile `src/` (avoids stale oclif command files) |
| `bun run typecheck` | `tsc --noEmit`           |
| `bun run lint`      | Biome check              |

### oclif note

Do **not** add a top-level `src/commands/index.ts`: oclif treats that file as a **single-command CLI** and maps it to an internal symbol, which breaks normal multi-command discovery. The interactive entry is **`menu.ts`** (`hax menu`); `bin/run.js` runs `menu` when you invoke `hax` with no args.
