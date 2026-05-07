import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { EmailTemplateInput, EmailTemplateRecord, LeadSelectOption } from '../types'

const defaultSignature = `Elan
Sales Manager
Weihai WieldMaster Intelligent Manufacturing Co., Ltd.
WEIDA Hardware Tools
WhatsApp / WeChat: +86 186 0535 5005
Email: elan.xing@wieldmaster.com`

export const templateVariables = [
  '{{company_name}}',
  '{{contact_name}}',
  '{{country}}',
  '{{region}}',
  '{{customer_type}}',
  '{{product_keywords}}',
  '{{matched_weida_product_lines}}',
  '{{recommended_products}}',
  '{{match_reason}}',
  '{{elan_name}}',
  '{{elan_title}}',
  '{{company_english_name}}',
  '{{email}}',
  '{{phone}}',
  '{{whatsapp}}',
]

export const defaultEmailTemplates: EmailTemplateInput[] = [
  {
    template_name: 'Hardware Importer / Wholesaler - First Outreach',
    customer_type: 'hardware_importer_wholesaler',
    development_stage: 'first_outreach',
    subject: 'WEIDA hand tools for your hardware supply range',
    body: `Hi {{contact_name}},

I found {{company_name}} while reviewing hardware and tool suppliers in {{country}}. Your business appears closely related to hand tools, hardware supply or industrial tool distribution, so I wanted to make a brief introduction.

We are Weihai WieldMaster Intelligent Manufacturing Co., Ltd., operating the WEIDA hardware tools brand. Our manufacturing base is in Weihai, Shandong, China, with tool manufacturing experience dating back to 1968.

For your channel, the following WEIDA product lines may be relevant:
{{matched_weida_product_lines}}

We can support factory-direct supply for wrenches, pliers, cutting tools, socket tools, automotive tools, insulated tools and measuring tools.

If useful, I can send a short product selection first, based on the items you currently sell or import.

Best regards,
${defaultSignature}`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Industrial / MRO / Engineering Supplier - First Outreach',
    customer_type: 'industrial_mro_engineering_supplier',
    development_stage: 'first_outreach',
    subject: 'WEIDA industrial hand tools for MRO and maintenance supply',
    body: `Hi {{contact_name}},

I noticed that {{company_name}} may serve industrial, maintenance or engineering customers in {{country}}. I am contacting you because WEIDA could be a practical factory source for part of your hand tool and maintenance tool range.

WEIDA Hardware Tools covers wrenches, socket tools, pliers, cutting tools, torque tools, automotive service tools and insulated tools. Our factory background dates back to 1968, and we focus on stable quality, practical product selection and reliable supply for wholesale and project channels.

For MRO and industrial supply, we usually recommend:
{{matched_weida_product_lines}}

Would it be useful if I prepare a compact product selection for your review?

Best regards,
Elan
Sales Manager
Weihai WieldMaster Intelligent Manufacturing Co., Ltd.
WhatsApp / WeChat: +86 186 0535 5005
Email: elan.xing@wieldmaster.com`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Building Material / Construction Hardware - First Outreach',
    customer_type: 'building_material_construction_hardware_channel',
    development_stage: 'first_outreach',
    subject: 'WEIDA hand tools for construction and hardware supply',
    body: `Hi {{contact_name}},

I came across {{company_name}} and noticed your business may be connected with building materials, construction supply or hardware distribution in {{country}}.

I am Elan from Weihai WieldMaster Intelligent Manufacturing Co., Ltd., manufacturer of WEIDA hardware tools. Our factory history dates back to 1968, and we supply reliable hand tools for distributors, wholesalers and project supply channels.

For construction and hardware customers, the following WEIDA lines are usually a good match:
{{matched_weida_product_lines}}

We can offer adjustable wrenches, combination wrenches, pliers, cutting tools, measuring tools, plumbing tools, screwdrivers and tool sets.

If you are reviewing new tool suppliers, I can send a short selection with popular items for your market.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Automotive Repair / Garage Tool Channel - First Outreach',
    customer_type: 'automotive_repair_garage_tool_channel',
    development_stage: 'first_outreach',
    subject: 'WEIDA automotive and hand tools for repair supply',
    body: `Hi {{contact_name}},

I found {{company_name}} while checking companies related to automotive repair, garage tools or tool supply in {{country}}.

WEIDA may be a suitable factory source for your automotive and hand tool range. We manufacture a broad selection of hand tools, including wrenches, socket tools, ratchet tools, torque wrenches, pliers, cutting tools and automotive service tools.

Our company, Weihai WieldMaster Intelligent Manufacturing Co., Ltd., operates the WEIDA hardware tools brand. The factory has long manufacturing experience and supports strict quality inspection before shipment.

For your channel, I would suggest starting with:
{{matched_weida_product_lines}}

May I send you a short list of suitable items with photos and basic specifications?

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Electrical / Insulated Tool Distributor - First Outreach',
    customer_type: 'electrical_insulated_tool_distributor',
    development_stage: 'first_outreach',
    subject: 'WEIDA insulated and electrical hand tools',
    body: `Hi {{contact_name}},

I noticed {{company_name}} may be related to electrical, cable, industrial or maintenance supply in {{country}}.

I am contacting you because WEIDA has several product lines that may fit this type of channel, including insulated hand tools, electrical tools, cable cutters, wire strippers, pliers, screwdrivers and measuring tools.

We are Weihai WieldMaster Intelligent Manufacturing Co., Ltd., operating the WEIDA hardware tools brand. Our manufacturing base is in Weihai, China, with tool manufacturing experience dating back to 1968.

For your business, I would first recommend:
{{matched_weida_product_lines}}

If you are currently sourcing electrical or insulated hand tools, I can send a compact selection for your review.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Retail Chain / Hardware Store - First Outreach',
    customer_type: 'retail_chain_hardware_store',
    development_stage: 'first_outreach',
    subject: 'WEIDA practical hand tools for retail hardware channels',
    body: `Hi {{contact_name}},

I found {{company_name}} while reviewing retail and hardware store channels in {{country}}.

WEIDA Hardware Tools may be a useful supplier for practical hand tools with stable quality and clear product coverage. Our range includes adjustable wrenches, pliers, screwdrivers, cutting tools, sockets, measuring tools, automotive tools and plumbing tools.

We are a factory-backed tool brand from Weihai, China, with manufacturing experience dating back to 1968. For retail channels, we can support selected fast-moving items, practical packaging and product selection for different market levels.

If relevant, I can prepare a short list of retail-friendly WEIDA products for your review.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Plumbing / Sanitary Hardware Channel - First Outreach',
    customer_type: 'plumbing_sanitary_hardware_channel',
    development_stage: 'first_outreach',
    subject: 'WEIDA plumbing and hand tools for your hardware range',
    body: `Hi {{contact_name}},

I noticed {{company_name}} may be connected with plumbing, sanitary hardware or building supply in {{country}}.

WEIDA has several product lines that may fit this channel, including pipe wrenches, plumbing tools, adjustable wrenches, cutting tools, measuring tools and general hand tools for installation and maintenance work.

Weihai WieldMaster Intelligent Manufacturing Co., Ltd. operates the WEIDA hardware tools brand, with tool manufacturing experience dating back to 1968. We support factory-direct supply, stable quality inspection and practical product selection for distributors and wholesalers.

Would you like me to send a compact plumbing and hand tool selection for your market?

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'General Trading Company - First Outreach',
    customer_type: 'general_trading_company',
    development_stage: 'first_outreach',
    subject: 'WEIDA hardware tools for your sourcing range',
    body: `Hi {{contact_name}},

I found {{company_name}} while reviewing trading companies and sourcing channels in {{country}}.

I am contacting you to introduce WEIDA Hardware Tools. We manufacture and supply a wide range of hand tools, including wrenches, pliers, cutting tools, sockets, screwdrivers, automotive tools, insulated tools, measuring tools and plumbing tools.

Our manufacturing base is in Weihai, Shandong, China, with tool manufacturing experience dating back to 1968. We can support wholesale buyers with stable product quality, factory-direct supply and selected customization.

If hardware tools are within your sourcing plan, I can send a short product selection first, rather than a full catalog.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Unknown Business Type - Soft Outreach',
    customer_type: 'unknown_business_type',
    development_stage: 'first_outreach',
    subject: 'Checking if WEIDA hand tools fit your sourcing needs',
    body: `Hi {{contact_name}},

I found {{company_name}} during a review of potential international buyers in {{country}}. I am not fully sure whether hand tools are part of your current sourcing range, so I will keep this brief.

We are Weihai WieldMaster Intelligent Manufacturing Co., Ltd., supplier of WEIDA Hardware Tools. Our products cover wrenches, pliers, cutting tools, socket tools, automotive tools, insulated tools, measuring tools and other hand tool categories.

If this product category is relevant to your business, I would be glad to send a short product selection for your review. If not, please feel free to ignore this message.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Follow-up - D3 Short Reminder',
    customer_type: 'follow_up_templates',
    development_stage: 'd3_follow_up',
    subject: 'Re: WEIDA hand tools for {{company_name}}',
    body: `Hi {{contact_name}},

Just a short follow-up on my previous email.

I contacted you because WEIDA may be a suitable factory source for part of your hand tool range, especially:
{{matched_weida_product_lines}}

I do not want to send a large catalog before knowing your focus. If you are interested, I can prepare a short product selection based on the items you currently sell or import.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Follow-up - D7 Product Selection',
    customer_type: 'follow_up_templates',
    development_stage: 'd7_follow_up',
    subject: 'Short WEIDA product selection for your review',
    body: `Hi {{contact_name}},

I understand you may be busy, so I will keep this brief.

For companies like {{company_name}}, we usually recommend starting with a limited product selection instead of a full catalog:
{{matched_weida_product_lines}}

WEIDA is a factory-backed hand tool brand from China, covering wrenches, pliers, cutting tools, socket tools, automotive tools and insulated tools.

If this category is relevant to your sourcing plan, I can send a small product list with photos and specifications.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Follow-up - Catalog Offer',
    customer_type: 'follow_up_templates',
    development_stage: 'catalog_offer',
    subject: 'Can I send a short WEIDA tool selection?',
    body: `Hi {{contact_name}},

Instead of sending a full catalog, I can prepare a short WEIDA product selection based on your business type and market.

The selection can include:
- Product photos
- Basic specifications
- Suggested product lines
- Packing information
- Factory supply information

If you are interested, please let me know which category is closer to your current demand:
wrenches, pliers, socket tools, automotive tools, insulated tools, plumbing tools or general hardware tools.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Follow-up - Quote Review',
    customer_type: 'follow_up_templates',
    development_stage: 'quote_follow_up',
    subject: 'Follow-up on WEIDA product quotation',
    body: `Hi {{contact_name}},

I wanted to check whether you had a chance to review the WEIDA product information or quotation.

If any item is not suitable in specification, packaging or quantity, please let me know. We can help adjust the selection and provide a more practical option for your market.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'Follow-up - No Reply Final Light Touch',
    customer_type: 'follow_up_templates',
    development_stage: 'no_reply_final',
    subject: 'Should I close this file for now?',
    body: `Hi {{contact_name}},

I have not heard back from you, so I do not want to keep following up too frequently.

If hand tools are not part of your current sourcing plan, no problem. If you would like to review WEIDA products later, I can send a short selection at any time.

Best regards,
Elan`,
    language: 'en',
    is_active: true,
  },
  {
    template_name: 'WhatsApp Short Message',
    customer_type: 'follow_up_templates',
    development_stage: 'whatsapp_short_message',
    subject: 'WhatsApp short message',
    body: `Hi {{contact_name}}, this is Elan from WEIDA Hardware Tools in China. We supply wrenches, pliers, socket tools, automotive tools and insulated hand tools. I found {{company_name}} and thought our product range may fit your hardware or tool business. May I send you a short product selection?`,
    language: 'en',
    is_active: true,
  },
]

type TemplateRow = {
  id: string
  template_name?: string | null
  name?: string | null
  customer_type?: string | null
  category?: string | null
  development_stage?: string | null
  subject: string
  body: string
  language?: string | null
  language_code?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const templateSelectColumns =
  'id, template_name, name, customer_type, category, development_stage, subject, body, language, language_code, is_active, created_at, updated_at'
const legacyTemplateSelectColumns = 'id, name, category, language_code, subject, body, is_active, created_at, updated_at'

export async function fetchEmailTemplates(): Promise<{ templates: EmailTemplateRecord[]; error?: string; usedDefault: boolean }> {
  if (!isSupabaseConfigured) {
    return { templates: mapDefaultTemplates(), error: '请先配置 Supabase 环境变量，当前显示默认模板。', usedDefault: true }
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('lead_email_templates')
      .select(templateSelectColumns)
      .order('created_at', { ascending: false })

    if (error) {
      if (isMissingTemplateWorkflowColumn(error.message)) {
        const legacyResult = await client
          .from('lead_email_templates')
          .select(legacyTemplateSelectColumns)
          .order('created_at', { ascending: false })
        if (!legacyResult.error) {
          const templates = ((legacyResult.data as TemplateRow[] | null) ?? []).map(mapTemplateRow)
          return templates.length > 0
            ? { templates, error: '当前数据库尚未执行模板字段 migration，已按旧字段兼容读取。', usedDefault: false }
            : { templates: mapDefaultTemplates(), error: '当前显示默认模板，尚未写入数据库。', usedDefault: true }
        }
      }
      return { templates: mapDefaultTemplates(), error: formatTemplateError(error.message), usedDefault: true }
    }

    const templates = ((data as TemplateRow[] | null) ?? []).map(mapTemplateRow)
    return templates.length > 0
      ? { templates, usedDefault: false }
      : { templates: mapDefaultTemplates(), error: '当前显示默认模板，尚未写入数据库。', usedDefault: true }
  } catch (error) {
    return {
      templates: mapDefaultTemplates(),
      error: error instanceof Error ? formatTemplateError(error.message) : '读取邮件模板失败',
      usedDefault: true,
    }
  }
}

export async function createEmailTemplate(input: EmailTemplateInput): Promise<{ template?: EmailTemplateRecord; error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client.from('lead_email_templates').insert(buildTemplatePayload(input)).select('*').single()
    if (error || !data) {
      if (error && isMissingTemplateWorkflowColumn(error.message)) {
        const legacyResult = await client.from('lead_email_templates').insert(buildLegacyTemplatePayload(input)).select('*').single()
        if (!legacyResult.error && legacyResult.data) {
          return { template: mapTemplateRow(legacyResult.data as TemplateRow) }
        }
        return { error: formatTemplateError(legacyResult.error?.message ?? error.message) }
      }
      return { error: formatTemplateError(error?.message ?? '新建模板失败') }
    }
    return { template: mapTemplateRow(data as TemplateRow) }
  } catch (error) {
    return { error: error instanceof Error ? formatTemplateError(error.message) : '新建模板失败' }
  }
}

export async function updateEmailTemplate(id: string, input: EmailTemplateInput): Promise<{ template?: EmailTemplateRecord; error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const { data, error } = await client.from('lead_email_templates').update(buildTemplatePayload(input)).eq('id', id).select('*').single()
    if (error || !data) {
      if (error && isMissingTemplateWorkflowColumn(error.message)) {
        const legacyResult = await client.from('lead_email_templates').update(buildLegacyTemplatePayload(input)).eq('id', id).select('*').single()
        if (!legacyResult.error && legacyResult.data) {
          return { template: mapTemplateRow(legacyResult.data as TemplateRow) }
        }
        return { error: formatTemplateError(legacyResult.error?.message ?? error.message) }
      }
      return { error: formatTemplateError(error?.message ?? '保存模板失败') }
    }
    return { template: mapTemplateRow(data as TemplateRow) }
  } catch (error) {
    return { error: error instanceof Error ? formatTemplateError(error.message) : '保存模板失败' }
  }
}

export async function deleteEmailTemplate(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const { error } = await client.from('lead_email_templates').delete().eq('id', id)
    return error ? { error: formatTemplateError(error.message) } : {}
  } catch (error) {
    return { error: error instanceof Error ? formatTemplateError(error.message) : '删除模板失败' }
  }
}

export async function seedDefaultTemplates(): Promise<{
  templates: EmailTemplateRecord[]
  insertedCount: number
  skippedCount: number
  error?: string
}> {
  if (!isSupabaseConfigured) {
    return { templates: [], insertedCount: 0, skippedCount: 0, error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const currentResult = await client.from('lead_email_templates').select(templateSelectColumns)
    if (currentResult.error) {
      if (!isMissingTemplateWorkflowColumn(currentResult.error.message)) {
        return { templates: [], insertedCount: 0, skippedCount: 0, error: formatTemplateError(currentResult.error.message) }
      }
      const legacyResult = await client.from('lead_email_templates').select(legacyTemplateSelectColumns)
      if (legacyResult.error) {
        return { templates: [], insertedCount: 0, skippedCount: 0, error: formatTemplateError(legacyResult.error.message) }
      }
      const existingLegacyTemplates = ((legacyResult.data as TemplateRow[] | null) ?? []).map(mapTemplateRow)
      const existingLegacyNames = new Set(existingLegacyTemplates.map((template) => template.template_name))
      const legacyTemplatesToInsert = defaultEmailTemplates.filter((template) => !existingLegacyNames.has(template.template_name))
      if (legacyTemplatesToInsert.length === 0) {
        return {
          templates: existingLegacyTemplates,
          insertedCount: 0,
          skippedCount: defaultEmailTemplates.length,
        }
      }
      const legacyInsertResult = await client
        .from('lead_email_templates')
        .insert(legacyTemplatesToInsert.map(buildLegacyTemplatePayload))
        .select('*')
      if (legacyInsertResult.error) {
        return { templates: [], insertedCount: 0, skippedCount: 0, error: formatTemplateError(legacyInsertResult.error.message) }
      }
      const insertedLegacyTemplates = ((legacyInsertResult.data as TemplateRow[] | null) ?? []).map(mapTemplateRow)
      return {
        templates: [...insertedLegacyTemplates, ...existingLegacyTemplates],
        insertedCount: insertedLegacyTemplates.length,
        skippedCount: defaultEmailTemplates.length - insertedLegacyTemplates.length,
      }
    }

    const existingTemplates = ((currentResult.data as TemplateRow[] | null) ?? []).map(mapTemplateRow)
    const existingNames = new Set(existingTemplates.map((template) => template.template_name))
    const templatesToInsert = defaultEmailTemplates.filter((template) => !existingNames.has(template.template_name))

    if (templatesToInsert.length === 0) {
      return {
        templates: existingTemplates,
        insertedCount: 0,
        skippedCount: defaultEmailTemplates.length,
      }
    }

    const { data, error } = await client
      .from('lead_email_templates')
      .insert(templatesToInsert.map(buildTemplatePayload))
      .select('*')

    if (error) {
      return { templates: [], insertedCount: 0, skippedCount: 0, error: formatTemplateError(error.message) }
    }

    const insertedTemplates = ((data as TemplateRow[] | null) ?? []).map(mapTemplateRow)
    return {
      templates: [...insertedTemplates, ...existingTemplates],
      insertedCount: insertedTemplates.length,
      skippedCount: defaultEmailTemplates.length - insertedTemplates.length,
    }
  } catch (error) {
    return {
      templates: [],
      insertedCount: 0,
      skippedCount: 0,
      error: error instanceof Error ? formatTemplateError(error.message) : '写入默认模板失败',
    }
  }
}

export async function cleanupOldDefaultTemplates(): Promise<{ deletedCount: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { deletedCount: 0, error: '请先配置 Supabase 环境变量' }
  }

  try {
    const client = getSupabaseClient()
    const currentResult = await client.from('lead_email_templates').select(templateSelectColumns)
    if (currentResult.error) {
      if (!isMissingTemplateWorkflowColumn(currentResult.error.message)) {
        return { deletedCount: 0, error: formatTemplateError(currentResult.error.message) }
      }
      const legacyResult = await client.from('lead_email_templates').select(legacyTemplateSelectColumns)
      if (legacyResult.error) {
        return { deletedCount: 0, error: formatTemplateError(legacyResult.error.message) }
      }
      const legacyRows = ((legacyResult.data as TemplateRow[] | null) ?? [])
      const legacyIds = legacyRows
        .filter(isOldDefaultTemplateRow)
        .map((row) => row.id)
      if (legacyIds.length === 0) {
        return { deletedCount: 0 }
      }
      const legacyDeleteResult = await client.from('lead_email_templates').delete().in('id', legacyIds)
      return legacyDeleteResult.error
        ? { deletedCount: 0, error: formatTemplateError(legacyDeleteResult.error.message) }
        : { deletedCount: legacyIds.length }
    }

    const rows = ((currentResult.data as TemplateRow[] | null) ?? [])
    const ids = rows
      .filter(isOldDefaultTemplateRow)
      .map((row) => row.id)

    if (ids.length === 0) {
      return { deletedCount: 0 }
    }

    const deleteResult = await client.from('lead_email_templates').delete().in('id', ids)
    return deleteResult.error
      ? { deletedCount: 0, error: formatTemplateError(deleteResult.error.message) }
      : { deletedCount: ids.length }
  } catch (error) {
    return { deletedCount: 0, error: error instanceof Error ? formatTemplateError(error.message) : '清理旧默认模板失败' }
  }
}

export function renderTemplateWithLead(template: Pick<EmailTemplateRecord, 'subject' | 'body'>, lead?: LeadSelectOption | null) {
  const variables: Record<string, string> = {
    company_name: lead?.company_name ?? '',
    contact_name: lead?.contact_name ?? '',
    country: lead?.country ?? '',
    region: lead?.region ?? '',
    customer_type: lead?.customer_type ?? '',
    product_keywords: lead?.product_keywords ?? '',
    matched_weida_product_lines: lead?.matched_weida_product_lines ?? '',
    recommended_products: lead?.matched_weida_product_lines ?? '',
    match_reason: lead?.product_keywords ?? '',
    elan_name: 'Elan',
    elan_title: 'Sales Manager',
    company_english_name: 'Weihai WieldMaster Intelligent Manufacturing Co., Ltd.',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    whatsapp: lead?.whatsapp ?? '',
  }

  return {
    subject: replaceVariables(template.subject, variables),
    body: replaceVariables(template.body, variables),
  }
}

function replaceVariables(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => variables[key] ?? '')
}

function buildTemplatePayload(input: EmailTemplateInput) {
  return {
    template_name: input.template_name,
    name: input.template_name,
    customer_type: input.customer_type,
    category: input.customer_type,
    development_stage: input.development_stage,
    subject: input.subject,
    body: input.body,
    language: input.language || 'en',
    language_code: input.language || 'en',
    is_active: input.is_active,
    variables: templateVariables,
  }
}

function buildLegacyTemplatePayload(input: EmailTemplateInput) {
  return {
    name: input.template_name,
    category: input.customer_type || input.development_stage || 'general',
    language_code: input.language || 'en',
    subject: input.subject,
    body: input.body,
    is_active: input.is_active,
    variables: templateVariables,
  }
}

function mapTemplateRow(row: TemplateRow): EmailTemplateRecord {
  return {
    id: row.id,
    template_name: row.template_name || row.name || '未命名模板',
    customer_type: row.customer_type || row.category || '通用客户',
    development_stage: row.development_stage || row.category || '首轮开发',
    subject: row.subject,
    body: row.body,
    language: row.language || row.language_code || 'en',
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapDefaultTemplates(): EmailTemplateRecord[] {
  const now = new Date().toISOString()
  return defaultEmailTemplates.map((template, index) => ({
    id: `default-${index + 1}`,
    ...template,
    created_at: now,
    updated_at: now,
  }))
}

function isOldDefaultTemplateRow(row: TemplateRow): boolean {
  return [row.template_name, row.name, row.customer_type, row.category, row.development_stage]
    .some((value) => value === 'new_lead' || value === 'quote_follow_up')
}

function isMissingTemplateWorkflowColumn(message: string): boolean {
  return /Could not find the '(template_name|customer_type|development_stage|language)' column/i.test(message)
    || /column .* (template_name|customer_type|development_stage|language) .* does not exist/i.test(message)
}

function formatTemplateError(message: string): string {
  if (/relation .* does not exist|column .* does not exist/i.test(message)) {
    return '数据库表或字段不存在，请先执行最新 migration。'
  }
  if (/permission denied|row-level security/i.test(message)) {
    return 'Supabase 权限不足，请检查 RLS 策略。'
  }
  return message
}
