import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'
import * as YAML from 'js-yaml'

type Frontmatter = {
  title?: string
  description?: string
  publishDate?: string
  updateDate?: string
  category?: string
  tags?: string[]
  author?: string
  image?: string
  imageAlt?: string
  locale?: string
  featured?: boolean
  seo?: {
    metaTitle?: string
    metaDescription?: string
    noindex?: boolean
  }
}

// Small helper to slugify heading text for id attributes
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

(async () => {
  // 0) Resolve repo root and essential paths
  const repoRoot = process.cwd()
  const postsDir = path.resolve(repoRoot, 'src', 'content', 'blog')
  const contentConfigPath = path.resolve(repoRoot, 'src', 'content.config.ts')
  const envPath = path.resolve(repoRoot, '.env')

  // 1) Load environment variables from .env (SUPABASE credentials)
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) {
        const key = m[1]
        let val = m[2].trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (!(process.env as any)[key]) {
          ;(process.env as any)[key] = val
        }
      }
    }
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials. Please set VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY or SUPABASE_URL/SUPABASE_ANON_KEY in .env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)

  // 2) Read content.config.ts to understand schema (read-only for now)
  try {
    if (existsSync(contentConfigPath)) {
      const cfg = readFileSync(contentConfigPath, 'utf8')
      // Intentionally not parsing deeply to keep migration lean. We rely on the frontmatter schema.
      void cfg
    }
  } catch (_) {
    // ignore
  }

  // 3) Prepare file list, auto-detect all .md files
  const { readdirSync } = await import('fs')
  const safeFilenameRe = /^[a-z0-9-]+\.md$/i
  const files = readdirSync(postsDir).filter((f: string) => safeFilenameRe.test(f))

  // 4) Markdown -> HTML conversion and mapping frontmatter -> insert payload
  const results: { slug: string; ok: boolean; error?: string }[] = []
  let migrated = 0
  let errors = 0

  for (const fname of files) {
    try {
      const sanitizedName = path.basename(fname)
      if (!safeFilenameRe.test(sanitizedName)) continue
      const mdPath = path.resolve(postsDir, sanitizedName)
      if (!mdPath.startsWith(postsDir + path.sep)) continue
      const raw = readFileSync(mdPath, 'utf8')
      let front: Frontmatter = {}
      let body = ''
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m)
      if (fmMatch) {
        const fmYaml = fmMatch[1]
        body = fmMatch[2] ?? ''
        const parsed = YAML.load(fmYaml) as Frontmatter
        if (parsed) front = parsed
      } else {
        body = raw
      }

      // Derive slug and title
      const slug = path.basename(mdPath, '.md')
      const title = front.title ?? slug
      const description = front.description ?? ''
      const publishDate = front.publishDate
      const publish_iso = publishDate ? new Date(publishDate).toISOString() : undefined
      const updateDate = front.updateDate
      const update_iso = updateDate ? new Date(updateDate).toISOString() : undefined
      const locale = front.locale ?? 'id'
      const featured = !!front.featured
      const seo = front.seo ?? undefined
      const seo_meta_title = seo?.metaTitle ?? ''
      const seo_meta_description = seo?.metaDescription ?? ''
      const seo_noindex = seo?.noindex ?? false
      const category = front.category ?? ''
      const tags = Array.isArray(front.tags) ? front.tags : (front.tags ? [front.tags] : [])
      const image = front.image ?? ''
      const image_alt = front.imageAlt ?? ''
      const bodyHtmlRaw = body
      const bodyHtml = bodyHtmlRaw
        ? await marked.parse(bodyHtmlRaw, { gfm: true, async: false })
        : ''
      // Add ids to h2/h3 for TOC support
      const bodyHtmlWithIds = bodyHtml.replace(/<h([23])>([^<]+)<\/h\1>/g, (_match: string, lvl: string, inner: string) => {
        const text = inner.replace(/<[^>]+>/g, '')
        const id = slugify(text)
        return `<h${lvl} id="${id}">${inner}</h${lvl}>`
      })

      const insertObj: any = {
        slug,
        locale,
        title,
        description,
        body_html: bodyHtmlWithIds,
        publish_date: publish_iso,
        update_date: update_iso,
        category,
        tags,
        author: front.author ?? 'Tim Ekalliptus',
        image,
        image_alt,
        featured,
        seo_meta_title,
        seo_meta_description,
        seo_noindex,
        status: 'published',
      }

      // Remove undefined fields
      Object.keys(insertObj).forEach((k) => {
        if (insertObj[k] === undefined) delete insertObj[k]
      })

      const { error } = await supabase.from('blog_posts').upsert([insertObj], { onConflict: 'slug,locale' })
      if (error) {
        errors++
        results.push({ slug, ok: false, error: error.message })
        console.error(`Error migrating ${slug}: ${error.message}`)
      } else {
        migrated++
        results.push({ slug, ok: true })
        console.log(`Migrated: ${slug}`)
      }
    } catch (err: any) {
      errors++
      const slug = fname.replace(/\.md$/, '')
      results.push({ slug, ok: false, error: String(err?.message ?? err) })
      console.error(`Unhandled error migrating ${slug}:`, err)
    }
  }

  console.log(`
Migration summary: ${migrated} migrated, ${errors} errors.
`)
  process.exit(errors > 0 ? 1 : 0)
})()
