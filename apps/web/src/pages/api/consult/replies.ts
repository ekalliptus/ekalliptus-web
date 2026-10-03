import type { APIRoute } from 'astro'
import { getSupabase } from '../../../lib/supabase'
import { apiJson, readPublicJson, validSession } from '../../../lib/public-api'

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await readPublicJson(request, { bucket: 'consult-replies', limit: 60 })
  if (body instanceof Response) return body
  const session = cookies.get('consult-session')?.value
  if (!validSession(session)) return apiJson({ error: 'Unauthorized' }, 403)
  const offset = body.offset ?? 0
  if (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) {
    return apiJson({ error: 'Invalid offset' }, 400)
  }
  const supabase = getSupabase(true)
  if (!supabase) return apiJson({ error: 'Service unavailable' }, 503)
  try {
    const { data, error } = await supabase.from('consultation_messages')
      .select('id, content, created_at')
      .eq('session_id', session)
      .eq('sender_type', 'admin')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + 49)
      .abortSignal(AbortSignal.timeout(10000))
    if (error) return apiJson({ error: 'Replies temporarily unavailable' }, 503)
    return apiJson({ messages: data ?? [], offset: offset + (data?.length ?? 0) })
  } catch {
    return apiJson({ error: 'Replies temporarily unavailable' }, 503)
  }
}
