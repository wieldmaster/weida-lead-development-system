import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { LeadCommunicationInput, LeadPoolRecord, UserProfile } from '../types'
import { canManageTeam, getProfileDisplayName } from './userProfileService'

type LeadCommunicationSummary = {
  lead_id: string
  user_name: string | null
  created_at: string
}

type LeadPoolView = 'mine' | 'public' | 'team'

type LeadPoolFetchOptions = {
  profile: UserProfile | null
  view: LeadPoolView
}

const leadPoolSelectColumns = [
  'id',
  'company_name',
  'contact_name',
  'email',
  'phone',
  'whatsapp',
  'country',
  'region',
  'website',
  'product_keywords',
  'customer_type',
  'source_type',
  'source_detail',
  'development_level',
  'priority_score',
  'status',
  'owner_user_id',
  'owner_name',
  'assigned_at',
  'assigned_by',
  'claim_status',
  'last_activity_at',
  'next_followup_at',
  'created_at',
].join(', ')

export async function fetchLeadPoolRecords(
  options?: LeadPoolFetchOptions,
): Promise<{ records: LeadPoolRecord[]; error?: string; usedMock: boolean }> {
  if (!isSupabaseConfigured) {
    return { records: [], error: '请先配置 Supabase 环境变量', usedMock: true }
  }

  try {
    const client = getSupabaseClient()
    const buildQuery = () => client
      .from('leads')
      .select(leadPoolSelectColumns)
      .order('created_at', { ascending: false })

    let query = buildQuery()

    if (options?.view === 'mine' && options.profile?.user_id) {
      query = query.eq('owner_user_id', options.profile.user_id)
    } else if (options?.view === 'public') {
      const [unassignedResult, publicStatusResult] = await Promise.all([
        buildQuery().is('owner_user_id', null),
        buildQuery().eq('claim_status', '公海'),
      ])
      const publicError = unassignedResult.error ?? publicStatusResult.error
      if (publicError) {
        return { records: [], error: formatPoolError(publicError.message), usedMock: true }
      }
      const unassignedRows = (unassignedResult.data as unknown as LeadPoolRecord[] | null) ?? []
      const publicStatusRows = (publicStatusResult.data as unknown as LeadPoolRecord[] | null) ?? []
      const mergedRecords = mergeLeadRows(unassignedRows, publicStatusRows)
      await attachLastCommunication(mergedRecords)
      return { records: mergedRecords, usedMock: false }
    } else if (options?.view === 'team' && !canManageTeam(options.profile ?? null)) {
      query = query.eq('owner_user_id', options.profile?.user_id ?? '')
    }

    const { data, error } = await query

    if (error) {
      return { records: [], error: formatPoolError(error.message), usedMock: true }
    }

    const records = normalizeLeadRows((data as unknown) as LeadPoolRecord[] | null)
    await attachLastCommunication(records)
    return { records, usedMock: false }
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? formatPoolError(error.message) : '读取客户池失败',
      usedMock: true,
    }
  }
}

function normalizeLeadRows(rows: LeadPoolRecord[] | null): LeadPoolRecord[] {
  return (rows ?? []).map((record) => ({
    ...record,
    claim_status: record.claim_status || (record.owner_user_id ? '已分配' : '公海'),
  }))
}

function mergeLeadRows(
  primaryRows: LeadPoolRecord[] | null,
  secondaryRows: LeadPoolRecord[] | null,
): LeadPoolRecord[] {
  const merged = new Map<string, LeadPoolRecord>()
  ;[...(primaryRows ?? []), ...(secondaryRows ?? [])].forEach((record) => {
    merged.set(record.id, {
      ...record,
      claim_status: record.claim_status || (record.owner_user_id ? '已分配' : '公海'),
    })
  })
  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
    return rightTime - leftTime
  })
}

export async function claimLead(record: LeadPoolRecord, profile: UserProfile): Promise<{ record?: LeadPoolRecord; error?: string }> {
  if (record.owner_user_id && record.owner_user_id !== profile.user_id && !canManageTeam(profile)) {
    return { error: '该客户已有负责人，普通业务员不能领取。' }
  }

  const ownerName = getProfileDisplayName(profile)
  return updateLeadOwnership(record.id, {
    owner_user_id: profile.user_id,
    owner_name: ownerName,
    assigned_at: new Date().toISOString(),
    assigned_by: profile.user_id,
    claim_status: '已分配',
    status: '待开发',
  }, {
    profile,
    contact_method: '系统',
    contact_result: '领取客户',
    next_action: '首轮开发',
    content: `${ownerName} 领取客户到本人客户池。`,
  })
}

export async function assignLead(
  leadId: string,
  targetProfile: UserProfile,
  currentProfile: UserProfile,
): Promise<{ record?: LeadPoolRecord; error?: string }> {
  if (!canManageTeam(currentProfile)) {
    return { error: '只有管理员或经理可以分配客户。' }
  }

  const ownerName = getProfileDisplayName(targetProfile)
  return updateLeadOwnership(leadId, {
    owner_user_id: targetProfile.user_id,
    owner_name: ownerName,
    assigned_at: new Date().toISOString(),
    assigned_by: currentProfile.user_id,
    claim_status: '已分配',
    status: '待开发',
  }, {
    profile: currentProfile,
    contact_method: '系统',
    contact_result: '分配客户',
    next_action: '首轮开发',
    content: `${getProfileDisplayName(currentProfile)} 将客户分配给 ${ownerName}。`,
  })
}

export async function releaseLead(record: LeadPoolRecord, profile: UserProfile): Promise<{ record?: LeadPoolRecord; error?: string }> {
  const canReleaseOwn = record.owner_user_id === profile.user_id && record.claim_status !== '已成交'
  if (!canManageTeam(profile) && !canReleaseOwn) {
    return { error: '普通业务员只能释放自己负责且未成交的客户。' }
  }

  return updateLeadOwnership(record.id, {
    owner_user_id: null,
    owner_name: null,
    assigned_at: null,
    assigned_by: profile.user_id,
    claim_status: '公海',
  }, {
    profile,
    contact_method: '系统',
    contact_result: '释放到公海',
    next_action: '待重新分配',
    content: `${getProfileDisplayName(profile)} 将客户释放到公海。`,
  })
}

export async function createLeadCommunication(
  input: LeadCommunicationInput,
  profile: UserProfile,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const now = new Date().toISOString()
    const { error } = await client.from('lead_communications').insert({
      lead_id: input.lead_id,
      user_id: profile.user_id,
      user_name: getProfileDisplayName(profile),
      contact_method: input.contact_method || '其他',
      channel: normalizeCommunicationChannel(input.contact_method),
      direction: 'outbound',
      communication_status: 'sent',
      contact_result: input.contact_result || null,
      next_action: input.next_action || null,
      next_followup_at: input.next_followup_at || null,
      content: input.content || null,
      sent_at: now,
      created_by: profile.user_id,
    })

    if (error) {
      return { error: formatPoolError(error.message) }
    }

    if (input.contact_method === '系统') {
      return {}
    }

    const { error: updateError } = await client
      .from('leads')
      .update({
        last_activity_at: now,
        next_followup_at: input.next_followup_at || null,
        claim_status: input.contact_result === '已成交' ? '已成交' : '跟进中',
      })
      .eq('id', input.lead_id)

    return updateError ? { error: formatPoolError(updateError.message) } : {}
  } catch (error) {
    return { error: error instanceof Error ? formatPoolError(error.message) : '保存沟通记录失败' }
  }
}

async function updateLeadOwnership(
  leadId: string,
  payload: Partial<LeadPoolRecord>,
  communication: {
    profile: UserProfile
    contact_method: string
    contact_result: string
    next_action: string
    content: string
  },
): Promise<{ record?: LeadPoolRecord; error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('leads')
      .update(payload)
      .eq('id', leadId)
      .select(
        'id, company_name, contact_name, email, phone, whatsapp, country, region, website, product_keywords, customer_type, source_type, source_detail, development_level, priority_score, status, owner_user_id, owner_name, assigned_at, assigned_by, claim_status, last_activity_at, next_followup_at, created_at',
      )
      .single()

    if (error || !data) {
      return { error: formatPoolError(error?.message ?? '更新客户归属失败') }
    }

    await createLeadCommunication(
      {
        lead_id: leadId,
        contact_method: communication.contact_method,
        contact_result: communication.contact_result,
        next_action: communication.next_action,
        next_followup_at: '',
        content: communication.content,
      },
      communication.profile,
    )

    return { record: data as LeadPoolRecord }
  } catch (error) {
    return { error: error instanceof Error ? formatPoolError(error.message) : '更新客户归属失败' }
  }
}

async function attachLastCommunication(records: LeadPoolRecord[]) {
  const leadIds = records.map((record) => record.id)
  if (leadIds.length === 0) {
    return
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('lead_communications')
      .select('lead_id, user_name, created_at')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) {
      return
    }

    const byLeadId = new Map<string, LeadCommunicationSummary>()
    for (const row of (data as LeadCommunicationSummary[] | null) ?? []) {
      if (!byLeadId.has(row.lead_id)) {
        byLeadId.set(row.lead_id, row)
      }
    }

    records.forEach((record) => {
      const summary = byLeadId.get(record.id)
      if (summary) {
        record.last_communication_user_name = summary.user_name
        record.last_communication_at = summary.created_at
      }
    })
  } catch {
    // 沟通摘要失败不影响客户池主数据展示。
  }
}

function normalizeCommunicationChannel(value: string): string {
  if (value === '电话') return 'phone'
  if (value === 'WhatsApp') return 'whatsapp'
  if (value === '会议') return 'meeting'
  if (value === '邮件') return 'email'
  return 'other'
}

function formatPoolError(message: string): string {
  if (/relation .* does not exist|column .* does not exist/i.test(message)) {
    return '数据库表或字段不存在，请先执行最新 migration。'
  }
  if (/permission denied|row-level security/i.test(message)) {
    return 'Supabase 权限不足，请检查 RLS 策略。'
  }
  return message
}
