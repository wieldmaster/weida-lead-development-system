# WEIDA 业务开发系统

这是一个独立于 WEIDA 报价系统的新项目，用于国际站站外客户开发。第一阶段只完成基础框架、页面路由、静态样例数据和 Supabase migration，不自动发邮件、不联网背调、不部署生产环境。

## 项目用途

WEIDA 业务开发系统用于站外客户开发流程管理，当前覆盖客户导入、客户开发池、客户详情、跟进任务、邮件模板和数据设置等基础模块。后续可以继续扩展 Excel / CSV 客户表导入、字段自动识别、结构化入库、客户去重、客户分层和与 WEIDA 报价系统的链接或 API 对接。

## 独立项目说明

本项目目录为：

```text
/Users/xing/Documents/New project/weida-lead-development-system
```

它是新建的独立应用目录，不复用、不覆盖、不修改原 WEIDA 报价系统代码。当前第一阶段只在本目录内维护业务开发系统相关文件。

## 本地运行

```bash
cd "/Users/xing/Documents/New project/weida-lead-development-system"
npm install
npm run dev
```

默认开发地址通常是：

```text
http://localhost:5173/
```

如果端口被占用，Vite 会自动换到下一个可用端口。

## 环境变量

第一阶段前端页面使用静态样例数据，不强制连接 Supabase。后续接入 Supabase 时，在项目根目录新建 `.env.local`：

```bash
cp .env.example .env.local
```

然后填写：

```text
VITE_SUPABASE_URL=你的 Supabase 项目地址
VITE_SUPABASE_ANON_KEY=你的 Supabase anon key
```

## 数据库 migration

migration 文件位置：

```text
supabase/migrations/202605060001_create_lead_development_tables.sql
```

执行方式二选一：

1. 使用 Supabase CLI：

```bash
supabase link --project-ref 你的项目 ref
supabase db push
```

2. 使用 Supabase 控制台：

打开 Supabase SQL Editor，把 `supabase/migrations/202605060001_create_lead_development_tables.sql` 的内容复制进去执行。

## 第一阶段已完成

- 新项目初始化：Vite + React + TypeScript。
- 基础页面路由：工作台、客户导入、客户开发池、客户详情、开发任务、邮件模板、数据设置。
- 左侧导航和业务员日常使用的桌面优先布局。
- 客户池基础表格和客户详情页入口。
- 客户导入页面结构，包含上传区域、导入批次和待校验行预览。
- 邮件模板页面结构。
- 开发任务看板基础结构。
- Supabase migration，包含 8 张业务表、索引、更新时间触发器和基础 RLS 策略。

## 当前仍是占位的功能

- Excel / CSV 文件解析。
- 字段自动识别和字段映射确认。
- 客户去重规则。
- 客户分层评分。
- 任务提醒和真实看板拖拽。
- 邮件发送、邮件收件箱同步和自动化触达。
- 联网客户背调或复杂 AI 功能。
- 与现有 WEIDA 报价系统的链接或 API 对接。
