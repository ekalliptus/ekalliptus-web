/// <reference types="astro/client" />

export {}

declare global {
  // Baked by vite define in astro.config.mjs at build time.
  const __BUILD_ID__: string

  namespace App {
    interface Locals {
      adminSession?: import('@ekalliptus/core').AdminSession
      locale?: import('./lib/locale-routing').Locale
      publicPathname?: string
      indexable?: boolean
      localeRewrite?: boolean
      runtime?: {
        env?: Record<string, string | undefined>
      }
    }
  }
}
