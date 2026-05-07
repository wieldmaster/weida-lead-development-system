import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { LeadSelectOption, LeadTaskInput, LeadTaskPriority, LeadTaskRecord, LeadTaskStatus } from '../types'

type TaskRow = {
  id: string
  lead_id: string | null
  task_type: string | null
  task_title?: string | null
  title?: string | null
  task_description?: string | null
  notes?: string | null
  due_date: string | null
  status: string | null
  priority: string | null
  owner_name?: string | null
  created_at: string
  updated_at: string
  leads?: { company_name?: string | null } | Array<{ company_name?: string | null }> | null
}

export async function fetchTasks(): Promise<{ tasks: LeadTaskRecord[]; error?: string }> {
  if (!isSupabaseConfigured) {
    return { tasks: [], error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('lead_tasks')
      .select(
        'id, lead_id, task_type, task_title, title, task_description, notes, due_date, status, priority, owner_name, created_at, updated_at, leads(company_name)',
      )
      .order('created_at', { ascending: false })

    if (error) {
      return { tasks: [], error: formatTaskError(error.message) }
    }

    return { tasks: ((data as TaskRow[] | null) ?? []).map(mapTaskRow) }
  } catch (error) {
    return { tasks: [], error: error instanceof Error ? formatTaskError(error.message) : '读取跟进任务失败' }
  }
}

export async function fetchLeadsForTaskSelect(): Promise<{ leads: LeadSelectOption[]; error?: string }> {
  if (!isSupabaseConfigured) {
    return { leads: [], error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('leads')
      .select('id, company_name, contact_name, email, phone, whatsapp, country, region, customer_type, product_keywords')
      .order('company_name', { ascending: true })
      .limit(2000)

    if (error) {
      return { leads: [], error: formatTaskError(error.message) }
    }

    return { leads: (data as LeadSelectOption[] | null) ?? [] }
  } catch (error) {
    return { leads: [], error: error instanceof Error ? formatTaskError(error.message) : '读取客户列表失败' }
  }
}

export async function createTask(input: LeadTaskInput): Promise<{ task?: LeadTaskRecord; error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const payload = buildTaskPayload(input)
    const { data, error } = await client.from('lead_tasks').insert(payload).select('*, leads(company_name)').single()

    if (error || !data) {
      return { error: formatTaskError(error?.message ?? '新建任务失败') }
    }

    return { task: mapTaskRow(data as TaskRow) }
  } catch (error) {
    return { error: error instanceof Error ? formatTaskError(error.message) : '新建任务失败' }
  }
}

export async function updateTask(id: string, input: LeadTaskInput): Promise<{ task?: LeadTaskRecord; error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const payload = buildTaskPayload(input)
    const { data, error } = await client.from('lead_tasks').update(payload).eq('id', id).select('*, leads(company_name)').single()

    if (error || !data) {
      return { error: formatTaskError(error?.message ?? '保存任务失败') }
    }

    return { task: mapTaskRow(data as TaskRow) }
  } catch (error) {
    return { error: error instanceof Error ? formatTaskError(error.message) : '保存任务失败' }
  }
}

export async function markTaskInvalid(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const { error } = await client.from('lead_tasks').update({ status: 'invalid' }).eq('id', id)
    return error ? { error: formatTaskError(error.message) } : {}
  } catch (error) {
    return { error: error instanceof Error ? formatTaskError(error.message) : '标记任务无效失败' }
  }
}

function buildTaskPayload(input: LeadTaskInput) {
  return {
    lead_id: input.lead_id || null,
    task_type: input.task_type,
    task_title: input.task_title,
    title: input.task_title,
    task_description: input.task_description || null,
    notes: input.task_description || null,
    due_date: input.due_date || null,
    status: input.status,
    priority: input.priority,
    owner_name: input.owner_name || null,
  }
}

function mapTaskRow(row: TaskRow): LeadTaskRecord {
  const relatedLead = Array.isArray(row.leads) ? row.leads[0] : row.leads
  return {
    id: row.id,
    lead_id: row.lead_id,
    lead_company_name: relatedLead?.company_name || '未关联客户',
    task_type: row.task_type || '其他',
    task_title: row.task_title || row.title || '未命名任务',
    task_description: row.task_description ?? row.notes ?? null,
    due_date: row.due_date,
    status: normalizeTaskStatus(row.status),
    priority: normalizePriority(row.priority),
    owner_name: row.owner_name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function normalizeTaskStatus(value: string | null): LeadTaskStatus {
  if (value === 'in_progress' || value === 'completed' || value === 'paused' || value === 'invalid') {
    return value
  }
  if (value === 'skipped') {
    return 'paused'
  }
  return 'pending'
}

function normalizePriority(value: string | null): LeadTaskPriority {
  if (value === 'low' || value === 'high' || value === 'urgent') {
    return value
  }
  return 'medium'
}

function formatTaskError(message: string): string {
  if (/relation .* does not exist|column .* does not exist/i.test(message)) {
    return '数据库表或字段不存在，请先执行最新 migration。'
  }
  if (/permission denied|row-level security/i.test(message)) {
    return 'Supabase 权限不足，请检查 RLS 策略。'
  }
  return message
}
