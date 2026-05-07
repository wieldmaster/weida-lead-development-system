import { getSupabaseClient } from '../lib/supabase'
import type { ColumnMapping, ImportProgress, ImportSheetPreview, LeadImportResult, NormalizedLeadRow } from '../types'
import { displayWebsite } from '../utils/leadImport'

type LeadInsertPayload = {
  batch_id: string
  company_name: string
  normalized_company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  normalized_phone: string | null
  fax: string | null
  whatsapp: string | null
  country: string | null
  region: string | null
  city: string | null
  website: string | null
  address: string | null
  product_keywords: string | null
  customer_type: string | null
  source_type: string
  source_detail: string | null
  development_level: string
  priority_score: number
  status: string
  raw_payload: Record<string, unknown>
}

type LeadRecord = LeadInsertPayload & {
  id: string
}

type ImportLeadOptions = {
  fileName: string
  sourceType: string
  sheet: ImportSheetPreview
  onProgress?: (progress: ImportProgress) => void
}

const levelRank: Record<string, number> = {
  'A+': 6,
  A: 5,
  'B+': 4,
  B: 3,
  C: 2,
  D: 1,
}

const importChunkSize = 200
const fetchPageSize = 1000

type ImportRowStatus = 'imported' | 'updated' | 'skipped' | 'duplicate' | 'error'

type LeadLookupMaps = {
  byEmail: Map<string, LeadRecord>
  byDomain: Map<string, LeadRecord>
  byCompanyLocation: Map<string, LeadRecord>
}

type PreparedImportRow = {
  row: NormalizedLeadRow
  payload?: LeadInsertPayload
  existing?: LeadRecord
  leadId?: string
  importStatus: ImportRowStatus
  errorMessage?: string
}

export async function importLeadListSheet(options: ImportLeadOptions): Promise<LeadImportResult> {
  const client = getSupabaseClient()
  const result: LeadImportResult = {
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    duplicateCount: 0,
    errorCount: 0,
    errors: [],
  }

  if (options.sheet.sheetType !== 'lead_list') {
    throw new Error('当前选择的 sheet 不是客户明细表，不能导入客户池。')
  }

  const reportProgress = createProgressReporter(options.onProgress)

  reportProgress({
    phase: 'creating_batch',
    label: '正在创建导入批次',
    current: 0,
    total: Math.max(options.sheet.rows.length, 1),
    percent: 5,
    detail: options.sheet.sheetName,
  })

  const now = new Date()
  const baseSummary = {
    sheetName: options.sheet.sheetName,
    sheetType: options.sheet.sheetType,
    mappings: options.sheet.mappings.map((mapping) => ({
      originalColumn: mapping.originalColumn,
      standardField: mapping.standardField,
      confidence: mapping.confidence,
      isDuplicate: mapping.isDuplicate,
    })),
    stats: options.sheet.stats,
    suspectedDuplicates: [],
  }
  const batchPayload = {
    batch_name: `${options.fileName} ${now.toLocaleString('zh-CN')}`,
    file_name: options.fileName,
    original_filename: options.fileName,
    source_type: options.sourceType,
    total_rows: options.sheet.stats.rawDataRows,
    valid_rows: options.sheet.stats.validRows,
    skipped_rows: options.sheet.stats.skippedRows,
    duplicate_rows: options.sheet.stats.duplicateRows,
    imported_rows: 0,
    status: 'validating',
    mapping_confidence: options.sheet.stats.averageConfidence,
    import_summary_json: baseSummary,
    field_mapping: buildFieldMappingJson(options.sheet.mappings),
  }

  const { data: batch, error: batchError } = await client
    .from('lead_import_batches')
    .insert(batchPayload)
    .select('id')
    .single()

  if (batchError || !batch) {
    throw new Error(formatSupabaseError(batchError?.message ?? '创建导入批次失败'))
  }

  result.batchId = batch.id as string

  try {
    reportProgress({
      phase: 'importing_rows',
      label: '正在建立去重索引',
      current: 0,
      total: Math.max(options.sheet.rows.length, 1),
      percent: 8,
      detail: '正在读取已有客户',
    })
    const leadMaps = await fetchExistingLeadMaps()
    const totalRows = Math.max(options.sheet.rows.length, 1)

    for (let start = 0; start < options.sheet.rows.length; start += importChunkSize) {
      const chunk = options.sheet.rows.slice(start, start + importChunkSize)
      const processedRows = Math.min(start + chunk.length, totalRows)
      reportProgress({
        phase: 'importing_rows',
        label: '正在分批写入客户数据',
        current: processedRows,
        total: totalRows,
        percent: Math.round(10 + (processedRows / totalRows) * 82),
        detail: `第 ${chunk[0]?.rowNumber ?? start + 1} - ${chunk[chunk.length - 1]?.rowNumber ?? processedRows} 行`,
      })

      await importRowsChunk({
        batchId: result.batchId,
        rows: chunk,
        sheetName: options.sheet.sheetName,
        sourceType: options.sourceType,
        mappingConfidence: options.sheet.stats.averageConfidence,
        leadMaps,
        result,
      })
    }

    reportProgress({
      phase: 'finalizing',
      label: '正在更新导入批次统计',
      current: totalRows,
      total: totalRows,
      percent: 96,
      detail: '正在写入导入结果',
    })

    await updateBatchSummary(result.batchId, result, baseSummary)

    reportProgress({
      phase: 'completed',
      label: '导入完成',
      current: totalRows,
      total: totalRows,
      percent: 100,
      detail: `新增 ${result.insertedCount}，更新 ${result.updatedCount}，跳过 ${result.skippedCount}`,
    })

    return result
  } catch (error) {
    const message = formatSupabaseError(error instanceof Error ? error.message : '导入过程已中断')
    result.errorCount += 1
    result.errors.push(message)
    await updateBatchSummary(result.batchId, result, baseSummary, 'failed')
    throw new Error(message, { cause: error })
  }
}

function createProgressReporter(onProgress?: (progress: ImportProgress) => void) {
  return (progress: Omit<ImportProgress, 'percent'> & { percent?: number }) => {
    if (!onProgress) {
      return
    }
    const percent =
      progress.percent ??
      (progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : progress.current > 0 ? 100 : 0)
    onProgress({
      ...progress,
      percent: Math.max(0, Math.min(100, percent)),
    })
  }
}

async function importRowsChunk({
  batchId,
  rows,
  sheetName,
  sourceType,
  mappingConfidence,
  leadMaps,
  result,
}: {
  batchId: string
  rows: NormalizedLeadRow[]
  sheetName: string
  sourceType: string
  mappingConfidence: number
  leadMaps: LeadLookupMaps
  result: LeadImportResult
}) {
  const client = getSupabaseClient()
  const preparedRows = rows.map((row): PreparedImportRow => {
    if (row.status === 'skipped' || !hasLeadIdentity(row)) {
      return {
        row,
        importStatus: 'skipped',
        errorMessage: row.issues.join('；') || '缺少公司名、邮箱、电话或网站。',
      }
    }

    const payload = buildLeadPayload(batchId, row, sourceType)
    const existing = findExistingLeadInMaps(payload, leadMaps)
    return {
      row,
      payload,
      existing: existing ?? undefined,
      importStatus: existing ? 'updated' : 'imported',
    }
  })

  await insertNewLeads(client, preparedRows, leadMaps)
  await updateExistingLeads(client, preparedRows, leadMaps)
  await insertImportRows({
    batchId,
    sheetName,
    mappingConfidence,
    preparedRows,
  })

  for (const prepared of preparedRows) {
    if (prepared.importStatus === 'imported') {
      result.insertedCount += 1
    } else if (prepared.importStatus === 'updated') {
      result.updatedCount += 1
      result.duplicateCount += 1
    } else if (prepared.importStatus === 'skipped') {
      result.skippedCount += 1
    } else if (prepared.importStatus === 'error') {
      result.errorCount += 1
      result.errors.push(prepared.errorMessage || `第 ${prepared.row.rowNumber} 行导入失败`)
    }
  }
}

async function insertNewLeads(client: ReturnType<typeof getSupabaseClient>, preparedRows: PreparedImportRow[], leadMaps: LeadLookupMaps) {
  const rowsToInsert = preparedRows.filter((row) => row.importStatus === 'imported' && row.payload)
  if (rowsToInsert.length === 0) {
    return
  }

  const { data, error } = await client
    .from('leads')
    .insert(rowsToInsert.map((row) => row.payload as LeadInsertPayload))
    .select('*')

  if (error) {
    await insertNewLeadsOneByOne(client, rowsToInsert, leadMaps, error.message)
    return
  }

  const insertedRows = (data as LeadRecord[] | null) ?? []
  insertedRows.forEach((lead, index) => {
    const prepared = rowsToInsert[index]
    prepared.leadId = lead.id
    addLeadToMaps(leadMaps, lead)
  })
}

async function insertNewLeadsOneByOne(
  client: ReturnType<typeof getSupabaseClient>,
  rowsToInsert: PreparedImportRow[],
  leadMaps: LeadLookupMaps,
  fallbackMessage: string,
) {
  for (const prepared of rowsToInsert) {
    if (!prepared.payload) {
      continue
    }
    const { data, error } = await client.from('leads').insert(prepared.payload).select('*').single()
    if (error || !data) {
      prepared.importStatus = 'error'
      prepared.errorMessage = formatSupabaseError(error?.message ?? fallbackMessage)
      continue
    }
    const lead = data as LeadRecord
    prepared.leadId = lead.id
    addLeadToMaps(leadMaps, lead)
  }
}

async function updateExistingLeads(client: ReturnType<typeof getSupabaseClient>, preparedRows: PreparedImportRow[], leadMaps: LeadLookupMaps) {
  for (const prepared of preparedRows) {
    if (prepared.importStatus !== 'updated' || !prepared.existing || !prepared.payload) {
      continue
    }

    const updatePayload = mergeLeadPayload(prepared.existing, prepared.payload)
    const { data, error } = await client.from('leads').update(updatePayload).eq('id', prepared.existing.id).select('*').single()
    if (error || !data) {
      prepared.importStatus = 'error'
      prepared.errorMessage = formatSupabaseError(error?.message ?? '更新客户失败')
      continue
    }

    const updatedLead = data as LeadRecord
    prepared.leadId = updatedLead.id
    addLeadToMaps(leadMaps, updatedLead)
  }
}

async function insertImportRows({
  batchId,
  sheetName,
  mappingConfidence,
  preparedRows,
}: {
  batchId: string
  sheetName: string
  mappingConfidence: number
  preparedRows: PreparedImportRow[]
}) {
  const client = getSupabaseClient()
  const payload = preparedRows.map((prepared) => ({
    batch_id: batchId,
    lead_id: prepared.leadId ?? prepared.existing?.id ?? null,
    matched_lead_id: prepared.leadId ?? prepared.existing?.id ?? null,
    row_number: prepared.row.rowNumber,
    sheet_name: sheetName,
    raw_row_json: prepared.row.rawRow,
    mapped_row_json: prepared.row.values,
    raw_data: prepared.row.rawRow,
    normalized_data: prepared.row.values,
    mapping_confidence: mappingConfidence,
    import_status: prepared.importStatus,
    validation_status: prepared.importStatus === 'error' ? 'error' : prepared.row.status === 'skipped' ? 'needs_review' : 'valid',
    error_message: prepared.errorMessage ?? null,
  }))
  const { error } = await client.from('lead_import_rows').insert(payload)
  if (error) {
    throw new Error(formatSupabaseError(error.message))
  }
}

async function updateBatchSummary(
  batchId: string,
  result: LeadImportResult,
  baseSummary: Record<string, unknown>,
  forcedStatus?: 'completed' | 'failed',
) {
  const client = getSupabaseClient()
  const importedRows = result.insertedCount + result.updatedCount
  const status = forcedStatus ?? (result.errorCount > 0 ? 'failed' : 'completed')
  const { error } = await client
    .from('lead_import_batches')
    .update({
      imported_rows: importedRows,
      skipped_rows: result.skippedCount,
      duplicate_rows: result.duplicateCount,
      error_rows: result.errorCount,
      status,
      import_summary_json: {
        ...baseSummary,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        duplicateCount: result.duplicateCount,
        errorCount: result.errorCount,
        errors: result.errors,
      },
    })
    .eq('id', batchId)

  if (error) {
    throw new Error(formatSupabaseError(error.message))
  }
}

async function fetchExistingLeadMaps(): Promise<LeadLookupMaps> {
  const client = getSupabaseClient()
  const maps: LeadLookupMaps = {
    byEmail: new Map(),
    byDomain: new Map(),
    byCompanyLocation: new Map(),
  }
  let from = 0

  while (true) {
    const { data, error } = await client
      .from('leads')
      .select('*')
      .range(from, from + fetchPageSize - 1)

    if (error) {
      throw new Error(formatSupabaseError(error.message))
    }

    const leads = (data as LeadRecord[] | null) ?? []
    leads.forEach((lead) => addLeadToMaps(maps, lead))
    if (leads.length < fetchPageSize) {
      break
    }
    from += fetchPageSize
  }

  return maps
}

function findExistingLeadInMaps(payload: LeadInsertPayload, maps: LeadLookupMaps): LeadRecord | null {
  if (payload.email) {
    const lead = maps.byEmail.get(payload.email)
    if (lead) return lead
  }

  const domain = getWebsiteDomain(payload.website ?? '')
  if (domain) {
    const lead = maps.byDomain.get(domain)
    if (lead) return lead
  }

  const companyLocationKey = getCompanyLocationKey(payload)
  return companyLocationKey ? maps.byCompanyLocation.get(companyLocationKey) ?? null : null
}

function addLeadToMaps(maps: LeadLookupMaps, lead: LeadRecord) {
  if (lead.email) {
    maps.byEmail.set(lead.email.toLowerCase(), lead)
  }
  const domain = getWebsiteDomain(lead.website ?? '')
  if (domain) {
    maps.byDomain.set(domain, lead)
  }
  const companyLocationKey = getCompanyLocationKey(lead)
  if (companyLocationKey) {
    maps.byCompanyLocation.set(companyLocationKey, lead)
  }
}

function getCompanyLocationKey(value: Pick<LeadInsertPayload, 'normalized_company_name' | 'country' | 'region'>): string {
  const companyName = value.normalized_company_name?.trim().toLowerCase()
  const location = (value.country || value.region)?.trim().toLowerCase()
  return companyName && location ? `${companyName}::${location}` : ''
}

function buildLeadPayload(batchId: string, row: NormalizedLeadRow, sourceType: string): LeadInsertPayload {
  const companyName = cleanValue(row.values.company_name) || cleanValue(row.values.email) || cleanValue(row.values.website) || `未命名客户-${row.rowNumber}`
  const phone = cleanValue(row.values.phone)
  const whatsapp = cleanValue(row.values.whatsapp)
  const website = displayWebsite(cleanValue(row.values.website) ?? undefined)
  const productKeywords = cleanValue(row.values.product_keywords) || cleanValue(row.values.matched_weida_product_lines)
  const developmentLevel = cleanValue(row.values.development_level) || 'C'

  return {
    batch_id: batchId,
    company_name: companyName,
    normalized_company_name: normalizeCompanyName(companyName),
    contact_name: cleanValue(row.values.contact_name),
    email: cleanValue(row.values.email)?.toLowerCase() ?? null,
    phone,
    normalized_phone: normalizePhone(phone ?? whatsapp ?? ''),
    fax: cleanValue(row.values.fax),
    whatsapp,
    country: cleanValue(row.values.country),
    region: cleanValue(row.values.region),
    city: cleanValue(row.values.city),
    website: website || null,
    address: cleanValue(row.values.address),
    product_keywords: productKeywords,
    customer_type: cleanValue(row.values.customer_type),
    source_type: sourceType,
    source_detail: cleanValue(row.values.source_detail),
    development_level: developmentLevel,
    priority_score: calculatePriorityScore(row),
    status: '待开发',
    raw_payload: {
      rawRow: row.rawRow,
      values: row.values,
    },
  }
}

function mergeLeadPayload(existing: LeadRecord, incoming: LeadInsertPayload): Partial<LeadInsertPayload> {
  const merged: Partial<LeadInsertPayload> = {}
  const fillFields: Array<keyof LeadInsertPayload> = [
    'company_name',
    'normalized_company_name',
    'contact_name',
    'email',
    'phone',
    'normalized_phone',
    'fax',
    'whatsapp',
    'country',
    'region',
    'city',
    'website',
    'address',
    'product_keywords',
    'customer_type',
    'source_type',
  ]

  for (const field of fillFields) {
    if (!existing[field] && incoming[field]) {
      merged[field] = incoming[field] as never
    }
  }

  if (isHigherLevel(incoming.development_level, existing.development_level)) {
    merged.development_level = incoming.development_level
  }
  if ((incoming.priority_score ?? 0) > (existing.priority_score ?? 0)) {
    merged.priority_score = incoming.priority_score
  }
  if (incoming.source_detail) {
    merged.source_detail = appendSourceDetail(existing.source_detail, incoming.source_detail)
  }
  merged.batch_id = incoming.batch_id
  merged.raw_payload = incoming.raw_payload

  return merged
}

export function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,，。]/g, ' ')
    .replace(/\b(ltd|limited|co|company|inc|llc|corp|corporation|gmbh|sarl|sa|plc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, '')
  return digits || null
}

function calculatePriorityScore(row: NormalizedLeadRow): number {
  let score = 0
  if (row.values.email) score += 15
  if (row.values.website) score += 15
  if (row.values.phone || row.values.whatsapp) score += 10
  if (row.values.product_keywords || row.values.matched_weida_product_lines) score += 20
  if (row.values.company_name) score += 20
  if (row.values.country || row.values.region) score += 10
  return Math.min(100, score)
}

function hasLeadIdentity(row: NormalizedLeadRow): boolean {
  return Boolean(row.values.company_name || row.values.email || row.values.phone || row.values.website)
}

function buildFieldMappingJson(mappings: ColumnMapping[]): Record<string, unknown> {
  return {
    columns: mappings.map((mapping) => ({
      originalColumn: mapping.originalColumn,
      standardField: mapping.standardField,
      confidence: mapping.confidence,
      isDuplicate: mapping.isDuplicate,
    })),
  }
}

function getWebsiteDomain(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .trim()
}

function cleanValue(value: string | undefined): string | null {
  const cleaned = value?.trim()
  return cleaned ? cleaned : null
}

function appendSourceDetail(existing: string | null, incoming: string): string {
  if (!existing) {
    return incoming
  }
  return existing.includes(incoming) ? existing : `${existing}\n${incoming}`
}

function isHigherLevel(incoming: string | null, existing: string | null): boolean {
  return (levelRank[incoming ?? ''] ?? 0) > (levelRank[existing ?? ''] ?? 0)
}

function formatSupabaseError(message: string): string {
  if (/relation .* does not exist/i.test(message) || /column .* does not exist/i.test(message)) {
    return '数据库表或字段不存在，请先执行最新 migration。'
  }
  if (/permission denied|row-level security/i.test(message)) {
    return 'Supabase 权限不足，请检查 RLS 策略或登录状态。'
  }
  return message
}
