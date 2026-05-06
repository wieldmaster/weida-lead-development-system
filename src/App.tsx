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
import type { ReactNode } from 'react'
import './App.css'
import {
  emailTemplates,
  fieldMappings,
  importBatches,
  importRows,
  leads,
  tasks,
} from './data'
import type { Lead, LeadStatus, TaskStatus } from './types'

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

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <strong>WEIDA</strong>
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
  return (
    <section>
      <PageHeader
        title="站外客户导入"
        description="预留 Excel / CSV 上传、字段识别、数据校验和入库确认流程。"
        action={<button className="primary-button">创建导入任务</button>}
      />

      <section className="upload-panel">
        <div className="upload-icon">
          <Upload size={28} aria-hidden="true" />
        </div>
        <h2>上传客户表</h2>
        <p>第一阶段不解析文件，仅预留上传区域和导入批次结构。</p>
        <div className="upload-actions">
          <button className="primary-button">选择文件</button>
          <button className="ghost-button">下载字段模板</button>
        </div>
      </section>

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
          <div className="section-title">
            <h2>待校验行</h2>
            <span>结构化预览</span>
          </div>
          <div className="stack">
            {importRows.map((row) => (
              <div className="review-row" key={row.id}>
                <div>
                  <strong>第 {row.rowNumber} 行 · {row.companyName}</strong>
                  <span>{row.message}</span>
                </div>
                <StatusPill tone={row.status === 'valid' ? 'green' : 'orange'}>
                  {row.status === 'valid' ? '可入库' : '需确认'}
                </StatusPill>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function LeadPoolPage() {
  return (
    <section>
      <PageHeader
        title="客户开发池"
        description="集中管理站外客户，后续支持去重、分层、负责人分配和批量创建任务。"
        action={<button className="primary-button">新增客户</button>}
      />

      <div className="toolbar">
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <input type="search" placeholder="搜索公司、国家、行业或邮箱" />
        </label>
        <select aria-label="客户分层">
          <option>全部层级</option>
          <option>A级客户</option>
          <option>B级客户</option>
          <option>C级客户</option>
        </select>
        <select aria-label="开发状态">
          <option>全部状态</option>
          <option>新线索</option>
          <option>开发中</option>
          <option>已触达</option>
        </select>
      </div>

      <section className="panel">
        <DataTable
          columns={['公司', '国家', '行业', '层级', '状态', '负责人', '下次跟进']}
          rows={leads.map((lead) => [
            <NavLink to={`/leads/${lead.id}`} className="table-link" key={lead.id}>
              {lead.companyName}
            </NavLink>,
            lead.country,
            lead.industry,
            lead.tier,
            statusLabel[lead.status],
            lead.owner,
            lead.nextFollowUp,
          ])}
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

function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
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
