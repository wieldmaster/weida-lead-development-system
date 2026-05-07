import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { LeadPoolRecord } from '../types'

export async function fetchLeadPoolRecords(): Promise<{ records: LeadPoolRecord[]; error?: string; usedMock: boolean }> {
  if (!isSupabaseConfigured) {
    return { records: [], error: '请先配置 Supabase 环境变量', usedMock: true }
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('leads')
      .select(
        'id, company_name, contact_name, email, phone, whatsapp, country, region, website, product_keywords, customer_type, source_type, source_detail, development_level, priority_score, status, created_at',
      )
      .order('created_at', { ascending: false })

    if (error) {
      return { records: [], error: formatPoolError(error.message), usedMock: true }
    }

    return { records: (data as LeadPoolRecord[] | null) ?? [], usedMock: false }
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? formatPoolError(error.message) : '读取客户池失败',
      usedMock: true,
    }
  }
}

function formatPoolError(message: string): string {
  if (/relation .* does not exist|column .* does not exist/i.test(message)) {
    return '数据库表或字段不存在，请先执行最新 migration。'
  }
  return message
}
