// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { readPublicJson, validSession, validText } from '../lib/public-api'
import { formatChatResponse } from '../lib/chat-format'

const request = (body = '{}', headers: Record<string, string> = {}) => new Request('https://ekalliptus.com/api/order', {
  method: 'POST', headers: { origin: 'https://ekalliptus.com', 'content-type': 'application/json', 'cf-connecting-ip': crypto.randomUUID(), ...headers }, body,
})

describe('public API boundary', () => {
  it('accepts same-origin JSON objects only', async () => {
    expect(await readPublicJson(request('{"name":"Test"}'))).toEqual({ name: 'Test' })
    for (const body of ['null', '[]', '"text"', '{']) {
      expect((await readPublicJson(request(body)) as Response).status).toBe(400)
    }
  })
  it('does not allow referer to override a hostile Origin', async () => {
    expect((await readPublicJson(request('{}', { origin: 'https://evil.test', referer: 'https://ekalliptus.com/' })) as Response).status).toBe(403)
    expect((await readPublicJson(request('{}', { origin: 'null' })) as Response).status).toBe(403)
    expect((await readPublicJson(request('{}', { 'content-type': 'text/plain' })) as Response).status).toBe(415)
  })
  it('counts actual bytes instead of trusting Content-Length', async () => {
    expect((await readPublicJson(request(JSON.stringify({ text: '界'.repeat(6000) }))) as Response).status).toBe(413)
  })
  it('limits repeated requests then expires the window', async () => {
    const headers = { 'cf-connecting-ip': crypto.randomUUID() }
    for (let i = 0; i < 30; i++) expect(await readPublicJson(request('{}', headers))).toEqual({})
    const response = await readPublicJson(request('{}', headers)) as Response
    expect(response.status).toBe(429)
    expect(response.headers.get('cache-control')).toBe('no-store')
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000)
    try { expect(await readPublicJson(request('{}', headers))).toEqual({}) } finally { vi.restoreAllMocks() }
  })
  it('validates text types, bounds, UUID sessions', () => {
    expect(validText({}, 1, 10)).toBe(false)
    expect(validText('   ', 1, 10)).toBe(false)
    expect(validText('x'.repeat(11), 1, 10)).toBe(false)
    expect(validSession(crypto.randomUUID())).toBe(true)
    expect(validSession('victim-session')).toBe(false)
  })
  it('escapes AI/admin output before adding formatting', () => {
    expect(formatChatResponse('<img src=x onerror=alert(1)> **safe**')).toBe('&lt;img src=x onerror=alert(1)&gt; <strong>safe</strong>')
  })
})
