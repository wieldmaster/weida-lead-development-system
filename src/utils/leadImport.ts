import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type {
  ColumnMapping,
  HeaderDetectionResult,
  ImportPreviewResult,
  ImportSheetPreview,
  NormalizedLeadRow,
  SheetType,
  SheetTypeDetectionResult,
  StandardLeadField,
} from '../types'

type RawCell = string | number | boolean | Date | null | undefined
type RawSheetRow = RawCell[]
type FieldScore = {
  field: StandardLeadField | ''
  confidence: number
  reason: string
}

export const standardLeadFieldLabels: Record<StandardLeadField, string> = {
  company_name: '公司名称',
  contact_name: '联系人',
  email: '邮箱',
  phone: '电话',
  fax: '传真',
  whatsapp: 'WhatsApp',
  country: '国家/地区',
  region: '区域',
  city: '城市',
  website: '网站',
  address: '地址',
  product_keywords: '产品/主营/采购需求',
  customer_type: '客户类型',
  development_level: '开发层级',
  matched_weida_product_lines: '推荐产品线',
  research_summary: '背调结论',
  risk_notes: '风险点',
  suggested_action: '建议动作',
  source_detail: '来源说明',
  notes: '备注',
}

export const standardLeadFields = Object.keys(standardLeadFieldLabels) as StandardLeadField[]

const fieldAliases: Record<StandardLeadField, string[]> = {
  company_name: [
    'company',
    'company name',
    'buyer company',
    'customer',
    'customer name',
    'business name',
    'organization',
    'exhibitor',
    'exhibitor name',
    '公司',
    '公司名称',
    '企业名称',
    '客户名称',
    '买家公司',
    '采购商',
    '参展商',
    '参展商名称',
    '客户公司',
    '客户/公司',
    '公司/客户',
    '客户企业',
    '目标客户',
    '开发客户',
  ],
  contact_name: [
    'contact',
    'contact name',
    'contact person',
    'person',
    'buyer name',
    'representative',
    'name',
    '联系人',
    '姓名',
    '负责人',
    '采购负责人',
    '客户联系人',
    '采购联系人',
    '联系人姓名',
    '负责人姓名',
    '业务联系人',
  ],
  email: [
    'email',
    'e-mail',
    'mail',
    'contact email',
    'buyer email',
    '邮箱',
    '电子邮箱',
    '邮件',
    '联系邮箱',
    '客户邮箱',
    '邮件地址',
    'E-mail',
    'Email Address',
  ],
  phone: [
    'phone',
    'tel',
    'telephone',
    'mobile',
    'contact number',
    '电话',
    '手机',
    '手机号',
    '联系电话',
    '座机',
    '客户电话',
    '电话号码',
    '手机号码',
    '手机/电话',
    '电话/手机',
  ],
  fax: ['fax', 'FAX', 'facsimile', '传真', '传真号码'],
  whatsapp: [
    'whatsapp',
    'whats app',
    'wa',
    'WhatsApp',
    'Whatsapp',
    'whatsapp number',
    'WA',
    '电话+WhatsApp',
    '邮件+电话/WhatsApp',
    '电话/WhatsApp',
  ],
  country: [
    'country',
    'nation',
    'market',
    'destination',
    'buyer country',
    '国家',
    '地区',
    '国家地区',
    '市场',
    '目的国',
    '客户国家',
    '国家/地区',
    '市场国家',
    '所在国家',
    '目标国家',
  ],
  region: ['region', 'state', 'province', 'area', '区域', '州', '省份', '地区'],
  city: ['city', '城市', '所在城市'],
  website: [
    'website',
    'web',
    'url',
    'homepage',
    'company website',
    '官网',
    '网站',
    '公司网站',
    '网址',
    '客户官网',
    '客户网站',
    '官网/网站',
    'Website',
    'URL',
  ],
  address: ['address', 'company address', 'location', '地址', '公司地址', '所在地'],
  product_keywords: [
    'product',
    'products',
    'interested products',
    'buying products',
    'category',
    'main products',
    'business scope',
    '产品',
    '主营产品',
    '采购产品',
    '感兴趣产品',
    '行业',
    '类目',
    '经营范围',
  ],
  customer_type: [
    'customer type',
    'type',
    'business type',
    'channel type',
    '客户类型',
    '类型',
    '渠道类型',
    '业务类型',
    '客户属性',
    '买家类型',
  ],
  development_level: [
    '开发层级',
    '客户层级',
    '客户等级',
    '等级',
    'level',
    'development level',
    'priority',
    '优先级',
    '开发优先级',
    'A+优先',
    'A+ 立即开发',
    'A类',
    'B类',
    'C类',
    'D类',
    'a+',
    'a',
    'b+',
    'b',
    'c',
    'd',
  ],
  matched_weida_product_lines: [
    '推荐产品线',
    '匹配产品线',
    'WEIDA匹配产品',
    '适配产品',
    '推荐开发产品',
    '主推产品线',
    '产品匹配',
  ],
  research_summary: ['背调结论', '客户背调', '背调摘要', '调研结论', '公开资料结论', '官网摘要'],
  risk_notes: ['风险点', '风险提示', '暂缓原因', '降级原因', '注意事项'],
  suggested_action: ['建议动作', '开发建议', '下一步动作', '跟进建议', '处理建议'],
  source_detail: ['source', 'data source', 'platform', 'channel', '来源', '数据来源', '平台', '渠道'],
  notes: ['notes', 'remark', 'remarks', 'description', 'profile', 'introduction', '备注', '描述', '简介', '说明', '其他说明', '补充说明'],
}

const aliasLookup = new Map<string, StandardLeadField>()
for (const field of standardLeadFields) {
  for (const alias of fieldAliases[field]) {
    aliasLookup.set(normalizeHeader(alias), field)
  }
}

const commonCountries = new Set([
  'united states',
  'usa',
  'u.s.a.',
  'america',
  'united kingdom',
  'uk',
  'u.k.',
  'germany',
  'france',
  'italy',
  'spain',
  'canada',
  'australia',
  'india',
  'japan',
  'korea',
  'south korea',
  'brazil',
  'mexico',
  'uae',
  'u.a.e.',
  'united arab emirates',
  'saudi arabia',
  'netherlands',
  'poland',
  'turkey',
  'russia',
  '土耳其',
  '美国',
  '英国',
  '阿联酋',
  '德国',
  '法国',
  '意大利',
  '西班牙',
  '加拿大',
  '澳大利亚',
  '印度',
  '日本',
  '韩国',
  '巴西',
  '墨西哥',
])

const productWords = [
  'product',
  'products',
  'category',
  'buying',
  'sourcing',
  '采购',
  '产品',
  '主营',
  '类目',
  '行业',
  '经营',
  '需求',
]

const sheetTypeLabels: Record<SheetType, string> = {
  lead_list: '客户明细',
  task_plan: '跟进任务',
  email_template: '邮件模板',
  summary: '总览摘要',
  rules: '规则说明',
  unknown: '未知',
}

const topLevelDomains = [
  'com',
  'net',
  'org',
  'co',
  'cn',
  'sg',
  'ae',
  'uk',
  'de',
  'fr',
  'it',
  'es',
  'br',
  'mx',
  'za',
  'au',
  'in',
  'io',
  'biz',
  'info',
  'us',
  'ca',
  'jp',
  'kr',
  'tr',
  'nl',
]

const developmentLevelValues = new Set(['a+', 'a', 'b+', 'b', 'c', 'd'])
const invalidCompanyValues = new Set([
  'a+',
  'a',
  'b+',
  'b',
  'c',
  'd',
  '优先开发',
  '立即开发',
  '评分',
  '状态',
  '开发动作',
  '跟进',
  '首轮邮件',
])
const actionPhrasePattern = /(首轮|邮件|跟进|whatsapp|开发|触达|任务|节奏|暂缓|降级|优先开发|立即开发)/i

export const leadImportSheetTypeExamples: Array<{
  sheetName: string
  expectedSheetType: SheetType
  expectedAction: string
}> = [
  { sheetName: '00_执行总览', expectedSheetType: 'summary', expectedAction: '不建议导入' },
  { sheetName: '01_客户背调与层级调整', expectedSheetType: 'lead_list', expectedAction: '建议导入客户池' },
  { sheetName: '02_A+与A首轮开发清单', expectedSheetType: 'lead_list', expectedAction: '建议导入客户池' },
  { sheetName: '03_国家与区域优先级', expectedSheetType: 'summary', expectedAction: '不建议导入' },
  { sheetName: '04_客户类型与产品匹配', expectedSheetType: 'rules', expectedAction: '不建议导入客户池' },
  { sheetName: '05_14天开发节奏', expectedSheetType: 'task_plan', expectedAction: '不导入客户池' },
  { sheetName: '06_开发信模板库', expectedSheetType: 'email_template', expectedAction: '不导入客户池' },
  { sheetName: '07_降级与暂缓原因', expectedSheetType: 'unknown', expectedAction: '低置信度需确认' },
  { sheetName: '08_评分规则与资料来源', expectedSheetType: 'rules', expectedAction: '不建议导入' },
  { sheetName: '09_全量客户池处理说明', expectedSheetType: 'rules', expectedAction: '不建议导入' },
]

export async function parseLeadFile(file: File): Promise<ImportPreviewResult> {
  const extension = getFileExtension(file.name)
  if (!['xlsx', 'xls', 'csv'].includes(extension)) {
    return buildErrorResult(file, '仅支持 .xlsx、.xls、.csv 文件。')
  }

  try {
    const workbookSheets = extension === 'csv' ? await parseCsvFile(file) : await parseWorkbookFile(file)
    if (workbookSheets.length === 0) {
      return buildErrorResult(file, '文件中没有可读取的 sheet 或数据行。')
    }

    const sheets = workbookSheets.map(({ name, rows }) => buildSheetPreview(name, rows))
    const selectedSheetIndex = Math.max(
      0,
      sheets.findIndex((sheet) => sheet.sheetType === 'lead_list'),
    )

    return {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || extension.toUpperCase(),
      sheets,
      selectedSheetIndex,
    }
  } catch (error) {
    return buildErrorResult(file, getReadableError(error))
  }
}

export function detectHeaderRow(rows: RawSheetRow[]): HeaderDetectionResult {
  const sampleRows = rows.slice(0, 20)
  let best: HeaderDetectionResult = {
    rowIndex: 0,
    confidence: 0.25,
    score: 0,
    reason: '无法明确识别表头，已默认使用第一行。',
  }

  sampleRows.forEach((row, rowIndex) => {
    const values = row.map(toCellText)
    const nonEmpty = values.filter(Boolean)
    if (nonEmpty.length === 0) {
      return
    }

    const aliasMatches = nonEmpty.filter((value) => findFieldByHeader(value).field).length
    const nextRow = rows[rowIndex + 1] ?? []
    const nextNonEmpty = nextRow.map(toCellText).filter(Boolean).length
    const nextLooksLikeData = nextRow.some((cell) => {
      const text = toCellText(cell)
      return isLikelyEmail(text) || isLikelyPhone(text) || isLikelyWebsite(text) || looksLikeCountry(text)
    })
    const titlePenalty = nonEmpty.length <= 2 ? 12 : 0
    const score =
      Math.min(nonEmpty.length, 12) * 2 +
      aliasMatches * 12 +
      Math.min(nextNonEmpty, 10) * 1.5 +
      (nextLooksLikeData ? 8 : 0) -
      titlePenalty

    if (score > best.score) {
      const confidence = clamp((score + aliasMatches * 6) / 80, 0.25, 0.98)
      best = {
        rowIndex,
        confidence,
        score,
        reason:
          aliasMatches > 0
            ? `识别到 ${aliasMatches} 个字段别名，下一行数据特征 ${nextLooksLikeData ? '明显' : '一般'}。`
            : '表头别名较少，主要根据非空列数量和下一行数据特征判断。',
      }
    }
  })

  if (best.score <= 0) {
    return best
  }

  return best
}

export function detectSheetType(
  sheetName: string,
  rows: RawSheetRow[],
  mappings: ColumnMapping[] = [],
): SheetTypeDetectionResult {
  const name = normalizeHeader(sheetName)
  const sampleRows = rows.slice(0, 20)
  const sampleText = sampleRows.flat().map(toCellText).filter(Boolean).join(' ').toLowerCase()
  const allText = `${name} ${sampleText}`
  const mappedFields = new Set(mappings.map((mapping) => mapping.standardField).filter(Boolean))

  const nameHas = (keywords: string[]) => keywords.some((keyword) => name.includes(normalizeHeader(keyword)))
  const textHas = (keywords: string[]) => keywords.some((keyword) => allText.includes(keyword.toLowerCase()))
  const textSignalCount = (keywords: string[]) =>
    keywords.filter((keyword) => allText.includes(keyword.toLowerCase())).length
  const fieldCount = (fields: StandardLeadField[]) => fields.filter((field) => mappedFields.has(field)).length

  const emailCount = countSampleCells(sampleRows, isLikelyEmail)
  const phoneCount = countSampleCells(sampleRows, isLikelyPhone)
  const websiteCount = countSampleCells(sampleRows, isLikelyWebsite)
  const companyLikeCount = countSampleCells(sampleRows, isLikelyCompanyName)
  const customerSignalCount =
    fieldCount([
      'company_name',
      'contact_name',
      'email',
      'phone',
      'whatsapp',
      'country',
      'website',
      'customer_type',
      'development_level',
      'product_keywords',
    ]) + Math.min(3, emailCount + phoneCount + websiteCount + Math.floor(companyLikeCount / 3))

  if (nameHas(['邮件模板', '模板', '开发信', 'email template'])) {
    return { sheetType: 'email_template', confidence: 0.9, reason: 'Sheet 名称或字段包含邮件模板特征。' }
  }

  if (nameHas(['开发节奏', '跟进计划', '任务', 'task', 'follow'])) {
    return { sheetType: 'task_plan', confidence: 0.86, reason: 'Sheet 名称或内容包含开发节奏、任务或跟进节点。' }
  }

  if (nameHas(['评分规则', '资料来源', '说明', '规则', 'rule', 'source', '产品匹配', '客户类型与产品匹配'])) {
    return { sheetType: 'rules', confidence: 0.86, reason: 'Sheet 名称或内容包含评分规则、资料来源或口径说明。' }
  }

  if (nameHas(['总览', '摘要', '执行总览', 'overview', 'summary', '国家与区域优先级'])) {
    return { sheetType: 'summary', confidence: 0.82, reason: 'Sheet 名称或内容更像执行总览、统计摘要或说明。' }
  }

  if (customerSignalCount >= 3) {
    return {
      sheetType: 'lead_list',
      confidence: clamp(0.55 + customerSignalCount * 0.06, 0.65, 0.95),
      reason: `识别到 ${customerSignalCount} 类客户明细特征。`,
    }
  }

  if (emailCount + phoneCount + websiteCount >= 4 && companyLikeCount >= 3) {
    return {
      sheetType: 'lead_list',
      confidence: 0.74,
      reason: '前 20 行存在较多公司、邮箱、电话或网站信息。',
    }
  }

  if (textSignalCount(['subject', 'body', '邮件标题', '邮件正文', 'template']) >= 2) {
    return { sheetType: 'email_template', confidence: 0.78, reason: '内容包含邮件标题、正文或模板字段。' }
  }

  if (textHas(['d0', 'd3', 'd7', 'd14']) || textSignalCount(['跟进', '任务', '邮件', 'whatsapp']) >= 3) {
    return { sheetType: 'task_plan', confidence: 0.74, reason: '内容包含多个跟进节点、任务或开发动作字段。' }
  }

  if (textSignalCount(['评分', '加分', '减分', '规则', '来源', '口径']) >= 2) {
    return { sheetType: 'rules', confidence: 0.74, reason: '内容包含多个评分、规则或来源说明字段。' }
  }

  if (looksLikeSummarySheet(sampleRows, customerSignalCount)) {
    return { sheetType: 'summary', confidence: 0.68, reason: '内容以统计数字、结论或说明为主。' }
  }

  return { sheetType: 'unknown', confidence: 0.35, reason: '客户明细、模板、任务、规则或总览特征均不足，需人工确认。' }
}

export function mapColumnsToStandardFields(headers: string[], dataRows: RawSheetRow[]): ColumnMapping[] {
  const mappings = headers.map((header, columnIndex) => {
    const headerScore = findFieldByHeader(header)
    const contentScore = inferFieldFromColumn(dataRows.map((row) => toCellText(row[columnIndex])))

    const selected =
      headerScore.confidence >= contentScore.confidence
        ? headerScore
        : {
            ...contentScore,
            confidence: Math.min(contentScore.confidence, 0.78),
            reason: `根据列内容识别：${contentScore.reason}`,
          }

    return {
      originalColumn: header || `未命名列 ${columnIndex + 1}`,
      columnIndex,
      standardField: selected.field,
      confidence: selected.field ? selected.confidence : 0,
      reason: selected.reason,
    }
  })

  return markDuplicateMappings(mappings)
}

export function normalizeLeadRow(
  rawValues: RawSheetRow,
  headers: string[],
  mappings: ColumnMapping[],
  rowNumber: number,
): NormalizedLeadRow {
  const rawRow: Record<string, string> = {}
  const values: Partial<Record<StandardLeadField, string>> = {}

  headers.forEach((header, index) => {
    rawRow[header || `未命名列 ${index + 1}`] = toCellText(rawValues[index])
  })

  mappings.forEach((mapping) => {
    if (!mapping.standardField || mapping.isDuplicate) {
      return
    }
    const rawValue = toCellText(rawValues[mapping.columnIndex])
    if (!rawValue || values[mapping.standardField]) {
      return
    }

    const normalizedValue = normalizeFieldValue(mapping.standardField, rawValue)
    if (normalizedValue) {
      values[mapping.standardField] = normalizedValue
    }
  })

  mappings.forEach((mapping) => {
    if (!mapping.standardField || !mapping.isDuplicate || values[mapping.standardField]) {
      return
    }
    const rawValue = toCellText(rawValues[mapping.columnIndex])
    const normalizedValue = rawValue ? normalizeFieldValue(mapping.standardField, rawValue) : ''
    if (normalizedValue) {
      values[mapping.standardField] = normalizedValue
    }
  })

  const hasIdentity = Boolean(values.company_name || values.email || values.phone || values.website)
  return {
    rowNumber,
    values,
    rawRow,
    status: hasIdentity ? 'valid' : 'skipped',
    issues: hasIdentity ? [] : ['缺少公司名称、邮箱、电话或网站，暂时跳过。'],
  }
}

export function applyColumnMappingsToSheet(sheet: ImportSheetPreview, mappings: ColumnMapping[]): ImportSheetPreview {
  const rows = sheet.rows.map((row) => {
    const rawValues = sheet.headers.map((header) => row.rawRow[header] ?? '')
    return normalizeLeadRow(rawValues, sheet.headers, mappings, row.rowNumber)
  })
  const rowsWithDuplicates = markDuplicateRows(rows)
  const averageConfidence = calculateAverageConfidence(mappings)
  const needsReviewFields = mappings.filter((mapping) => mapping.standardField && mapping.confidence < 0.7).length
  const mappedFieldCount = new Set(mappings.filter((mapping) => mapping.standardField).map((mapping) => mapping.standardField)).size
  const validRows = rowsWithDuplicates.filter((row) => row.status === 'valid').length
  const duplicateRows = rowsWithDuplicates.filter((row) => row.status === 'duplicate').length
  const skippedRows = rowsWithDuplicates.filter((row) => row.status === 'skipped').length

  return {
    ...sheet,
    mappings,
    rows: rowsWithDuplicates,
    previewRows: rowsWithDuplicates.slice(0, 20),
    stats: {
      ...sheet.stats,
      validRows,
      skippedRows,
      duplicateRows,
      averageConfidence,
      needsReviewFields,
      mappedFieldCount,
    },
    suggested: sheet.sheetType === 'lead_list' && validRows > 0 && mappedFieldCount >= 2 && averageConfidence >= 0.45,
  }
}

export function standardizeCountry(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  const lower = normalized.toLowerCase()
  if (['usa', 'u.s.a.', 'america', 'united states of america'].includes(lower)) {
    return 'United States'
  }
  if (['uk', 'u.k.', 'britain', 'great britain'].includes(lower)) {
    return 'United Kingdom'
  }
  if (['uae', 'u.a.e.'].includes(lower)) {
    return 'United Arab Emirates'
  }
  return normalized
}

export function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function isLikelyWebsite(value: string): boolean {
  const text = value.trim().toLowerCase()
  if (!text || /^[\d\s.,%]+$/.test(text)) {
    return false
  }
  const withoutProtocol = text.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
  if (!/[a-z]/.test(withoutProtocol)) {
    return false
  }
  const domainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/
  if (!domainPattern.test(withoutProtocol)) {
    return false
  }
  const parts = withoutProtocol.split('.')
  const last = parts[parts.length - 1]
  const secondLast = parts[parts.length - 2]
  return topLevelDomains.includes(last) || (last.length === 2 && Boolean(secondLast) && topLevelDomains.includes(secondLast))
}

export function isLikelyPhone(value: string): boolean {
  const text = value.trim()
  const digits = text.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 18 && /^[+\d\s().-]+$/.test(text)
}

export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function displayWebsite(value: string | undefined): string {
  if (!value) {
    return ''
  }
  if (!isLikelyWebsite(value)) {
    return ''
  }
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function buildSheetPreview(sheetName: string, rows: RawSheetRow[]): ImportSheetPreview {
  const normalizedRows = trimTrailingEmptyRows(rows)
  const header = detectHeaderRow(normalizedRows)
  const headers = normalizeHeaders(normalizedRows[header.rowIndex] ?? [])
  const dataRows = normalizedRows.slice(header.rowIndex + 1).filter((row) => row.some((cell) => toCellText(cell)))
  const mappings = mapColumnsToStandardFields(headers, dataRows)
  const sheetType = detectSheetType(sheetName, normalizedRows, mappings)
  const leadRows = dataRows.map((row, index) => normalizeLeadRow(row, headers, mappings, header.rowIndex + index + 2))
  const rowsWithDuplicates = markDuplicateRows(leadRows)
  const averageConfidence = calculateAverageConfidence(mappings)
  const needsReviewFields = mappings.filter((mapping) => mapping.standardField && mapping.confidence < 0.7).length
  const mappedFieldCount = new Set(mappings.filter((mapping) => mapping.standardField).map((mapping) => mapping.standardField)).size
  const warnings: string[] = []

  if (header.confidence < 0.5) {
    warnings.push('表头识别置信度较低，请人工确认。')
  }
  if (mappedFieldCount === 0) {
    warnings.push('没有识别到标准字段，请手动调整字段映射。')
  }
  if (rowsWithDuplicates.length === 0) {
    warnings.push('没有可预览的数据行。')
  }
  if (sheetType.sheetType !== 'lead_list') {
    warnings.push(`${sheetTypeLabels[sheetType.sheetType]}类型不作为客户池明细直接导入。`)
  }

  const validRows = rowsWithDuplicates.filter((row) => row.status === 'valid').length
  const duplicateRows = rowsWithDuplicates.filter((row) => row.status === 'duplicate').length
  const skippedRows = rowsWithDuplicates.filter((row) => row.status === 'skipped').length

  return {
    sheetName,
    sheetType: sheetType.sheetType,
    sheetTypeConfidence: sheetType.confidence,
    sheetTypeReason: sheetType.reason,
    suggestedAction: getSuggestedAction(sheetType.sheetType),
    totalRows: normalizedRows.length,
    headerRowIndex: header.rowIndex,
    headerRowNumber: header.rowIndex + 1,
    headerConfidence: header.confidence,
    headerReason: header.reason,
    headers,
    mappings,
    rows: rowsWithDuplicates,
    previewRows: rowsWithDuplicates.slice(0, 20),
    stats: {
      totalRows: normalizedRows.length,
      rawDataRows: dataRows.length,
      validRows,
      skippedRows,
      duplicateRows,
      averageConfidence,
      needsReviewFields,
      mappedFieldCount,
    },
    suggested: isSuggestedSheet(sheetType.sheetType, validRows, mappedFieldCount, averageConfidence),
    warnings,
  }
}

async function parseWorkbookFile(file: File): Promise<Array<{ name: string; rows: RawSheetRow[] }>> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  return workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<RawSheetRow>(worksheet, {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    })
    return { name: sheetName, rows }
  })
}

async function parseCsvFile(file: File): Promise<Array<{ name: string; rows: RawSheetRow[] }>> {
  const text = await file.text()
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: false,
  })

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0]
    throw new Error(`CSV 解析失败：第 ${firstError.row ?? '-'} 行，${firstError.message}`)
  }

  return [{ name: 'CSV 数据', rows: parsed.data }]
}

function normalizeHeaders(row: RawSheetRow): string[] {
  const headers = row.map(toCellText)
  const lastNonEmptyIndex = headers.reduce((lastIndex, value, index) => (value ? index : lastIndex), -1)
  return headers.slice(0, Math.max(lastNonEmptyIndex + 1, headers.length)).map((header, index) => header || `未命名列 ${index + 1}`)
}

function findFieldByHeader(header: string): FieldScore {
  const normalized = normalizeHeader(header)
  const exact = aliasLookup.get(normalized)
  if (exact) {
    return {
      field: exact,
      confidence: 0.96,
      reason: `表头命中字段别名“${header}”。`,
    }
  }

  for (const field of standardLeadFields) {
    const aliases = fieldAliases[field].map(normalizeHeader)
    const partial = aliases.find((alias) => alias.length >= 4 && (normalized.includes(alias) || alias.includes(normalized)))
    if (partial) {
      return {
        field,
        confidence: 0.76,
        reason: `表头与字段别名“${partial}”相近。`,
      }
    }
  }

  return {
    field: '',
    confidence: 0,
    reason: '未识别到明确字段。',
  }
}

function inferFieldFromColumn(values: string[]): FieldScore {
  const samples = values.map((value) => value.trim()).filter(Boolean).slice(0, 30)
  if (samples.length === 0) {
    return { field: '', confidence: 0, reason: '该列没有可用于判断的内容。' }
  }

  const countRatio = (predicate: (value: string) => boolean) => samples.filter(predicate).length / samples.length
  const emailRatio = countRatio(isLikelyEmail)
  if (emailRatio >= 0.35) {
    return { field: 'email', confidence: clamp(0.68 + emailRatio * 0.25, 0, 0.92), reason: '多行内容符合邮箱格式。' }
  }

  const websiteRatio = countRatio(isLikelyWebsite)
  if (websiteRatio >= 0.35) {
    return {
      field: 'website',
      confidence: clamp(0.65 + websiteRatio * 0.25, 0, 0.9),
      reason: '多行内容包含网址、www 或域名特征。',
    }
  }

  const phoneRatio = countRatio(isLikelyPhone)
  if (phoneRatio >= 0.45) {
    return { field: 'phone', confidence: clamp(0.6 + phoneRatio * 0.25, 0, 0.86), reason: '多行内容符合电话数字特征。' }
  }

  const levelRatio = countRatio(isDevelopmentLevel)
  if (levelRatio >= 0.45) {
    return {
      field: 'development_level',
      confidence: clamp(0.62 + levelRatio * 0.25, 0, 0.88),
      reason: '多行内容为 A+、A、B+、B、C、D 等开发层级。',
    }
  }

  const countryRatio = countRatio(looksLikeCountry)
  if (countryRatio >= 0.45) {
    return {
      field: 'country',
      confidence: clamp(0.58 + countryRatio * 0.25, 0, 0.84),
      reason: '多行内容匹配常见国家或地区名称。',
    }
  }

  const longTextRatio = countRatio((value) => value.length >= 20)
  const productRatio = countRatio((value) => productWords.some((word) => value.toLowerCase().includes(word.toLowerCase())))
  if (productRatio >= 0.2) {
    return {
      field: 'product_keywords',
      confidence: clamp(0.55 + productRatio * 0.3, 0, 0.78),
      reason: '内容包含产品、采购或行业关键词。',
    }
  }

  const companyRatio = countRatio(isLikelyCompanyName)
  if (companyRatio >= 0.55) {
    return {
      field: 'company_name',
      confidence: clamp(0.5 + companyRatio * 0.25, 0, 0.74),
      reason: '列内容多为较长文本，且不像等级、国家、数字或开发动作。',
    }
  }

  if (longTextRatio >= 0.5) {
    return { field: 'notes', confidence: 0.56, reason: '多行内容为较长文本，更像备注或描述。' }
  }

  return { field: '', confidence: 0, reason: '内容特征不足，需人工确认。' }
}

function markDuplicateRows(rows: NormalizedLeadRow[]): NormalizedLeadRow[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    if (row.status === 'skipped') {
      return row
    }
    const key = buildDuplicateKey(row)
    if (!key) {
      return row
    }
    if (seen.has(key)) {
      return {
        ...row,
        status: 'duplicate',
        issues: [...row.issues, '疑似与本次上传中的其他行重复。'],
      }
    }
    seen.add(key)
    return row
  })
}

function markDuplicateMappings(mappings: ColumnMapping[]): ColumnMapping[] {
  const primaryByField = new Map<StandardLeadField, ColumnMapping>()

  for (const mapping of mappings) {
    if (!mapping.standardField) {
      continue
    }
    const currentPrimary = primaryByField.get(mapping.standardField)
    if (
      !currentPrimary ||
      mapping.confidence > currentPrimary.confidence ||
      (mapping.confidence === currentPrimary.confidence && mapping.columnIndex < currentPrimary.columnIndex)
    ) {
      primaryByField.set(mapping.standardField, mapping)
    }
  }

  return mappings.map((mapping) => {
    if (!mapping.standardField) {
      return mapping
    }
    const primary = primaryByField.get(mapping.standardField)
    const isPrimary = primary?.columnIndex === mapping.columnIndex
    return {
      ...mapping,
      isPrimary,
      isDuplicate: !isPrimary,
      duplicateOfColumn: isPrimary ? undefined : primary?.originalColumn,
      reason: isPrimary
        ? mapping.reason
        : `${mapping.reason} 重复字段，可作为补充信息；主字段使用“${primary?.originalColumn ?? '更高置信度列'}”。`,
    }
  })
}

function buildDuplicateKey(row: NormalizedLeadRow): string {
  const email = row.values.email?.toLowerCase()
  if (email) {
    return `email:${email}`
  }
  const website = row.values.website?.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
  if (website) {
    return `website:${website}`
  }
  const company = row.values.company_name?.toLowerCase()
  const country = row.values.country?.toLowerCase()
  return company ? `company:${company}|${country ?? ''}` : ''
}

function normalizeFieldValue(field: StandardLeadField, value: string): string {
  const trimmed = value.trim()
  if (field === 'company_name') {
    return isLikelyCompanyName(trimmed) ? trimmed : ''
  }
  if (field === 'email') {
    return isLikelyEmail(trimmed) ? trimmed.toLowerCase() : ''
  }
  if (field === 'phone' || field === 'whatsapp') {
    return isLikelyPhone(trimmed) ? trimmed.replace(/\s+/g, ' ') : ''
  }
  if (field === 'fax') {
    return trimmed.replace(/\s+/g, ' ')
  }
  if (field === 'website') {
    return isLikelyWebsite(trimmed) ? trimmed : ''
  }
  if (field === 'country') {
    return standardizeCountry(trimmed)
  }
  if (field === 'development_level') {
    return isDevelopmentLevel(trimmed) ? trimmed.toUpperCase() : ''
  }
  return trimmed
}

function looksLikeCountry(value: string): boolean {
  return commonCountries.has(value.trim().toLowerCase())
}

function isDevelopmentLevel(value: string): boolean {
  return developmentLevelValues.has(value.trim().toLowerCase())
}

function isLikelyCompanyName(value: string): boolean {
  const text = value.trim()
  const normalized = normalizeHeader(text)
  if (!text || text.length < 3) {
    return false
  }
  if (/^[\d\s.,%]+$/.test(text) || isDevelopmentLevel(text) || looksLikeCountry(text)) {
    return false
  }
  if (invalidCompanyValues.has(normalized) || actionPhrasePattern.test(text)) {
    return false
  }
  if (isLikelyEmail(text) || isLikelyPhone(text) || isLikelyWebsite(text)) {
    return false
  }
  return text.length >= 4 || /[\u4e00-\u9fa5]{3,}/.test(text)
}

function countSampleCells(rows: RawSheetRow[], predicate: (value: string) => boolean): number {
  return rows.flat().map(toCellText).filter((value) => value && predicate(value)).length
}

function looksLikeSummarySheet(rows: RawSheetRow[], customerSignalCount: number): boolean {
  const cells = rows.flat().map(toCellText).filter(Boolean)
  if (cells.length === 0) {
    return false
  }
  const numericCount = cells.filter((value) => /^[\d\s.,%]+$/.test(value)).length
  const explanationCount = cells.filter((value) => /(说明|结论|统计|总数|占比|摘要|建议|执行|完成|目标)/.test(value)).length
  return customerSignalCount < 3 && (numericCount / cells.length > 0.45 || explanationCount >= 3)
}

function isSuggestedSheet(
  sheetType: SheetType,
  validRows: number,
  mappedFieldCount: number,
  averageConfidence: number,
): boolean {
  if (sheetType === 'lead_list') {
    return validRows > 0 && mappedFieldCount >= 2 && averageConfidence >= 0.45
  }
  return sheetType === 'email_template' || sheetType === 'task_plan'
}

function getSuggestedAction(sheetType: SheetType): string {
  switch (sheetType) {
    case 'lead_list':
      return '建议导入客户池'
    case 'email_template':
      return '建议导入模板库'
    case 'task_plan':
      return '建议导入任务计划'
    case 'summary':
    case 'rules':
      return '仅供阅读，不导入'
    case 'unknown':
      return '需人工确认'
  }
}

function toCellText(value: RawCell): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  return String(value).trim()
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/\\|:：,，;；()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
}

function trimTrailingEmptyRows(rows: RawSheetRow[]): RawSheetRow[] {
  let lastIndex = rows.length - 1
  while (lastIndex >= 0 && rows[lastIndex].every((cell) => !toCellText(cell))) {
    lastIndex -= 1
  }
  return rows.slice(0, lastIndex + 1)
}

function calculateAverageConfidence(mappings: ColumnMapping[]): number {
  const mapped = mappings.filter((mapping) => mapping.standardField)
  if (mapped.length === 0) {
    return 0
  }
  return mapped.reduce((sum, mapping) => sum + mapping.confidence, 0) / mapped.length
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function buildErrorResult(file: File, error: string): ImportPreviewResult {
  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || getFileExtension(file.name).toUpperCase(),
    sheets: [],
    selectedSheetIndex: 0,
    error,
  }
}

function getReadableError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return '文件解析失败，请检查文件格式或内容。'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
