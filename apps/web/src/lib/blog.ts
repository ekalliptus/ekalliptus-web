import type { Database } from '../types/database'

export type BlogRow = Database['public']['Tables']['blog_posts']['Row']
export type BlogPost = Omit<BlogRow, 'author' | 'body_html' | 'category' | 'description' | 'publish_date'> & {
  author: string
  body_html: string
  category: string
  description: string
  publish_date: string
}
// Metadata-only queries omit body_html; the mapper tolerates its absence.
export type BlogRowInput = Omit<BlogRow, 'body_html'> & { body_html?: string | null }
export type QueryResult<T> = { status: 'ok'; data: T } | { status: 'not_found' } | { status: 'error'; error: string }

type QueryError = { code?: string; message: string } | null

export function mapBlogPost(row: BlogRowInput): BlogPost {
  return {
    ...row,
    author: row.author ?? '',
    body_html: row.body_html ?? '',
    category: row.category ?? '',
    description: row.description ?? '',
    publish_date: row.publish_date ?? '',
    tags: row.tags ?? [],
  }
}

export function queryResult(row: BlogRow | null, error: QueryError): QueryResult<BlogPost> {
  if (error?.code === 'PGRST116') return { status: 'not_found' }
  if (error) return { status: 'error', error: error.message }
  if (!row) return { status: 'not_found' }
  return { status: 'ok', data: mapBlogPost(row) }
}

export const excludeNoindex = (posts: BlogPost[]) => posts.filter(post => !post.seo_noindex)
export const blogPath = (slug: string) => `/id/blog/${encodeURIComponent(slug)}`
export const tagPath = (tag: string) => `/id/blog/tag/${encodeURIComponent(tag)}`
export const absoluteUrl = (path: string, base = 'https://ekalliptus.com') => new URL(path, base).toString()
export const serviceUnavailable = (message: string) => new Response(message, {
  status: 503,
  headers: { 'Cache-Control': 'no-store', 'Retry-After': '300' },
})

export function dedupeFeatured<T extends BlogPost>(posts: T[]) {
  const featured = posts.find(post => post.featured) ?? null
  return { featured, posts: featured ? posts.filter(post => post.slug !== featured.slug) : posts }
}

export function relatedPosts(current: BlogPost, posts: BlogPost[]) {
  return posts
    .filter(post => post.slug !== current.slug && !post.seo_noindex)
    .map(post => ({ post, score: post.tags.filter(tag => current.tags.includes(tag)).length + Number(post.category === current.category) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ post }) => post)
}

export function escapeXml(value: unknown) {
  return String(value ?? '').replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]!)
}

export const cdata = (value: unknown) => `<![CDATA[${String(value ?? '').replaceAll(']]>', ']]]]><![CDATA[>')}]]>`

export function generateBlogSitemap(posts: BlogPost[], siteUrl = 'https://ekalliptus.com') {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${excludeNoindex(posts).map(post => `\n  <url><loc>${escapeXml(absoluteUrl(blogPath(post.slug), siteUrl))}</loc><lastmod>${escapeXml(new Date(post.update_date || post.publish_date).toISOString())}</lastmod><changefreq>weekly</changefreq><priority>${post.featured ? 0.8 : 0.7}</priority></url>`).join('')}\n</urlset>`
}
