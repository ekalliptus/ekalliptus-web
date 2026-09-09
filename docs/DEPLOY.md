# Deployment, Cloudflare Workers

This project deploys to **Cloudflare Workers** (Static Assets model, **not** Pages)
via `wrangler deploy`. The live Worker is named **`ekalliptus`** and serves the
apex `ekalliptus.com`.

## How it works

- `astro build` (with `@astrojs/cloudflare`) emits:
  - `dist/server/entry.mjs` (+ chunks) → the Worker code
  - `dist/client/**` → static assets (served via the `ASSETS` binding)
  - `dist/server/wrangler.json` → generated Workers deploy config
  - `.wrangler/deploy/config.json` → a redirect so a root `wrangler deploy`
    automatically uses the generated config
- `scripts/post-build.mjs` strips dot-prefixed asset filenames (Cloudflare does
  not serve hidden files) and rewrites references in the built Worker.
- `wrangler deploy` (run from repo root) uploads the Worker + assets.

`wrangler.toml` pins: `name = "ekalliptus"`, `account_id`, and the `SESSION` KV
namespace id.

## Environment variables

Server-side env is read via `readEnv()` (`src/lib/runtime-env.ts`), which prefers
the **Cloudflare runtime env** (secrets set with `wrangler secret`) and falls back
to the build-inlined `import.meta.env`. So server secrets do **not** need to be in
the build, they live as Worker secrets and survive `wrangler deploy`.

**Runtime secrets** (already set on the `ekalliptus` Worker via `wrangler secret put`):

| Secret | Notes |
|---|---|
| `SUPABASE_URL` | from `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | from `VITE_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only |
| `ZAI_API_KEY` | consult eBot |
| `ZAI_MODEL` | consult model |

`ZAI_API_URL` and `CONSULT_SECRET` have safe in-code defaults; override via
`wrangler secret put` if needed.

**Build-time only** (must exist at build, Vite inlines them into the client):

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | public, client-visible |
| `PUBLIC_GOOGLE_SITE_VERIFICATION`, `PUBLIC_BING_SITE_VERIFICATION` | optional SEO |
| `PUBLIC_URL` | site URL |

To set or rotate a runtime secret:

```bash
CLOUDFLARE_ACCOUNT_ID=f24eb3f70bf59379632e280f8756b9e4 \
  wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name ekalliptus
```

## Manual deploy (local)

```bash
bun install
bun run deploy        # build + wrangler deploy
bun run deploy:dry    # build + dry-run (validate, no upload)
```

Requires a populated `.env` and `wrangler login` (account
`ekalliptus@gmail.com`, id `f24eb3f70bf59379632e280f8756b9e4`).

## CI auto-deploy (Cloudflare Workers Builds)

Deploy on every push to `main`. One-time dashboard setup:

1. **Cloudflare dashboard → Workers & Pages → `ekalliptus` → Settings → Builds**
   (or *Connect to Git* if not yet linked).
2. **Connect repository**: `anrdart/ekalliptus`, production branch **`main`**.
3. **Build settings**:
   - Build command: `bun run build`
   - Deploy command: `wrangler deploy`
   - Root directory: `/`
4. **Build variables**: add the **build-time-only** vars (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `PUBLIC_*`, `PUBLIC_URL`). The server runtime secrets
   (Supabase/ZAI) are already set as Worker secrets and persist across deploys,
   they do **not** need to be build variables.
5. Save. Push to `main` → Cloudflare builds and deploys automatically.

> Note: `account_id` and the `SESSION` KV id are already in `wrangler.toml`, so
> the deploy is deterministic. The KV namespace is `ekalliptus-session`
> (`fa54633d534d4662a0365aaffe577c75`).
