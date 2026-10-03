import { describe, expect, it } from 'vitest'
import { t, defaultLocale } from '../i18n'

describe('t() fallback chain', () => {
  it('resolves keys in the requested locale', () => {
    expect(t('nav.home', 'en')).toBe('Home')
    expect(t('nav.blog', 'ja')).toBe('ブログ')
    expect(t('nav.blog', 'ar')).toBe('المدونة')
  })

  it('falls back to the default locale for translations missing in the requested locale', () => {
    // 'blog.metaTitle' exists in id (and en) but not in ja
    expect(t('blog.metaTitle', 'ja')).toBe(t('blog.metaTitle', 'id'))
    expect(t('blog.metaTitle', 'ja')).not.toMatch(/^blog\./)
  })

  it('returns the raw key only when no locale defines it', () => {
    expect(t('totally.missing.key', 'en')).toBe('totally.missing.key')
    expect(t('totally.missing.key', 'ja')).toBe('totally.missing.key')
  })

  it('defaults to the default locale', () => {
    expect(t('nav.home')).toBe(t('nav.home', defaultLocale))
  })
})
