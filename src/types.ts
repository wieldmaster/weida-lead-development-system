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
