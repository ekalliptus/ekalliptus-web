import type { APIRoute } from 'astro'
import { fetchErpAiConsultConfig, requestErpAiConsult } from '../../lib/ai-consult'
import { readEnv } from '../../lib/runtime-env'
import { requestZaiCompletion } from '../../lib/zai'
import { readPublicJson } from '../../lib/public-api'

const ZAI_MODEL_DEFAULT = 'glm-4.5-air'

const FALLBACK_RESPONSES = [
  'Terima kasih atas pertanyaan Anda. Untuk informasi lebih detail, silakan hubungi kami melalui WhatsApp di +62 819-9990-0306 atau kunjungi halaman order kami di ekalliptus.com/id/order.',
  'Pertanyaan yang bagus. Tim Ekalliptus siap membantu kebutuhan website, aplikasi mobile, dan sistem ERP Anda. Hubungi WhatsApp +62 819-9990-0306 untuk diskusi cepat.',
  'Saat ini asisten AI sedang dalam mode cadangan. Untuk respons cepat bersama tim, silakan beralih ke tab WhatsApp atau hubungi +62 819-9990-0306.',
]

function pickFallback(): string {
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)]
}

function detectHandoff(messages: Array<{ role: string; content: string }>): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUser) return false
  const text = lastUser.content.toLowerCase().trim()
  const phrases = [
    'chat admin',
    'bicara admin',
    'hubungkan admin',
    'bicara dengan admin',
    'saya mau bicara admin',
    'mau chat admin',
    'bicara langsung',
    'talk to admin',
    'connect admin',
    'chat dengan admin',
    'mau ngobrol admin',
    'pengen ketemu admin',
    'bicara sama admin',
    'mau tanya admin',
    'adminnya mana',
    'panggil admin',
  ]
  return phrases.some((p) => text.includes(p))
}

function sanitizeMessage(content: unknown): string {
  const str = typeof content === 'string' ? content : JSON.stringify(content)
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<img\b[^>]*onerror[^>]*>/gi, '')
    .replace(/<\s*img\b[^>]*\bsrc\s*=\s*["']?\s*data\s*:/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<\?php.*?\?>/gis, '')
    .replace(/\u2014/g, ', ')
    .trim()
    .substring(0, 1000)
}

function sanitizeMessages(messages: unknown[]): Array<{ role: string; content: string }> {
  const validRoles = new Set(['user', 'assistant'])
  return messages
    .slice(-10)
    .filter(
      (m: unknown): m is { role: string; content: string } =>
        Boolean(m) &&
        typeof m === 'object' &&
        validRoles.has((m as { role?: string }).role ?? '') &&
        typeof (m as { content?: unknown }).content === 'string',
    )
    .map((m) => ({
      role: m.role,
      content: sanitizeMessage(m.content),
    }))
    .filter((m) => m.content.length > 0)
}

export const GET: APIRoute = async () => {
  const erpCfg = await fetchErpAiConsultConfig()
  const hasLocalFallback = Boolean(readEnv('ZAI_API_KEY'))

  if (erpCfg.ok) {
    const enabled = erpCfg.enabled
    const ready = enabled && (erpCfg.configured || hasLocalFallback)
    return new Response(
      JSON.stringify({
        enabled,
        ready,
        assistant_name: erpCfg.assistant_name,
        greeting_message: erpCfg.greeting_message,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=15',
        },
      },
    )
  }

  return new Response(
    JSON.stringify({
      enabled: hasLocalFallback,
      ready: hasLocalFallback,
      assistant_name: 'eBot',
      greeting_message: '',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  )
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const ZAI_API_KEY = readEnv('ZAI_API_KEY') || ''
    const ZAI_MODEL = readEnv('ZAI_MODEL') || ZAI_MODEL_DEFAULT

    const body = await readPublicJson(request, { bucket: 'consult', limit: 20 })
    if (body instanceof Response) return body
    const { messages, locale } = body as { messages?: unknown; locale?: unknown }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Messages array is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        },
      )
    }

    const sanitized = sanitizeMessages(messages)
    if (sanitized.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Invalid messages',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        },
      )
    }

    const cleanLocale =
      typeof locale === 'string' && /^[a-z-]{2,10}$/i.test(locale.trim())
        ? locale.trim().toLowerCase()
        : 'id'

    const erpRes = await requestErpAiConsult({ messages: sanitized, locale: cleanLocale })
    if (erpRes.ok) {
      if (!erpRes.enabled) {
        return new Response(
          JSON.stringify({
            reply: erpRes.reply || pickFallback(),
            handoff: false,
            disabled: true,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          },
        )
      }

      if (erpRes.configured) {
        return new Response(
          JSON.stringify({
            reply: erpRes.reply,
            handoff: erpRes.handoff,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          },
        )
      }
    }

    if (detectHandoff(sanitized)) {
      return new Response(
        JSON.stringify({
          reply:
            'Baik, Anda bisa langsung melanjutkan obrolan bersama admin Ekalliptus melalui WhatsApp.',
          handoff: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        },
      )
    }

    if (!ZAI_API_KEY) {
      return new Response(
        JSON.stringify({
          reply: pickFallback(),
          handoff: false,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        },
      )
    }

    const aiReply = await requestZaiCompletion(sanitized, ZAI_API_KEY, ZAI_MODEL)
    return new Response(
      JSON.stringify({
        reply: (aiReply || pickFallback()).replace(/\u2014/g, ', '),
        handoff: false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      },
    )
  } catch {
    return new Response(
      JSON.stringify({
        reply: pickFallback(),
        handoff: false,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      },
    )
  }
}
