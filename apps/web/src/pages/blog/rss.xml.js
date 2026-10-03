import { sanitizeArticleHtml } from '../../lib/article-html'
import { fetchPublishedPosts } from '../../lib/supabase'
import { absoluteUrl, blogPath, cdata, escapeXml } from '../../lib/blog'

export const prerender = false
const siteUrl = 'https://ekalliptus.com'

export function generateRss(posts, now = new Date()) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<title>Ekalliptus Digital Blog</title><description>Artikel &amp; insight tentang web development, mobile app, WordPress, dan multimedia editing</description><link>${siteUrl}/id/blog</link>
<atom:link href="${siteUrl}/blog/rss.xml" rel="self" type="application/rss+xml"/><language>id</language><lastBuildDate>${now.toUTCString()}</lastBuildDate>
${posts.slice(0, 20).map(post => {
    const url = absoluteUrl(blogPath(post.slug), siteUrl)
    const image = post.image ? `<img src="${escapeXml(absoluteUrl(post.image, siteUrl))}" alt="${escapeXml(post.image_alt || post.title)}" />` : ''
    const content = `${sanitizeArticleHtml(post.body_html || '') || `<p>${escapeXml(post.description)}</p>`}${image}<p>Baca selengkapnya di: <a href="${escapeXml(url)}">${escapeXml(post.title)}</a></p>`
    return `<item><title>${escapeXml(post.title)}</title><link>${escapeXml(url)}</link><guid isPermaLink="true">${escapeXml(url)}</guid><description>${escapeXml(post.description)}</description><content:encoded>${cdata(content)}</content:encoded><category>${escapeXml(post.category)}</category>${post.tags.map(tag => `<category>${escapeXml(tag)}</category>`).join('')}<pubDate>${new Date(post.publish_date).toUTCString()}</pubDate><author>salam@ekalliptus.com (Ekalliptus Digital)</author></item>`
  }).join('')}
</channel></rss>`
}

export async function GET() {
  const result = await fetchPublishedPosts('id')
  if (result.status === 'error') return new Response('Feed temporarily unavailable', { status: 503 })
  return new Response(generateRss(result.status === 'ok' ? result.data : []), { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=600, s-maxage=300, stale-while-revalidate=600' } })
}
