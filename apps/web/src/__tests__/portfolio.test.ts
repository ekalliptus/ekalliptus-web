// @vitest-environment node
import { describe, expect, it } from 'vitest'
import idLocale from '../i18n/locales/id.json'
import enLocale from '../i18n/locales/en.json'
import jaLocale from '../i18n/locales/ja.json'
import koLocale from '../i18n/locales/ko.json'
import ruLocale from '../i18n/locales/ru.json'
import arLocale from '../i18n/locales/ar.json'
import trLocale from '../i18n/locales/tr.json'
import { routePolicy } from '../lib/locale-routing'
import {
  fetchPublicPortfolio,
  fetchPublicPortfolioBySlug,
  sanitizeHttpsUrl,
} from '../lib/portfolio'
import {
  buildPortfolioWaMessage,
  buildPortfolioWaUrl,
  formatPortfolioPrice,
} from '../lib/portfolio-wa'

function collectStrings(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj]
  if (Array.isArray(obj)) return obj.flatMap(collectStrings)
  if (obj && typeof obj === 'object') {
    return Object.values(obj).flatMap(collectStrings)
  }
  return []
}

describe('Portfolio WhatsApp & Price helpers', () => {
  it('formats fixed, starting_from, and negotiable prices accurately', () => {
    expect(formatPortfolioPrice({ price_type: 'fixed', price_amount: '3500000' }, 'id')).toContain(
      '3.500.000',
    )
    expect(
      formatPortfolioPrice({ price_type: 'starting_from', price_amount: '2500000' }, 'id'),
    ).toMatch(/^Mulai Rp.*2\.500\.000$/)
    expect(
      formatPortfolioPrice({ price_type: 'starting_from', price_amount: '2500000' }, 'en'),
    ).toMatch(/^From Rp.*2\.500\.000$/)
    expect(formatPortfolioPrice({ price_type: 'negotiable', price_amount: null }, 'id')).toBe(
      'Diskusi Harga',
    )
  })

  it('builds encoded WhatsApp URL with title, slug, intent, price, and zero em dashes', () => {
    const msg = buildPortfolioWaMessage({
      title: 'Web Toko Ekalliptus',
      slug: 'web-toko-ekalliptus',
      priceLabel: 'Rp 3.500.000',
      intent: 'buy_ready',
      pageUrl: 'https://ekalliptus.com/id/portfolio/web-toko-ekalliptus',
      locale: 'id',
    })
    expect(msg).toContain('Web Toko Ekalliptus')
    expect(msg).toContain('web-toko-ekalliptus')
    expect(msg).toContain('Rp 3.500.000')
    expect(msg).not.toContain('\u2014')

    const customUrl = buildPortfolioWaUrl({
      title: 'ERP Gudang',
      slug: 'erp-gudang',
      priceLabel: 'Mulai Rp 5.000.000',
      intent: 'custom_similar',
      locale: 'id',
    })
    expect(customUrl).toMatch(/^https:\/\/wa\.me\/6281999900306\?text=/)
    expect(decodeURIComponent(customUrl.split('?text=')[1] ?? '')).toContain('Pesan Versi Custom Serupa')
  })
})

describe('Portfolio URL sanitizer & route policy', () => {
  it('rejects javascript:, data:, and external plain http URLs', () => {
    expect(sanitizeHttpsUrl('https://demo.ekalliptus.com')).toBe('https://demo.ekalliptus.com/')
    expect(sanitizeHttpsUrl('http://localhost:4321/preview')).toBe('http://localhost:4321/preview')
    expect(sanitizeHttpsUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeHttpsUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(sanitizeHttpsUrl('http://evil.example.com')).toBeNull()
  })

  it('routes portfolio catalog, detail pages, and sitemap cleanly across locales', () => {
    expect(routePolicy('/portfolio')).toMatchObject({ status: 302, location: '/id/portfolio' })
    expect(routePolicy('/id/portfolio')).toMatchObject({
      status: 200,
      locale: 'id',
      renderPathname: '/portfolio',
      indexable: true,
    })
    expect(routePolicy('/en/portfolio')).toMatchObject({
      status: 200,
      locale: 'en',
      renderPathname: '/portfolio',
      indexable: false,
    })
    expect(routePolicy('/ja/portfolio/web-toko')).toMatchObject({
      status: 200,
      locale: 'ja',
      renderPathname: '/portfolio/web-toko',
      indexable: false,
    })
    expect(routePolicy('/portfolio/sitemap.xml')).toMatchObject({ action: 'bypass', status: 200 })
    expect(routePolicy('/en/blog')).toMatchObject({ status: 404 })
  })
})

describe('Portfolio i18n coverage (7 locales)', () => {
  it('defines nav.portfolio and avoids em dashes in every locale portfolio section', () => {
    const allLocales = [idLocale, enLocale, jaLocale, koLocale, ruLocale, arLocale, trLocale]
    for (const loc of allLocales) {
      expect(typeof loc.nav.portfolio).toBe('string')
      expect(loc.nav.portfolio.length).toBeGreaterThan(0)
      for (const text of collectStrings(loc.portfolio)) {
        expect(text).not.toContain('\u2014')
      }
    }
  })
})

describe('Public portfolio sync fetch client', () => {
  it('returns sanitized items on HTTP 200 and handles empty, 404, and 500 states', async () => {
    const okRes = await fetchPublicPortfolio({
      baseUrl: 'https://api.example.test',
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                id: '00000000-0000-0000-0000-000000000001',
                slug: 'erp-mini',
                title: 'ERP Mini',
                tagline: 'Sistem ringkas',
                summary: 'Deskripsi',
                category: 'erp_system',
                offer_type: 'hybrid',
                availability_status: 'available',
                price_type: 'fixed',
                price_amount: '4000000',
                demo_url: 'javascript:alert(1)',
                cover_image_url: 'https://cdn.ekalliptus.com/cover.webp',
                gallery_image_urls: ['https://cdn.ekalliptus.com/1.webp', 'data:text/plain,bad'],
                tech_stack: ['React'],
                highlights: ['POS'],
                is_featured: true,
              },
            ],
          }),
          { status: 200 },
        )) as unknown as typeof fetch,
    })
    expect(okRes.status).toBe('ok')
    if (okRes.status === 'ok') {
      expect(okRes.items).toHaveLength(1)
      expect(okRes.items[0].demo_url).toBeNull()
      expect(okRes.items[0].gallery_image_urls).toEqual(['https://cdn.ekalliptus.com/1.webp'])
    }

    const emptyRes = await fetchPublicPortfolio({
      baseUrl: 'https://api.example.test',
      fetchImpl: (async () => new Response(JSON.stringify({ items: [] }), { status: 200 })) as unknown as typeof fetch,
    })
    expect(emptyRes).toEqual({ status: 'ok', items: [] })

    const errRes = await fetchPublicPortfolio({
      baseUrl: 'https://api.example.test',
      fetchImpl: (async () => new Response('Server error', { status: 500 })) as unknown as typeof fetch,
    })
    expect(errRes.status).toBe('error')

    const notFoundDetail = await fetchPublicPortfolioBySlug('tidak-ada', {
      baseUrl: 'https://api.example.test',
      fetchImpl: (async () => new Response('Not found', { status: 404 })) as unknown as typeof fetch,
    })
    expect(notFoundDetail).toEqual({ status: 'not_found' })

    const netErrDetail = await fetchPublicPortfolioBySlug('erp-mini', {
      baseUrl: 'https://api.example.test',
      fetchImpl: (async () => {
        throw new Error('network down')
      }) as unknown as typeof fetch,
    })
    expect(netErrDetail.status).toBe('error')
  })
})
