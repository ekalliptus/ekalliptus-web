/** Single source of truth for contact identifiers. Import everywhere. */
export const WA_BUSINESS_NUMBER = '6281999900306'
export const WA_DISPLAY_PHONE = '+62 819-9990-0306'
export const BUSINESS_EMAIL = 'alul@ekalliptus.com'

/** Build a wa.me link, optionally with a pre-filled (URL-encoded) message. */
export function waLink(text?: string): string {
  const base = `https://wa.me/${WA_BUSINESS_NUMBER}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
