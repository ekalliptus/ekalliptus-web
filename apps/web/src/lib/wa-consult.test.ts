import { describe, expect, it } from 'vitest'
import { buildWaConsultMessage, waConsultUrl, WA_CONSULT_NUMBER } from './wa-consult'

describe('buildWaConsultMessage', () => {
  const input = { name: 'Budi', need: 'website' as const, message: 'Butuh company profile', source: 'ekalliptus.com/id' }

  it('menyusun pesan dengan nama bold, kebutuhan, dan sumber', () => {
    const msg = buildWaConsultMessage(input)
    expect(msg).toContain('Halo Ekalliptus! Saya *Budi*.')
    expect(msg).toContain('Kebutuhan: Website Baru')
    expect(msg).toContain('Butuh company profile')
    expect(msg).toContain('Dikirim dari ekalliptus.com/id')
  })

  it('memotong nama maksimal 60 dan pesan maksimal 500 karakter', () => {
    const long = buildWaConsultMessage({ ...input, name: 'a'.repeat(80), message: 'b'.repeat(600) })
    expect(long).not.toContain('a'.repeat(61))
    expect(long).not.toContain('b'.repeat(501))
  })

  it('melewatkan bagian pesan saat kosong', () => {
    const msg = buildWaConsultMessage({ ...input, message: '' })
    expect(msg).not.toContain('Butuh')
    expect(msg).toContain('Kebutuhan: Website Baru')
  })
})

describe('waConsultUrl', () => {
  const input = { name: 'Budi', need: 'website' as const, message: 'Butuh company profile', source: 'ekalliptus.com/id' }

  it('membuat URL wa.me dengan teks terenkode', () => {
    const url = waConsultUrl(input)
    expect(url.startsWith(`https://wa.me/${WA_CONSULT_NUMBER}?text=`)).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1] ?? '')).toContain('Saya *Budi*')
  })
})
