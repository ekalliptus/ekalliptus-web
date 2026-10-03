import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
    platformProxy: {
      enabled: true,
    },
  }),
  site: 'https://ekalliptus.com',
  vite: {
    // Baked at build time; the edge-cache key includes it so a new deploy
    // never matches cached HTML that references assets from the old bundle.
    define: {
      __BUILD_ID__: JSON.stringify(Date.now().toString(36))
    },
    build: {
      cssMinify: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    }
  },
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto'
  }
})
