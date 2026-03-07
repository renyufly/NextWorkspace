# WorkNext

<p align="center">
  <strong>A Slack-inspired team collaboration platform built as a production-minded TypeScript monorepo.</strong>
</p>

<p align="center">
  Multi-tenant architecture, real-time messaging, PostgreSQL persistence, strong end-to-end typing, and automated testing across API and web flows.
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#中文介绍">中文</a>
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Active-336791?logo=postgresql&logoColor=white">
</p>

<p align="center">
  <img alt="Socket.IO" src="https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io&logoColor=white">
  <img alt="Playwright" src="https://img.shields.io/badge/E2E-Playwright-45BA63?logo=playwright&logoColor=white">
  <img alt="Jest" src="https://img.shields.io/badge/API%20Tests-Jest-C21325?logo=jest&logoColor=white">
  <img alt="Status" src="https://img.shields.io/badge/Status-Phase%201%20plus%20Phase%202%20baselines-success">
  <img alt="Architecture" src="https://img.shields.io/badge/Architecture-Modular%20Monolith-6B7280">
  <img alt="Roadmap" src="https://img.shields.io/badge/Next-Scaling%20%26%20Hardening-8B5CF6">
</p>

## English

### Overview

WorkNext is a full-stack collaboration platform designed to showcase how a modern team messaging product can be built with strong engineering fundamentals.

This repository focuses on:

- multi-tenant backend design
- real-time collaboration with a clean upgrade path to horizontal scaling
- shared TypeScript contracts across frontend and backend
- modular NestJS service design
- production-minded testing, security, and developer ergonomics

The current codebase is beyond a prototype. It already delivers a working MVP with authentication, workspaces, channels, messaging, file attachments, notifications, realtime updates, optimistic UI, and automated end-to-end coverage.

### Quick Demo

| Area | Details |
| --- | --- |
| Live Preview | `Not published yet` — local-first development repository |
| Web App | `apps/web` |
| API Service | `apps/api` |
| Detailed Status | [docs/project-status.md](docs/project-status.md) |
| API Handoff | [docs/frontend-api-handoff.md](docs/frontend-api-handoff.md) |
| Operations Runbook | [docs/operations-runbook.md](docs/operations-runbook.md) |
| Ops Validation Checklist | [docs/operations-validation-checklist.md](docs/operations-validation-checklist.md) |

#### Core Commands

```bash
pnpm install
pnpm dev
pnpm -r build
```

#### Test Commands

```bash
pnpm --filter @worknext/api test
pnpm --filter @worknext/web test
pnpm -r typecheck
```

### Features

| Feature | What it shows |
| --- | --- |
| Multi-Tenant Workspaces | Tenant isolation, workspace-scoped access rules, and role-aware collaboration boundaries |
| Auth and Sessions | JWT access tokens, rotating refresh cookies, logout, and profile updates |
| Public and Private Channels | Open team channels plus restricted private collaboration spaces |
| Realtime Collaboration | Live message delivery, typing indicators, and presence over Socket.IO |
| Messaging Workflow | Send, edit, soft delete, pagination, read markers, unread counts, one-level threads, and emoji reactions |
| Files and Notifications | Attachment uploads, mention parsing, inbox notifications, digest controls, and email plus push delivery baselines |
| Search and Audit | Workspace-scoped ranked search, previews, highlighting, and admin audit history |
| Admin Insights | Workspace analytics cards plus organization overview and cross-workspace administration basics |
| Operations Surface | Detailed health, liveness, readiness, backup and restore runbooks, and deployment validation checklists |
| End-to-End Typing | Shared TypeScript contracts between frontend and backend through `packages/shared` |
| Automated Quality Baseline | API E2E with Jest + Supertest and browser E2E with Playwright |

### Highlights

- Full-stack TypeScript monorepo powered by `pnpm` workspaces
- Next.js 16 + React 19 frontend with TanStack Query and Zustand
- NestJS 10 backend with Prisma and PostgreSQL
- JWT access tokens plus rotating refresh-token cookies
- Public and private channels with RBAC-aware membership rules
- Real-time messaging, typing indicators, presence, reconnect state sync, and optional Redis adapter wiring
- File uploads, ranked search, audit history, admin analytics, and organization-aware workspace management
- Notification inbox plus email and push delivery baselines with local outbox fallbacks
- Dedicated health, liveness, and readiness probes with an operations runbook
- API E2E coverage with Jest + Supertest
- Browser E2E coverage with Playwright
- Optimistic UI flows for key collaboration actions

### Architecture Snapshot

```mermaid
flowchart LR
    U[User Browser] --> W[Next.js Web App]
    W --> Q[TanStack Query + Zustand]
    Q --> A[NestJS API]
    W -. realtime .-> R[Socket.IO Gateway]
    R --> A
    A --> P[Prisma]
    P --> D[(PostgreSQL)]
    A --> F[Local File Storage]
    A -. optional scaling .-> X[(Redis Adapter)]
    A -. optional async jobs .-> B[(BullMQ Workers)]
    S[packages/shared] -. shared contracts .-> W
    S -. shared contracts .-> A
```

### Screenshots

<table>
  <tr>
    <td align="center"><strong>Workspace Overview</strong></td>
    <td align="center"><strong>Chat Timeline</strong></td>
    <td align="center"><strong>Workspace Settings</strong></td>
  </tr>
  <tr>
    <td><img alt="Workspace Overview Placeholder" src="https://placehold.co/1200x760/F4F1EA/1F2937?text=Workspace+Overview+Screenshot" /></td>
    <td><img alt="Chat Timeline Placeholder" src="https://placehold.co/1200x760/EAF4F1/1F2937?text=Chat+Timeline+Screenshot" /></td>
    <td><img alt="Workspace Settings Placeholder" src="https://placehold.co/1200x760/EEF2FF/1F2937?text=Workspace+Settings+Screenshot" /></td>
  </tr>
</table>

Replace these placeholders with real product screenshots when the visual presentation is finalized.

### Current Status

WorkNext has completed the core scope of a strong Phase 1 MVP and already includes several Phase 2 baselines.

Implemented today:

- authentication and session management
- workspace creation, invitations, acceptance, revocation, and leave flows
- owner, admin, and member role management
- public and private channels
- message send, edit, soft delete, pagination, read markers, unread counts, threads, reactions, and read receipts
- local file upload with attachment metadata
- in-app notifications, digest preferences, and email plus push delivery baselines
- realtime delivery for messages, typing, presence, and reconnect reconciliation hooks
- ranked search, audit history, admin analytics snapshots, and organization admin overview
- frontend workspace shell with optimistic updates and responsive collaboration flows
- automated API and frontend end-to-end testing

Still planned as the next platform step:

- repeatable rollout guidance for Redis-backed multi-instance Socket.IO
- stronger cross-instance delivery guarantees and replay behavior
- broader BullMQ adoption for retryable background work
- production alerting, backup and restore drills, and recovery evidence capture
- deeper analytics, richer organization lifecycle controls, scheduled digests, and OAuth

### Feature Matrix

| Area | Status | Scope |
| --- | --- | --- |
| Auth and sessions | Completed | Register, login, refresh, logout, profile update, JWT + refresh cookie flow |
| Workspace and membership | Completed | Workspaces, invitations, member roles, tenant isolation, leave and revoke flows |
| Channels and messaging | Completed | Public/private channels, send/edit/delete, threads, reactions, read state, unread counts |
| Files and notifications | Completed | Uploads, mention notifications, digest preferences, local email/push outbox delivery |
| Search and audit | Completed | Workspace search with filtering/highlighting plus admin audit history |
| Frontend collaboration UX | Completed | Responsive workspace shell, optimistic updates, thread panel, notifications UI |
| Analytics and organization admin | Baseline | Analytics snapshot cards, organization overview, cross-workspace creation basics |
| Redis realtime scaling | Baseline | Redis adapter wiring exists and local two-instance validation has passed |
| BullMQ background jobs | Baseline | Mention notification dispatch can run through BullMQ with fallback preserved |
| Operations readiness | Baseline | Health/live/ready probes, runbook, validation checklist, local Redis validation evidence |
| Realtime durability | Expanding | Replay behavior, stronger delivery guarantees, and broader multi-instance failure coverage remain in progress |
| Product depth | Expanding | Deeper analytics, org lifecycle controls, scheduled digests, push integration depth, OAuth |

### Tech Stack

#### Frontend

- Next.js 16
- React 19
- TypeScript
- TanStack Query
- Zustand
- Tailwind CSS
- Playwright

#### Backend

- NestJS 10
- TypeScript
- Prisma
- PostgreSQL
- Socket.IO
- Swagger / OpenAPI
- Pino
- class-validator
- Helmet
- Jest + Supertest

### Database

The repository supports three practical runtime modes.

- Local-first mode uses a JSON state file plus local uploads and remains the default easiest way to run the app.
- Database mode uses PostgreSQL through Prisma-backed parity in the storage layer.
- Redis-enhanced mode layers the Socket.IO adapter and BullMQ queue path on top of either storage mode when the related env flags are enabled.

The database-backed model covers users, sessions, workspaces, memberships, invitations, channels, messages, attachments, notifications, presence, and organization entities.

### Deployment / Environment

#### Local Requirements

- Node.js 22+
- pnpm 10+
- PostgreSQL only when running the database-backed mode
- Linux or WSL2-friendly local development environment
- Redis only when validating the optional realtime adapter or BullMQ paths

#### Current Runtime Modes

| Mode | Storage | Optional Infra | Best For |
| --- | --- | --- | --- |
| File-backed runtime | Local JSON state file plus local uploads | None required | Lowest-friction local development and isolated validation |
| PostgreSQL-backed runtime | Prisma plus PostgreSQL | None required | Relational persistence parity and database-backed verification |
| Redis-enhanced runtime | File-backed or PostgreSQL-backed | Redis adapter plus BullMQ | Multi-instance realtime validation and retryable background work |

Runtime dependency map:

```mermaid
flowchart TD
  root[WorkNext runtime] --> local[Local-first mode\nSTORAGE_DRIVER=local]
  root --> database[Database mode\nSTORAGE_DRIVER=database]

  local --> localState[Local JSON state]
  local --> localUploads[Local uploads]

  database --> prisma[Prisma storage layer]
  prisma --> postgres[(PostgreSQL)]

  local --> redisLayer[Optional Redis-enhanced layer]
  database --> redisLayer

  redisLayer --> redisFlags[ENABLE_REDIS_ADAPTER=true\nENABLE_BULLMQ=true]
  redisFlags --> redis[(Redis)]
  redis --> adapter[Socket.IO Redis adapter]
  redis --> queues[BullMQ queues]
```

#### Notes

- File-backed persistence remains the default low-friction local workflow in this repo.
- PostgreSQL mode is implemented but depends on a reachable local database.
- Redis adapter and BullMQ wiring are implemented, and local two-instance validation has passed; broader rollout guidance and more failure-mode evidence are still in progress.

### Why This Project Exists

WorkNext is intentionally built as a portfolio-grade repository, not just a feature demo.

It is meant to demonstrate:

- system design tradeoffs in a real product shape
- clean API and domain boundaries
- pragmatic product scoping between MVP and later phases
- realistic engineering concerns such as auth, tenancy, realtime, persistence, security, and testing

### Repository Structure

```text
.
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── config/
│   ├── shared/
│   └── ui/
└── docs/
```

### Documentation

- Detailed implementation and delivery status: [docs/project-status.md](docs/project-status.md)
- Frontend API handoff notes: [docs/frontend-api-handoff.md](docs/frontend-api-handoff.md)
- Operations runbook: [docs/operations-runbook.md](docs/operations-runbook.md)
- Operations validation checklist: [docs/operations-validation-checklist.md](docs/operations-validation-checklist.md)

### Roadmap

Near-term engineering roadmap:

1. Redis rollout guidance and broader multi-instance validation coverage
2. delivery reconciliation for reconnect and multi-instance consistency
3. BullMQ for async and retryable work
4. alerting, backup and restore drills, and production hardening validation

Phase 2 product roadmap:

1. deeper admin analytics and drill-down reporting
2. richer organization lifecycle controls
3. scheduled digest automation and stronger push integrations
4. deeper audit coverage and search relevance tuning
5. OAuth and enterprise-oriented platform controls

### Local Development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Default local profile:

- uses `STORAGE_DRIVER=local`
- persists state to `.data/worknext.json`
- writes uploads to `.uploads`
- keeps email and push delivery in local outbox files
- now enables Redis adapter and BullMQ automatically when `REDIS_URL` is set and Redis is reachable

Path resolution note:

- when you run `pnpm dev`, the API process starts from `apps/api`
- relative paths such as `.data/worknext.json`, `.uploads`, `.data/email-outbox.jsonl`, and `.data/push-outbox.jsonl` therefore resolve under `apps/api/`
- if you want these artifacts elsewhere, use absolute paths in `.env`

If you want the lowest-dependency setup, keep the default `STORAGE_DRIVER=local` profile and leave PostgreSQL unused.

If you want local Redis-backed validation, make sure Redis is running and then verify it before `pnpm dev`:

```bash
redis-cli ping
```

The checked-in `.env.example` is already suitable for this mode on a machine with local Redis running at `redis://127.0.0.1:6379`.

If you want PostgreSQL as well, update `.env` like this:

```bash
STORAGE_DRIVER=database
DATABASE_URL=postgresql://worknext:worknext@localhost:5432/worknext
```

Useful commands:

```bash
pnpm --filter @worknext/api test
pnpm --filter @worknext/web test
pnpm -r build
```

### Local FAQ

`pnpm dev` fails because port `3000` or `3001` is already in use

- Cause: a stale Next.js or API process from an earlier run is still alive.
- Check: `ss -ltnp '( sport = :3000 or sport = :3001 )'`
- Fix: stop only the matching WorkNext processes, then retry `pnpm dev`.

`redis-cli ping` fails or `/api/health` shows `redis=down`

- Cause: Redis is not running, or `.env` points to the wrong `REDIS_URL`.
- Check: `redis-cli ping`
- Fix: start Redis locally and confirm `.env` uses `redis://127.0.0.1:6379` or another reachable address.

`/api/health` shows `queues=down` or `realtime=down`

- Cause: Redis-backed features are enabled but Redis is unavailable, or the API booted before Redis was ready.
- Check: `curl http://127.0.0.1:3001/api/health`
- Fix: recover Redis first, then restart `pnpm dev`.

`PostgreSQL connection errors appear during startup`

- Cause: `STORAGE_DRIVER=database` is enabled but PostgreSQL is not running or `DATABASE_URL` is wrong.
- Fix: either start PostgreSQL and correct `DATABASE_URL`, or switch back to `STORAGE_DRIVER=local` for the default local-first workflow.

`Local files are not showing up where expected`

- Cause: relative paths in `.env` are resolved from `apps/api` during `pnpm dev`.
- Fix: look under `apps/api/.data` and `apps/api/.uploads`, or use absolute paths in `.env`.

`Email or push notifications do not hit an external provider`

- Cause: local development defaults use `EMAIL_DELIVERY_MODE=local` and `PUSH_DELIVERY_MODE=local`.
- Fix: inspect the local outbox files under `apps/api/.data`, or configure SMTP / webhook settings explicitly.

---

<details>
<summary id="中文介绍"><strong>切换到中文 / Switch to Chinese</strong></summary>

## 中文介绍

### 项目简介

WorkNext 是一个偏作品集展示口径的全栈团队协作平台，产品形态参考 Slack，重点不只是功能堆叠，而是体现完整的工程设计能力。

这个仓库主要展示：

- 多租户后端设计
- 实时协作系统设计
- 前后端统一的 TypeScript 类型契约
- 模块化 NestJS 架构
- 面向生产的测试、安全和可维护性思路

当前项目已经不再是原型阶段，而是一个完成度较高的一期 MVP，并且已经落了一批二期基础能力：除了认证、工作区、频道、消息、附件、通知、实时通信和 optimistic UI 之外，也已经具备线程、表情反应、搜索、审计、基础分析面板、组织级概览，以及 API 和前端端到端自动化测试。

### 当前已完成能力

- 注册、登录、JWT 鉴权、Refresh Token 轮换、登出、资料更新
- 工作区创建、邀请、接受邀请、撤销邀请、退出工作区
- Owner / Admin / Member 角色管理
- 公共频道与私有频道
- 消息发送、编辑、软删除、分页、已读、未读计数、线程、表情反应、读回执
- 本地文件上传与附件元数据管理
- `@mention` 通知、Digest 偏好、邮件与 Push 基线投递
- Socket.IO 实时消息、输入中状态、在线状态、重连状态同步基础能力
- 工作区内搜索、高亮预览、审计日志、基础分析卡片、组织级工作区概览
- 前端工作区主界面、响应式协作流程与 optimistic UI
- API E2E 与 Playwright 自动化测试

### 功能矩阵

| 领域 | 状态 | 当前范围 |
| --- | --- | --- |
| 认证与会话 | 已完成 | 注册、登录、刷新、登出、资料更新、JWT + Refresh Cookie |
| 工作区与成员 | 已完成 | 工作区、邀请、成员角色、租户隔离、退出与撤销邀请 |
| 频道与消息 | 已完成 | 公共/私有频道、发消息、编辑、删除、线程、表情反应、已读与未读 |
| 文件与通知 | 已完成 | 上传、提及通知、Digest 偏好、本地邮件/Push outbox |
| 搜索与审计 | 已完成 | 工作区搜索、高亮预览、管理员审计日志 |
| 前端协作体验 | 已完成 | 响应式主界面、optimistic updates、线程面板、通知界面 |
| 分析与组织管理 | 基线完成 | 分析卡片、组织概览、组织下跨工作区创建 |
| Redis 实时扩展 | 基线完成 | Redis adapter 已接线，并已通过本地双实例验证 |
| BullMQ 后台任务 | 基线完成 | 提及通知可走 BullMQ，且保留同步 fallback |
| 运维就绪度 | 基线完成 | health/live/ready、runbook、验证清单、本地 Redis 验证证据 |
| 实时可靠性 | 持续扩展中 | 回放、投递保证、更多多实例故障场景还在补强 |
| 产品深度 | 持续扩展中 | 更深分析、组织生命周期、定时 Digest、Push 深度集成、OAuth |

### 技术栈

前端：

- Next.js 16
- React 19
- TypeScript
- TanStack Query
- Zustand
- Tailwind CSS
- Playwright

后端：

- NestJS 10
- TypeScript
- Prisma
- PostgreSQL
- Socket.IO
- Swagger / OpenAPI
- Pino
- class-validator
- Helmet
- Jest + Supertest

### 数据库状态

仓库当前支持三种可实际运行的模式。

- Local-first 模式使用本地 JSON 状态文件和上传目录，仍然是最容易启动的默认路径。
- Database 模式通过 Prisma 接入 PostgreSQL，已经具备与本地存储层对齐的数据模型。
- Redis-enhanced 模式会在上述任一存储模式之上叠加 Socket.IO Redis adapter 和 BullMQ 队列路径。

### 部署 / 环境简述

本地运行依赖：

- Node.js 22+
- pnpm 10+
- PostgreSQL，仅在使用 database 模式时需要
- 适合 Linux / WSL2 的本地开发环境
- Redis，仅在验证可选的实时扩展或 BullMQ 路径时需要

当前运行模式：

| 模式 | 存储 | 可选基础设施 | 适用场景 |
| --- | --- | --- | --- |
| File-backed runtime | 本地 JSON 状态文件 + 本地上传目录 | 无 | 最低依赖的本地开发与隔离验证 |
| PostgreSQL-backed runtime | Prisma + PostgreSQL | 无 | 关系型持久化与数据库路径验证 |
| Redis-enhanced runtime | File-backed 或 PostgreSQL-backed | Redis adapter + BullMQ | 多实例实时验证与可重试后台任务 |

运行模式依赖关系图：

```mermaid
flowchart TD
  root[WorkNext 运行模式] --> local[Local-first 模式\nSTORAGE_DRIVER=local]
  root --> database[Database 模式\nSTORAGE_DRIVER=database]

  local --> localState[本地 JSON 状态文件]
  local --> localUploads[本地上传目录]

  database --> prisma[Prisma 存储层]
  prisma --> postgres[(PostgreSQL)]

  local --> redisLayer[可选 Redis-enhanced 层]
  database --> redisLayer

  redisLayer --> redisFlags[ENABLE_REDIS_ADAPTER=true\nENABLE_BULLMQ=true]
  redisFlags --> redis[(Redis)]
  redis --> adapter[Socket.IO Redis adapter]
  redis --> queues[BullMQ 队列]
```

补充说明：

- File-backed 仍然是当前仓库最省依赖的本地工作流
- PostgreSQL 模式已经实现，但依赖本机可访问的数据库服务
- Redis Adapter 和 BullMQ 已完成接线，且本地双实例验证已经通过；后续重点是补齐更广的发布指引与故障场景证据

### 本地启动建议

最省事的本地启动方式：

```bash
cp .env.example .env
pnpm install
redis-cli ping
pnpm dev
```

默认 `.env.example` 已经适配以下本地模式：

- `STORAGE_DRIVER=local`，不会强制依赖 PostgreSQL
- `REDIS_URL=redis://127.0.0.1:6379`
- `ENABLE_REDIS_ADAPTER=true`
- `ENABLE_BULLMQ=true`
- 邮件和 Push 默认写入本地 outbox 文件，便于调试

路径说明：

- 使用 `pnpm dev` 时，API 进程的工作目录是 `apps/api`
- 所以 `.data/worknext.json`、`.uploads`、`.data/email-outbox.jsonl`、`.data/push-outbox.jsonl` 这类相对路径，实际都会落到 `apps/api/` 下
- 如果你希望这些文件落到别的目录，请在 `.env` 中改成绝对路径

如果你要切到 PostgreSQL，把 `.env` 改成：

```bash
STORAGE_DRIVER=database
DATABASE_URL=postgresql://worknext:worknext@localhost:5432/worknext
```

### 本地常见问题

`pnpm dev` 提示 `3000` 或 `3001` 端口被占用

- 原因：上一次运行残留了 Next.js 或 API 进程。
- 排查：`ss -ltnp '( sport = :3000 or sport = :3001 )'`
- 处理：只杀掉对应的 WorkNext 进程，再重新执行 `pnpm dev`。

`redis-cli ping` 失败，或 `/api/health` 里 `redis=down`

- 原因：Redis 没启动，或者 `.env` 里的 `REDIS_URL` 不对。
- 排查：`redis-cli ping`
- 处理：先启动 Redis，并确认 `.env` 使用的是 `redis://127.0.0.1:6379` 或其他可达地址。

`/api/health` 显示 `queues=down` 或 `realtime=down`

- 原因：Redis 相关功能已开启，但 Redis 不可用，或者 API 启动早于 Redis 就绪。
- 排查：`curl http://127.0.0.1:3001/api/health`
- 处理：先恢复 Redis，再重启 `pnpm dev`。

`启动时出现 PostgreSQL 连接错误`

- 原因：开启了 `STORAGE_DRIVER=database`，但 PostgreSQL 没启动或 `DATABASE_URL` 配错。
- 处理：要么启动 PostgreSQL 并修正 `DATABASE_URL`，要么切回默认的 `STORAGE_DRIVER=local`。

`本地文件位置和预期不一致`

- 原因：`pnpm dev` 下，相对路径会从 `apps/api` 解析。
- 处理：去 `apps/api/.data` 和 `apps/api/.uploads` 下看，或者直接在 `.env` 中改成绝对路径。

`邮件或 Push 没有发到真实外部服务`

- 原因：本地默认使用 `EMAIL_DELIVERY_MODE=local` 和 `PUSH_DELIVERY_MODE=local`。
- 处理：先查看 `apps/api/.data` 下的本地 outbox，若要接真实服务，再单独配置 SMTP 或 webhook。

### 二期方向

后续重点不再是补基础聊天功能，而是把扩展能力和生产化闭环做实：

1. Redis 驱动的实时扩展能力
2. 更完整的多实例一致性、重连补偿与发布指引
3. BullMQ 异步任务体系
4. 告警接线、备份恢复演练与生产化校验
5. 更深的分析面板、组织生命周期能力、定时 Digest、OAuth

### 文档

- 详细实现状态与阶段记录：[docs/project-status.md](docs/project-status.md)
- 前端 API 交接文档：[docs/frontend-api-handoff.md](docs/frontend-api-handoff.md)
- 运维 Runbook：[docs/operations-runbook.md](docs/operations-runbook.md)
- 运维验证清单：[docs/operations-validation-checklist.md](docs/operations-validation-checklist.md)

### 架构与展示

- 英文主区域已经加入 GitHub 徽章、Mermaid 架构图和截图占位区，适合仓库首页展示
- 当前截图仍是占位图，后续可以直接替换为真实产品截图

</details>