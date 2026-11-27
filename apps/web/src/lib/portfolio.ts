import { readEnv } from './runtime-env'

export const DEFAULT_ERP_API_BASE_URL =
  'https://br-odd-frog-aoghf6vq-erpapi.compute.c-2.ap-southeast-1.aws.neon.tech'

export type PortfolioCategory =
  | 'website'
  | 'mobile_app'
  | 'web_mobile'
  | 'desktop'
  | 'desktop_mobile'
  | 'erp_system'
  | 'ui_ux'
  | 'automation'
  | 'other'

export type PortfolioOfferType = 'ready_to_buy' | 'custom_similar' | 'hybrid'
export type PortfolioAvailabilityStatus = 'available' | 'custom_only' | 'sold'
export type PortfolioPriceType = 'fixed' | 'starting_from' | 'negotiable'

export interface PublicPortfolioProject {
  id: string
  slug: string
  title: string
  tagline: string
  summary: string
  category: PortfolioCategory
  offer_type: PortfolioOfferType
  availability_status: PortfolioAvailabilityStatus
  price_type: PortfolioPriceType
  price_amount: string | null
  original_price_amount: string | null
  currency: string
  client_name: string | null
  delivery_estimate: string | null
  demo_url: string | null
  cover_image_url: string | null
  gallery_image_urls: string[]
  tech_stack: string[]
  highlights: string[]
  whatsapp_prefill: string | null
  is_featured: boolean
  sort_order: number
  published_at: string | null
  updated_at: string
}

export type PortfolioListResult =
  | { status: 'ok'; items: PublicPortfolioProject[] }
  | { status: 'error'; message: string }

export type PortfolioDetailResult =
  | { status: 'ok'; item: PublicPortfolioProject }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

export function sanitizeHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:' && parsed.hostname.length > 0) {
      return parsed.toString()
    }
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}

export function resolvePortfolioApiBaseUrl(override?: string): string {
  const raw =
    override ||
    readEnv('ERP_API_BASE_URL') ||
    readEnv('PUBLIC_ERP_API_BASE_URL') ||
    DEFAULT_ERP_API_BASE_URL
  return raw.replace(/\/+$/, '')
}

function normalizePortfolioItem(raw: unknown): PublicPortfolioProject | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.slug !== 'string' || typeof row.title !== 'string') {
    return null
  }

  const gallery = Array.isArray(row.gallery_image_urls)
    ? row.gallery_image_urls
        .map((u) => sanitizeHttpsUrl(typeof u === 'string' ? u : null))
        .filter((u): u is string => Boolean(u))
    : []

  const techStack = Array.isArray(row.tech_stack)
    ? row.tech_stack.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : []

  const highlights = Array.isArray(row.highlights)
    ? row.highlights.filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    : []

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: typeof row.tagline === 'string' ? row.tagline : '',
    summary: typeof row.summary === 'string' ? row.summary : '',
    category: (typeof row.category === 'string' ? row.category : 'website') as PortfolioCategory,
    offer_type: (typeof row.offer_type === 'string' ? row.offer_type : 'hybrid') as PortfolioOfferType,
    availability_status: (typeof row.availability_status === 'string'
      ? row.availability_status
      : 'available') as PortfolioAvailabilityStatus,
    price_type: (typeof row.price_type === 'string' ? row.price_type : 'fixed') as PortfolioPriceType,
    price_amount: typeof row.price_amount === 'string' ? row.price_amount : null,
    original_price_amount:
      typeof row.original_price_amount === 'string' ? row.original_price_amount : null,
    currency: typeof row.currency === 'string' ? row.currency : 'IDR',
    client_name: typeof row.client_name === 'string' ? row.client_name : null,
    delivery_estimate: typeof row.delivery_estimate === 'string' ? row.delivery_estimate : null,
    demo_url: sanitizeHttpsUrl(typeof row.demo_url === 'string' ? row.demo_url : null),
    cover_image_url: sanitizeHttpsUrl(
      typeof row.cover_image_url === 'string' ? row.cover_image_url : null,
    ),
    gallery_image_urls: gallery,
    tech_stack: techStack,
    highlights,
    whatsapp_prefill: typeof row.whatsapp_prefill === 'string' ? row.whatsapp_prefill : null,
    is_featured: Boolean(row.is_featured),
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
    published_at: typeof row.published_at === 'string' ? row.published_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  }
}

async function fetchWithTimeout(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs = 4500,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchPublicPortfolio(options?: {
  category?: string
  featured?: boolean
  limit?: number
  fetchImpl?: typeof fetch
  baseUrl?: string
}): Promise<PortfolioListResult> {
  const baseUrl = resolvePortfolioApiBaseUrl(options?.baseUrl)
  const params = new URLSearchParams()
  if (options?.category && options.category !== 'all') params.set('category', options.category)
  if (options?.featured) params.set('featured', 'true')
  if (options?.limit) params.set('limit', String(options.limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  const fetchImpl = options?.fetchImpl ?? fetch

  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/public/portfolio${qs}`, fetchImpl)
    if (!res.ok) {
      return { status: 'error', message: `Layanan katalog merespons HTTP ${res.status}.` }
    }
    const payload = (await res.json()) as { items?: unknown[] }
    const rawList = Array.isArray(payload?.items) ? payload.items : []
    const items = rawList
      .map(normalizePortfolioItem)
      .filter((item): item is PublicPortfolioProject => Boolean(item))
    return { status: 'ok', items }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Gagal menghubungi layanan katalog portofolio.',
    }
  }
}

export async function fetchPublicPortfolioBySlug(
  slug: string,
  options?: {
    fetchImpl?: typeof fetch
    baseUrl?: string
  },
): Promise<PortfolioDetailResult> {
  const cleanSlug = slug.trim().toLowerCase()
  if (!cleanSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
    return { status: 'not_found' }
  }
  const baseUrl = resolvePortfolioApiBaseUrl(options?.baseUrl)
  const fetchImpl = options?.fetchImpl ?? fetch

  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/public/portfolio/${encodeURIComponent(cleanSlug)}`,
      fetchImpl,
    )
    if (res.status === 404) {
      return { status: 'not_found' }
    }
    if (!res.ok) {
      return { status: 'error', message: `Layanan katalog merespons HTTP ${res.status}.` }
    }
    const payload = (await res.json()) as { item?: unknown }
    const normalized = normalizePortfolioItem(payload?.item)
    if (!normalized) return { status: 'not_found' }
    return { status: 'ok', item: normalized }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Gagal memuat detail project portofolio.',
    }
  }
}
