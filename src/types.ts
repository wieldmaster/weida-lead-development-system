export type LeadStatus = 'new' | 'qualified' | 'contacted' | 'negotiating' | 'won' | 'paused'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export type Lead = {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string
  website: string
  country: string
  industry: string
  tier: 'A' | 'B' | 'C'
  status: LeadStatus
  source: string
  owner: string
  nextFollowUp: string
  researchSummary: string
}

export type LeadTask = {
  id: string
  leadId: string
  leadName: string
  title: string
  status: TaskStatus
  priority: '高' | '中' | '低'
  dueDate: string
  owner: string
}

export type StandardLeadField =
  | 'company_name'
  | 'contact_name'
  | 'email'
  | 'phone'
  | 'fax'
  | 'whatsapp'
  | 'country'
  | 'region'
  | 'city'
  | 'website'
  | 'address'
  | 'product_keywords'
  | 'customer_type'
  | 'development_level'
  | 'matched_weida_product_lines'
  | 'research_summary'
  | 'risk_notes'
  | 'suggested_action'
  | 'source_detail'
  | 'notes'

export type SheetType = 'lead_list' | 'task_plan' | 'email_template' | 'summary' | 'rules' | 'unknown'

export type SheetTypeDetectionResult = {
  sheetType: SheetType
  confidence: number
  reason: string
}

export type ColumnMapping = {
  originalColumn: string
  columnIndex: number
  standardField: StandardLeadField | ''
  confidence: number
  reason: string
  isDuplicate?: boolean
  duplicateOfColumn?: string
  isPrimary?: boolean
}

export type HeaderDetectionResult = {
  rowIndex: number
  confidence: number
  score: number
  reason: string
}

export type NormalizedLeadRow = {
  rowNumber: number
  values: Partial<Record<StandardLeadField, string>>
  rawRow: Record<string, string>
  status: 'valid' | 'skipped' | 'duplicate'
  issues: string[]
}

export type ImportSheetStats = {
  totalRows: number
  rawDataRows: number
  validRows: number
  skippedRows: number
  duplicateRows: number
  averageConfidence: number
  needsReviewFields: number
  mappedFieldCount: number
}

export type ImportSheetPreview = {
  sheetName: string
  sheetType: SheetType
  sheetTypeConfidence: number
  sheetTypeReason: string
  suggestedAction: string
  totalRows: number
  headerRowIndex: number
  headerRowNumber: number
  headerConfidence: number
  headerReason: string
  headers: string[]
  mappings: ColumnMapping[]
  rows: NormalizedLeadRow[]
  previewRows: NormalizedLeadRow[]
  stats: ImportSheetStats
  suggested: boolean
  warnings: string[]
}

export type ImportPreviewResult = {
  fileName: string
  fileSize: number
  fileType: string
  sheets: ImportSheetPreview[]
  selectedSheetIndex: number
  error?: string
}

export type ImportProgressPhase =
  | 'reading'
  | 'parsing'
  | 'detecting'
  | 'preview'
  | 'creating_batch'
  | 'importing_rows'
  | 'finalizing'
  | 'completed'
  | 'error'

export type ImportProgress = {
  phase: ImportProgressPhase
  label: string
  current: number
  total: number
  percent: number
  detail?: string
}

export type LeadImportResult = {
  batchId?: string
  insertedCount: number
  updatedCount: number
  skippedCount: number
  duplicateCount: number
  errorCount: number
  errors: string[]
}

export type UserRole = 'admin' | 'manager' | 'sales'

export type UserProfile = {
  id: string
  user_id: string
  full_name: string | null
  display_name: string | null
  email: string | null
  role: UserRole
  department: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type LeadClaimStatus = '公海' | '已分配' | '跟进中' | '已成交' | '暂缓' | '无效'

export type LeadPoolRecord = {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  country: string | null
  region: string | null
  website: string | null
  product_keywords: string | null
  customer_type: string | null
  source_type: string | null
  source_detail: string | null
  development_level: string | null
  priority_score: number | null
  status: string | null
  owner_user_id: string | null
  owner_name: string | null
  assigned_at: string | null
  assigned_by: string | null
  claim_status: LeadClaimStatus | string | null
  last_activity_at: string | null
  next_followup_at: string | null
  last_communication_user_name?: string | null
  last_communication_at?: string | null
  created_at: string
}

export type LeadTaskStatus = 'pending' | 'in_progress' | 'completed' | 'paused' | 'invalid'

export type LeadTaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type LeadTaskRecord = {
  id: string
  lead_id: string | null
  lead_company_name: string
  task_type: string
  task_title: string
  task_description: string | null
  due_date: string | null
  status: LeadTaskStatus
  priority: LeadTaskPriority
  owner_name: string | null
  assigned_user_id: string | null
  assigned_user_name: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

export type LeadTaskInput = {
  lead_id: string | null
  task_type: string
  task_title: string
  task_description: string
  due_date: string
  status: LeadTaskStatus
  priority: LeadTaskPriority
  owner_name: string
  assigned_user_id?: string | null
  assigned_user_name?: string | null
}

export type LeadCommunicationInput = {
  lead_id: string
  contact_method: string
  contact_result: string
  next_action: string
  next_followup_at: string
  content: string
}

export type LeadCommunicationRecord = {
  id: string
  lead_id: string
  user_id: string | null
  user_name: string | null
  contact_method: string | null
  contact_result: string | null
  next_action: string | null
  next_followup_at: string | null
  content: string | null
  created_at: string
}

export type DashboardStats = {
  totalLeads: number
  publicLeads: number
  myLeads: number
  todayTasks: number
  overdueTasks: number
  contactedThisWeek: number
  repliedThisWeek: number
  quotingLeads: number
  salesBreakdown: Array<{
    owner_user_id: string | null
    owner_name: string
    leadCount: number
    pendingTasks: number
    overdueTasks: number
  }>
}

export type LeadSelectOption = {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  country: string | null
  region: string | null
  customer_type: string | null
  product_keywords: string | null
  matched_weida_product_lines?: string | null
}

export type EmailTemplateRecord = {
  id: string
  template_name: string
  customer_type: string
  development_stage: string
  subject: string
  body: string
  language: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type EmailTemplateInput = {
  template_name: string
  customer_type: string
  development_stage: string
  subject: string
  body: string
  language: string
  is_active: boolean
}
