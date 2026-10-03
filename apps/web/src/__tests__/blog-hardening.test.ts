import { describe, expect, it } from 'vitest'
import type { BlogRow } from '../lib/blog'
import { initCategoryFilter } from '../lib/blog-category-filter'
import {
  blogPath,
  cdata,
  dedupeFeatured,
  escapeXml,
  excludeNoindex,
  generateBlogSitemap,
  mapBlogPost,
  queryResult,
  relatedPosts,
  serviceUnavailable,
} from '../lib/blog'

const row = (overrides: Partial<BlogRow> = {}): BlogRow => ({
  id: 'database-id', slug: 'hello world/ไทย', locale: 'id', title: 'A & B', description: 'x', body_html: '<p>x</p>',
  publish_date: '2026-01-01T00:00:00Z', update_date: null, category: 'Web', tags: ['SEO'], author: 'Ekalliptus',
  image: null, image_alt: null, featured: false, seo_meta_title: null, seo_meta_description: null, seo_noindex: false,
  status: 'published', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...overrides,
})
const post = (overrides: Partial<BlogRow> = {}) => mapBlogPost(row(overrides))

describe('blog category interaction', () => {
  it('keeps selection accessible, synchronous, and surfaces empty state', () => {
    document.body.innerHTML = '<button class="category-btn" data-category="all" aria-pressed="true"></button><button class="category-btn" data-category="Web" aria-pressed="false"></button><button class="category-btn" data-category="Kosong" aria-pressed="false"></button><article class="blog-card" data-category="Web"></article><article class="blog-card" data-category="App"></article><div class="ad-in-feed"></div><div id="blog-empty-state" hidden></div>'
    initCategoryFilter(document)
    const buttons = document.querySelectorAll<HTMLButtonElement>('.category-btn')
    const cards = document.querySelectorAll<HTMLElement>('article')
    const empty = document.getElementById('blog-empty-state')!
    buttons[1].click()
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true')
    expect(cards[0].hidden).toBe(false)
    expect(cards[1].hidden).toBe(true)
    expect(empty.hidden).toBe(true)
    buttons[2].click()
    expect([...cards].every(card => card.hidden)).toBe(true)
    expect(empty.hidden).toBe(false)
    buttons[0].click()
    expect([...cards].every(card => !card.hidden)).toBe(true)
    expect(empty.hidden).toBe(true)
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelector<HTMLElement>('.ad-in-feed')!.hidden).toBe(false)
    document.body.innerHTML = ''
  })
})

describe('blog query semantics', () => {
  it('distinguishes success, absence, and failures', () => {
    expect(queryResult(row(), null)).toMatchObject({ status: 'ok' })
    expect(queryResult(null, { code: 'PGRST116', message: 'none' })).toEqual({ status: 'not_found' })
    expect(queryResult(null, { code: '500', message: 'down' })).toEqual({ status: 'error', error: 'down' })
  })

  it('returns retryable non-cacheable 503 responses', () => {
    const response = serviceUnavailable('Feed temporarily unavailable')
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('300')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('maps nullable database rows to the public shape', () => {
    expect(mapBlogPost(row({ author: null, body_html: null, category: null, description: null, publish_date: null }))).toMatchObject({
      id: 'database-id', author: '', body_html: '', category: '', description: '', publish_date: '', tags: ['SEO'],
    })
  })
})

describe('crawl helpers', () => {
  it('encodes path segments without encoding slashes', () => {
    expect(blogPath(post().slug)).toBe('/id/blog/hello%20world%2F%E0%B9%84%E0%B8%97%E0%B8%A2')
  })

  it('excludes noindex and deduplicates featured posts', () => {
    const featured = post({ slug: 'featured', featured: true })
    const normal = post({ slug: 'normal' })
    expect(excludeNoindex([featured, post({ slug: 'hidden', seo_noindex: true })])).toEqual([featured])
    expect(dedupeFeatured([featured, normal])).toEqual({ featured, posts: [normal] })
  })

  it('caps related posts at three and excludes the current post', () => {
    const current = post({ slug: 'current', tags: ['SEO'] })
    const posts = ['current', 'a', 'b', 'c', 'd'].map(slug => post({ slug, tags: ['SEO'] }))
    expect(relatedPosts(current, posts).map(post => post.slug)).toEqual(['a', 'b', 'c'])
  })

  it('builds a dynamic-only sitemap without the blog index or noindex posts', () => {
    const xml = generateBlogSitemap([post(), post({ slug: 'hidden', seo_noindex: true })])
    expect(xml).toContain('/blog/hello%20world%2F%E0%B9%84%E0%B8%97%E0%B8%A2')
    expect(xml).not.toContain('<loc>https://ekalliptus.com/blog</loc>')
    expect(xml).not.toContain('/hidden')
  })

  it('escapes XML and safely splits CDATA terminators', () => {
    expect(escapeXml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&apos;')
    expect(cdata('a]]>b')).toBe('<![CDATA[a]]]]><![CDATA[>b]]>')
  })
})
