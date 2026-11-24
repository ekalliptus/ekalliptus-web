import { fetchPublicPortfolio } from '../../lib/portfolio'
import { escapeXml } from '../../lib/blog'

export const prerender = false

export async function GET() {
  const site = 'https://ekalliptus.com'
  const urls = [`${site}/id/portfolio`]
  const res = await fetchPublicPortfolio({ limit: 50 })
  if (res.status === 'ok') {
    for (const item of res.items) {
      urls.push(`${site}/id/portfolio/${encodeURIComponent(item.slug)}`)
    }
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
    .map((u) => `\n  <url><loc>${escapeXml(u)}</loc></url>`)
    .join('')}\n</urlset>`
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
