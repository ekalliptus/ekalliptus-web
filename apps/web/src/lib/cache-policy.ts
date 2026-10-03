export const PAGE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30'

export function sMaxageTtl(cacheControl: string | null): number {
  if (!cacheControl || cacheControl.includes('no-store') || cacheControl.includes('private')) return 0
  const m = cacheControl.match(/s-maxage=(\d+)/)
  return m ? Number(m[1]) : 0
}

export function isCacheableRequest(method: string, pathname: string): boolean {
  if (method !== 'GET') return false
  return !pathname.startsWith('/api/') && !pathname.startsWith('/admin/')
}
