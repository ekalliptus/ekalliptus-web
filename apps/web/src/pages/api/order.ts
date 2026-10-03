import type { APIRoute } from 'astro'
import { getSupabase } from '../../lib/supabase'
import { SERVICE_TYPE_MAP } from '../../utils/pricing'
import { createLead } from '@ekalliptus/core'
import { normalizeWhatsapp, isValidWhatsapp } from '../../utils/whatsapp'
import { apiJson as json, readPublicJson, validText } from '../../lib/public-api'

const VALID_SERVICES = ['web', 'mobile', 'maintenance']
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await readPublicJson(request, { bucket: 'order', limit: 10 })
    if (body instanceof Response) return body
    const { service_type, customer_name, whatsapp, description } = body

    // --- Validation ---
    if (!validText(customer_name, 2, 120)) {
      return json({ success: false, error: 'Nama tidak valid' }, 400)
    }
    if (!validText(description, 10, 5000)) {
      return json({ success: false, error: 'Deskripsi terlalu pendek (min 10 karakter)' }, 400)
    }
    if (typeof service_type !== 'string' || !VALID_SERVICES.includes(service_type)) {
      return json({ success: false, error: 'Layanan tidak valid' }, 400)
    }
    if (!validText(whatsapp, 6, 32)) return json({ success: false, error: 'Nomor WhatsApp tidak valid' }, 400)
    const wa = normalizeWhatsapp(whatsapp)
    if (!isValidWhatsapp(wa)) {
      return json({ success: false, error: 'Nomor WhatsApp tidak valid' }, 400)
    }

    const serviceType = SERVICE_TYPE_MAP[service_type] || 'website'
    const name = customer_name.trim()
    const desc = description.trim()

    const orderData = {
      customer_name: name,
      whatsapp: wa,
      service_type: serviceType,
      description: desc,
      price: null,            // price-free consultation request
      scope: { source: 'web_form', description: desc },
      pricing: {},            // no pricing computed client-side
      status: 'new' as const,
      schedule_date: new Date().toISOString().split('T')[0],
      schedule_time: '10:00',
      delivery_method: 'pickup' as const
    }

    const supabase = getSupabase(true)
    if (!supabase) return json({ success: false, error: 'Layanan sementara tidak tersedia. Hubungi WhatsApp.' }, 503)
    const { data: order, error } = await supabase.from('orders').insert(orderData).select('id').single()

    if (error || !order) {
      console.error('Order creation error:', error)
      return json({ success: false, error: 'Gagal membuat order' }, 500)
    }

    // Best-effort CRM lead (never block the order on lead failure).
    try {
      await createLead({
        name,
        whatsapp: wa,
        service_interest: serviceType,
        stage: 'new',
        source: 'direct_order',
        order_id: order.id,
        estimated_value: null,   // no price captured at request time
        notes: `Auto-created from order ${order.id.slice(0, 8)}`
      })
    } catch (err) {
      console.error('[order] Auto-create lead failed:', err)
    }

    return json({
      success: true,
      data: { orderId: order.id, customerName: name, whatsapp: wa, serviceType: service_type }
    }, 200)
  } catch (error) {
    console.error('API error:', error)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
}
