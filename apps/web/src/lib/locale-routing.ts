export const locales = ['id', 'en', 'ja', 'ko', 'ru', 'ar', 'tr'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'id'

const localeSet = new Set<string>(locales)
const translatedRoutes = new Set([
  '/', '/about', '/order', '/portfolio', '/editorial-policy', '/privacy-policy', '/terms-of-service',
  '/services/website', '/services/mobile-app', '/services/maintenance',
])
const bypassExact = new Set(['/robots.txt', '/sitemap.xml', '/sitemap-index.xml', '/sitemap-pages.xml', '/portfolio/sitemap.xml', '/blog/rss.xml', '/blog/feed.json', '/blog/sitemap.xml'])
const assetExtension = /\.[a-z0-9]{2,8}$/i

export function isPortfolioDetailPath(pathname: string): boolean {
  return /^\/portfolio\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i.test(pathname)
}

export const indexablePages = [...translatedRoutes, '/blog'].map(path => localizedPath(path, 'id'))

function splitSuffix(path: string) {
  const index = path.search(/[?#]/)
  return index < 0 ? [path, ''] : [path.slice(0, index), path.slice(index)]
}

export function stripLocale(path: string): { locale: Locale | null; pathname: string } {
  const [pathname] = splitSuffix(path)
  const match = pathname.match(/^\/([^/]+)(\/.*)?$/)
  if (!match || !localeSet.has(match[1])) return { locale: null, pathname: pathname || '/' }
  return { locale: match[1] as Locale, pathname: match[2] || '/' }
}

export function localizedPath(path: string, locale: Locale): string {
  const [pathname, suffix] = splitSuffix(path)
  const stripped = stripLocale(pathname).pathname
  return `/${locale}${stripped === '/' ? '' : stripped}${suffix}`
}

export type RoutePolicy = {
  action: 'bypass' | 'redirect' | 'rewrite' | 'not-found'
  status: 200 | 302 | 404
  locale?: Locale
  renderPathname?: string
  publicPathname?: string
  location?: string
  indexable: boolean
}

export function routePolicy(pathname: string): RoutePolicy {
  if (pathname.startsWith('/api/') || pathname === '/api' || pathname.startsWith('/_') || bypassExact.has(pathname) || assetExtension.test(pathname)) {
    return { action: 'bypass', status: 200, indexable: false }
  }

  const stripped = stripLocale(pathname)
  if (!stripped.locale) return { action: 'redirect', status: 302, location: localizedPath(pathname, defaultLocale), indexable: false }
  if (stripped.locale !== 'id' && (stripped.pathname === '/blog' || stripped.pathname.startsWith('/blog/'))) {
    return { action: 'not-found', status: 404, locale: stripped.locale, publicPathname: pathname, indexable: false }
  }
  if (stripped.locale !== 'id' && !translatedRoutes.has(stripped.pathname) && !isPortfolioDetailPath(stripped.pathname)) {
    return { action: 'not-found', status: 404, locale: stripped.locale, publicPathname: pathname, indexable: false }
  }
  return {
    action: 'rewrite', status: 200, locale: stripped.locale,
    renderPathname: stripped.pathname, publicPathname: pathname,
    indexable: stripped.locale === 'id',
  }
}

export function canonicalUrl(publicPathname: string, site = 'https://ekalliptus.com') {
  return new URL(splitSuffix(publicPathname)[0], site).toString()
}

export function alternateLinks(_publicPathname: string): Array<{ locale: Locale | 'x-default'; href: string }> {
  return []
}
