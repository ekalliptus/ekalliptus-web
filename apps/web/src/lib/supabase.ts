import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, Order, OrderInsert, OrderAttachment, OrderAttachmentInsert, ServiceType, OrderStatus } from '../types/database'
import { readSupabaseEnv } from './runtime-env'
import { excludeNoindex, mapBlogPost, queryResult, type BlogPost, type QueryResult } from './blog'

let supabaseClient: SupabaseClient<Database> | null = null
let supabaseAdminClient: SupabaseClient<Database> | null = null

export function getSupabase(useServiceRole = false): SupabaseClient<Database> | null {
  const { url: supabaseUrl, anonKey: supabaseAnonKey, serviceRoleKey: supabaseServiceRoleKey } = readSupabaseEnv()

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured')
    return null
  }

  if (useServiceRole) {
    if (!supabaseServiceRoleKey) {
      console.warn('Supabase service role key not configured')
      return null
    }

    if (!supabaseAdminClient) {
      supabaseAdminClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    }

    return supabaseAdminClient
  }

  if (!supabaseClient) {
    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  }

  return supabaseClient
}

export type { Order, OrderInsert, OrderAttachment, OrderAttachmentInsert, ServiceType, OrderStatus }

export async function createOrder(orderData: OrderInsert, attachments?: OrderAttachmentInsert[]): Promise<{ data: Order | null; error: Error | null }> {
  const supabase = getSupabase()
  
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single()

    if (orderError) {
      console.error('Supabase insert error:', orderError)
      return { data: null, error: new Error(orderError.message) }
    }

    if (attachments && attachments.length > 0 && order) {
      const attachmentsWithOrderId = attachments.map(att => ({
        ...att,
        order_id: order.id
      }))

      const { error: attachmentError } = await supabase
        .from('order_attachments')
        .insert(attachmentsWithOrderId)

      if (attachmentError) {
        console.error('Attachment insert error:', attachmentError)
      }
    }

    return { data: order, error: null }
  } catch (err) {
    console.error('Order creation error:', err)
    return { data: null, error: err as Error }
  }
}

export async function getOrderById(id: string): Promise<{ data: (Order & { attachments?: OrderAttachment[] }) | null; error: Error | null }> {
  const supabase = getSupabase()
  
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError) {
      return { data: null, error: new Error(orderError.message) }
    }

    const { data: attachments } = await supabase
      .from('order_attachments')
      .select('*')
      .eq('order_id', id)

    return { 
      data: { ...order, attachments: attachments || [] }, 
      error: null 
    }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<{ data: Order | null; error: Error | null }> {
  const supabase = getSupabase()
  
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    return { data, error: null }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

export async function uploadAttachment(file: File, orderId: string): Promise<{ data: { path: string; url: string } | null; error: Error | null }> {
  const supabase = getSupabase()
  
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') }
  }

  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${orderId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('orders')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    const { data: urlData } = supabase.storage
      .from('orders')
      .getPublicUrl(data.path)

    return { 
      data: { 
        path: data.path, 
        url: urlData.publicUrl 
      }, 
      error: null 
    }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// Blog-related types and helpers
export function normalizeBlogImage(img: string | null | undefined): string {
  if (!img || typeof img !== 'string') return '/blog/placeholder.svg'
  const trimmed = img.trim()
  if (!trimmed) return '/blog/placeholder.svg'
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed
  }
  return `/blog/${trimmed.replace(/^blog\//, '')}`
}

export type { BlogPost, QueryResult }
export type BlogPostFlat = BlogPost

const BLOG_METADATA = 'id,slug,locale,title,description,body_html,publish_date,update_date,category,tags,author,image,image_alt,featured,seo_meta_title,seo_meta_description,seo_noindex,status,created_at,updated_at'
// Listing views (index/tag/feeds/related) never render body_html, so skip the
// heavy column there. Single-post fetches keep the full column list.
const BLOG_LIST_METADATA = 'id,slug,locale,title,description,publish_date,update_date,category,tags,author,image,image_alt,featured,seo_meta_title,seo_meta_description,seo_noindex,status,created_at,updated_at'

export async function fetchPublishedPosts(locale?: string, limit?: number): Promise<QueryResult<BlogPost[]>> {
  const supabase = getSupabase()
  if (!supabase) return { status: 'error', error: 'Supabase client not initialized' }

  let builder = supabase.from('blog_posts').select(BLOG_METADATA).eq('status', 'published').eq('seo_noindex', false)
  if (locale) builder = builder.eq('locale', locale)
  builder = builder.order('publish_date', { ascending: false })
  if (typeof limit === 'number' && limit > 0) builder = builder.limit(limit)
  const { data, error } = await builder
  if (error) return { status: 'error', error: error.message }
  return { status: 'ok', data: excludeNoindex((data ?? []).map(mapBlogPost)) }
}

/** Metadata-only variant of fetchPublishedPosts for listings and related posts. */
export async function fetchPublishedPostSummaries(locale?: string, limit?: number): Promise<QueryResult<BlogPost[]>> {
  const supabase = getSupabase()
  if (!supabase) return { status: 'error', error: 'Supabase client not initialized' }

  let builder = supabase.from('blog_posts').select(BLOG_LIST_METADATA).eq('status', 'published').eq('seo_noindex', false)
  if (locale) builder = builder.eq('locale', locale)
  builder = builder.order('publish_date', { ascending: false })
  if (typeof limit === 'number' && limit > 0) builder = builder.limit(limit)
  const { data, error } = await builder
  if (error) return { status: 'error', error: error.message }
  return { status: 'ok', data: excludeNoindex((data ?? []).map(mapBlogPost)) }
}

export async function fetchPostBySlug(slug: string, locale: string): Promise<QueryResult<BlogPost>> {
  const supabase = getSupabase()
  if (!supabase) return { status: 'error', error: 'Supabase client not initialized' }

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('locale', locale)
    .eq('status', 'published')
    .maybeSingle()

  return queryResult(data, error)
}

export async function fetchPostsByTag(tag: string, locale = 'id'): Promise<QueryResult<BlogPost[]>> {
  const supabase = getSupabase()
  if (!supabase) return { status: 'error', error: 'Supabase client not initialized' }

  const { data, error } = await supabase
    .from('blog_posts')
    .select(BLOG_LIST_METADATA)
    .eq('status', 'published')
    .eq('seo_noindex', false)
    .eq('locale', locale)
    .contains('tags', [tag])
    .order('publish_date', { ascending: false })

  if (error) return { status: 'error', error: error.message }
  const posts = excludeNoindex((data ?? []).map(mapBlogPost))
  return posts.length ? { status: 'ok', data: posts } : { status: 'not_found' }
}
