import { fetchPublishedPostSummaries } from '../../lib/supabase'
import { absoluteUrl, blogPath } from '../../lib/blog'

export const prerender = false

export async function GET(context) {
  const siteUrl = 'https://ekalliptus.com'

  // Fetch published posts from Supabase and map to JSON Feed format
  // (metadata only, the JSON feed renders descriptions rather than HTML).
  const result = await fetchPublishedPostSummaries('id')
  if (result.status === 'error') return new Response('Feed temporarily unavailable', { status: 503 })
  const posts = result.status === 'ok' ? result.data : []

  const feedPosts = posts
    .sort((a, b) => new Date(b.publish_date).valueOf() - new Date(a.publish_date).valueOf())
    .slice(0, 20)
    .map(post => ({
      id: absoluteUrl(blogPath(post.slug), siteUrl),
      url: absoluteUrl(blogPath(post.slug), siteUrl),
      title: post.title,
      content_text: post.description,
      summary: post.description,
      image: post.image ? absoluteUrl(post.image, siteUrl) : undefined,
      date_published: new Date(post.publish_date).toISOString(),
      date_modified: post.update_date ? new Date(post.update_date).toISOString() : new Date(post.publish_date).toISOString(),
      authors: [{ name: 'Ekalliptus Digital', url: `${siteUrl}/id/about` }],
      tags: [post.category, ...(post.tags || [])],
      language: post.locale,
    }))

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Ekalliptus Digital Blog',
    description: 'Artikel & insight tentang web development, mobile app, WordPress, dan multimedia editing',
    home_page_url: `${siteUrl}/id/blog`,
    feed_url: `${siteUrl}/blog/feed.json`,
    icon: `${siteUrl}/ekalliptus_rounded.webp`,
    authors: [
      {
        name: 'Ekalliptus Digital',
        url: siteUrl,
        avatar: `${siteUrl}/ekalliptus_rounded.webp`,
      },
    ],
    language: 'id',
    items: feedPosts,
  }

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      'Content-Type': 'application/feed+json',
      'Cache-Control': 'public, max-age=600, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
