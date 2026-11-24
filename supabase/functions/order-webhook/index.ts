import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SERVICE_LABELS: Record<string, string> = {
  website: 'Website Development',
  mobile: 'Mobile App Development',
  wordpress: 'WordPress Development',
  editing: 'UI/UX Design',
  web: 'Website Development',
  uiux: 'UI/UX Design'
}

function formatPrice(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<{ success: boolean; result?: T; error?: string; attempts: number }> {
  let lastError = ''
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn()
      return { success: true, result, attempts: attempt }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }
  return { success: false, error: lastError, attempts: maxAttempts }
}

async function sendTelegramNotification(order: any): Promise<void> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')!

  const price = order.price || (order.pricing as any)?.grand_total || 0
  const description = order.description || (order.scope as any)?.description || ''
  const serviceLabel = SERVICE_LABELS[order.service_type] || order.service_type

  const text = `🔔 *Order Baru\\!*

📋 Order ID: \`${order.id.slice(0, 8)}\`
👤 Nama: ${escapeMarkdown(order.customer_name)}
📱 WhatsApp: ${escapeMarkdown(order.whatsapp)}
🛠 Layanan: ${escapeMarkdown(serviceLabel)}
💰 Harga: ${escapeMarkdown(formatPrice(price))}

📝 ${escapeMarkdown(description)}`

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' })
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Telegram API error ${res.status}: ${body}`)
  }
}

function escapeMarkdown(text: unknown): string {
  return String(text ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  const maxLen = Math.max(aBytes.length, bBytes.length)
  let diff = aBytes.length ^ bBytes.length
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)
  }
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const expectedSecret = Deno.env.get('ORDER_WEBHOOK_SECRET')?.trim()
  if (!expectedSecret) {
    console.error('[order-webhook] ORDER_WEBHOOK_SECRET is not configured')
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const providedSecret = req.headers.get('x-webhook-secret')?.trim() ?? ''
  if (!providedSecret || !timingSafeEqual(providedSecret, expectedSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const payload = await req.json().catch(() => null)
    const order = payload?.record

    if (!order || typeof order.id !== 'string' || !UUID_RE.test(order.id)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: verifiedOrder, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer_name, whatsapp, service_type, price, pricing, description, scope')
      .eq('id', order.id)
      .maybeSingle()

    if (orderErr) {
      console.error('[order-webhook] Order lookup error:', orderErr)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!verifiedOrder) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const result = await withRetry(() => sendTelegramNotification(verifiedOrder))

    if (!result.success) {
      await supabase.from('order_sync_failures').insert({
        order_id: verifiedOrder.id,
        target: 'telegram',
        error_message: result.error || 'Unknown error',
        attempts: result.attempts
      })
    }

    return new Response(JSON.stringify({
      telegram: result.success ? 'ok' : 'failed'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
