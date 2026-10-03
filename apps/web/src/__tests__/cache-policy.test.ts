import { describe, expect, it } from 'vitest'
import { PAGE_CACHE_CONTROL, isCacheableRequest, sMaxageTtl } from '../lib/cache-policy'

describe('edge cache policy', () => {
  it('parses s-maxage and refuses private/no-store responses', () => {
    expect(sMaxageTtl(PAGE_CACHE_CONTROL)).toBe(60)
    expect(sMaxageTtl('public, max-age=600, s-maxage=300, stale-while-revalidate=600')).toBe(300)
    expect(sMaxageTtl('no-store')).toBe(0)
    expect(sMaxageTtl('private, max-age=60')).toBe(0)
    expect(sMaxageTtl(null)).toBe(0)
    expect(sMaxageTtl('public')).toBe(0)
  })

  it('only caches safe GET traffic outside api/admin', () => {
    expect(isCacheableRequest('GET', '/id/blog')).toBe(true)
    expect(isCacheableRequest('GET', '/en')).toBe(true)
    expect(isCacheableRequest('GET', '/blog/rss.xml')).toBe(true)
    expect(isCacheableRequest('HEAD', '/en')).toBe(false)
    expect(isCacheableRequest('POST', '/api/order')).toBe(false)
    expect(isCacheableRequest('GET', '/api/order')).toBe(false)
    expect(isCacheableRequest('GET', '/admin/blog')).toBe(false)
    expect(isCacheableRequest('DELETE', '/id/blog')).toBe(false)
  })
})
