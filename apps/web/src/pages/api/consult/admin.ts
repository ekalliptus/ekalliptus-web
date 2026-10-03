import type { APIRoute } from 'astro'
import { getSupabase } from '../../../lib/supabase'
import type { ConsultationMessageInsert } from '../../../types/database'
import { createLead } from '@ekalliptus/core'
import { readEnv } from '../../../lib/runtime-env'
import { apiJson, readPublicJson, validText, validSession } from '../../../lib/public-api'

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await readPublicJson(request, { bucket: 'consult-admin', limit: 10 })
    if (body instanceof Response) return body
    const { message, history, visitor_name } = body
    if (!validText(message, 1, 2000) || (visitor_name !== undefined && !validText(visitor_name, 1, 120)) ||
      (history !== undefined && (!Array.isArray(history) || history.length > 10 || history.some(entry =>
        !entry || !['user', 'assistant'].includes(entry.role) || !validText(entry.content, 1, 2000)))) ||
      (body.whatsapp !== undefined && !validText(body.whatsapp, 6, 32)) ||
      (body.email !== undefined && !validText(body.email, 3, 254))) return apiJson({ error: 'Invalid consultation' }, 400)
    const supabase = getSupabase(true)
    if (!supabase) return apiJson({ error: 'Service unavailable' }, 503)
    const existingSession = cookies.get('consult-session')?.value
    const sessionId = validSession(existingSession) ? existingSession : crypto.randomUUID()
    cookies.set('consult-session', sessionId, { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'strict', path: '/api/consult', maxAge: 86400 })

    if (supabase) {
      try {
        const visitorName = visitor_name || 'Pengunjung'
        const lastMessage = message.length > 200 ? message.slice(0, 200) + '...' : message

        // Read-then-write so an existing consultation's unread counter is
        // incremented instead of reset (PostgREST has no computed updates).
        const { data: existingConsultation } = await supabase
          .from('consultations')
          .select('id, unread_count')
          .eq('session_id', sessionId)
          .maybeSingle()

        let consultation;
        if (existingConsultation) {
          const { data, error } = await supabase
            .from('consultations')
            .update({
              visitor_name: visitorName,
              status: 'scheduled',
              last_message: lastMessage,
              last_message_at: new Date().toISOString(),
              unread_count: (existingConsultation.unread_count ?? 0) + 1,
            })
            .eq('id', existingConsultation.id)
            .select()
            .single()
          if (error || !data) return apiJson({ error: 'Failed to create consultation' }, 503)
          consultation = data
        } else {
          const { data, error } = await supabase
            .from('consultations')
            .upsert({
              session_id: sessionId,
              visitor_name: visitorName,
              status: 'scheduled',
              last_message: lastMessage,
              last_message_at: new Date().toISOString(),
              unread_count: 1,
            }, { onConflict: 'session_id' })
            .select()
            .single()
          if (error || !data) return apiJson({ error: 'Failed to create consultation' }, 503)
          consultation = data
        }

        // Auto-create lead from consultation handoff (non-blocking, with dedup by whatsapp)
        try {
          const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp : null
          let shouldCreate = true
          if (whatsapp) {
            const { data: existing } = await supabase!
              .from('leads')
              .select('id, stage')
              .eq('whatsapp', whatsapp)
              .not('stage', 'in', '("won","lost")')
              .limit(1)
            if (existing && existing.length > 0) shouldCreate = false
          }
          if (shouldCreate) {
            await createLead({
              name: visitorName !== 'Pengunjung' ? visitorName : 'Visitor',
              whatsapp: whatsapp,
              email: typeof body.email === 'string' ? body.email : null,
              service_interest: null,
              stage: 'contacted',
              source: 'consultation',
              consultation_id: consultation.id,
              notes: 'Auto-created from consultation handoff'
            })
          }
        } catch (err) {
          console.error('[consult/admin] Auto-create lead failed:', err)
        }

        const messagesToInsert: ConsultationMessageInsert[] = []

        if (history && Array.isArray(history)) {
          for (let i = 0; i < history.length; i++) {
            const entry = history[i]
            // The client pushes the typed handoff message into history before
            // sending it; skip that final duplicate so it is stored only once.
            if (i === history.length - 1 && entry.role === 'user' && entry.content === message) continue
            const senderType = entry.role === 'assistant' ? 'bot' : 'visitor'
            const content = typeof entry.content === 'string' ? entry.content : ''
            if (content) {
              messagesToInsert.push({
                consultation_id: consultation.id,
                session_id: sessionId,
                sender_type: senderType,
                sender_name: senderType === 'bot' ? 'eBot' : visitorName,
                content: content.slice(0, 2000),
              })
            }
          }
        }

        if (message) {
          messagesToInsert.push({
            consultation_id: consultation.id,
            session_id: sessionId,
            sender_type: 'visitor',
            sender_name: visitorName,
            content: message.slice(0, 2000),
          })
        }

        if (messagesToInsert.length > 0) {
          const { error } = await supabase.from('consultation_messages').insert(messagesToInsert)
          if (error) return apiJson({ error: 'Failed to save messages' }, 503)
        }
      } catch (err) {
        console.error('Failed to create consultation:', err)
        return apiJson({ error: 'Failed to create consultation' }, 503)
      }

      try {
        const { error } = await supabase
          .from('audit_logs')
          .insert({
            table_name: 'consultations',
            action: 'admin_handoff',
            new_values: {
              message,
              history: history || [],
              session_id: sessionId,
              timestamp: new Date().toISOString()
            } as any
          })

        if (error) {
          console.error('Failed to log admin handoff:', error.message)
        }
      } catch {
        // logging is best effort
      }
    }

    const supabaseUrl = readEnv('SUPABASE_URL') || ''
    const supabaseAnonKey = readEnv('SUPABASE_ANON_KEY') || ''

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const parsed = new URL(supabaseUrl)
        if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co')) {
          await fetch(`${parsed.origin}/functions/v1/notify-admin`, {
            method: 'POST',
            signal: AbortSignal.timeout(5000),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`
            },
            body: JSON.stringify({
              type: 'consultation_handoff',
              message,
              session_id: sessionId,
              timestamp: new Date().toISOString()
            })
          })
        }
      } catch {
        // notification is best effort
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('Admin consult API error:', error)
    return new Response(JSON.stringify({
      success: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    })
  }
}
