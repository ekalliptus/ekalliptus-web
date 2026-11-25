// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import idLocale from '../i18n/locales/id.json'
import enLocale from '../i18n/locales/en.json'
import jaLocale from '../i18n/locales/ja.json'
import koLocale from '../i18n/locales/ko.json'
import ruLocale from '../i18n/locales/ru.json'
import arLocale from '../i18n/locales/ar.json'
import trLocale from '../i18n/locales/tr.json'

const mocks = vi.hoisted(() => ({
  fetchErpAiConsultConfig: vi.fn(),
  requestErpAiConsult: vi.fn(),
  requestZaiCompletion: vi.fn(),
  readEnv: vi.fn(() => ''),
}))

vi.mock('../lib/ai-consult', () => ({
  fetchErpAiConsultConfig: mocks.fetchErpAiConsultConfig,
  requestErpAiConsult: mocks.requestErpAiConsult,
}))

vi.mock('../lib/zai', () => ({
  requestZaiCompletion: mocks.requestZaiCompletion,
}))

vi.mock('../lib/runtime-env', () => ({
  readEnv: mocks.readEnv,
}))

import { GET, POST } from '../pages/api/consult'

function makePostRequest(body: unknown) {
  return new Request('https://ekalliptus.com/api/consult', {
    method: 'POST',
    headers: {
      origin: 'https://ekalliptus.com',
      'content-type': 'application/json',
      'cf-connecting-ip': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  })
}

describe('/api/consult hybrid ERP sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readEnv.mockReturnValue('')
  })

  it('honors AI Management kill switch even if fallback env exists', async () => {
    mocks.readEnv.mockReturnValue('local-zai-secret')
    mocks.fetchErpAiConsultConfig.mockResolvedValue({
      ok: true,
      enabled: false,
      configured: false,
      assistant_name: 'eBot',
      greeting_message: 'Halo',
      handoff_phrases: ['chat admin'],
    })

    const res = await GET({} as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ enabled: false, ready: false })
  })

  it('reports ready=true when ERP consult config is enabled and configured', async () => {
    mocks.fetchErpAiConsultConfig.mockResolvedValue({
      ok: true,
      enabled: true,
      configured: true,
      assistant_name: 'Ekalliptus Bot',
      greeting_message: 'Halo dari ERP',
      handoff_phrases: ['chat admin'],
    })

    const res = await GET({} as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      enabled: true,
      ready: true,
      assistant_name: 'Ekalliptus Bot',
      greeting_message: 'Halo dari ERP',
    })
  })

  it('rejects empty messages with HTTP 400', async () => {
    const res = await POST({ request: makePostRequest({ messages: [] }) } as any)
    expect(res.status).toBe(400)
  })

  it('returns disabled=true when ERP AI is turned off', async () => {
    mocks.requestErpAiConsult.mockResolvedValue({
      ok: true,
      enabled: false,
      configured: false,
      reply: 'Silakan lanjut via WhatsApp.',
      handoff: false,
      fallback_used: true,
    })

    const res = await POST({
      request: makePostRequest({ messages: [{ role: 'user', content: 'Halo' }], locale: 'id' }),
    } as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ disabled: true, handoff: false })
    expect(mocks.requestZaiCompletion).not.toHaveBeenCalled()
  })

  it('forwards ERP reply and handoff flag without calling legacy fallback', async () => {
    mocks.requestErpAiConsult.mockResolvedValue({
      ok: true,
      enabled: true,
      configured: true,
      reply: 'Silakan lanjut lewat WhatsApp Admin.',
      handoff: true,
      fallback_used: false,
    })

    const res = await POST({
      request: makePostRequest({ messages: [{ role: 'user', content: 'chat admin' }], locale: 'id' }),
    } as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      reply: 'Silakan lanjut lewat WhatsApp Admin.',
      handoff: true,
    })
    expect(mocks.requestZaiCompletion).not.toHaveBeenCalled()
  })

  it('falls back to local ZAI_API_KEY when ERP AI has no key configured yet', async () => {
    mocks.readEnv.mockReturnValue('local-zai-secret')
    mocks.requestErpAiConsult.mockResolvedValue({ ok: false })
    mocks.requestZaiCompletion.mockResolvedValue('Balasan cadangan Z.ai')

    const res = await POST({
      request: makePostRequest({ messages: [{ role: 'user', content: 'Berapa harga website?' }] }),
    } as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      reply: 'Balasan cadangan Z.ai',
      handoff: false,
    })
    expect(mocks.requestZaiCompletion).toHaveBeenCalledOnce()
  })
})

describe('Consultation i18n hygiene (7 locales)', () => {
  it('avoids em dashes in consultation and waForm copy', () => {
    const all = [idLocale, enLocale, jaLocale, koLocale, ruLocale, arLocale, trLocale]
    for (const loc of all) {
      for (const group of [loc.consultation, loc.waForm]) {
        for (const val of Object.values(group ?? {})) {
          if (typeof val === 'string') {
            expect(val).not.toContain('\u2014')
          }
        }
      }
    }
  })
})
