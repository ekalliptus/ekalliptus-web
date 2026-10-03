import { describe, expect, it } from 'vitest'
import { isValidWhatsapp, normalizeWhatsapp } from '../utils/whatsapp'

describe('whatsapp normalization', () => {
  it('coerces only the local leading zero, never prefixes other countries', () => {
    expect(normalizeWhatsapp('0812-3456-789')).toBe('628123456789')
    expect(normalizeWhatsapp('628123456789')).toBe('628123456789')
    expect(normalizeWhatsapp('+49 151 23456789')).toBe('4915123456789')
  })
  it('validates 62-prefixed numbers only and rejects foreign prefixes', () => {
    expect(isValidWhatsapp('0812345678')).toBe(true)
    expect(isValidWhatsapp('628123456789')).toBe(true)
    expect(isValidWhatsapp('+49 151 23456789')).toBe(false)
    expect(isValidWhatsapp('12345')).toBe(false)
    expect(isValidWhatsapp('')).toBe(false)
  })
})
