/** Shared client/server WhatsApp helpers. No DOM dependencies. */

// Only coerce a local leading 0 to the Indonesian prefix. Prefixing other
// countries' digits with 62 silently produced unreachable leads (a German
// +49 number became 6249...), so non-62 international input is kept as-is.
export function normalizeWhatsapp(input: string): string {
  let cleaned = (input || '').replace(/\D/g, '')
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1)
  return cleaned
}

/** 9–15 digits, optionally 62-prefixed (Indonesian local or international). */
export function isValidWhatsapp(input: string): boolean {
  const normalized = normalizeWhatsapp(input)
  if (!normalized.startsWith('62')) return false
  return normalized.length >= 9 && normalized.length <= 15
}
