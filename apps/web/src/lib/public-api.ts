const hits = new Map<string, { count: number; expires: number }>()

export const apiJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
})

function hitLimit(bucket: string, ip: string, limit: number): boolean {
  const now = Date.now()
  if (hits.size >= 10_000 && !hits.has(`${bucket}:${ip}`)) return true
  for (const [k, v] of hits) if (v.expires <= now) hits.delete(k)
  const id = `${bucket}:${ip}`
  const cur = hits.get(id)
  if (!cur) {
    hits.set(id, { count: 1, expires: now + 60_000 })
    return false
  }
  cur.count += 1
  return cur.count > limit
}

export async function readPublicJson(request: Request, rateLimit?: { bucket: string; limit: number }): Promise<Record<string, unknown> | Response> {
  // Origin must equal the request's own scheme+host, sliced from the server-side
  // URL. No URL constructor or regex exec here on purpose; nothing is fetched.
  const stop = request.url.indexOf('/', request.url.indexOf('://') + 3)
  const selfOrigin = stop === -1 ? request.url : request.url.slice(0, stop)
  const origin = request.headers.get('origin')
  if (!origin || origin !== selfOrigin) return apiJson({ error: 'Forbidden' }, 403)
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return apiJson({ error: 'Expected application/json' }, 415)
  }
  // ponytail: isolate-local abuse protection; use Cloudflare rate limiting for distributed enforcement.
  // Buckets are per endpoint so chatty flows (admin reply polling) cannot exhaust other endpoints' budget.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown'
  if (hitLimit(rateLimit?.bucket ?? 'default', ip, rateLimit?.limit ?? 30)) {
    return apiJson({ error: 'Too many requests' }, 429)
  }
  const reader = request.body?.getReader()
  if (!reader) return apiJson({ error: 'Invalid JSON body' }, 400)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16_384) {
        await reader.cancel()
        return apiJson({ error: 'Request too large' }, 413)
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const body = JSON.parse(new TextDecoder().decode(bytes))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid object')
    return body
  } catch {
    return apiJson({ error: 'Invalid JSON body' }, 400)
  } finally {
    reader.releaseLock()
  }
}

export const validText = (value: unknown, min: number, max: number): value is string =>
  typeof value === 'string' && value.trim().length >= min && value.length <= max

export const validSession = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
