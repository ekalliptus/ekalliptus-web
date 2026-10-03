# ekalliptus-web

Monorepo for ekalliptus.com: a digital agency site (company profile, services, blog, order flow) and the admin panel that runs it.

## Apps

- `apps/web`: public site, built with Astro (SSR) and deployed to Cloudflare Workers. Blog content is stored in Supabase.
- `apps/admin`: admin panel (dashboard, blog editor with TipTap, customers, orders, payments, consultations, vouchers, reports, audit logs), built with React Router v7 and deployed as its own Worker.
- `packages/core`: shared library (`@ekalliptus/core`) used by both apps.

## Stack

- Astro, React Router v7, Tailwind CSS
- Supabase (Postgres, Auth, Storage)
- Cloudflare Workers (Static Assets model), deploy via `wrangler deploy`

## Run locally

Requires Bun 1.3+ and Node 22+.

```bash
bun install
cp .env.example .env        # fill Supabase credentials
bun run dev:web             # public site
bun run dev:admin           # admin panel
```

## Build and deploy

```bash
bun run build               # build web + admin
bun run deploy:web
bun run deploy:admin
```

Deployment details (Workers config, secrets, KV bindings): [docs/DEPLOY.md](docs/DEPLOY.md).

## License

[MIT](LICENSE)
