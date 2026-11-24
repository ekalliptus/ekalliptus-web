// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  ADMIN_AUDIT_ROLES,
  ADMIN_BLOG_ROLES,
  ADMIN_CONSULTATION_ROLES,
  ADMIN_CUSTOMER_ROLES,
  ADMIN_LEAD_DELETE_ROLES,
  ADMIN_LEAD_ROLES,
  ADMIN_ORDER_ROLES,
  VALID_USER_ROLES,
  hasRole,
  requireRole,
  sanitizePostgrestSearch,
  type AdminSession,
  type UserRole
} from '@ekalliptus/core'
import { applyAdminSecurityHeaders } from '../../../admin/app/lib/security-headers'

const makeSession = (role: UserRole): AdminSession => ({
  user: { id: `user-${role}`, email: `${role}@ekalliptus.com` } as AdminSession['user'],
  role,
  displayName: role.toUpperCase()
})

describe('Admin RBAC fail-closed & role matrix (APP-WEB-02)', () => {
  it('validates known roles and rejects unknown or empty roles', () => {
    expect(VALID_USER_ROLES.has('owner')).toBe(true)
    expect(VALID_USER_ROLES.has('admin')).toBe(true)
    expect(VALID_USER_ROLES.has('editor')).toBe(true)
    expect(VALID_USER_ROLES.has('cs')).toBe(true)
    expect(hasRole(makeSession('' as UserRole), ADMIN_BLOG_ROLES)).toBe(false)
    expect(hasRole(makeSession('guest' as UserRole), ADMIN_ORDER_ROLES)).toBe(false)
    expect(requireRole(null, ADMIN_BLOG_ROLES)).toBeNull()
    expect(requireRole(makeSession('unknown' as UserRole), ['admin'])).toBeNull()
  })

  it('always allows owner and admin across all operational role matrices', () => {
    const matrices = [
      ADMIN_BLOG_ROLES,
      ADMIN_ORDER_ROLES,
      ADMIN_CUSTOMER_ROLES,
      ADMIN_LEAD_ROLES,
      ADMIN_LEAD_DELETE_ROLES,
      ADMIN_CONSULTATION_ROLES,
      ADMIN_AUDIT_ROLES
    ]
    for (const allowed of matrices) {
      expect(requireRole(makeSession('owner'), allowed)).not.toBeNull()
      expect(requireRole(makeSession('admin'), allowed)).not.toBeNull()
    }
  })

  it('isolates editor role strictly to blog and blocks orders, customers, leads, consultations, and audit logs', () => {
    const editor = makeSession('editor')
    expect(requireRole(editor, ADMIN_BLOG_ROLES)).not.toBeNull()
    expect(requireRole(editor, ADMIN_ORDER_ROLES)).toBeNull()
    expect(requireRole(editor, ADMIN_CUSTOMER_ROLES)).toBeNull()
    expect(requireRole(editor, ADMIN_LEAD_ROLES)).toBeNull()
    expect(requireRole(editor, ADMIN_LEAD_DELETE_ROLES)).toBeNull()
    expect(requireRole(editor, ADMIN_CONSULTATION_ROLES)).toBeNull()
    expect(requireRole(editor, ADMIN_AUDIT_ROLES)).toBeNull()
  })

  it('allows cs on consultations, orders, customers, and leads while blocking blog, audit, and lead delete', () => {
    const cs = makeSession('cs')
    expect(requireRole(cs, ADMIN_CONSULTATION_ROLES)).not.toBeNull()
    expect(requireRole(cs, ADMIN_ORDER_ROLES)).not.toBeNull()
    expect(requireRole(cs, ADMIN_CUSTOMER_ROLES)).not.toBeNull()
    expect(requireRole(cs, ADMIN_LEAD_ROLES)).not.toBeNull()
    expect(requireRole(cs, ADMIN_BLOG_ROLES)).toBeNull()
    expect(requireRole(cs, ADMIN_LEAD_DELETE_ROLES)).toBeNull()
    expect(requireRole(cs, ADMIN_AUDIT_ROLES)).toBeNull()
  })

  it('removes fail-open admin role fallback from packages/core/src/admin/auth.ts', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
    const authSrc = fs.readFileSync(path.join(repoRoot, 'packages/core/src/admin/auth.ts'), 'utf8')
    expect(authSrc).not.toMatch(/\?\?\s*['"]admin['"]/)
  })
})

describe('PostgREST search sanitizer (APP-WEB-04)', () => {
  it('strips filter-injection metacharacters and truncates long strings', () => {
    expect(sanitizePostgrestSearch('budi,id.neq.0000*()%\\')).toBe('budi id.neq.0000')
    expect(sanitizePostgrestSearch('x'.repeat(120)).length).toBe(80)
  })
})

describe('Admin Worker security headers (INFRA-01)', () => {
  it('injects strict security headers while preserving status and Set-Cookie headers', () => {
    const baseHeaders = new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      Location: '/admin'
    })
    baseHeaders.append('Set-Cookie', 'admin_session=tok1; Path=/; HttpOnly; SameSite=Lax; Secure')
    baseHeaders.append('Set-Cookie', 'pref=dark; Path=/; Secure')

    const secured = applyAdminSecurityHeaders(new Response('ok', { status: 302, headers: baseHeaders }))
    expect(secured.status).toBe(302)
    expect(secured.headers.get('Location')).toBe('/admin')
    expect(secured.headers.get('X-Frame-Options')).toBe('DENY')
    expect(secured.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(secured.headers.get('Strict-Transport-Security')).toContain('max-age=31536000')
    expect(secured.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(secured.headers.get('Permissions-Policy')).toContain('camera=()')
    expect(secured.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
    expect(secured.headers.get('Cache-Control')).toBe('no-store')
    expect(secured.headers.get('Set-Cookie')).toContain('admin_session=tok1')
    expect(secured.headers.get('Set-Cookie')).toContain('pref=dark')
  })

  it('preserves immutable cache-control on fingerprinted static assets', () => {
    const assetRes = new Response('js', {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }
    })
    const secured = applyAdminSecurityHeaders(assetRes)
    expect(secured.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(secured.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})

describe('Edge webhook & RLS migration guards (APP-WEB-01, INFRA-02)', () => {
  it('requires ORDER_WEBHOOK_SECRET and DB verification in order-webhook without raw error echo', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
    const webhookSrc = fs.readFileSync(
      path.join(repoRoot, 'supabase/functions/order-webhook/index.ts'),
      'utf8'
    )
    expect(webhookSrc).toContain('ORDER_WEBHOOK_SECRET')
    expect(webhookSrc).toContain('x-webhook-secret')
    expect(webhookSrc).toContain('timingSafeEqual')
    expect(webhookSrc).toContain(".from('orders')")
    expect(webhookSrc).not.toMatch(/error:\s*String\(err\)/)
  })

  it('enables RLS on public.order_sync_failures in new migration', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
    const migSql = fs.readFileSync(
      path.join(repoRoot, 'supabase/migrations/20261124000001_enable_rls_order_sync_failures.sql'),
      'utf8'
    )
    expect(migSql).toMatch(/ALTER TABLE IF EXISTS public\.order_sync_failures ENABLE ROW LEVEL SECURITY/i)
    expect(migSql).toMatch(/REVOKE ALL ON TABLE public\.order_sync_failures FROM anon, authenticated/i)
  })
})
