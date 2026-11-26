import { waLink } from './constants'

export type PortfolioPurchaseIntent = 'buy_ready' | 'custom_similar'

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatIdrString(rawDigits: string): string {
  const normalized = rawDigits.replace(/\D/g, '')
  if (!normalized) return 'Rp 0'
  const big = BigInt(normalized)
  const asNum = Number(big)
  if (Number.isSafeInteger(asNum)) {
    return idrFormatter.format(asNum)
  }
  const grouped = big.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `Rp ${grouped}`
}

export function hasListedPortfolioPrice(project: {
  price_type: 'fixed' | 'starting_from' | 'negotiable'
  price_amount: string | null
}): boolean {
  if (project.price_type === 'negotiable') return false
  const digits = project.price_amount?.replace(/\D/g, '') ?? ''
  return digits.length > 0 && BigInt(digits) > 0n
}

export function formatListedPortfolioPrice(
  project: {
    price_type: 'fixed' | 'starting_from' | 'negotiable'
    price_amount: string | null
  },
  locale = 'id',
): string | null {
  if (!hasListedPortfolioPrice(project)) return null
  return formatPortfolioPrice(project, locale)
}

export function formatPortfolioPrice(
  project: {
    price_type: 'fixed' | 'starting_from' | 'negotiable'
    price_amount: string | null
  },
  locale = 'id',
): string {
  const digits = project.price_amount?.replace(/\D/g, '') ?? ''
  const hasPositivePrice = digits.length > 0 && BigInt(digits) > 0n
  if (project.price_type === 'negotiable' || !hasPositivePrice) {
    return locale === 'id' ? 'Diskusi Harga' : 'Discuss Price'
  }
  const formatted = formatIdrString(digits)
  if (project.price_type === 'starting_from') {
    return locale === 'id' ? `Mulai ${formatted}` : `From ${formatted}`
  }
  return formatted
}

export interface PortfolioWaMessageInput {
  title: string
  slug: string
  priceLabel?: string | null
  intent: PortfolioPurchaseIntent
  pageUrl?: string
  customIntro?: string | null
  locale?: string
}

export function buildPortfolioWaMessage(input: PortfolioWaMessageInput): string {
  const locale = input.locale ?? 'id'
  const title = input.title.trim().slice(0, 120)
  const slug = input.slug.trim().slice(0, 96)
  const intro = input.customIntro?.trim().slice(0, 280)
  const pageUrl = input.pageUrl?.trim()
  const priceLabel = input.priceLabel?.trim() || ''

  if (locale === 'id') {
    const intentLabel =
      input.intent === 'custom_similar'
        ? 'Pesan Versi Custom Serupa'
        : 'Beli Project Siap Pakai'
    const lines = [
      intro || `Halo Ekalliptus, saya tertarik membeli project "${title}".`,
      `Kode project: ${slug}`,
      `Kebutuhan: ${intentLabel}`,
    ]
    if (priceLabel) lines.push(`Harga tertera: ${priceLabel}`)
    if (pageUrl) lines.push(`Halaman project: ${pageUrl}`)
    return lines.join('\n')
  }

  const intentLabel =
    input.intent === 'custom_similar'
      ? 'Request Custom Build'
      : 'Buy Ready-to-Use Project'
  const lines = [
    intro || `Hello Ekalliptus, I am interested in purchasing the project "${title}".`,
    `Project code: ${slug}`,
    `Request type: ${intentLabel}`,
  ]
  if (priceLabel) lines.push(`Listed price: ${priceLabel}`)
  if (pageUrl) lines.push(`Project page: ${pageUrl}`)
  return lines.join('\n')
}

export function buildPortfolioWaUrl(input: PortfolioWaMessageInput): string {
  return waLink(buildPortfolioWaMessage(input))
}
