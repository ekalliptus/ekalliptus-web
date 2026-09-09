/**
 * Homepage testimonials.
 *
 * ⚠️ HONESTY / SEO POLICY
 * -----------------------------------------------------------------------------
 * Google's review-snippet guidelines (and basic integrity) forbid fabricated
 * reviews. The `verified` flag gates BOTH the on-page rating stars AND the
 * Review / AggregateRating JSON-LD:
 *
 *   - Set `verified: true` ONLY for a real testimonial you have permission to
 *     publish (real person/company, real words, real rating).
 *   - Unverified entries still render as plain quote cards (social proof), but
 *     emit NO rating stars and NO structured data.
 *
 * Replace the placeholders below with real client testimonials over time.
 * `hasVerifiedTestimonials()` is what the page uses to decide whether to emit
 * AggregateRating, so until at least one entry is verified, no review schema
 * is produced. This is intentional.
 */

export interface Testimonial {
  /** Display name of the client (real person). */
  name: string
  /** Role / company, e.g. "Owner, Kopi Senja". */
  role: string
  /** The testimonial text. */
  quote: string
  /** 1–5. Only used for schema/stars when `verified` is true. */
  rating: number
  /** Which service this relates to (for context chips). */
  service?: string
  /** Optional avatar path under /public. Falls back to initials. */
  avatar?: string
  /**
   * TRUE only for real, permission-granted testimonials. Controls rating
   * stars + Review/AggregateRating structured data. Leave false for samples.
   */
  verified: boolean
}

/**
 * Placeholder testimonials. These are clearly-sample social-proof cards and are
 * NOT marked verified, so they produce no review schema. Swap in real ones.
 */
export const testimonials: Testimonial[] = [
  {
    name: 'Calon Klien Anda',
    role: 'Bisnis Anda di sini',
    quote:
      'Ruang ini menanti testimoni nyata dari klien kami. Setelah project selesai, cerita kepuasan Anda akan tampil di sini.',
    rating: 5,
    service: 'Website',
    verified: false,
  },
  {
    name: 'Calon Klien Anda',
    role: 'UMKM / Startup',
    quote:
      'Kami menjaga setiap testimoni tetap jujur dan terverifikasi. Tidak ada ulasan palsu, hanya cerita nyata dari klien yang puas.',
    rating: 5,
    service: 'Mobile App',
    verified: false,
  },
  {
    name: 'Calon Klien Anda',
    role: 'Perusahaan',
    quote:
      'Hubungi kami untuk memulai project Anda. Setelah selesai, dengan izin Anda, kisah sukses ini bisa menggantikan placeholder ini.',
    rating: 5,
    service: 'UI/UX Design',
    verified: false,
  },
]

/** Only the testimonials safe to use for stars + structured data. */
export const verifiedTestimonials = testimonials.filter((t) => t.verified)

/** Whether any verified testimonial exists (gates AggregateRating schema). */
export function hasVerifiedTestimonials(): boolean {
  return verifiedTestimonials.length > 0
}

/** Aggregate rating across verified testimonials, or null if none. */
export function aggregateRating(): { ratingValue: string; reviewCount: number } | null {
  if (verifiedTestimonials.length === 0) return null
  const sum = verifiedTestimonials.reduce((s, t) => s + t.rating, 0)
  const avg = sum / verifiedTestimonials.length
  return { ratingValue: avg.toFixed(1), reviewCount: verifiedTestimonials.length }
}
