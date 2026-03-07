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
  <img alt="Status" src="https://img.shields.io/badge/Status-Phase%201%20MVP%20Core-success">
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
| Messaging Workflow | Send, edit, soft delete, pagination, read markers, and unread counts |
| Files and Notifications | Attachment uploads, mention parsing, inbox notifications, and unread summary flows |
| End-to-End Typing | Shared TypeScript contracts between frontend and backend through `packages/shared` |
| Automated Quality Baseline | API E2E with Jest + Supertest and browser E2E with Playwright |

### Highlights

- Full-stack TypeScript monorepo powered by `pnpm` workspaces
- Next.js 16 + React 19 frontend with TanStack Query and Zustand
- NestJS 10 backend with Prisma and PostgreSQL
- JWT access tokens plus rotating refresh-token cookies
- Public and private channels with RBAC-aware membership rules
- Real-time messaging, typing indicators, and presence over Socket.IO
- File uploads and mention-driven notifications
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
    A -. planned scaling .-> X[(Redis Adapter)]
    A -. planned async jobs .-> B[(BullMQ Workers)]
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

WorkNext has completed the core scope of a strong Phase 1 MVP.

Implemented today:

- authentication and session management
- workspace creation, invitations, acceptance, revocation, and leave flows
- owner, admin, and member role management
- public and private channels
- message send, edit, soft delete, pagination, read markers, and unread counts
- local file upload with attachment metadata
- in-app notifications for mentions
- realtime delivery for messages, typing, and presence
- frontend workspace shell and collaboration UI
- automated API and frontend end-to-end testing

Still planned as the next platform step:

- Redis-backed Socket.IO scaling
- cross-instance reconciliation and delivery guarantees
- BullMQ background jobs
- production hardening for PostgreSQL, Redis, and observability
- advanced collaboration features such as threads, reactions, search, and audit trails

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

The active application path is connected to PostgreSQL through Prisma.

The repository also keeps a file-backed persistence mode for lightweight local development and isolated test scenarios, but the main runtime has already been wired to a relational database model covering users, sessions, workspaces, memberships, invitations, channels, messages, attachments, notifications, and presence.

### Deployment / Environment

#### Local Requirements

- Node.js 22+
- pnpm 10+
- PostgreSQL for the database-backed runtime
- Linux or WSL2-friendly local development environment

#### Current Runtime Modes

| Mode | Purpose |
| --- | --- |
| PostgreSQL-backed runtime | Main application path and active persistence model |
| File-backed runtime | Lightweight local fallback and isolated test scenarios |

#### Notes

- The primary application path is designed around PostgreSQL through Prisma.
- File-backed persistence remains available for development convenience and test isolation.
- Redis and BullMQ are planned next for scaling and async job execution, but are not yet part of the active runtime path.

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

### Roadmap

Near-term engineering roadmap:

1. Redis-backed realtime scaling
2. delivery reconciliation for reconnect and multi-instance consistency
3. BullMQ for async and retryable work
4. production hardening and observability

Phase 2 product roadmap:

1. threads
2. emoji reactions
3. read receipts
4. full-text search
5. email and push notifications
6. audit logs and admin analytics

### Local Development

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm --filter @worknext/api test
pnpm --filter @worknext/web test
pnpm -r build
```

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

当前项目已经不再是原型阶段，而是一个完成度较高的一期 MVP：已经具备认证、工作区、频道、消息、附件、通知、实时通信、前端主界面、optimistic UI，以及 API 和前端端到端自动化测试。

### 当前已完成能力

- 注册、登录、JWT 鉴权、Refresh Token 轮换、登出、资料更新
- 工作区创建、邀请、接受邀请、撤销邀请、退出工作区
- Owner / Admin / Member 角色管理
- 公共频道与私有频道
- 消息发送、编辑、软删除、分页、已读、未读计数
- 本地文件上传与附件元数据管理
- `@mention` 通知与未读统计
- Socket.IO 实时消息、输入中状态、在线状态
- 前端工作区主界面与协作流程
- API E2E 与 Playwright 自动化测试

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

项目已经接入 PostgreSQL，并通过 Prisma 管理数据模型。

仓库中仍然保留 file-backed 持久化模式，用于轻量本地开发和隔离测试，但当前主运行路径已经具备数据库持久化能力，不再只是本地 JSON 或内存型 demo。

### 部署 / 环境简述

本地运行依赖：

- Node.js 22+
- pnpm 10+
- PostgreSQL
- 适合 Linux / WSL2 的本地开发环境

当前运行模式：

- PostgreSQL-backed runtime：主运行路径
- File-backed runtime：本地 fallback 与测试隔离场景

补充说明：

- 当前数据库主路径已经通过 Prisma 接入 PostgreSQL
- Redis 和 BullMQ 仍属于下一阶段扩展能力，尚未进入当前主运行链路

### 二期方向

后续重点不再是补基础聊天功能，而是补齐平台能力：

1. Redis 驱动的实时扩展能力
2. 多实例一致性与重连补偿
3. BullMQ 异步任务体系
4. PostgreSQL / Redis / 监控告警等生产化硬化
5. Threads、Reactions、Search、Audit Log 等高级协作能力

### 文档

- 详细实现状态与阶段记录：[docs/project-status.md](docs/project-status.md)
- 前端 API 交接文档：[docs/frontend-api-handoff.md](docs/frontend-api-handoff.md)

### 架构与展示

- 英文主区域已经加入 GitHub 徽章、Mermaid 架构图和截图占位区，适合仓库首页展示
- 当前截图仍是占位图，后续可以直接替换为真实产品截图

</details>