import { resolvePortfolioApiBaseUrl } from './portfolio'

export interface ErpAiConsultConfigResult {
  ok: true
  enabled: boolean
  configured: boolean
  assistant_name: string
  greeting_message: string
  handoff_phrases: string[]
}

export type ErpAiConsultConfigResponse = ErpAiConsultConfigResult | { ok: false }

export interface ErpAiConsultReplyResult {
  ok: true
  enabled: boolean
  configured: boolean
  reply: string
  handoff: boolean
  fallback_used: boolean
}

export type ErpAiConsultReplyResponse = ErpAiConsultReplyResult | { ok: false }

export async function fetchErpAiConsultConfig(options?: {
  fetchImpl?: typeof fetch
  baseUrl?: string
}): Promise<ErpAiConsultConfigResponse> {
  const baseUrl = resolvePortfolioApiBaseUrl(options?.baseUrl)
  const fetchImpl = options?.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)

  try {
    const res = await fetchImpl(`${baseUrl}/api/public/ai/consult-config`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false }
    const data = (await res.json()) as Partial<ErpAiConsultConfigResult>
    return {
      ok: true,
      enabled: Boolean(data.enabled),
      configured: Boolean(data.configured),
      assistant_name:
        typeof data.assistant_name === 'string' && data.assistant_name.trim()
          ? data.assistant_name.trim()
          : 'eBot',
      greeting_message:
        typeof data.greeting_message === 'string' ? data.greeting_message.trim() : '',
      handoff_phrases: Array.isArray(data.handoff_phrases)
        ? data.handoff_phrases.filter((p): p is string => typeof p === 'string')
        : [],
    }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timer)
  }
}

export async function requestErpAiConsult(
  payload: {
    messages: Array<{ role: string; content: string }>
    locale?: string
  },
  options?: {
    fetchImpl?: typeof fetch
    baseUrl?: string
  },
): Promise<ErpAiConsultReplyResponse> {
  const baseUrl = resolvePortfolioApiBaseUrl(options?.baseUrl)
  const fetchImpl = options?.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 28000)

  try {
    const res = await fetchImpl(`${baseUrl}/api/public/ai/consult`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: payload.messages,
        locale: payload.locale || 'id',
      }),
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false }
    const data = (await res.json()) as Partial<ErpAiConsultReplyResult>
    if (typeof data.reply !== 'string') return { ok: false }
    return {
      ok: true,
      enabled: Boolean(data.enabled),
      configured: Boolean(data.configured),
      reply: data.reply,
      handoff: Boolean(data.handoff),
      fallback_used: Boolean(data.fallback_used),
    }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timer)
  }
}
