import {
  BarChart3,
  ClipboardList,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  Mail,
  Search,
  Settings,
  Upload,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, Route, Routes, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import './App.css'
import {
  emailTemplates,
  fieldMappings,
  importBatches,
  leads,
  tasks,
} from './data'
import { isSupabaseConfigured } from './lib/supabase'
import { importLeadListSheet } from './services/leadImportService'
import { fetchLeadPoolRecords } from './services/leadPoolService'
import type {
  ImportPreviewResult,
  ImportProgress,
  Lead,
  LeadImportResult,
  LeadPoolRecord,
  LeadStatus,
  SheetType,
  StandardLeadField,
  TaskStatus,
} from './types'
import {
  applyColumnMappingsToSheet,
  displayWebsite,
  formatFileSize,
  parseLeadFile,
  standardLeadFieldLabels,
  standardLeadFields,
} from './utils/leadImport'

const navItems = [
  { to: '/', label: '工作台', icon: LayoutDashboard },
  { to: '/import', label: '客户导入', icon: Upload },
  { to: '/leads', label: '客户开发池', icon: UsersRound },
  { to: '/tasks', label: '跟进任务', icon: ClipboardList },
  { to: '/templates', label: '邮件模板', icon: Mail },
  { to: '/settings', label: '数据设置', icon: Settings },
]

const statusLabel: Record<LeadStatus, string> = {
  new: '新线索',
  qualified: '已分层',
  contacted: '已触达',
  negotiating: '开发中',
  won: '已成交',
  paused: '暂缓',
}

const taskStatusLabel: Record<TaskStatus, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  skipped: '已跳过',
}

const importSourceTypes = ['广交会', 'Alibaba 国际站', '中国制造网', 'Google', 'LinkedIn', '海关数据', '行业黄页', '手动 Excel', '其他']

const sheetTypeLabel: Record<SheetType, string> = {
  lead_list: '客户明细',
  task_plan: '跟进任务',
  email_template: '邮件模板',
  summary: '总览摘要',
  rules: '规则说明',
  unknown: '未知',
}

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">w</div>
          <div>
            <strong>wieldmaster</strong>
            <span>业务开发系统</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
                end={item.to === '/'}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="side-note">
          <span>第一阶段</span>
          <p>仅搭建系统基础框架，导入、去重、字段识别和邮件发送先保留接口位置。</p>
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/import" element={<LeadImportPage />} />
          <Route path="/leads" element={<LeadPoolPage />} />
          <Route path="/leads/:leadId" element={<LeadDetailPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

function DashboardPage() {
  const activeTasks = tasks.filter((task) => task.status !== 'completed').length
  const highPriority = leads.filter((lead) => lead.tier === 'A').length
  const pendingImports = importBatches.filter((batch) => batch.status !== 'completed').length

  return (
    <section>
      <PageHeader
        title="工作台"
        description="查看客户开发进度、待处理任务和近期导入情况。"
        action={<button className="primary-button">新建导入批次</button>}
      />

      <div className="metric-grid">
        <MetricCard title="客户总数" value={leads.length} detail="当前开发池样例客户" icon={UsersRound} />
        <MetricCard title="A级客户" value={highPriority} detail="优先跟进对象" icon={BarChart3} />
        <MetricCard title="待办任务" value={activeTasks} detail="未完成开发动作" icon={ClipboardList} />
        <MetricCard title="导入处理中" value={pendingImports} detail="等待识别或确认" icon={FileSpreadsheet} />
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="section-title">
            <h2>近期导入</h2>
            <NavLink to="/import">查看导入页</NavLink>
          </div>
          <div className="stack">
            {importBatches.map((batch) => (
              <div className="batch-row" key={batch.id}>
                <FileSpreadsheet size={18} aria-hidden="true" />
                <div>
                  <strong>{batch.fileName}</strong>
                  <span>{batch.totalRows} 行 · {batch.createdAt}</span>
                </div>
                <StatusPill tone={batch.status === 'completed' ? 'green' : 'blue'}>
                  {batch.status === 'completed' ? '已完成' : '待处理'}
                </StatusPill>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <h2>今日建议动作</h2>
            <NavLink to="/tasks">查看任务</NavLink>
          </div>
          <div className="timeline-list">
            {tasks.slice(0, 4).map((task) => (
              <div className="timeline-item" key={task.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.leadName} · 截止 {task.dueDate}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string
  value: number
  detail: string
  icon: LucideIcon
}) {
  return (
    <section className="metric-card">
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
      <Icon size={22} aria-hidden="true" />
    </section>
  )
}

function LeadImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sourceType, setSourceType] = useState('手动 Excel')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [importResult, setImportResult] = useState<LeadImportResult | null>(null)
  const [parseProgress, setParseProgress] = useState<ImportProgress | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)

  const selectedSheet = preview?.sheets[selectedSheetIndex]

  async function handleFile(file: File | undefined) {
    if (!file) {
      return
    }

    setUploadedFile(file)
    setIsParsing(true)
    setMessage('')
    setImportResult(null)
    setImportProgress(null)
    setParseProgress({
      phase: 'reading',
      label: '等待读取文件',
      current: 0,
      total: 1,
      percent: 0,
      detail: file.name,
    })
    try {
      const result = await parseLeadFile(file, setParseProgress)
      setPreview(result)
      setSelectedSheetIndex(result.selectedSheetIndex)
      if (result.error) {
        setMessage(result.error)
      } else if (!result.sheets.some((sheet) => sheet.sheetType === 'lead_list')) {
        setMessage('未识别到客户明细表，请手动选择 sheet。')
      } else {
        setMessage('文件已读取，系统已默认选择第一个客户明细表进行预览。')
      }
    } finally {
      setIsParsing(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFile(event.target.files?.[0])
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    void handleFile(event.dataTransfer.files?.[0])
  }

  function handleMappingChange(columnIndex: number, standardField: StandardLeadField | '') {
    if (!preview || !selectedSheet) {
      return
    }

    const nextMappings = selectedSheet.mappings.map((mapping) =>
      mapping.columnIndex === columnIndex
        ? {
            ...mapping,
            standardField,
            confidence: standardField ? Math.max(mapping.confidence, 0.72) : 0,
            reason: standardField ? '人工调整字段映射。' : '人工取消字段映射。',
          }
        : mapping,
    )
    const nextSheet = applyColumnMappingsToSheet(selectedSheet, nextMappings)
    const nextSheets = preview.sheets.map((sheet, index) => (index === selectedSheetIndex ? nextSheet : sheet))
    setPreview({ ...preview, sheets: nextSheets })
  }

  async function handleReidentify() {
    if (!uploadedFile) {
      setMessage('请先上传 Excel 或 CSV 文件。')
      return
    }
    await handleFile(uploadedFile)
  }

  async function handleImportToLeadPool() {
    if (!selectedSheet || !uploadedFile) {
      setMessage('请先上传并选择客户明细 sheet。')
      return
    }
    if (selectedSheet.sheetType !== 'lead_list') {
      setMessage('当前选择的 sheet 不是客户明细表，不能导入客户池。')
      return
    }
    if (!isSupabaseConfigured) {
      setMessage('请先配置 Supabase 环境变量')
      return
    }
    const hasIdentityMapping = selectedSheet.mappings.some(
      (mapping) =>
        !mapping.isDuplicate &&
        ['company_name', 'email', 'phone', 'website'].includes(mapping.standardField),
    )
    if (!hasIdentityMapping) {
      setMessage('字段映射中至少需要公司名称、邮箱、电话或网站任一字段。')
      return
    }
    const ok = window.confirm(
      `将导入 ${selectedSheet.stats.validRows} 条有效客户，跳过 ${selectedSheet.stats.skippedRows} 条无效行。是否继续？`,
    )
    if (!ok) {
      return
    }

    setIsImporting(true)
    setMessage('正在导入客户池...')
    setImportResult(null)
    setImportProgress({
      phase: 'creating_batch',
      label: '准备导入客户池',
      current: 0,
      total: Math.max(selectedSheet.rows.length, 1),
      percent: 0,
      detail: selectedSheet.sheetName,
    })
    try {
      const result = await importLeadListSheet({
        fileName: uploadedFile.name,
        sourceType,
        sheet: selectedSheet,
        onProgress: setImportProgress,
      })
      setImportResult(result)
      setMessage('客户导入完成。')
    } catch (error) {
      setImportProgress({
        phase: 'error',
        label: '导入失败',
        current: 0,
        total: 1,
        percent: 100,
        detail: error instanceof Error ? error.message : '客户导入失败',
      })
      setMessage(error instanceof Error ? error.message : '客户导入失败')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="站外客户导入"
        description="上传 Excel / CSV 客户表，先完成字段识别、映射预览和数据预览。本阶段不写入数据库。"
        action={<button className="primary-button">创建导入任务</button>}
      />

      <div className="import-grid">
        <section className="panel">
          <div className="section-title">
            <h2>文件上传</h2>
            <span>支持 .xlsx / .xls / .csv</span>
          </div>
          <label
            className="upload-panel upload-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
            <div className="upload-icon">
              <Upload size={28} aria-hidden="true" />
            </div>
            <h2>{isParsing ? '正在解析文件...' : '拖拽或选择客户表'}</h2>
            <p>系统会读取所有 sheet，自动识别表头、字段映射和前 20 行数据预览。</p>
            <button type="button" className="primary-button" disabled={isParsing || isImporting} onClick={() => fileInputRef.current?.click()}>
              选择文件
            </button>
          </label>

          {parseProgress ? <ImportProgressBar progress={parseProgress} /> : null}

          {uploadedFile ? (
            <div className="file-meta">
              <div>
                <strong>{uploadedFile.name}</strong>
                <span>
                  {formatFileSize(uploadedFile.size)} · {uploadedFile.type || '未知类型'}
                </span>
              </div>
              <StatusPill tone={preview?.error ? 'orange' : 'blue'}>{preview?.error ? '解析失败' : '已上传'}</StatusPill>
            </div>
          ) : null}

          <label className="field-label">
            来源类型
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value)} aria-label="来源类型">
              {importSourceTypes.map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="panel">
          <div className="section-title">
            <h2>导入统计</h2>
            <span>{sourceType}</span>
          </div>
          <div className="import-stat-grid">
            <ImportStat label="原始总行数" value={selectedSheet?.stats.totalRows ?? 0} />
            <ImportStat label="有效行数" value={selectedSheet?.stats.validRows ?? 0} />
            <ImportStat label="跳过行数" value={selectedSheet?.stats.skippedRows ?? 0} />
            <ImportStat label="疑似重复行" value={selectedSheet?.stats.duplicateRows ?? 0} />
            <ImportStat label="平均置信度" value={`${Math.round((selectedSheet?.stats.averageConfidence ?? 0) * 100)}%`} />
            <ImportStat label="需人工确认字段" value={selectedSheet?.stats.needsReviewFields ?? 0} />
          </div>
          {message ? <p className={preview?.error ? 'error-text' : 'hint-text'}>{message}</p> : null}
          <div className="upload-actions">
            <button type="button" className="ghost-button" disabled={isParsing || isImporting} onClick={() => fileInputRef.current?.click()}>
              重新上传
            </button>
            <button type="button" className="ghost-button" disabled={isParsing || isImporting} onClick={() => void handleReidentify()}>
              重新识别
            </button>
            <button type="button" className="primary-button" disabled={isParsing || isImporting} onClick={() => setMessage('字段映射已确认，本阶段仅保存在页面状态。')}>
              确认映射
            </button>
            <button type="button" className="primary-button" disabled={isParsing || isImporting} onClick={() => setMessage('下一阶段将写入客户池。')}>
              下一步：准备入库
            </button>
            <button type="button" className="primary-button" disabled={isParsing || isImporting} onClick={() => void handleImportToLeadPool()}>
              {isImporting ? '正在导入...' : '确认导入客户池'}
            </button>
          </div>
          {importProgress ? <ImportProgressBar progress={importProgress} /> : null}
        </section>
      </div>

      {importResult ? (
        <section className="panel import-result-panel">
          <div className="section-title">
            <h2>导入结果</h2>
            <span>批次 ID：{importResult.batchId ?? '-'}</span>
          </div>
          <div className="import-stat-grid">
            <ImportStat label="新增客户数" value={importResult.insertedCount} />
            <ImportStat label="更新客户数" value={importResult.updatedCount} />
            <ImportStat label="跳过行数" value={importResult.skippedCount} />
            <ImportStat label="重复客户数" value={importResult.duplicateCount} />
            <ImportStat label="错误行数" value={importResult.errorCount} />
          </div>
          {importResult.errors.length > 0 ? (
            <div className="warning-box">
              {importResult.errors.slice(0, 5).map((error) => (
                <span key={error}>{error}</span>
              ))}
            </div>
          ) : null}
          <div className="upload-actions">
            <NavLink className="primary-button" to="/leads">
              查看客户开发池
            </NavLink>
            <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()}>
              继续导入
            </button>
          </div>
        </section>
      ) : null}

      {preview?.sheets.length ? <ImportRecommendationCard preview={preview} /> : null}

      {preview?.sheets.length ? (
        <section className="panel">
          <div className="section-title">
            <h2>Sheet 识别结果</h2>
            <span>{preview.sheets.length} 个 sheet</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sheet 名称</th>
                  <th>Sheet 类型</th>
                  <th>总行数</th>
                  <th>表头行</th>
                  <th>字段识别数量</th>
                  <th>平均置信度</th>
                  <th>建议导入</th>
                </tr>
              </thead>
              <tbody>
                {preview.sheets.map((sheet, index) => (
                  <tr key={sheet.sheetName} className={index === selectedSheetIndex ? 'selected-row' : undefined}>
                    <td>
                      <button type="button" className="table-button" onClick={() => setSelectedSheetIndex(index)}>
                        {sheet.sheetName}
                      </button>
                      {sheet.warnings.map((warning) => (
                        <span className="warning-line" key={warning}>
                          {warning}
                        </span>
                      ))}
                    </td>
                    <td>
                      <StatusPill tone={getSheetTypeTone(sheet.sheetType)}>{sheetTypeLabel[sheet.sheetType]}</StatusPill>
                      <span className="subtle-line">
                        {Math.round(sheet.sheetTypeConfidence * 100)}% · {sheet.sheetTypeReason}
                      </span>
                    </td>
                    <td>{sheet.totalRows}</td>
                    <td>
                      第 {sheet.headerRowNumber} 行
                      <span className="subtle-line">{sheet.headerReason}</span>
                    </td>
                    <td>{sheet.stats.mappedFieldCount}</td>
                    <td>{Math.round(sheet.stats.averageConfidence * 100)}%</td>
                    <td>
                      <StatusPill tone={getSuggestedActionTone(sheet.sheetType)}>{sheet.suggestedAction}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedSheet ? (
        <section className="panel">
          <div className="section-title">
            <h2>字段映射预览：{selectedSheet.sheetName}</h2>
            <span>
              {sheetTypeLabel[selectedSheet.sheetType]} · 置信度低于 70% 显示为需确认
            </span>
          </div>
          {selectedSheet.sheetType !== 'lead_list' ? (
            <p className="warning-box">当前 sheet 不是客户明细表，字段映射仅供检查，不会作为客户池导入建议。</p>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>原始列名</th>
                  <th>系统标准字段</th>
                  <th>置信度</th>
                  <th>识别原因</th>
                  <th>状态</th>
                  <th>人工调整</th>
                </tr>
              </thead>
              <tbody>
                {selectedSheet.mappings.map((mapping) => (
                  <tr key={`${mapping.columnIndex}-${mapping.originalColumn}`}>
                    <td>{mapping.originalColumn}</td>
                    <td>{getMappingDisplayName(mapping.originalColumn, mapping.standardField)}</td>
                    <td>{Math.round(mapping.confidence * 100)}%</td>
                    <td>{mapping.reason}</td>
                    <td>
                      <StatusPill tone={mapping.isDuplicate || !mapping.standardField || mapping.confidence < 0.7 ? 'orange' : 'green'}>
                        {mapping.isDuplicate ? '重复字段' : !mapping.standardField || mapping.confidence < 0.7 ? '需确认' : '已识别'}
                      </StatusPill>
                      {mapping.isDuplicate ? <span className="warning-line">重复字段，可作为补充信息</span> : null}
                    </td>
                    <td>
                      <select
                        aria-label={`${mapping.originalColumn} 字段映射`}
                        value={mapping.standardField}
                        onChange={(event) =>
                          handleMappingChange(mapping.columnIndex, event.target.value as StandardLeadField | '')
                        }
                      >
                        <option value="">不映射</option>
                        {standardLeadFields.map((field) => (
                          <option key={field} value={field}>
                            {standardLeadFieldLabels[field]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedSheet ? (
        <section className="panel">
          <div className="section-title">
            <h2>数据预览：{selectedSheet.sheetName}</h2>
            <span>只显示当前选中 sheet 的前 20 行标准化客户数据</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>行号</th>
                  <th>公司名称</th>
                  <th>国家</th>
                  <th>联系人</th>
                  <th>邮箱</th>
                  <th>电话</th>
                  <th>网站</th>
                  <th>客户类型</th>
                  <th>开发层级</th>
                  <th>推荐产品线</th>
                  <th>背调结论</th>
                  <th>风险点</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {selectedSheet.previewRows.length > 0 ? (
                  selectedSheet.previewRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.values.company_name || '-'}</td>
                      <td>{row.values.country || '-'}</td>
                      <td>{row.values.contact_name || '-'}</td>
                      <td>{row.values.email || '-'}</td>
                      <td>{row.values.phone || row.values.whatsapp || '-'}</td>
                      <td>{displayWebsite(row.values.website) || '-'}</td>
                      <td>{row.values.customer_type || '-'}</td>
                      <td>{row.values.development_level || '-'}</td>
                      <td>{row.values.matched_weida_product_lines || row.values.product_keywords || '-'}</td>
                      <td>{row.values.research_summary || '-'}</td>
                      <td>{row.values.risk_notes || '-'}</td>
                      <td>
                        <StatusPill tone={row.status === 'valid' ? 'green' : row.status === 'duplicate' ? 'orange' : 'blue'}>
                          {row.status === 'valid' ? '有效' : row.status === 'duplicate' ? '疑似重复' : '跳过'}
                        </StatusPill>
                        {row.issues.map((issue) => (
                          <span className="warning-line" key={issue}>
                            {issue}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={13}>暂无可预览数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="two-column">
          <section className="panel">
            <div className="section-title">
              <h2>导入批次</h2>
              <span>{importBatches.length} 个批次</span>
            </div>
            <DataTable
              columns={['文件名', '状态', '总行数', '有效客户', '重复', '创建时间']}
              rows={importBatches.map((batch) => [
                batch.fileName,
                batch.status === 'completed' ? '已完成' : '待处理',
                batch.totalRows,
                batch.importedRows,
                batch.duplicateRows,
                batch.createdAt,
              ])}
            />
          </section>

          <section className="panel">
            <h2>导入说明</h2>
            <div className="rule-list">
              <div>
                <strong>本阶段只预览</strong>
                <span>上传文件后仅在页面状态中解析，不会写入 Supabase。</span>
              </div>
              <div>
                <strong>支持多个 sheet</strong>
                <span>系统会读取 Excel 中所有 sheet，并判断哪个更适合导入。</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

function ImportRecommendationCard({ preview }: { preview: ImportPreviewResult }) {
  const grouped = preview.sheets.reduce<Record<SheetType, number>>(
    (acc, sheet) => {
      acc[sheet.sheetType] += 1
      return acc
    },
    {
      lead_list: 0,
      task_plan: 0,
      email_template: 0,
      summary: 0,
      rules: 0,
      unknown: 0,
    },
  )

  return (
    <section className="recommend-card">
      <div>
        <h2>推荐导入对象</h2>
        <p>系统已先区分客户明细、模板、任务、总览和规则说明，避免把加工计划表误导入客户池。</p>
      </div>
      <div className="recommend-list">
        <span>客户明细表：{grouped.lead_list} 个，建议导入客户池</span>
        <span>邮件模板表：{grouped.email_template} 个，建议导入邮件模板</span>
        <span>跟进任务表：{grouped.task_plan} 个，建议导入任务计划</span>
        <span>总览/规则说明：{grouped.summary + grouped.rules} 个，仅供阅读，不导入</span>
        {grouped.unknown > 0 ? <span>未知：{grouped.unknown} 个，需要人工确认</span> : null}
      </div>
    </section>
  )
}

function ImportStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="import-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ImportProgressBar({ progress }: { progress: ImportProgress }) {
  const isError = progress.phase === 'error'
  return (
    <div className={`import-progress ${isError ? 'is-error' : ''}`} role="status" aria-live="polite">
      <div className="import-progress-head">
        <strong>{progress.label}</strong>
        <span>{progress.percent}%</span>
      </div>
      <div className="import-progress-track" aria-hidden="true">
        <div className="import-progress-value" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="import-progress-detail">
        <span>{progress.detail ?? '正在处理数据'}</span>
        <span>
          {progress.current}/{progress.total}
        </span>
      </div>
    </div>
  )
}

function getSheetTypeTone(sheetType: SheetType): 'blue' | 'green' | 'orange' {
  if (sheetType === 'lead_list') {
    return 'green'
  }
  if (sheetType === 'unknown') {
    return 'orange'
  }
  return 'blue'
}

function getSuggestedActionTone(sheetType: SheetType): 'blue' | 'green' | 'orange' {
  if (sheetType === 'lead_list' || sheetType === 'email_template' || sheetType === 'task_plan') {
    return 'green'
  }
  if (sheetType === 'unknown') {
    return 'orange'
  }
  return 'blue'
}

function getMappingDisplayName(originalColumn: string, standardField: StandardLeadField | '') {
  if (standardField) {
    return standardLeadFieldLabels[standardField]
  }
  return /^(序号|编号|no\.?|id)$/i.test(originalColumn.trim()) ? '忽略字段' : '未映射'
}

function mockLeadPoolRecords(): LeadPoolRecord[] {
  return leads.map((lead) => ({
    id: lead.id,
    company_name: lead.companyName,
    contact_name: lead.contactName,
    email: lead.email,
    phone: lead.phone,
    whatsapp: null,
    country: lead.country,
    region: null,
    website: lead.website,
    product_keywords: lead.industry,
    customer_type: null,
    source_type: lead.source,
    source_detail: lead.source,
    development_level: lead.tier,
    priority_score: lead.tier === 'A' ? 80 : lead.tier === 'B' ? 60 : 40,
    status: statusLabel[lead.status],
    created_at: new Date().toISOString(),
  }))
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString('zh-CN')
}

function getWebsiteHref(value: string | null): string {
  const website = value?.trim()
  if (!website || /\s/.test(website)) {
    return ''
  }
  const candidate = /^https?:\/\//i.test(website) ? website : `https://${website}`
  try {
    const url = new URL(candidate)
    return url.hostname.includes('.') ? url.toString() : ''
  } catch {
    return ''
  }
}

function formatWebsiteLabel(value: string | null): string {
  const website = value?.trim()
  if (!website) {
    return '-'
  }
  return website.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

function normalizeLeadStatus(value: string | null): string {
  const status = value?.trim()
  if (!status) {
    return '待开发'
  }
  if (status.includes('回复')) return '已回复'
  if (status.includes('报价')) return '报价中'
  if (status.includes('暂缓') || status.includes('暂停')) return '暂缓'
  if (status.includes('无效') || status.includes('失效')) return '无效'
  if (status.includes('联系') || status.includes('触达')) return '已联系'
  return status === '新线索' || status === '已分层' || status === '开发中' ? '待开发' : status
}

function getLeadLevelClass(value: string | null): string {
  const level = value?.trim().toUpperCase() || 'C'
  if (level === 'A+') return 'level-a-plus'
  if (level === 'A') return 'level-a'
  if (level === 'B+') return 'level-b-plus'
  if (level === 'B') return 'level-b'
  if (level === 'D') return 'level-d'
  return 'level-c'
}

function getLeadStatusClass(value: string): string {
  if (value === '已联系') return 'status-contacted'
  if (value === '已回复') return 'status-replied'
  if (value === '报价中') return 'status-quoting'
  if (value === '暂缓') return 'status-paused'
  if (value === '无效') return 'status-invalid'
  return 'status-pending'
}

function LeadPoolPage() {
  const [records, setRecords] = useState<LeadPoolRecord[]>([])
  const [poolMessage, setPoolMessage] = useState('')
  const [usedMock, setUsedMock] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [levelFilter, setLevelFilter] = useState('全部层级')
  const [sourceFilter, setSourceFilter] = useState('全部来源')

  useEffect(() => {
    let mounted = true
    void fetchLeadPoolRecords().then((result) => {
      if (!mounted) {
        return
      }
      if (result.usedMock) {
        setRecords(mockLeadPoolRecords())
        setUsedMock(true)
        setPoolMessage(result.error ?? '当前使用示例客户数据。')
      } else {
        setRecords(result.records)
        setUsedMock(false)
        setPoolMessage(result.records.length === 0 ? 'Supabase 已连接，但客户池暂无数据。' : '')
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  const sourceOptions = useMemo(
    () => ['全部来源', ...Array.from(new Set(records.map((record) => record.source_type).filter(Boolean) as string[]))],
    [records],
  )
  const filteredRecords = records.filter((record) => {
    const keyword = searchKeyword.trim().toLowerCase()
    const matchesKeyword =
      !keyword ||
      [
        record.company_name,
        record.country,
        record.region,
        record.contact_name,
        record.email,
        record.product_keywords,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    const matchesLevel = levelFilter === '全部层级' || record.development_level === levelFilter
    const matchesSource = sourceFilter === '全部来源' || record.source_type === sourceFilter
    return matchesKeyword && matchesLevel && matchesSource
  })
  const poolStats = {
    total: records.length,
    email: records.filter((record) => Boolean(record.email?.trim())).length,
    phone: records.filter((record) => Boolean(record.phone?.trim() || record.whatsapp?.trim())).length,
    website: records.filter((record) => Boolean(getWebsiteHref(record.website))).length,
  }

  return (
    <section>
      <PageHeader
        title="客户开发池"
        description="集中管理已导入客户，支持按层级、来源和关键词筛选。"
        action={<button className="primary-button">新增客户</button>}
      />

      {poolMessage ? <p className={usedMock ? 'warning-box' : 'hint-text'}>{poolMessage}</p> : null}

      <div className="metric-grid lead-pool-stats">
        <MetricCard title="客户总数" value={poolStats.total} detail="当前客户池记录" icon={UsersRound} />
        <MetricCard title="有邮箱客户数" value={poolStats.email} detail="可优先开发信触达" icon={Mail} />
        <MetricCard title="有电话客户数" value={poolStats.phone} detail="可电话或 WhatsApp 跟进" icon={ClipboardList} />
        <MetricCard title="有网站客户数" value={poolStats.website} detail="可查看官网背景" icon={Database} />
      </div>

      <div className="toolbar">
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            placeholder="搜索公司、国家、区域、联系人、邮箱或产品"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
          />
        </label>
        <select aria-label="客户分层" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
          <option>全部层级</option>
          <option>A+</option>
          <option>A</option>
          <option>B+</option>
          <option>B</option>
          <option>C</option>
          <option>D</option>
        </select>
        <select aria-label="来源筛选" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
          {sourceOptions.map((source) => (
            <option key={source}>{source}</option>
          ))}
        </select>
      </div>

      <section className="panel lead-pool-panel">
        <DataTable
          className="lead-pool-table"
          columns={['公司名称', '国家', '区域', '联系人', '邮箱', '电话', '网站', '产品/主营/采购需求', '开发层级', '优先分', '状态', '来源', '创建时间']}
          rows={filteredRecords.map((lead) => {
            const websiteHref = getWebsiteHref(lead.website)
            const leadStatus = normalizeLeadStatus(lead.status)
            const level = lead.development_level?.trim() || 'C'
            return [
              <NavLink to={`/leads/${lead.id}`} className="table-link lead-company-link" key={lead.id} title={lead.company_name}>
                {lead.company_name}
              </NavLink>,
              lead.country ?? '-',
              lead.region ?? '-',
              lead.contact_name ?? '-',
              lead.email ?? '-',
              lead.phone || lead.whatsapp || '-',
              websiteHref ? (
                <a className="table-link website-link" href={websiteHref} target="_blank" rel="noreferrer" title={websiteHref}>
                  {formatWebsiteLabel(lead.website)}
                </a>
              ) : (
                '-'
              ),
              <span className="truncate-cell" title={lead.product_keywords ?? '-'}>
                {lead.product_keywords ?? '-'}
              </span>,
              <span className={`lead-tag ${getLeadLevelClass(level)}`}>{level}</span>,
              lead.priority_score ?? 0,
              <span className={`lead-tag ${getLeadStatusClass(leadStatus)}`}>{leadStatus}</span>,
              lead.source_type ?? lead.source_detail ?? '-',
              formatDate(lead.created_at),
            ]
          })}
        />
      </section>
    </section>
  )
}

function LeadDetailPage() {
  const { leadId } = useParams()
  const lead = leads.find((item) => item.id === leadId) ?? leads[0]

  return (
    <section>
      <PageHeader
        title={lead.companyName}
        description={`${lead.country} · ${lead.industry} · ${statusLabel[lead.status]}`}
        action={<button className="primary-button">创建跟进任务</button>}
      />

      <div className="detail-grid">
        <section className="panel detail-card">
          <h2>客户基础信息</h2>
          <InfoList lead={lead} />
        </section>

        <section className="panel detail-card">
          <h2>调研记录</h2>
          <p className="muted-text">
            第一阶段只展示调研字段位置，后续可接入人工录入、来源记录和结构化标签。
          </p>
          <div className="research-box">
            <Database size={18} aria-hidden="true" />
            <span>{lead.researchSummary}</span>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="section-title">
          <h2>沟通与任务</h2>
          <span>客户详情页占位</span>
        </div>
        <DataTable
          columns={['类型', '内容', '负责人', '日期', '状态']}
          rows={tasks
            .filter((task) => task.leadId === lead.id)
            .map((task) => ['任务', task.title, task.owner, task.dueDate, taskStatusLabel[task.status]])}
        />
      </section>
    </section>
  )
}

function InfoList({ lead }: { lead: Lead }) {
  const items = [
    ['联系人', lead.contactName],
    ['邮箱', lead.email],
    ['电话', lead.phone],
    ['网站', lead.website],
    ['来源', lead.source],
    ['负责人', lead.owner],
  ]

  return (
    <dl className="info-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function TasksPage() {
  return (
    <section>
      <PageHeader
        title="开发任务"
        description="按照客户阶段安排跟进动作，后续支持看板、提醒和批量分配。"
        action={<button className="primary-button">新建任务</button>}
      />

      <div className="kanban">
        {(['pending', 'in_progress', 'completed'] as TaskStatus[]).map((status) => (
          <section className="task-column" key={status}>
            <div className="section-title">
              <h2>{taskStatusLabel[status]}</h2>
              <span>{tasks.filter((task) => task.status === status).length}</span>
            </div>
            <div className="stack">
              {tasks
                .filter((task) => task.status === status)
                .map((task) => (
                  <article className="task-card" key={task.id}>
                    <strong>{task.title}</strong>
                    <p>{task.leadName}</p>
                    <div>
                      <StatusPill tone={task.priority === '高' ? 'orange' : 'blue'}>
                        {task.priority}优先级
                      </StatusPill>
                      <span>{task.dueDate}</span>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function TemplatesPage() {
  return (
    <section>
      <PageHeader
        title="邮件模板"
        description="维护开发邮件内容。第一阶段只做模板库页面，不发送邮件。"
        action={<button className="primary-button">新建模板</button>}
      />

      <section className="panel template-list">
        {emailTemplates.map((template) => (
          <article className="template-card" key={template.id}>
            <div>
              <span>{template.category}</span>
              <h2>{template.name}</h2>
              <p>{template.subject}</p>
            </div>
            <pre>{template.preview}</pre>
          </article>
        ))}
      </section>
    </section>
  )
}

function SettingsPage() {
  return (
    <section>
      <PageHeader
        title="数据设置"
        description="预留字段映射、导入规则、去重规则和客户分层规则配置。"
      />

      <div className="settings-grid">
        <section className="panel">
          <div className="section-title">
            <h2>字段映射模板</h2>
            <button className="ghost-button">新增映射</button>
          </div>
          <DataTable
            columns={['模板名称', '文件类型', '映射字段数', '默认', '更新时间']}
            rows={fieldMappings.map((mapping) => [
              mapping.name,
              mapping.sourceType,
              mapping.fieldCount,
              mapping.isDefault ? '是' : '否',
              mapping.updatedAt,
            ])}
          />
        </section>

        <section className="panel">
          <h2>后续规则位置</h2>
          <div className="rule-list">
            <div>
              <strong>客户去重</strong>
              <span>公司名、邮箱、网站、电话组合判断。</span>
            </div>
            <div>
              <strong>客户分层</strong>
              <span>国家、行业、采购意向、公司规模综合评分。</span>
            </div>
            <div>
              <strong>任务看板</strong>
              <span>按照状态、负责人、截止日期生成视图。</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}

function DataTable({ columns, rows, className }: { columns: string[]; rows: ReactNode[][]; className?: string }) {
  return (
    <div className="table-wrap">
      <table className={className}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>暂无数据</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'blue' | 'green' | 'orange' }) {
  return <span className={`status-pill ${tone}`}>{children}</span>
}

export default App
