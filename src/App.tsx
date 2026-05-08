import {
  BarChart3,
  ClipboardList,
  Copy,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Mail,
  Search,
  Settings,
  Trash2,
  Upload,
  UsersRound,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { NavLink, Route, Routes, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from 'react'
import './App.css'
import { fieldMappings, importBatches, leads, tasks } from './data'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  cleanupOldDefaultTemplates,
  createEmailTemplate,
  deleteEmailTemplate,
  fetchEmailTemplates,
  renderTemplateWithLead,
  seedDefaultTemplates,
  templateVariables,
  updateEmailTemplate,
} from './services/emailTemplateService'
import { importLeadListSheet } from './services/leadImportService'
import {
  assignLead,
  claimLead,
  createLeadCommunication,
  fetchLeadPoolRecords,
  releaseLead,
} from './services/leadPoolService'
import {
  createTask,
  fetchLeadsForTaskSelect,
  fetchTasks,
  markTaskInvalid,
  updateTask,
} from './services/leadTaskService'
import {
  canManageTeam,
  fetchAssignableProfiles,
  fetchCurrentUserProfile,
  getProfileDisplayName,
} from './services/userProfileService'
import type {
  DashboardStats,
  EmailTemplateInput,
  EmailTemplateRecord,
  ImportPreviewResult,
  ImportProgress,
  Lead,
  LeadCommunicationInput,
  LeadImportResult,
  LeadPoolRecord,
  LeadSelectOption,
  LeadTaskInput,
  LeadTaskPriority,
  LeadTaskRecord,
  LeadTaskStatus,
  LeadStatus,
  SheetType,
  StandardLeadField,
  TaskStatus,
  UserProfile,
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

const leadTaskStatusLabels: Record<LeadTaskStatus, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  paused: '暂缓',
  invalid: '无效',
}

const leadTaskPriorityLabels: Record<LeadTaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
}

const taskBoardStatuses: LeadTaskStatus[] = ['pending', 'in_progress', 'completed', 'paused', 'invalid']
const taskTypeOptions = ['首轮开发', 'D3跟进', 'D7跟进', 'D14跟进', '样品跟进', '报价跟进', '资料补充', '其他']

const importSourceTypes = ['广交会', 'Alibaba 国际站', '中国制造网', 'Google', 'LinkedIn', '海关数据', '行业黄页', '手动 Excel', '其他']

const sheetTypeLabel: Record<SheetType, string> = {
  lead_list: '客户明细',
  task_plan: '跟进任务',
  email_template: '邮件模板',
  summary: '总览摘要',
  rules: '规则说明',
  unknown: '未知',
}

function getRoleLabel(role?: string): string {
  if (role === 'admin') return '管理员'
  if (role === 'manager') return '经理'
  return '业务员'
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null)
  const [profileMessage, setProfileMessage] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return
    }

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setIsCheckingAuth(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setIsCheckingAuth(false)
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      return
    }

    let mounted = true
    void fetchCurrentUserProfile(session.user).then((result) => {
      if (!mounted) return
      setCurrentProfile(result.profile)
      setProfileMessage(result.error ?? '')
    })
    return () => {
      mounted = false
    }
  }, [session])

  async function handleSignOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null)
    setCurrentProfile(null)
  }

  if (!isSupabaseConfigured) {
    return <AuthSetupScreen />
  }

  if (isCheckingAuth) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand auth-brand">
            <div className="brand-mark">w</div>
            <div>
              <strong>wieldmaster</strong>
              <span>业务开发系统</span>
            </div>
          </div>
          <p className="hint-text">正在检查登录状态...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <AuthPage />
  }

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
          <span>当前账号</span>
          <p>{getProfileDisplayName(currentProfile, session.user.email)}</p>
          <p>{session.user.email}</p>
          <p>{getRoleLabel(currentProfile?.role)}</p>
          <button className="ghost-button sign-out-button" onClick={() => void handleSignOut()}>
            <LogOut size={15} aria-hidden="true" />
            退出登录
          </button>
        </div>
      </aside>

      <main className="content">
        {profileMessage ? <p className="warning-box">{profileMessage}</p> : null}
        <Routes>
          <Route path="/" element={<DashboardPage currentProfile={currentProfile} />} />
          <Route path="/import" element={<LeadImportPage />} />
          <Route path="/leads" element={<LeadPoolPage currentProfile={currentProfile} />} />
          <Route path="/leads/:leadId" element={<LeadDetailPage />} />
          <Route path="/tasks" element={<TasksPage currentProfile={currentProfile} />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function AuthSetupScreen() {
  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark">w</div>
          <div>
            <strong>wieldmaster</strong>
            <span>业务开发系统</span>
          </div>
        </div>
        <h1>请先配置 Supabase 环境变量</h1>
        <p>网络版需要 Supabase Auth 和数据库连接。请在本地或部署平台配置以下环境变量后重新打开系统。</p>
        <div className="env-list">
          <code>VITE_SUPABASE_URL</code>
          <code>VITE_SUPABASE_ANON_KEY</code>
        </div>
      </section>
    </div>
  )
}

function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setMessage('请先配置 Supabase 环境变量。')
      return
    }
    if (!email.trim() || !password.trim()) {
      setMessage('请输入邮箱和密码。')
      return
    }

    setIsSubmitting(true)
    setMessage('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      })
    setIsSubmitting(false)

    if (result.error) {
      setMessage(formatAuthError(result.error.message))
      return
    }

    if (mode === 'register' && !result.data.session) {
      setMessage('注册已提交，请按邮箱确认邮件完成账号激活。')
      return
    }

    setMessage(mode === 'login' ? '登录成功，正在进入系统。' : '注册成功，正在进入系统。')
  }

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark">w</div>
          <div>
            <strong>wieldmaster</strong>
            <span>业务开发系统</span>
          </div>
        </div>
        <h1>{mode === 'login' ? '账号登录' : '注册账号'}</h1>
        <p>业务员登录后可共同使用客户导入、客户池、跟进任务和邮件模板库。</p>

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          {mode === 'register' ? (
            <label>
              <span>姓名</span>
              <input
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="请输入姓名"
              />
            </label>
          ) : null}
          <label>
            <span>邮箱</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 6 位密码"
            />
          </label>
          {message ? <p className="warning-box">{message}</p> : null}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <button
          className="link-button"
          type="button"
          onClick={() => {
            setMode((current) => (current === 'login' ? 'register' : 'login'))
            setMessage('')
          }}
        >
          {mode === 'login' ? '没有账号？注册业务员账号' : '已有账号？返回登录'}
        </button>
      </section>
    </div>
  )
}

function formatAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return '邮箱或密码不正确。'
  }
  if (/email not confirmed/i.test(message)) {
    return '邮箱尚未确认，请先打开确认邮件。'
  }
  if (/password/i.test(message)) {
    return '密码不符合要求，请至少使用 6 位字符。'
  }
  if (/already registered|user already registered/i.test(message)) {
    return '该邮箱已注册，请直接登录。'
  }
  return message
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

function DashboardPage({ currentProfile }: { currentProfile: UserProfile | null }) {
  const [dashboardRecords, setDashboardRecords] = useState<LeadPoolRecord[]>([])
  const [dashboardTasks, setDashboardTasks] = useState<LeadTaskRecord[]>([])
  const [dashboardMessage, setDashboardMessage] = useState('')
  const isTeamView = canManageTeam(currentProfile)

  useEffect(() => {
    let mounted = true
    async function loadDashboard() {
      const [leadResult, taskResult] = await Promise.all([
        fetchLeadPoolRecords({ profile: currentProfile, view: isTeamView ? 'team' : 'mine' }),
        fetchTasks(),
      ])
      if (!mounted) return
      setDashboardRecords(leadResult.usedMock ? mockLeadPoolRecords() : leadResult.records)
      setDashboardTasks(taskResult.tasks)
      setDashboardMessage(leadResult.error ?? taskResult.error ?? '')
    }
    void loadDashboard()
    return () => {
      mounted = false
    }
  }, [currentProfile, isTeamView])

  const stats = useMemo(
    () => buildDashboardStats(dashboardRecords, dashboardTasks, currentProfile),
    [currentProfile, dashboardRecords, dashboardTasks],
  )

  return (
    <section>
      <PageHeader
        title="工作台"
        description={isTeamView ? '查看团队客户归属、待跟进和业务员开发负荷。' : '查看我的客户、今日待跟进和逾期任务。'}
        action={<button className="primary-button">新建导入批次</button>}
      />

      {dashboardMessage ? <p className="warning-box">{dashboardMessage}</p> : null}

      <div className="metric-grid">
        <MetricCard title={isTeamView ? '全部客户数' : '我的客户数'} value={isTeamView ? stats.totalLeads : stats.myLeads} detail="当前可见客户" icon={UsersRound} />
        <MetricCard title={isTeamView ? '公海客户数' : '今日待跟进'} value={isTeamView ? stats.publicLeads : stats.todayTasks} detail={isTeamView ? '未分配客户' : '今天需要处理'} icon={BarChart3} />
        <MetricCard title="逾期任务" value={stats.overdueTasks} detail="超过截止日期未完成" icon={ClipboardList} />
        <MetricCard title={isTeamView ? '报价中客户' : '本周已联系'} value={isTeamView ? stats.quotingLeads : stats.contactedThisWeek} detail={isTeamView ? '销售机会推进中' : '本周沟通记录'} icon={Mail} />
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
            <h2>{isTeamView ? '业务员客户分布' : '今日建议动作'}</h2>
            <NavLink to="/tasks">查看任务</NavLink>
          </div>
          {isTeamView ? (
            <DataTable
              columns={['业务员', '客户数', '待跟进', '逾期']}
              rows={stats.salesBreakdown.map((item) => [
                item.owner_name,
                item.leadCount,
                item.pendingTasks,
                item.overdueTasks,
              ])}
            />
          ) : (
            <div className="timeline-list">
              {dashboardTasks.slice(0, 4).map((task) => (
                <div className="timeline-item" key={task.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{task.task_title}</strong>
                    <p>{task.lead_company_name} · 截止 {task.due_date || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

function buildDashboardStats(
  records: LeadPoolRecord[],
  taskRecords: LeadTaskRecord[],
  profile: UserProfile | null,
): DashboardStats {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1)
  const userId = profile?.user_id
  const myRecords = userId ? records.filter((record) => record.owner_user_id === userId) : records
  const myTasks = userId
    ? taskRecords.filter((task) => task.assigned_user_id === userId || records.some((record) => record.id === task.lead_id && record.owner_user_id === userId))
    : taskRecords

  const isDueToday = (value: string | null) => {
    if (!value) return false
    const date = new Date(value)
    return date >= today && date < tomorrow
  }
  const isOverdue = (value: string | null) => {
    if (!value) return false
    const date = new Date(value)
    return date < today
  }
  const isThisWeek = (value: string | null) => {
    if (!value) return false
    return new Date(value) >= weekStart
  }

  const salesMap = new Map<string, DashboardStats['salesBreakdown'][number]>()
  records.forEach((record) => {
    const key = record.owner_user_id || 'public'
    const current = salesMap.get(key) ?? {
      owner_user_id: record.owner_user_id,
      owner_name: record.owner_name || '公海',
      leadCount: 0,
      pendingTasks: 0,
      overdueTasks: 0,
    }
    current.leadCount += 1
    salesMap.set(key, current)
  })
  taskRecords.forEach((task) => {
    const key = task.assigned_user_id || 'unassigned'
    const current = salesMap.get(key) ?? {
      owner_user_id: task.assigned_user_id,
      owner_name: task.assigned_user_name || task.owner_name || '未分配',
      leadCount: 0,
      pendingTasks: 0,
      overdueTasks: 0,
    }
    if (task.status !== 'completed' && task.status !== 'invalid') {
      current.pendingTasks += 1
    }
    if (task.status !== 'completed' && task.status !== 'invalid' && isOverdue(task.due_date)) {
      current.overdueTasks += 1
    }
    salesMap.set(key, current)
  })

  return {
    totalLeads: records.length,
    publicLeads: records.filter((record) => !record.owner_user_id || record.claim_status === '公海').length,
    myLeads: myRecords.length,
    todayTasks: myTasks.filter((task) => task.status !== 'completed' && isDueToday(task.due_date)).length,
    overdueTasks: myTasks.filter((task) => task.status !== 'completed' && task.status !== 'invalid' && isOverdue(task.due_date)).length,
    contactedThisWeek: myRecords.filter((record) => isThisWeek(record.last_activity_at)).length,
    repliedThisWeek: myRecords.filter((record) => normalizeLeadStatus(record.status) === '已回复' && isThisWeek(record.last_activity_at)).length,
    quotingLeads: records.filter((record) => normalizeLeadStatus(record.status) === '报价中').length,
    salesBreakdown: Array.from(salesMap.values()).sort((a, b) => b.leadCount - a.leadCount),
  }
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
    owner_user_id: null,
    owner_name: null,
    assigned_at: null,
    assigned_by: null,
    claim_status: '公海',
    last_activity_at: null,
    next_followup_at: lead.nextFollowUp,
    last_communication_user_name: null,
    last_communication_at: null,
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

function formatNullableDate(value: string | null | undefined): string {
  return value ? formatDate(value) : '-'
}

function isSameDay(value: string | null | undefined, target: Date): boolean {
  if (!value) return false
  const date = new Date(value)
  return date.getFullYear() === target.getFullYear()
    && date.getMonth() === target.getMonth()
    && date.getDate() === target.getDate()
}

function isPastDate(value: string | null | undefined): boolean {
  if (!value) return false
  const date = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

function isThisWeekDate(value: string | null | undefined): boolean {
  if (!value) return false
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(today.getDate() - today.getDay() + 1)
  return new Date(value) >= weekStart
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

function LeadPoolPage({ currentProfile }: { currentProfile: UserProfile | null }) {
  const [records, setRecords] = useState<LeadPoolRecord[]>([])
  const [assignableProfiles, setAssignableProfiles] = useState<UserProfile[]>([])
  const [poolMessage, setPoolMessage] = useState('')
  const [usedMock, setUsedMock] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [levelFilter, setLevelFilter] = useState('全部层级')
  const [sourceFilter, setSourceFilter] = useState('全部来源')
  const [ownerFilter, setOwnerFilter] = useState('全部负责人')
  const [claimFilter, setClaimFilter] = useState('全部归属')
  const [statusFilter, setStatusFilter] = useState('全部状态')
  const [activityFilter, setActivityFilter] = useState('全部最近跟进')
  const [followupFilter, setFollowupFilter] = useState('全部跟进')
  const [viewMode, setViewMode] = useState<'mine' | 'public' | 'team'>('mine')
  const [selectedLead, setSelectedLead] = useState<LeadPoolRecord | null>(null)
  const [assignTargetUserId, setAssignTargetUserId] = useState('')
  const [communicationDraft, setCommunicationDraft] = useState<LeadCommunicationInput>(createEmptyCommunicationInput(''))
  const [modalMode, setModalMode] = useState<'assign' | 'communication' | null>(null)
  const canManage = canManageTeam(currentProfile)
  const activeViewMode = !canManage && viewMode === 'team' ? 'mine' : viewMode

  useEffect(() => {
    let mounted = true
    async function loadLeadPool() {
      const [leadResult, profileResult] = await Promise.all([
        fetchLeadPoolRecords({ profile: currentProfile, view: activeViewMode }),
        fetchAssignableProfiles(),
      ])
      if (!mounted) {
        return
      }
      setAssignableProfiles(profileResult.profiles)
      if (leadResult.usedMock) {
        setRecords(mockLeadPoolRecords())
        setUsedMock(true)
        setPoolMessage(leadResult.error ?? profileResult.error ?? '当前使用示例客户数据。')
      } else {
        setRecords(leadResult.records)
        setUsedMock(false)
        setPoolMessage(leadResult.records.length === 0 ? 'Supabase 已连接，但当前视图暂无客户。' : profileResult.error ?? '')
      }
    }
    void loadLeadPool()
    return () => {
      mounted = false
    }
  }, [activeViewMode, currentProfile])

  function updateRecordInState(nextRecord: LeadPoolRecord) {
    setRecords((current) => current.map((record) => (record.id === nextRecord.id ? { ...record, ...nextRecord } : record)))
  }

  async function handleClaimLead(lead: LeadPoolRecord) {
    if (!currentProfile) {
      setPoolMessage('请先登录并加载用户资料。')
      return
    }
    const result = await claimLead(lead, currentProfile)
    if (result.error || !result.record) {
      setPoolMessage(result.error ?? '领取客户失败')
      return
    }
    updateRecordInState(result.record)
    setPoolMessage('客户已领取到我的客户。')
  }

  function openAssignLead(lead: LeadPoolRecord) {
    setSelectedLead(lead)
    setAssignTargetUserId(lead.owner_user_id || assignableProfiles[0]?.user_id || '')
    setModalMode('assign')
  }

  async function handleAssignLead() {
    if (!selectedLead || !currentProfile) return
    const targetProfile = assignableProfiles.find((profile) => profile.user_id === assignTargetUserId)
    if (!targetProfile) {
      setPoolMessage('请选择要分配的业务员。')
      return
    }
    const result = await assignLead(selectedLead.id, targetProfile, currentProfile)
    if (result.error || !result.record) {
      setPoolMessage(result.error ?? '分配客户失败')
      return
    }
    updateRecordInState(result.record)
    setPoolMessage('客户负责人已更新。')
    setModalMode(null)
    setSelectedLead(null)
  }

  async function handleReleaseLead(lead: LeadPoolRecord) {
    if (!currentProfile) {
      setPoolMessage('请先登录并加载用户资料。')
      return
    }
    const ok = window.confirm(`确认将 ${lead.company_name} 释放到公海吗？`)
    if (!ok) return
    const result = await releaseLead(lead, currentProfile)
    if (result.error || !result.record) {
      setPoolMessage(result.error ?? '释放客户失败')
      return
    }
    updateRecordInState(result.record)
    setPoolMessage('客户已释放到公海。')
  }

  function openCommunicationModal(lead: LeadPoolRecord) {
    setSelectedLead(lead)
    setCommunicationDraft(createEmptyCommunicationInput(lead.id))
    setModalMode('communication')
  }

  async function handleSaveCommunication() {
    if (!currentProfile || !selectedLead) return
    if (!communicationDraft.contact_result.trim() && !communicationDraft.content.trim()) {
      setPoolMessage('请填写沟通结果或沟通内容。')
      return
    }
    const result = await createLeadCommunication(communicationDraft, currentProfile)
    if (result.error) {
      setPoolMessage(result.error)
      return
    }
    const now = new Date().toISOString()
    updateRecordInState({
      ...selectedLead,
      claim_status: communicationDraft.contact_result === '已成交' ? '已成交' : '跟进中',
      last_activity_at: now,
      next_followup_at: communicationDraft.next_followup_at || null,
      last_communication_user_name: getProfileDisplayName(currentProfile),
      last_communication_at: now,
    })
    setPoolMessage('沟通记录已保存。')
    setModalMode(null)
    setSelectedLead(null)
  }

  async function handleCreateTaskForLead(lead: LeadPoolRecord) {
    if (!currentProfile) {
      setPoolMessage('请先登录并加载用户资料。')
      return
    }
    const result = await createTask({
      ...createEmptyTaskInput(lead.id),
      task_title: `首轮开发 - ${lead.company_name}`,
      task_description: '从客户开发池创建的跟进任务。',
      due_date: new Date().toISOString().slice(0, 10),
      owner_name: getProfileDisplayName(currentProfile),
      assigned_user_id: currentProfile.user_id,
      assigned_user_name: getProfileDisplayName(currentProfile),
    })
    setPoolMessage(result.error ?? '已创建跟进任务。')
  }

  const sourceOptions = useMemo(
    () => ['全部来源', ...Array.from(new Set(records.map((record) => record.source_type).filter(Boolean) as string[]))],
    [records],
  )
  const ownerOptions = useMemo(
    () => ['全部负责人', ...Array.from(new Set(records.map((record) => record.owner_name || '公海')))],
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
    const matchesOwner = ownerFilter === '全部负责人' || (record.owner_name || '公海') === ownerFilter
    const matchesClaim = claimFilter === '全部归属' || (record.claim_status || '公海') === claimFilter
    const leadStatus = normalizeLeadStatus(record.status)
    const matchesStatus = statusFilter === '全部状态' || leadStatus === statusFilter
    const matchesActivity = activityFilter === '全部最近跟进'
      || (activityFilter === '本周已跟进' && isThisWeekDate(record.last_activity_at))
      || (activityFilter === '从未跟进' && !record.last_activity_at)
    const matchesFollowup = followupFilter === '全部跟进'
      || (followupFilter === '今日跟进' && isSameDay(record.next_followup_at, new Date()))
      || (followupFilter === '逾期' && isPastDate(record.next_followup_at))
      || (followupFilter === '无下次跟进' && !record.next_followup_at)
    return matchesKeyword && matchesLevel && matchesSource && matchesOwner && matchesClaim && matchesStatus && matchesActivity && matchesFollowup
  })
  const poolStats = {
    total: records.length,
    email: records.filter((record) => Boolean(record.email?.trim())).length,
    phone: records.filter((record) => Boolean(record.phone?.trim() || record.whatsapp?.trim())).length,
    website: records.filter((record) => Boolean(getWebsiteHref(record.website))).length,
    public: records.filter((record) => !record.owner_user_id || record.claim_status === '公海').length,
  }

  return (
    <section>
      <PageHeader
        title="客户开发池"
        description="按我的客户、公海客户和团队客户管理客户归属，支持领取、分配、释放和沟通记录。"
        action={<button className="primary-button">新增客户</button>}
      />

      {poolMessage ? <p className={usedMock ? 'warning-box' : 'hint-text'}>{poolMessage}</p> : null}

      <div className="metric-grid lead-pool-stats">
        <MetricCard title="客户总数" value={poolStats.total} detail="当前客户池记录" icon={UsersRound} />
        <MetricCard title="有邮箱客户数" value={poolStats.email} detail="可优先开发信触达" icon={Mail} />
        <MetricCard title="有电话客户数" value={poolStats.phone} detail="可电话或 WhatsApp 跟进" icon={ClipboardList} />
        <MetricCard title="公海客户数" value={poolStats.public} detail="可领取或分配" icon={Database} />
      </div>

      <div className="view-tabs" role="tablist" aria-label="客户池视图">
        <button className={activeViewMode === 'mine' ? 'active' : ''} type="button" onClick={() => setViewMode('mine')}>
          我的客户
        </button>
        <button className={activeViewMode === 'public' ? 'active' : ''} type="button" onClick={() => setViewMode('public')}>
          公海客户
        </button>
        {canManage ? (
          <button className={activeViewMode === 'team' ? 'active' : ''} type="button" onClick={() => setViewMode('team')}>
            团队客户
          </button>
        ) : null}
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
        <select aria-label="负责人筛选" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
          {ownerOptions.map((owner) => (
            <option key={owner}>{owner}</option>
          ))}
        </select>
        <select aria-label="归属状态" value={claimFilter} onChange={(event) => setClaimFilter(event.target.value)}>
          <option>全部归属</option>
          <option>公海</option>
          <option>已分配</option>
          <option>跟进中</option>
          <option>已成交</option>
          <option>暂缓</option>
          <option>无效</option>
        </select>
        <select aria-label="开发状态" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option>全部状态</option>
          <option>待开发</option>
          <option>已联系</option>
          <option>已回复</option>
          <option>报价中</option>
          <option>暂缓</option>
          <option>无效</option>
        </select>
        <select aria-label="最近跟进时间" value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
          <option>全部最近跟进</option>
          <option>本周已跟进</option>
          <option>从未跟进</option>
        </select>
        <select aria-label="跟进时间" value={followupFilter} onChange={(event) => setFollowupFilter(event.target.value)}>
          <option>全部跟进</option>
          <option>今日跟进</option>
          <option>逾期</option>
          <option>无下次跟进</option>
        </select>
      </div>

      <section className="panel lead-pool-panel">
        <DataTable
          className="lead-pool-table"
          columns={['公司名称', '国家', '区域', '联系人', '邮箱', '电话', '网站', '产品/主营/采购需求', '开发层级', '优先分', '状态', '来源', '负责人', '归属状态', '最近跟进', '下次跟进', '最后沟通人', '创建时间', '操作']}
          rows={filteredRecords.map((lead) => {
            const websiteHref = getWebsiteHref(lead.website)
            const leadStatus = normalizeLeadStatus(lead.status)
            const level = lead.development_level?.trim() || 'C'
            const isPublic = !lead.owner_user_id || lead.claim_status === '公海'
            const canClaim = isPublic || canManage
            const canRelease = canManage || lead.owner_user_id === currentProfile?.user_id
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
              lead.owner_name || '公海',
              <span className={`lead-tag ${lead.claim_status === '公海' ? 'status-paused' : 'status-replied'}`}>
                {lead.claim_status || '公海'}
              </span>,
              formatNullableDate(lead.last_activity_at),
              <span className={isPastDate(lead.next_followup_at) ? 'overdue-text' : undefined}>
                {formatNullableDate(lead.next_followup_at)}
              </span>,
              lead.last_communication_user_name || '-',
              formatDate(lead.created_at),
              <div className="row-actions">
                {canClaim ? (
                  <button className="table-action-button" type="button" onClick={() => void handleClaimLead(lead)}>
                    领取客户
                  </button>
                ) : null}
                {canManage ? (
                  <button className="table-action-button" type="button" onClick={() => openAssignLead(lead)}>
                    {lead.owner_user_id ? '转移负责人' : '分配客户'}
                  </button>
                ) : null}
                {canRelease ? (
                  <button className="table-action-button" type="button" onClick={() => void handleReleaseLead(lead)}>
                    释放公海
                  </button>
                ) : null}
                <button className="table-action-button" type="button" onClick={() => void handleCreateTaskForLead(lead)}>
                  创建任务
                </button>
                <button className="table-action-button" type="button" onClick={() => openCommunicationModal(lead)}>
                  添加沟通
                </button>
              </div>,
            ]
          })}
        />
      </section>

      {modalMode === 'assign' && selectedLead ? (
        <Modal title="分配 / 转移负责人" onClose={() => setModalMode(null)}>
          <div className="form-grid">
            <label>
              <span>客户</span>
              <input value={selectedLead.company_name} readOnly />
            </label>
            <label>
              <span>选择业务员</span>
              <select value={assignTargetUserId} onChange={(event) => setAssignTargetUserId(event.target.value)}>
                <option value="">请选择业务员</option>
                {assignableProfiles.map((profile) => (
                  <option key={profile.user_id} value={profile.user_id}>
                    {getProfileDisplayName(profile)} · {profile.email}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button className="ghost-button" onClick={() => setModalMode(null)}>关闭</button>
            <button className="primary-button" onClick={() => void handleAssignLead()}>确认分配</button>
          </div>
        </Modal>
      ) : null}

      {modalMode === 'communication' && selectedLead ? (
        <Modal title="添加沟通记录" onClose={() => setModalMode(null)}>
          <div className="form-grid">
            <label>
              <span>客户</span>
              <input value={selectedLead.company_name} readOnly />
            </label>
            <label>
              <span>沟通方式</span>
              <select
                value={communicationDraft.contact_method}
                onChange={(event) => setCommunicationDraft((current) => ({ ...current, contact_method: event.target.value }))}
              >
                <option>邮件</option>
                <option>电话</option>
                <option>WhatsApp</option>
                <option>会议</option>
                <option>其他</option>
              </select>
            </label>
            <label>
              <span>沟通结果</span>
              <select
                value={communicationDraft.contact_result}
                onChange={(event) => setCommunicationDraft((current) => ({ ...current, contact_result: event.target.value }))}
              >
                <option>已联系</option>
                <option>已回复</option>
                <option>报价中</option>
                <option>暂缓</option>
                <option>无效</option>
                <option>已成交</option>
              </select>
            </label>
            <label>
              <span>下次跟进时间</span>
              <input
                type="date"
                value={communicationDraft.next_followup_at}
                onChange={(event) => setCommunicationDraft((current) => ({ ...current, next_followup_at: event.target.value }))}
              />
            </label>
            <label className="full-span">
              <span>下一步动作</span>
              <input
                value={communicationDraft.next_action}
                onChange={(event) => setCommunicationDraft((current) => ({ ...current, next_action: event.target.value }))}
                placeholder="例如：3天后发送产品选品"
              />
            </label>
            <label className="full-span">
              <span>沟通内容</span>
              <textarea
                value={communicationDraft.content}
                onChange={(event) => setCommunicationDraft((current) => ({ ...current, content: event.target.value }))}
                rows={5}
              />
            </label>
          </div>
          <div className="modal-actions">
            <button className="ghost-button" onClick={() => setModalMode(null)}>关闭</button>
            <button className="primary-button" onClick={() => void handleSaveCommunication()}>保存沟通记录</button>
          </div>
        </Modal>
      ) : null}
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
        action={<NavLink className="primary-button" to="/tasks">创建跟进任务</NavLink>}
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

function createEmptyTaskInput(leadId: string | null = null): LeadTaskInput {
  return {
    lead_id: leadId,
    task_type: '首轮开发',
    task_title: '',
    task_description: '',
    due_date: '',
    status: 'pending',
    priority: 'medium',
    owner_name: 'Elan',
    assigned_user_id: null,
    assigned_user_name: null,
  }
}

function createEmptyCommunicationInput(leadId: string): LeadCommunicationInput {
  return {
    lead_id: leadId,
    contact_method: '邮件',
    contact_result: '已联系',
    next_action: '',
    next_followup_at: '',
    content: '',
  }
}

function createEmptyTemplateInput(): EmailTemplateInput {
  return {
    template_name: '',
    customer_type: '',
    development_stage: '首轮开发',
    subject: '',
    body: '',
    language: 'en',
    is_active: true,
  }
}

function taskToInput(task: LeadTaskRecord): LeadTaskInput {
  return {
    lead_id: task.lead_id,
    task_type: task.task_type,
    task_title: task.task_title,
    task_description: task.task_description ?? '',
    due_date: task.due_date ?? '',
    status: task.status,
    priority: task.priority,
    owner_name: task.owner_name ?? '',
    assigned_user_id: task.assigned_user_id,
    assigned_user_name: task.assigned_user_name,
  }
}

function templateToInput(template: EmailTemplateRecord): EmailTemplateInput {
  return {
    template_name: template.template_name,
    customer_type: template.customer_type,
    development_stage: template.development_stage,
    subject: template.subject,
    body: template.body,
    language: template.language,
    is_active: template.is_active,
  }
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items]
}

const emailTemplateCustomerTypeLabels: Record<string, string> = {
  hardware_importer_wholesaler: '五金进口商 / 批发商',
  industrial_mro_engineering_supplier: '工业品 / MRO / 工程渠道',
  building_material_construction_hardware_channel: '建材 / 工程 / 装饰五金渠道',
  automotive_repair_garage_tool_channel: '汽修 / 车库 / 维修工具渠道',
  electrical_insulated_tool_distributor: '电工 / 电气 / 绝缘工具渠道',
  retail_chain_hardware_store: '零售连锁 / 五金门店渠道',
  plumbing_sanitary_hardware_channel: '管道 / 卫浴五金渠道',
  general_trading_company: '综合贸易公司',
  unknown_business_type: '业务类型不明确客户',
  follow_up_templates: '跟进模板',
  new_lead: '旧默认模板',
  quote_follow_up: '旧默认模板',
}

const emailTemplateStageLabels: Record<string, string> = {
  first_outreach: '首轮开发',
  d3_follow_up: '3天后跟进',
  d7_follow_up: '7天后跟进',
  catalog_offer: '目录/选品推荐',
  quote_follow_up: '报价/产品资料跟进',
  no_reply_final: '长期未回复轻提醒',
  whatsapp_short_message: 'WhatsApp 短消息',
  new_lead: '旧首轮开发',
}

const legacyDefaultTemplateNames = new Set(['new_lead', 'quote_follow_up'])

function isLegacyDefaultTemplate(template: EmailTemplateRecord): boolean {
  return legacyDefaultTemplateNames.has(template.template_name)
    || legacyDefaultTemplateNames.has(template.customer_type)
    || legacyDefaultTemplateNames.has(template.development_stage)
}

function getEmailTemplateCustomerTypeLabel(value: string): string {
  return emailTemplateCustomerTypeLabels[value] ?? (value || '未分类')
}

function getEmailTemplateStageLabel(value: string): string {
  return emailTemplateStageLabels[value] ?? (value || '未设置阶段')
}

function TasksPage({ currentProfile }: { currentProfile: UserProfile | null }) {
  const [taskRecords, setTaskRecords] = useState<LeadTaskRecord[]>([])
  const [leadOptions, setLeadOptions] = useState<LeadSelectOption[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedTask, setSelectedTask] = useState<LeadTaskRecord | null>(null)
  const [draftTask, setDraftTask] = useState<LeadTaskInput>(createEmptyTaskInput())
  const [leadSearch, setLeadSearch] = useState('')
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    async function loadTasks() {
      setIsLoading(true)
      const [tasksResult, leadsResult] = await Promise.all([fetchTasks(), fetchLeadsForTaskSelect()])
      if (!mounted) return
      setTaskRecords(tasksResult.tasks)
      setLeadOptions(leadsResult.leads)
      setMessage(tasksResult.error ?? leadsResult.error ?? '')
      setIsLoading(false)
    }
    void loadTasks()
    return () => {
      mounted = false
    }
  }, [])

  const filteredLeadOptions = leadOptions.filter((lead) =>
    lead.company_name.toLowerCase().includes(leadSearch.trim().toLowerCase()),
  )
  function openNewTask() {
    setSelectedTask(null)
    setDraftTask({
      ...createEmptyTaskInput(),
      owner_name: getProfileDisplayName(currentProfile),
      assigned_user_id: currentProfile?.user_id ?? null,
      assigned_user_name: getProfileDisplayName(currentProfile),
    })
    setLeadSearch('')
    setIsTaskModalOpen(true)
    setMessage('')
  }

  function openEditTask(task: LeadTaskRecord) {
    setSelectedTask(task)
    setDraftTask(taskToInput(task))
    setLeadSearch('')
    setIsTaskModalOpen(true)
    setMessage('')
  }

  function closeTaskModal() {
    if (isSaving) return
    setSelectedTask(null)
    setDraftTask(createEmptyTaskInput())
    setLeadSearch('')
    setIsTaskModalOpen(false)
  }

  async function handleSaveTask() {
    if (!draftTask.task_title.trim()) {
      setMessage('请填写任务标题。')
      return
    }
    setIsSaving(true)
    const taskPayload: LeadTaskInput = {
      ...draftTask,
      owner_name: draftTask.owner_name || getProfileDisplayName(currentProfile),
      assigned_user_id: draftTask.assigned_user_id || currentProfile?.user_id || null,
      assigned_user_name: draftTask.assigned_user_name || getProfileDisplayName(currentProfile),
    }
    const result = selectedTask ? await updateTask(selectedTask.id, taskPayload) : await createTask(taskPayload)
    setIsSaving(false)
    if (result.error || !result.task) {
      setMessage(result.error ?? '保存任务失败')
      return
    }
    setTaskRecords((current) => upsertById(current, result.task as LeadTaskRecord))
    setMessage('任务已保存。')
    setSelectedTask(null)
    setDraftTask(createEmptyTaskInput())
    setIsTaskModalOpen(false)
  }

  async function handleMarkTaskInvalid() {
    if (!selectedTask) return
    setIsSaving(true)
    const result = await markTaskInvalid(selectedTask.id)
    setIsSaving(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setTaskRecords((current) =>
      current.map((task) => (task.id === selectedTask.id ? { ...task, status: 'invalid' } : task)),
    )
    setMessage('任务已标记为无效。')
    closeTaskModal()
  }

  return (
    <section>
      <PageHeader
        title="开发任务"
        description="从 Supabase 读取真实跟进任务，按状态分栏管理客户开发动作。"
        action={<button className="primary-button" onClick={openNewTask}>新建任务</button>}
      />

      {message ? <p className="warning-box">{message}</p> : null}
      {isLoading ? <p className="hint-text">正在读取跟进任务...</p> : null}
      {!isLoading && taskRecords.length === 0 ? (
        <section className="panel empty-state">暂无跟进任务，可点击右上角新建任务。</section>
      ) : null}

      <div className="kanban task-kanban">
        {taskBoardStatuses.map((status) => {
          const columnTasks = taskRecords.filter((task) => task.status === status)
          return (
            <section className="task-column" key={status}>
              <div className="section-title">
                <h2>{leadTaskStatusLabels[status]}</h2>
                <span>{columnTasks.length}</span>
              </div>
              <div className="stack">
                {columnTasks.map((task) => (
                  <button className="task-card" key={task.id} type="button" onClick={() => openEditTask(task)}>
                    <strong>{task.task_title}</strong>
                    <p>{task.lead_company_name}</p>
                    <dl className="task-meta">
                      <div>
                        <dt>类型</dt>
                        <dd>{task.task_type}</dd>
                      </div>
                      <div>
                        <dt>优先级</dt>
                        <dd>{leadTaskPriorityLabels[task.priority]}</dd>
                      </div>
                      <div>
                        <dt>截止</dt>
                        <dd>{task.due_date || '-'}</dd>
                      </div>
                      <div>
                        <dt>负责人</dt>
                        <dd>{task.assigned_user_name || task.owner_name || '-'}</dd>
                      </div>
                    </dl>
                    <span className={`lead-tag ${getLeadStatusClass(leadTaskStatusLabels[task.status])}`}>
                      {leadTaskStatusLabels[task.status]}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {isTaskModalOpen ? (
        <Modal title={selectedTask ? '任务详情' : '新建任务'} onClose={closeTaskModal}>
          <div className="form-grid">
            <label>
              <span>选择客户</span>
              <input
                type="search"
                placeholder="搜索公司名"
                value={leadSearch}
                onChange={(event) => setLeadSearch(event.target.value)}
              />
              <select
                value={draftTask.lead_id ?? ''}
                onChange={(event) => setDraftTask((current) => ({ ...current, lead_id: event.target.value || null }))}
              >
                <option value="">未关联客户</option>
                {filteredLeadOptions.map((lead) => (
                  <option key={lead.id} value={lead.id}>{lead.company_name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>任务类型</span>
              <select
                value={draftTask.task_type}
                onChange={(event) => setDraftTask((current) => ({ ...current, task_type: event.target.value }))}
              >
                {taskTypeOptions.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span>任务标题</span>
              <input
                value={draftTask.task_title}
                onChange={(event) => setDraftTask((current) => ({ ...current, task_title: event.target.value }))}
              />
            </label>
            <label>
              <span>截止日期</span>
              <input
                type="date"
                value={draftTask.due_date}
                onChange={(event) => setDraftTask((current) => ({ ...current, due_date: event.target.value }))}
              />
            </label>
            <label>
              <span>状态</span>
              <select
                value={draftTask.status}
                onChange={(event) => setDraftTask((current) => ({ ...current, status: event.target.value as LeadTaskStatus }))}
              >
                {taskBoardStatuses.map((status) => <option key={status} value={status}>{leadTaskStatusLabels[status]}</option>)}
              </select>
            </label>
            <label>
              <span>优先级</span>
              <select
                value={draftTask.priority}
                onChange={(event) => setDraftTask((current) => ({ ...current, priority: event.target.value as LeadTaskPriority }))}
              >
                {Object.entries(leadTaskPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>负责人</span>
              <input value={draftTask.assigned_user_name || draftTask.owner_name} readOnly />
            </label>
            <label className="full-span">
              <span>任务描述</span>
              <textarea
                value={draftTask.task_description}
                onChange={(event) => setDraftTask((current) => ({ ...current, task_description: event.target.value }))}
                rows={5}
              />
            </label>
          </div>

          {selectedTask ? (
            <div className="modal-meta">
              <span>客户公司：{selectedTask.lead_company_name}</span>
              <span>创建时间：{formatDate(selectedTask.created_at)}</span>
              <span>更新时间：{formatDate(selectedTask.updated_at)}</span>
            </div>
          ) : null}

          <div className="modal-actions">
            {selectedTask ? <button className="ghost-button danger-button" onClick={() => void handleMarkTaskInvalid()}>标记无效</button> : null}
            <button className="ghost-button" onClick={closeTaskModal}>关闭</button>
            <button className="primary-button" disabled={isSaving} onClick={() => void handleSaveTask()}>
              {isSaving ? '保存中...' : '保存任务'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

function TemplatesPage() {
  const [templateRecords, setTemplateRecords] = useState<EmailTemplateRecord[]>([])
  const [leadOptions, setLeadOptions] = useState<LeadSelectOption[]>([])
  const [message, setMessage] = useState('')
  const [usedDefault, setUsedDefault] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateRecord | null>(null)
  const [draftTemplate, setDraftTemplate] = useState<EmailTemplateInput>(createEmptyTemplateInput())
  const [previewLeadId, setPreviewLeadId] = useState('')
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all')
  const [developmentStageFilter, setDevelopmentStageFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    let mounted = true
    async function loadTemplates() {
      const [templatesResult, leadsResult] = await Promise.all([fetchEmailTemplates(), fetchLeadsForTaskSelect()])
      if (!mounted) return
      setTemplateRecords(templatesResult.templates)
      setUsedDefault(templatesResult.usedDefault)
      setLeadOptions(leadsResult.leads)
      setMessage(templatesResult.error ?? leadsResult.error ?? '')
    }
    void loadTemplates()
    return () => {
      mounted = false
    }
  }, [])

  const previewLead = leadOptions.find((lead) => lead.id === previewLeadId) ?? null
  const renderedPreview = renderTemplateWithLead(draftTemplate, previewLead)
  const customerTypeOptions = useMemo(
    () => Array.from(new Set(templateRecords.map((template) => template.customer_type).filter(Boolean))).sort(),
    [templateRecords],
  )
  const developmentStageOptions = useMemo(
    () => Array.from(new Set(templateRecords.map((template) => template.development_stage).filter(Boolean))).sort(),
    [templateRecords],
  )
  const filteredTemplateRecords = useMemo(
    () => templateRecords.filter((template) => {
      const matchesCustomerType = customerTypeFilter === 'all' || template.customer_type === customerTypeFilter
      const matchesDevelopmentStage = developmentStageFilter === 'all' || template.development_stage === developmentStageFilter
      const matchesActive = activeFilter === 'all'
        || (activeFilter === 'active' && template.is_active)
        || (activeFilter === 'inactive' && !template.is_active)
      return matchesCustomerType && matchesDevelopmentStage && matchesActive
    }),
    [activeFilter, customerTypeFilter, developmentStageFilter, templateRecords],
  )
  const hasLegacyDefaultTemplates = templateRecords.some(isLegacyDefaultTemplate)

  function openNewTemplate() {
    setSelectedTemplate(null)
    setDraftTemplate(createEmptyTemplateInput())
    setPreviewLeadId('')
    setIsTemplateModalOpen(true)
    setMessage('')
  }

  function openEditTemplate(template: EmailTemplateRecord) {
    setSelectedTemplate(template)
    setDraftTemplate(templateToInput(template))
    setPreviewLeadId('')
    setIsTemplateModalOpen(true)
    setMessage('')
  }

  function closeTemplateModal() {
    if (isSaving) return
    setIsTemplateModalOpen(false)
    setSelectedTemplate(null)
    setDraftTemplate(createEmptyTemplateInput())
  }

  async function handleSaveTemplate() {
    if (!draftTemplate.template_name.trim() || !draftTemplate.subject.trim() || !draftTemplate.body.trim()) {
      setMessage('请填写模板名称、邮件标题和邮件正文。')
      return
    }
    setIsSaving(true)
    const shouldCreate = !selectedTemplate || selectedTemplate.id.startsWith('default-')
    const result = shouldCreate
      ? await createEmailTemplate(draftTemplate)
      : await updateEmailTemplate(selectedTemplate.id, draftTemplate)
    setIsSaving(false)
    if (result.error || !result.template) {
      setMessage(result.error ?? '保存模板失败')
      return
    }
    setTemplateRecords((current) => upsertById(current.filter((template) => !template.id.startsWith('default-')), result.template as EmailTemplateRecord))
    setUsedDefault(false)
    setMessage('模板已保存。')
    closeTemplateModal()
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplate) return
    if (selectedTemplate.id.startsWith('default-')) {
      setMessage('默认模板尚未写入数据库，无需删除。')
      closeTemplateModal()
      return
    }
    if (!window.confirm('确认删除该邮件模板吗？删除后不可恢复。')) {
      return
    }
    setIsSaving(true)
    const result = await deleteEmailTemplate(selectedTemplate.id)
    setIsSaving(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setTemplateRecords((current) => current.filter((template) => template.id !== selectedTemplate.id))
    setMessage('模板已删除。')
    closeTemplateModal()
  }

  async function handleSeedDefaultTemplates() {
    setIsSaving(true)
    const result = await seedDefaultTemplates()
    setIsSaving(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setTemplateRecords(result.templates)
    setUsedDefault(false)
    setMessage(`已写入 ${result.insertedCount} 个模板，跳过 ${result.skippedCount} 个已存在模板。`)
  }

  async function handleCleanupOldDefaultTemplates() {
    if (!window.confirm('确认清理旧默认模板 new_lead 和 quote_follow_up 吗？不会删除用户自建模板。')) {
      return
    }
    setIsSaving(true)
    const result = await cleanupOldDefaultTemplates()
    setIsSaving(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setTemplateRecords((current) => current.filter((template) => !isLegacyDefaultTemplate(template)))
    setMessage(`已清理 ${result.deletedCount} 个旧默认模板。`)
  }

  async function copyText(value: string, successMessage: string) {
    await navigator.clipboard.writeText(value)
    setMessage(successMessage)
  }

  return (
    <section>
      <PageHeader
        title="邮件模板"
        description="维护开发邮件内容，只支持复制和模板管理，不自动发送邮件。"
        action={<button className="primary-button" onClick={openNewTemplate}>新建模板</button>}
      />

      {message ? <p className={usedDefault ? 'warning-box' : 'hint-text'}>{message}</p> : null}
      <div className="template-actions">
        <button className="primary-button" disabled={isSaving || !isSupabaseConfigured} onClick={() => void handleSeedDefaultTemplates()}>
          写入英文模板库到数据库
        </button>
        {hasLegacyDefaultTemplates ? (
          <button className="ghost-button danger-button" disabled={isSaving || !isSupabaseConfigured} onClick={() => void handleCleanupOldDefaultTemplates()}>
            清理旧默认模板
          </button>
        ) : null}
      </div>

      <section className="panel template-filter-panel">
        <label>
          <span>客户类型</span>
          <select value={customerTypeFilter} onChange={(event) => setCustomerTypeFilter(event.target.value)}>
            <option value="all">全部客户类型</option>
            {customerTypeOptions.map((customerType) => (
              <option key={customerType} value={customerType}>{getEmailTemplateCustomerTypeLabel(customerType)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>开发阶段</span>
          <select value={developmentStageFilter} onChange={(event) => setDevelopmentStageFilter(event.target.value)}>
            <option value="all">全部开发阶段</option>
            {developmentStageOptions.map((stage) => (
              <option key={stage} value={stage}>{getEmailTemplateStageLabel(stage)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>启用状态</span>
          <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
            <option value="all">全部状态</option>
            <option value="active">仅启用</option>
            <option value="inactive">仅停用</option>
          </select>
        </label>
        <span>当前显示 {filteredTemplateRecords.length} / {templateRecords.length} 个模板</span>
      </section>

      <section className="panel template-list">
        {filteredTemplateRecords.length === 0 ? (
          <div className="empty-state">没有符合当前筛选条件的邮件模板。</div>
        ) : null}
        {filteredTemplateRecords.map((template) => (
          <button className="template-card" key={template.id} type="button" onClick={() => openEditTemplate(template)}>
            <div>
              <span>{getEmailTemplateCustomerTypeLabel(template.customer_type)} · {getEmailTemplateStageLabel(template.development_stage)}</span>
              <h2>{template.template_name}</h2>
              <p>{template.subject}</p>
            </div>
            <pre>{template.body}</pre>
            <span className={`lead-tag ${template.is_active ? 'status-replied' : 'status-paused'}`}>
              {template.is_active ? '启用' : '停用'}
            </span>
          </button>
        ))}
      </section>

      {isTemplateModalOpen ? (
        <Modal title={selectedTemplate ? '模板详情' : '新建模板'} onClose={closeTemplateModal}>
          <div className="form-grid">
            <label>
              <span>模板名称</span>
              <input
                value={draftTemplate.template_name}
                onChange={(event) => setDraftTemplate((current) => ({ ...current, template_name: event.target.value }))}
              />
            </label>
            <label>
              <span>客户类型</span>
              <input
                value={draftTemplate.customer_type}
                onChange={(event) => setDraftTemplate((current) => ({ ...current, customer_type: event.target.value }))}
              />
            </label>
            <label>
              <span>开发阶段</span>
              <input
                value={draftTemplate.development_stage}
                onChange={(event) => setDraftTemplate((current) => ({ ...current, development_stage: event.target.value }))}
              />
            </label>
            <label>
              <span>语言</span>
              <input
                value={draftTemplate.language}
                onChange={(event) => setDraftTemplate((current) => ({ ...current, language: event.target.value || 'en' }))}
              />
            </label>
            <label className="full-span">
              <span>邮件标题 subject</span>
              <input
                value={draftTemplate.subject}
                onChange={(event) => setDraftTemplate((current) => ({ ...current, subject: event.target.value }))}
              />
            </label>
            <label className="full-span">
              <span>邮件正文 body</span>
              <textarea
                className="template-body-input"
                value={draftTemplate.body}
                onChange={(event) => setDraftTemplate((current) => ({ ...current, body: event.target.value }))}
                rows={12}
              />
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={draftTemplate.is_active}
                onChange={(event) => setDraftTemplate((current) => ({ ...current, is_active: event.target.checked }))}
              />
              <span>启用模板</span>
            </label>
          </div>

          <section className="variable-box">
            <h3>可用变量说明</h3>
            <div>
              {templateVariables.map((variable) => <code key={variable}>{variable}</code>)}
            </div>
          </section>

          <section className="preview-box">
            <div className="section-title">
              <h2>预览效果</h2>
              <select value={previewLeadId} onChange={(event) => setPreviewLeadId(event.target.value)}>
                <option value="">选择客户预览</option>
                {leadOptions.map((lead) => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}
              </select>
            </div>
            <strong>{renderedPreview.subject || '邮件标题预览'}</strong>
            <pre>{renderedPreview.body || '邮件正文预览'}</pre>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => void copyText(renderedPreview.subject, '已复制邮件标题。')}>
                <Copy size={15} aria-hidden="true" />复制标题
              </button>
              <button className="ghost-button" onClick={() => void copyText(renderedPreview.body, '已复制邮件正文。')}>
                <Copy size={15} aria-hidden="true" />复制正文
              </button>
              <button className="ghost-button" onClick={() => void copyText(`${renderedPreview.subject}\n\n${renderedPreview.body}`, '已复制完整邮件。')}>
                <Copy size={15} aria-hidden="true" />复制完整邮件
              </button>
            </div>
          </section>

          <div className="modal-actions">
            {selectedTemplate ? (
              <button className="ghost-button danger-button" onClick={() => void handleDeleteTemplate()}>
                <Trash2 size={15} aria-hidden="true" />删除模板
              </button>
            ) : null}
            <button className="ghost-button" onClick={closeTemplateModal}>关闭</button>
            <button className="primary-button" disabled={isSaving} onClick={() => void handleSaveTemplate()}>
              {isSaving ? '保存中...' : '保存模板'}
            </button>
          </div>
        </Modal>
      ) : null}
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

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭弹窗">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
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
