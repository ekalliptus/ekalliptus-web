export const prerender = false

export function GET() {
  const site = 'https://ekalliptus.com'
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${site}/sitemap-pages.xml</loc></sitemap>\n  <sitemap><loc>${site}/portfolio/sitemap.xml</loc></sitemap>\n  <sitemap><loc>${site}/blog/sitemap.xml</loc></sitemap>\n</sitemapindex>`
  return new Response(body, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } })
}
