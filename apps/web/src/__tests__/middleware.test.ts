import { describe, it, expect } from 'vitest'
import { onRequest } from '../middleware'
import { isProtectedPath, isLoginPath } from '../lib/admin-paths'

describe('admin middleware path matching', () => {
  it('protects /admin and /admin/* but not /admin/login', () => {
    expect(isProtectedPath('/admin')).toBe(true)
    expect(isProtectedPath('/admin/orders')).toBe(true)
    expect(isProtectedPath('/admin/customers/123')).toBe(true)
    expect(isProtectedPath('/admin/login')).toBe(false)
  })
  it('protects /api/admin/* but not /api/admin/login', () => {
    expect(isProtectedPath('/api/admin/dashboard')).toBe(true)
    expect(isProtectedPath('/api/admin/login')).toBe(false)
  })
  it('does not protect public routes', () => {
    expect(isProtectedPath('/')).toBe(false)
    expect(isProtectedPath('/blog/post-slug')).toBe(false)
    expect(isProtectedPath('/api/order')).toBe(false)
  })
  it('identifies the login page', () => {
    expect(isLoginPath('/admin/login')).toBe(true)
    expect(isLoginPath('/admin')).toBe(false)
  })
})

describe('locale middleware responses', () => {
  it('returns an actual 404 and prevents caching for unsupported routes', async () => {
    const response = await onRequest({
      url: new URL('https://ekalliptus.com/en/blog/example'),
      locals: {},
      rewrite: async () => new Response('not found'),
      redirect: () => { throw new Error('unexpected redirect') },
    } as never, async () => new Response('next'))

    expect(response).toBeInstanceOf(Response)
    if (!response) throw new Error('middleware returned no response')
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('still edge-caches translated noindex pages (noindex is a meta tag, not cacheability)', async () => {
    const response = await onRequest({
      url: new URL('https://ekalliptus.com/en/about'),
      locals: {},
      rewrite: async () => new Response('about', { headers: { 'Content-Type': 'text/html' } }),
      redirect: () => { throw new Error('unexpected redirect') },
    } as never, async () => new Response('next'))

    expect(response).toBeInstanceOf(Response)
    if (!response) throw new Error('middleware returned no response')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=30')
  })
})
