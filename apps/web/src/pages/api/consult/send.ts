import type { APIRoute } from 'astro'
import { getSupabase } from '../../../lib/supabase'
import type { ConsultationMessageInsert } from '../../../types/database'
import { createLead } from '@ekalliptus/core'

import { apiJson, readPublicJson, validText, validSession } from '../../../lib/public-api'

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await readPublicJson(request, { bucket: 'consult-send', limit: 20 })
    if (body instanceof Response) return body
    const { message, visitor_name } = body
    const session_id = cookies.get('consult-session')?.value
    if (!validSession(session_id)) return apiJson({ error: 'Start a consultation first' }, 403)
    if (!validText(message, 1, 2000) || (visitor_name !== undefined && !validText(visitor_name, 1, 120))) {
      return apiJson({ error: 'Invalid message' }, 400)
    }

    const supabase = getSupabase(true)

    if (!supabase) {
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      })
    }

    const visitorName = visitor_name || 'Pengunjung'

    const { data: consultation, error: consultError } = await supabase
      .from('consultations')
      .select('id, unread_count')
      .eq('session_id', session_id)
      .single()

    if (consultError || !consultation) {
      const { data: newConsultation, error: insertError } = await supabase
        .from('consultations')
        .insert({
          session_id,
          visitor_name: visitorName,
          status: 'scheduled',
          last_message: message.length > 200 ? message.slice(0, 200) + '...' : message,
          last_message_at: new Date().toISOString(),
          unread_count: 1,
        })
        .select()
        .single()

      if (insertError || !newConsultation) {
        return new Response(JSON.stringify({ error: 'Failed to create consultation' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        })
      }

      // Auto-create lead from first visitor message (non-blocking)
      // Dedup is naturally ensured since this branch only runs on new consultation insert (session_id unique)
      try {
        await createLead({
          name: visitorName !== 'Pengunjung' ? visitorName : 'Visitor',
          whatsapp: null,
          email: null,
          service_interest: null,
          stage: 'new',
          source: 'consultation',
          consultation_id: newConsultation.id,
          notes: 'Auto-created from consultation (first message)'
        })
      } catch (err) {
        console.error('[consult/send] Auto-create lead failed:', err)
      }

      const messageRecord: ConsultationMessageInsert = {
        consultation_id: newConsultation.id,
        session_id,
        sender_type: 'visitor',
        sender_name: visitorName,
        content: message.slice(0, 2000),
      }

      const { error: msgError } = await supabase
        .from('consultation_messages')
        .insert(messageRecord)

      if (msgError) {
        console.error('Failed to insert message:', msgError.message)
        return apiJson({ error: 'Failed to save message' }, 503)
      }
    } else {
      const messageRecord: ConsultationMessageInsert = {
        consultation_id: consultation.id,
        session_id,
        sender_type: 'visitor',
        sender_name: visitorName,
        content: message.slice(0, 2000),
      }

      const { error: msgError } = await supabase
        .from('consultation_messages')
        .insert(messageRecord)

      if (msgError) {
        console.error('Failed to insert message:', msgError.message)
        return apiJson({ error: 'Failed to save message' }, 503)
      }

      const { error: updateError } = await supabase
        .from('consultations')
        .update({
          last_message: message.length > 200 ? message.slice(0, 200) + '...' : message,
          last_message_at: new Date().toISOString(),
          // Increment the unread counter (already read above) instead of
          // resetting it; PostgREST cannot compute updates without rpc.
          unread_count: (consultation.unread_count ?? 0) + 1,
          status: 'scheduled',
        })
        .eq('id', consultation.id)

      if (updateError) {
        console.error('Failed to update consultation:', updateError.message)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('Consult send API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    })
  }
}
