import type { User } from '@supabase/supabase-js'
import { getSupabase } from '../supabase'
import type { UserRole } from '../types'

export const ADMIN_COOKIE_NAME = 'admin_session'

export const VALID_USER_ROLES: ReadonlySet<UserRole> = new Set([
  'owner',
  'admin',
  'finance',
  'cs',
  'tech',
  'editor'
])

export const ADMIN_BLOG_ROLES: UserRole[] = ['admin', 'editor']
export const ADMIN_ORDER_ROLES: UserRole[] = ['admin', 'finance', 'cs', 'tech']
export const ADMIN_CUSTOMER_ROLES: UserRole[] = ['admin', 'finance', 'cs', 'tech']
export const ADMIN_LEAD_ROLES: UserRole[] = ['admin', 'finance', 'cs', 'tech']
export const ADMIN_LEAD_DELETE_ROLES: UserRole[] = ['admin']
export const ADMIN_CONSULTATION_ROLES: UserRole[] = ['admin', 'cs']
export const ADMIN_AUDIT_ROLES: UserRole[] = ['admin']

export function sanitizePostgrestSearch(raw: string): string {
  return raw.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export function parseSessionCookie(header: string | null): string | null {
  if (!header) return null
  const parts = header.split(/;\s*/)
  for (const part of parts) {
    const [name, ...rest] = part.split('=')
    if (name === ADMIN_COOKIE_NAME) return rest.join('=') || null
  }
  return null
}

export interface AdminSession {
  user: User
  role: UserRole
  displayName: string
}

export async function getAdminSession(cookieHeader: string | null): Promise<AdminSession | null> {
  // Wrap entirely so a thrown Supabase/network error doesn't bubble up.
  // A null session redirects to login, which is the safe fallback.
  try {
    const token = parseSessionCookie(cookieHeader)
    if (!token) return null

    const supabase = getSupabase(true)
    if (!supabase) return null

    const { data: userData, error } = await supabase.auth.getUser(token)
    if (error || !userData.user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, display_name')
      .eq('user_id', userData.user.id)
      .single()

    if (!profile || !profile.role || !VALID_USER_ROLES.has(profile.role as UserRole)) {
      console.error('[getAdminSession] Invalid or missing profile role:', profile?.role)
      return null
    }

    return {
      user: userData.user,
      role: profile.role as UserRole,
      displayName: profile.display_name
    }
  } catch (err) {
    console.error('[getAdminSession] Unhandled error:', err instanceof Error ? err.stack : err)
    return null
  }
}

export function hasRole(session: AdminSession, allowed: UserRole[]): boolean {
  if (!VALID_USER_ROLES.has(session.role)) return false
  if (session.role === 'owner') return true
  return allowed.includes(session.role)
}

/**
 * Gate a loader/action on a role set: returns the session when it carries one
 * of the allowed roles (owner is always allowed), null otherwise.
 */
export function requireRole(session: AdminSession | null, allowed: UserRole[]): AdminSession | null {
  if (!session) return null
  return hasRole(session, allowed) ? session : null
}
