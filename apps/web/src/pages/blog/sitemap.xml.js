import { fetchPublishedPostSummaries } from '../../lib/supabase'
import { generateBlogSitemap } from '../../lib/blog'

export const prerender = false

export async function GET() {
  const result = await fetchPublishedPostSummaries('id')
  if (result.status === 'error') return new Response('Sitemap temporarily unavailable', { status: 503 })
  const posts = result.status === 'ok' ? result.data : []
  return new Response(generateBlogSitemap(posts), {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
  })
}
