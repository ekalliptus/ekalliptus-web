/** Angka WhatsApp bisnis Ekalliptus (sama dengan lib/constants.ts). */
export const WA_CONSULT_NUMBER = '6281999900306'

export interface WaConsultInput {
  name: string
  need: 'website' | 'mobile' | 'maintenance' | 'other'
  message: string
  source: string
}

const NEED_LABELS: Record<WaConsultInput['need'], string> = {
  website: 'Website Baru',
  mobile: 'Aplikasi Mobile',
  maintenance: 'Maintenance & Perbaikan',
  other: 'Konsultasi Lainnya',
}

export function buildWaConsultMessage(input: WaConsultInput): string {
  const name = input.name.trim().slice(0, 60)
  const message = input.message.trim().slice(0, 500)
  const need = NEED_LABELS[input.need]
  const source = input.source.trim().slice(0, 80) || '/'
  return [
    `Halo Ekalliptus! Saya *${name}*.`,
    '',
    `Kebutuhan: ${need}`,
    message ? `\n${message}` : '',
    '',
    `Dikirim dari ${source}`,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export function waConsultUrl(input: WaConsultInput): string {
  const text = encodeURIComponent(buildWaConsultMessage(input))
  return `https://wa.me/${WA_CONSULT_NUMBER}?text=${text}`
}
