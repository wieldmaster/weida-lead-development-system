import type { User } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { UserProfile, UserRole } from '../types'

type UserProfileRow = Omit<UserProfile, 'role'> & { role: string | null }

export function getProfileDisplayName(profile: UserProfile | null, fallbackEmail?: string | null): string {
  return profile?.display_name || profile?.full_name || profile?.email || fallbackEmail || '未命名用户'
}

export function canManageTeam(profile: UserProfile | null): boolean {
  return profile?.role === 'admin' || profile?.role === 'manager'
}

export async function fetchCurrentUserProfile(user: User): Promise<{ profile: UserProfile | null; error?: string }> {
  if (!isSupabaseConfigured) {
    return { profile: null, error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('user_profiles')
      .select('id, user_id, full_name, display_name, email, role, department, is_active, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return { profile: buildFallbackProfile(user), error: formatProfileError(error.message) }
    }

    if (data) {
      return { profile: mapProfileRow(data as UserProfileRow) }
    }

    const fallback = buildFallbackProfile(user)
    const { data: inserted, error: insertError } = await client
      .from('user_profiles')
      .insert({
        user_id: user.id,
        email: user.email ?? '',
        full_name: getMetadataFullName(user),
        display_name: getMetadataFullName(user) || user.email,
        role: user.email?.toLowerCase() === 'elan.xing@wieldmaster.com' ? 'admin' : 'sales',
      })
      .select('id, user_id, full_name, display_name, email, role, department, is_active, created_at, updated_at')
      .single()

    if (insertError || !inserted) {
      return { profile: fallback, error: formatProfileError(insertError?.message ?? '创建用户资料失败') }
    }

    return { profile: mapProfileRow(inserted as UserProfileRow) }
  } catch (error) {
    return {
      profile: buildFallbackProfile(user),
      error: error instanceof Error ? formatProfileError(error.message) : '读取用户资料失败',
    }
  }
}

export async function fetchAssignableProfiles(): Promise<{ profiles: UserProfile[]; error?: string }> {
  if (!isSupabaseConfigured) {
    return { profiles: [], error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('user_profiles')
      .select('id, user_id, full_name, display_name, email, role, department, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('display_name', { ascending: true })

    if (error) {
      return { profiles: [], error: formatProfileError(error.message) }
    }

    return { profiles: ((data as UserProfileRow[] | null) ?? []).map(mapProfileRow) }
  } catch (error) {
    return { profiles: [], error: error instanceof Error ? formatProfileError(error.message) : '读取业务员列表失败' }
  }
}

function getMetadataFullName(user: User): string {
  const value = user.user_metadata?.full_name
  return typeof value === 'string' ? value.trim() : ''
}

function buildFallbackProfile(user: User): UserProfile {
  const now = new Date().toISOString()
  const fullName = getMetadataFullName(user)
  return {
    id: user.id,
    user_id: user.id,
    full_name: fullName || null,
    display_name: fullName || user.email || '当前用户',
    email: user.email ?? null,
    role: user.email?.toLowerCase() === 'elan.xing@wieldmaster.com' ? 'admin' : 'sales',
    department: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  }
}

function mapProfileRow(row: UserProfileRow): UserProfile {
  return {
    ...row,
    role: normalizeRole(row.role),
  }
}

function normalizeRole(value: string | null): UserRole {
  if (value === 'admin' || value === 'manager') {
    return value
  }
  return 'sales'
}

function formatProfileError(message: string): string {
  if (/relation .* does not exist|column .* does not exist/i.test(message)) {
    return '用户资料表或字段不存在，请先执行最新 migration。'
  }
  if (/permission denied|row-level security/i.test(message)) {
    return 'Supabase 用户资料权限不足，请检查 RLS 策略。'
  }
  return message
}
