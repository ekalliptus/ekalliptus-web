// Astro + Cloudflare Workers (Static Assets) post-build.
//
// Deployment model: Cloudflare WORKERS (not Pages). The @astrojs/cloudflare
// adapter emits:
//   - dist/server/entry.mjs (+ chunks)  → the Worker (main)
//   - dist/client/**                    → static assets (ASSETS binding)
//   - dist/server/wrangler.json         → generated Workers deploy config
//   - .wrangler/deploy/config.json      → redirect so root `wrangler deploy`
//                                          finds dist/server/wrangler.json
// Deploy command: `wrangler deploy` from repo root (uses the redirect above).
//
// The ONLY thing we fix here: Astro/Vite sometimes emits an asset whose
// filename starts with a dot (e.g. `.Layout.HASH.css`). Cloudflare's static
// asset server does NOT serve dot-prefixed (hidden) files, so the link 404s
// and styling breaks in production. We strip the leading dot from such assets
// under dist/client and rewrite every reference to them in the built Worker
// (dist/server) and any client JS.
//
// NOTE: we intentionally do NOT delete `.wrangler/deploy`, that directory
// holds the deploy redirect the adapter created; removing it breaks
// `wrangler deploy`.

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const serverDir = path.join(root, 'dist/server')
const clientDir = path.join(root, 'dist/client')
const astroDir = path.join(clientDir, '_astro')

// 1. Strip leading dot from asset filenames so Cloudflare serves them.
const renames = []
if (fs.existsSync(astroDir)) {
  for (const file of fs.readdirSync(astroDir)) {
    if (!file.startsWith('.')) continue
    const newName = file.replace(/^\.+/, '')
    if (!newName) continue
    fs.renameSync(path.join(astroDir, file), path.join(astroDir, newName))
    renames.push([file, newName])
    console.log(`[post-build] Renamed _astro/${file} → _astro/${newName}`)
  }
}

// 2. Rewrite references to renamed assets across BOTH the Worker (dist/server)
//    and client JS (dist/client). The SSR Worker injects the CSS <link>, so
//    the reference typically lives in dist/server/chunks/*.mjs.
if (renames.length > 0) {
  const replaceInFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8')
    let changed = false
    for (const [oldName, newName] of renames) {
      const variants = [
        ['/_astro/' + oldName, '/_astro/' + newName],
        ['_astro/' + oldName, '_astro/' + newName]
      ]
      for (const [oldRef, newRef] of variants) {
        if (content.includes(oldRef)) {
          content = content.split(oldRef).join(newRef)
          changed = true
        }
      }
    }
    if (changed) fs.writeFileSync(filePath, content, 'utf8')
    return changed
  }

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && (full.endsWith('.js') || full.endsWith('.mjs'))) {
        if (replaceInFile(full)) {
          console.log(`[post-build] Updated references in ${path.relative(root, full)}`)
        }
      }
    }
  }

  walk(serverDir)
  walk(clientDir)
}

console.log('[post-build] Done.')
