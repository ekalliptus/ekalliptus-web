import { defineMiddleware } from 'astro:middleware'
import { env as cfEnv } from 'cloudflare:workers'
import { captureRuntimeEnv } from './lib/runtime-env'
import { routePolicy } from './lib/locale-routing'
import { apiJson } from './lib/public-api'
import { PAGE_CACHE_CONTROL, sMaxageTtl, isCacheableRequest } from './lib/cache-policy'

// Full policy mirrored from public/_headers (which only covers static assets;
// all pages are SSR). Script-src additionally allows the AdSense origins the
// site loads (pagead2/tpc.googlesyndication.com) and frame-src the ad iframes,
// which the static _headers policy never had to cover.
const HTML_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com; worker-src 'self' blob:; frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.googlesyndication.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
const MINIMAL_CSP = "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

type RateLimitBinding = { limit(input: { key: string }): Promise<{ success: boolean }> }
type EdgeCache = { match(key: Request): Promise<Response | undefined>; put(key: Request, response: Response): Promise<void> }
const edgeCache = (globalThis as { caches?: { default?: EdgeCache } }).caches?.default

export const onRequest = defineMiddleware(async (ctx, next) => {
  const limited = await enforceDistributedLimit(ctx)
  if (limited) return limited

  const hit = await cacheGet(ctx)
  if (hit) return hit

  const response = await handleRequest(ctx, next) ?? await next()
  const secured = new Response(response.body, response)
  secured.headers.set('X-Content-Type-Options', 'nosniff')
  secured.headers.set('X-Frame-Options', 'DENY')
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  secured.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  const isHtml = (secured.headers.get('Content-Type') ?? '').toLowerCase().includes('text/html')
  secured.headers.set('Content-Security-Policy', isHtml ? HTML_CSP : MINIMAL_CSP)
  if (isHtml) {
    secured.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    secured.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  }
  if (ctx.url.pathname.startsWith('/api/')) secured.headers.set('Cache-Control', 'no-store')

  await cacheStore(ctx, secured)
  if (!secured.headers.has('X-Cache') && sMaxageTtl(secured.headers.get('Cache-Control')) > 0) {
    secured.headers.set('X-Cache', 'MISS')
  }
  return secured
})

// Coarse distributed limit for all public API writes: one binding counter per
// IP per Cloudflare location (60/min). Fine-grained per-endpoint buckets stay
// in src/lib/public-api.ts and run regardless.
async function enforceDistributedLimit(ctx: { request?: Request; url: URL }): Promise<Response | null> {
  if (ctx.request?.method !== 'POST' || !ctx.url.pathname.startsWith('/api/')) return null
  let limiter: RateLimitBinding | undefined
  try {
    limiter = (cfEnv as { RATE_LIMITER?: RateLimitBinding }).RATE_LIMITER
  } catch {
    return null
  }
  if (!limiter) return null
  try {
    const ip = ctx.request.headers.get('cf-connecting-ip') || 'unknown'
    const { success } = await limiter.limit({ key: ip })
    if (!success) return apiJson({ error: 'Too many requests' }, 429)
  } catch {
    // Binding unavailable (e.g. local dev without the binding):
    // per-isolate limits in public-api.ts still apply.
  }
  return null
}

// Content never varies by query string (tracking params aside), so the cache
// key is origin+pathname only — otherwise UTMs would fragment the cache.
function cacheKey(ctx: { url: URL }): Request {
  return new Request(ctx.url.origin + ctx.url.pathname, { method: 'GET' })
}

async function cacheGet(ctx: { request?: Request; url: URL }): Promise<Response | null> {
  if (!ctx.request || !edgeCache || !isCacheableRequest(ctx.request.method, ctx.url.pathname)) return null
  try {
    const hit = await edgeCache.match(cacheKey(ctx))
    if (!hit) return null
    const replay = new Response(hit.body, hit)
    replay.headers.set('X-Cache', 'HIT')
    return replay
  } catch {
    return null
  }
}

async function cacheStore(ctx: { request?: Request; url: URL }, response: Response): Promise<void> {
  const ttl = sMaxageTtl(response.headers.get('Cache-Control'))
  if (!edgeCache || !ctx.request || ttl <= 0 || response.status !== 200) return
  if (!isCacheableRequest(ctx.request.method, ctx.url.pathname)) return
  try {
    await edgeCache.put(cacheKey(ctx), response.clone())
  } catch {
    // Edge cache unavailable: response is still served fresh.
  }
}

const handleRequest = defineMiddleware(async (ctx, next) => {
  // Capture Cloudflare runtime env on EVERY request.
  // Public routes (webhook, order, etc.) need access to Supabase secrets.
  // Wrap in try/catch, Cloudflare bindings can be Proxies that throw on access.
  try {
    captureRuntimeEnv(cfEnv as unknown as Record<string, unknown>)
  } catch (err) {
    console.warn('[middleware] Failed to read runtime env:', err)
  }

  if (ctx.locals.localeRewrite) return next()

  const policy = routePolicy(ctx.url.pathname)
  if (policy.action === 'bypass') return next()
  if (policy.action === 'redirect') return ctx.redirect(`${policy.location}${ctx.url.search}`, 302)

  ctx.locals.locale = policy.locale
  ctx.locals.publicPathname = policy.publicPathname
  ctx.locals.indexable = policy.indexable
  ctx.locals.localeRewrite = true

  if (policy.action === 'not-found') {
    const response = await ctx.rewrite('/404')
    response.headers.set('Cache-Control', 'no-store')
    return new Response(response.body, { status: 404, headers: response.headers })
  }

  const response = await ctx.rewrite(`${policy.renderPathname}${ctx.url.search}`)
  const isHtml = (response.headers.get('Content-Type') ?? '').toLowerCase().includes('text/html')
  // Non-indexable locale pages still get edge-cached: their noindex is a
  // per-URL meta tag, and their content is stable per URL. Only 404s (status)
  // and /api/* (set above) stay uncacheable.
  if (isHtml && !response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', PAGE_CACHE_CONTROL)
  }
  return response
})
