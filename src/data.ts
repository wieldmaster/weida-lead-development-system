import type { Lead, LeadTask } from './types'

export const leads: Lead[] = [
  {
    id: 'lead-001',
    companyName: 'Atlantic Home Supplies',
    contactName: 'Maria Collins',
    email: 'maria@atlantichome.example',
    phone: '+1 415 010 2388',
    website: 'atlantichome.example',
    country: '美国',
    industry: '家居用品进口商',
    tier: 'A',
    status: 'qualified',
    source: '展会名录',
    owner: '销售一组',
    nextFollowUp: '2026-05-08',
    researchSummary: '已记录官网、主营类目和潜在采购方向，等待人工补充联系人角色。',
  },
  {
    id: 'lead-002',
    companyName: 'Nord Retail Group',
    contactName: 'Erik Hansen',
    email: 'buying@nordretail.example',
    phone: '+45 20 00 1188',
    website: 'nordretail.example',
    country: '丹麦',
    industry: '连锁零售',
    tier: 'B',
    status: 'new',
    source: 'Google 表格导入',
    owner: '销售二组',
    nextFollowUp: '2026-05-10',
    researchSummary: '仅有基础联系人信息，后续需要补充采购品类和年度采购规模。',
  },
  {
    id: 'lead-003',
    companyName: 'Pacific Outdoor Market',
    contactName: 'Liam Turner',
    email: 'sourcing@pacificoutdoor.example',
    phone: '+61 2 0100 6677',
    website: 'pacificoutdoor.example',
    country: '澳大利亚',
    industry: '户外用品分销',
    tier: 'A',
    status: 'contacted',
    source: 'LinkedIn 手工整理',
    owner: '销售三组',
    nextFollowUp: '2026-05-07',
    researchSummary: '已完成基础调研，疑似关注高性价比系列，建议使用新品开发模板。',
  },
  {
    id: 'lead-004',
    companyName: 'Casa Verde Imports',
    contactName: 'Sofia Marin',
    email: 'purchasing@casaverde.example',
    phone: '+34 91 010 3344',
    website: 'casaverde.example',
    country: '西班牙',
    industry: '进口批发',
    tier: 'C',
    status: 'paused',
    source: '客户推荐',
    owner: '销售一组',
    nextFollowUp: '2026-05-16',
    researchSummary: '客户规模较小，建议进入低频维护池。',
  },
]

export const importBatches = [
  {
    id: 'batch-001',
    fileName: '2026-05-us-home-leads.csv',
    status: 'pending',
    totalRows: 128,
    importedRows: 0,
    duplicateRows: 0,
    createdAt: '2026-05-06',
  },
  {
    id: 'batch-002',
    fileName: 'spring-canton-fair-buyers.xlsx',
    status: 'completed',
    totalRows: 84,
    importedRows: 71,
    duplicateRows: 9,
    createdAt: '2026-05-04',
  },
]

export const importRows = [
  {
    id: 'row-001',
    rowNumber: 12,
    companyName: 'Evergreen Wholesale',
    status: 'valid',
    message: '公司名、国家、邮箱已识别。',
  },
  {
    id: 'row-002',
    rowNumber: 23,
    companyName: '未命名客户',
    status: 'needs_review',
    message: '公司名缺失，等待人工确认。',
  },
  {
    id: 'row-003',
    rowNumber: 41,
    companyName: 'Atlantic Home Supplies',
    status: 'needs_review',
    message: '疑似与现有客户重复。',
  },
]

export const tasks: LeadTask[] = [
  {
    id: 'task-001',
    leadId: 'lead-003',
    leadName: 'Pacific Outdoor Market',
    title: '发送首封开发邮件',
    status: 'pending',
    priority: '高',
    dueDate: '2026-05-07',
    owner: '销售三组',
  },
  {
    id: 'task-002',
    leadId: 'lead-001',
    leadName: 'Atlantic Home Supplies',
    title: '补充采购负责人职位信息',
    status: 'in_progress',
    priority: '中',
    dueDate: '2026-05-08',
    owner: '销售一组',
  },
  {
    id: 'task-003',
    leadId: 'lead-002',
    leadName: 'Nord Retail Group',
    title: '确认主营采购类目',
    status: 'pending',
    priority: '中',
    dueDate: '2026-05-10',
    owner: '销售二组',
  },
  {
    id: 'task-004',
    leadId: 'lead-004',
    leadName: 'Casa Verde Imports',
    title: '移入低频维护池',
    status: 'completed',
    priority: '低',
    dueDate: '2026-05-05',
    owner: '销售一组',
  },
]

export const emailTemplates = [
  {
    id: 'template-001',
    name: '首次开发邮件',
    category: '新客户触达',
    subject: 'WEIDA 产品合作咨询',
    preview:
      '您好，\n我们是 WEIDA 团队，关注到贵司正在经营相关产品线，希望了解是否有合作机会。',
  },
  {
    id: 'template-002',
    name: '报价后跟进',
    category: '报价跟进',
    subject: '关于上一封产品方案的跟进',
    preview:
      '您好，\n想跟进确认您是否收到我们整理的产品方案。如需不同规格或包装，请告诉我们。',
  },
  {
    id: 'template-003',
    name: '长期未回复唤醒',
    category: '客户维护',
    subject: '是否需要更新产品资料',
    preview:
      '您好，\n我们近期更新了部分产品资料，如您有新的采购计划，可以随时联系我。',
  },
]

export const fieldMappings = [
  {
    id: 'mapping-001',
    name: '通用客户表',
    sourceType: 'Excel / CSV',
    fieldCount: 12,
    isDefault: true,
    updatedAt: '2026-05-06',
  },
  {
    id: 'mapping-002',
    name: '展会买家名录',
    sourceType: 'Excel',
    fieldCount: 9,
    isDefault: false,
    updatedAt: '2026-05-04',
  },
]
