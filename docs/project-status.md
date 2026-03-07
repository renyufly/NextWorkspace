# WorkNext

A production-grade Slack-inspired team communication platform built as a TypeScript monorepo.

This repository is the source of truth for product scope, architecture decisions, implementation phases, and delivery progress. Phase 1 is a strong MVP with real-time messaging, multi-tenant workspace isolation, and production-ready engineering foundations. Phase 2 extends the system with higher-complexity collaboration and platform features.

## 1. Product Goal

WorkNext is a resume-grade full-stack web application that demonstrates:

- Multi-tenant backend design
- Real-time communication with horizontal scaling support
- Strong TypeScript end-to-end contracts
- Clean modular backend architecture
- Production-minded testing, security, and DevOps practices
- Clear system design reasoning suitable for interviews

## 2. Delivery Strategy

The project is intentionally split into:

- Phase 1: complete, deployable MVP
- Phase 2: advanced collaboration and platform capabilities

Delivery principle:

- Prefer completeness and correctness over breadth.
- Any feature that threatens MVP quality moves to Phase 2.
- `docs/project-status.md` must be updated after each completed feature.

## 3. Final Tech Decisions

### Monorepo

- Package manager: pnpm workspaces
- Repository layout: apps plus packages
- Shared contracts: packages/shared

### Frontend

- Framework: Next.js 16 App Router
- Language: TypeScript strict mode
- Server state: TanStack Query
- Client and realtime local state: Zustand
- Styling: Tailwind CSS
- End-to-end testing: Playwright

### Backend

- Framework: NestJS 10
- Language: TypeScript strict mode
- Database: PostgreSQL
- ORM: Prisma
- Local standalone runtime: file-backed persistence adapter for WSL2-first MVP development
- Cache and realtime adapter: Redis
- WebSocket transport: Socket.io
- Background jobs: BullMQ
- API documentation: Swagger OpenAPI
- Logging: Pino
- Validation: class-validator with Nest ValidationPipe

### DevOps

- Local fallback runtime: no-Docker WSL2 mode with file-backed persistence
- Environment management: .env files with schema validation
- CI baseline: lint, typecheck, test, build
- Health checks: API health endpoint and container health probes

## 4. Repository Structure

```text
.
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── config/
│   ├── shared/
│   └── ui/
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## 5. Current Delivery Status

### 5.1 Implemented

- Authentication: registration, login, JWT access token issuance, refresh token rotation, logout, and profile update.
- Workspaces: create, rename, invite by email, accept invitation, revoke invitation, leave workspace, and enforce tenant isolation.
- Memberships and RBAC: owner/admin/member roles, member listing, role updates, and member removal.
- Channels: public and private channels, rename, delete with general-channel protection, channel membership management, and permission checks.
- Messaging: send, edit, soft delete, cursor pagination, mark-as-read, unread counts, attachment linking, one-level threads, emoji reactions, and derived per-message read receipts.
- Files: local disk uploads, file validation, attachment metadata persistence, and `/uploads` static serving.
- Notifications: mention parsing, in-app notification listing, unread count summary, single-item read, mark-all-read, workspace notification preferences, mute controls, digest mode selection, persisted last-digest tracking, manual digest generation, and email plus push delivery baselines with local outboxes and optional external transports.
- Audit trail: workspace-scoped admin audit history for workspace changes, invitations, role changes, channel administration, and private-channel membership changes.
- Realtime: authenticated Socket.IO connection, workspace/channel joins, message create/update/delete broadcasts, typing indicators, presence heartbeat, reconnect-driven room rejoin, and client-triggered state sync.
- Engineering baseline: Swagger, Pino logging, ValidationPipe, centralized exception filter, Helmet, throttling, and health reporting.
- Operations baseline: liveness and readiness probes, dependency-aware health status, and a repository-backed operations runbook for monitoring, backup, restore, and incident response.
- Operations documentation baseline: the repo now also includes an operations validation checklist covering alert routing, backup drills, restore drills, and Redis multi-instance verification steps.
- Frontend shell: register/login, workspace and channel navigation, chat timeline, composer, thread panel, reactions, workspace search, notifications, theme toggle, responsive layout work, workspace settings drawer, admin analytics snapshot cards, and organization admin overview with cross-workspace creation.
- Search: workspace-scoped ranked search across accessible channels, messages, files, and members with scope filters, channel filters, previews, and frontend highlighting.
- Automated verification: API Jest E2E coverage for auth, organizations, workspaces, invitations, private channels, uploads, messaging, threads, reactions, read receipts, search, notifications, digest generation, email and push outbox delivery, and workspace analytics; Playwright browser coverage for workspace creation, organization workspace creation, switching, thread replies, reactions, search, invitation acceptance, and notification preference interactions including manual digest runs, email and push toggles, and analytics visibility.
- Frontend responsiveness: optimistic updates with rollback for core collaboration flows including workspaces, channels, invitations, memberships, notifications, and message mutations.

### 5.2 Phase 2 Infrastructure Sync

This section reflects the latest completed Phase 2 platform work and should be updated after every implementation pass.

- Redis realtime scaling baseline: optional Redis service wiring and Socket.IO Redis adapter integration are implemented behind env flags so single-instance Phase 1 runtime still works without Redis.
- Redis adapter validation baseline: a local two-instance Redis-backed fan-out validation has now been completed against real `redis-server`, and the namespace-vs-root-server adapter wiring bug discovered during validation was fixed.
- Delivery reconciliation baseline: persisted presence records, per-user realtime rooms, reconnect invalidation, `state:sync` plus `state:reconciled` flow, and online user reconciliation are implemented for client recovery after reconnect.
- BullMQ job baseline: mention-notification dispatch can now run through BullMQ with retry/backoff when Redis and `ENABLE_BULLMQ=true` are enabled, while preserving inline fallback when queues are disabled.
- Production hardening baseline: health checks now report storage, database, Redis, queues, and realtime adapter status; feature flags expose whether Redis adapter and BullMQ are active; dedicated liveness and readiness probes plus an operations runbook are now in place.
- Runtime safety: API start and dev entrypoints were corrected to follow the real monorepo build output path, so local dev and Playwright boot flows use a stable backend startup path.

### 5.3 Current TODO Board

Current planning rule for the active MVP:

- Do not spend time on Docker.
- Do not spend time on S3-compatible storage for now.
- Continue using WSL2 local services plus PostgreSQL and local disk uploads.

| Priority | Area | Status | Remaining work | Current gap | Suggested done criteria |
| --- | --- | --- | --- | --- | --- |
| P0 | Testing | Done | API E2E coverage for auth, workspace, channel, message, invitation, upload, and notification flows. | Closed. Jest E2E now covers the critical API path. | Keep the suite green as new features land. |
| P0 | Testing | Done | Frontend Playwright coverage for login, workspace switching, messaging, invitation acceptance, and notification interactions. | Closed. Browser smoke coverage now exercises the main collaboration loop. | Extend only when new user-facing flows are added. |
| P0 | Frontend UX | Done | End-to-end optimistic updates and failure rollback for message send/edit/delete, channel operations, invitations, and membership changes. | Closed for the current MVP surface. | Preserve rollback correctness as new mutations are added. |
| P1 | Realtime scaling | In Progress | Extend Redis-backed Socket.IO validation beyond the completed local two-instance proof into repeatable rollout notes and broader environment coverage. | Two API instances have now been validated locally against real Redis with successful cross-instance message fan-out and surviving-instance `state:sync` recovery, but broader deployment notes and additional failure-mode coverage are still pending. | Multiple API instances can fan out events consistently through Redis in a verified runbook-backed setup with repeatable rollout guidance. |
| P1 | Realtime reliability | In Progress | Strengthen delivery acknowledgement rules, reconnect reconciliation, and multi-instance consistency guarantees. | Baseline reconciliation is implemented, but delivery durability, missed-event replay, and cross-instance edge cases are not fully covered yet. | Clients recover state cleanly after reconnects or instance changes without silent divergence under verified multi-instance tests. |
| P1 | Background jobs | In Progress | Broaden BullMQ beyond mention notifications to cleanup and other retryable work, then validate against live Redis. | Queue wiring exists with retry/backoff and fallback, but only mention notification fan-out is using it today. | Long-running or retryable work is consistently moved out of synchronous request paths and verified under queue runtime. |
| P1 | Ops hardening | In Progress | Finish production checklist, monitoring, alerting, backup, restore, and failure playbooks for PostgreSQL plus Redis. | Health surface now includes liveness and readiness probes, the repo has an operations runbook, and there is now a validation checklist for alert routing and drills, but live backup drills, restore evidence, and multi-instance recovery validation are still pending. | Runtime has documented production assumptions, recovery procedures, observability requirements, and a tested restore path. |
| P2 | Backend modules | In Progress | Keep SearchModule and AuditModule integrated, then extend audit coverage and search depth. | AuditModule and ranked filtered search are now active, but moderation-related audit trails, auth/session audit events, and deeper relevance tuning are still limited. | Search and audit are production-ready for core admin and collaboration use cases with clear expansion paths. |
| P2 | Product features | In Progress | Deliver deeper analytics and organization-level administration on top of the current collaboration baseline. | Initial admin analytics, email delivery, push delivery, and organization overview baselines are now available, but deeper dashboard drill-downs, scheduled digest automation, richer push integrations, and fuller org-level lifecycle controls are still missing. | Product scope grows into team operations and administration without regressing the collaboration surface. |
| P2 | Auth and platform | Planned | Add OAuth, enterprise auth extensions, and supporting platform controls after reliability and operations are in better shape. | Authentication is still email/password only, and platform-level administration remains workspace-scoped. | Platform scope expands after reliability and operational readiness are stable. |

### 5.4 Deferred For Now

- Docker-based local workflow is intentionally out of scope for the current WSL2-first setup.
- S3-compatible storage abstraction is intentionally deferred; local disk uploads remain the active file path.
- Phase 2 roadmap items remain deferred until testing, reliability, and operational hardening are in better shape.

## 6. Phase 2 Backlog

The following features stay deferred until the MVP todo board above is substantially complete:

- OAuth login providers
- Admin analytics dashboards with deeper drill-down and trend views
- AI assistant and summarization workflows
- Organization-level administration

### 6.1 Highest-Priority Business Features Still Not Implemented

The main remaining Phase 2 gaps are now more product-facing than infrastructure-facing:

- Audit coverage depth: admin-sensitive workspace and channel actions are now logged, but message moderation, auth/session events, and richer operator workflows are still not covered.
- Search quality ceiling: ranked filtered search with previews and highlighting is implemented, but advanced relevance tuning, saved searches, and deeper full-text behavior are still missing.
- External delivery channels: email and push delivery now both have baselines with per-workspace preferences, local outbox delivery, and optional external transports, but richer device-level push integration is not implemented.
- Notification delivery maturity: digest mode, mute preferences, last-digest tracking, manual in-app digest generation, and optional email plus push delivery are implemented, but there is not yet a real scheduled digest delivery pipeline.
- Organization and admin layer: an organization baseline now groups workspaces, surfaces org membership and workspace visibility to admins, and allows adding workspaces under an existing org, but org-level invitations, role editing, and centralized policy controls are still missing.
- Analytics depth: a baseline admin dashboard now shows active members, message volume, engaged-member retention proxy, top channels, and audit activity, but deeper drill-downs, cohort reporting, and moderation analytics are still missing.
- OAuth and enterprise auth: authentication is still email/password only.

### 6.2 Active Expansion Scope

The next product expansion is intentionally limited to the following four tracks:

- Analytics dashboard: add admin-facing views for active users, message volume, workspace retention, and moderation or audit activity.
- External notifications: add email delivery first, then push delivery, while preserving the current in-app notification and digest path as fallback.
- Organization administration: add organization entities, cross-workspace membership oversight, org-level roles, and admin visibility across workspaces.
- Operations readiness: add monitoring, alerting thresholds, backup and restore procedures, and incident runbooks that match the current monolith deployment model.

Explicitly out of scope for the current planning window:

- Microservice decomposition

### 6.3 Operational References

- Operations runbook: `docs/operations-runbook.md`
- Operations validation checklist: `docs/operations-validation-checklist.md`

## 7. Architecture Principles

- Keep controllers thin and move business rules into services and domain-oriented modules.
- Enforce workspace isolation on every tenant-scoped read and write.
- Keep DTO validation at the boundary and domain invariants in the application layer.
- Design storage, cache, and realtime integrations behind abstractions.
- Use strict typing across API, database, and client state.
- Keep Phase 1 modular monolith friendly to later extraction into services.

## 8. Module Ownership

### Feature Modules

- AuthModule
- UsersModule
- SessionsModule
- WorkspacesModule
- MembershipsModule
- InvitationsModule
- RbacModule
- ChannelsModule
- MessagesModule
- FilesModule
- NotificationsModule
- PresenceModule
- RealtimeModule

### Cross-Cutting Modules

- HealthModule
- StorageModule
- CacheModule
- ConfigModule
- DatabaseModule
- LoggingModule
- SecurityModule

### Active Or Reserved Phase 2 Modules

- SearchModule
- AuditModule

## 9. Multi-Tenant Rules

Tenant isolation is a hard requirement.

- Every tenant-scoped entity must carry workspaceId.
- Every protected request must validate workspace membership.
- Cross-workspace resource access must fail even when a valid resource id exists.
- Channel, message, file, and notification access must all be workspace-scoped.

## 10. Authentication Design

Phase 1 authentication model:

- Email and password sign-in
- Password hashing with Argon2 when supported, otherwise bcrypt
- Short-lived JWT access token for API and socket auth
- Rotating refresh token stored in HTTP-only cookie
- Refresh token hashes persisted server-side
- Session revocation on logout
- OAuth postponed to Phase 2

Authentication flow:

1. User registers or signs in with email and password.
2. API verifies credentials and creates a session record.
3. API returns an access token and sets refresh cookie.
4. Client uses access token for HTTP and Socket.io authentication.
5. When access token expires, client calls refresh endpoint.
6. API validates refresh cookie, rotates token, updates session, and returns new access token.
7. Logout revokes the active session and invalidates the stored refresh hash.

## 11. Realtime Design

Phase 1 realtime model:

- Socket.io namespaces remain simple; routing is room-based.
- Users join workspace and channel rooms after socket authentication.
- Message events broadcast to channel rooms.
- Typing indicators use short-lived ephemeral events.
- Presence updates use heartbeat plus disconnect fallback.
- Redis adapter enables multi-instance message fan-out.
- Client reconciles optimistic messages with server acknowledgements.

## 12. Storage Design

- Local disk storage in development
- Storage service abstraction from day one
- File metadata stored in PostgreSQL
- Attachment records linked to messages
- Cloud storage adapter planned for Phase 2 hardening

## 13. Security Baseline

- Helmet enabled on API
- Strict CORS allowlist by environment
- Rate limiting on auth and sensitive endpoints
- ValidationPipe with whitelist and transform
- Centralized exception filter
- Structured audit-friendly request logging
- Secrets loaded from environment variables only

## 14. Testing Strategy

- Unit tests for domain services and guards
- Integration tests for controllers and repositories
- E2E tests for auth and critical messaging flows
- Frontend end-to-end tests with Playwright for workspace creation, switching, invitation acceptance, messaging, and notification interactions

## 15. Implementation Phases

### Phase 0: Monorepo Bootstrap

- Root workspace configuration
- Shared TypeScript configuration
- API and web app scaffolding
- Shared package scaffolding
- Docker Compose for PostgreSQL and Redis
- Environment examples

### Phase 1A: Identity and Workspace Core

- Users, auth, sessions
- Workspaces, memberships, invitations
- RBAC baseline
- Swagger setup
- Auth test coverage

### Phase 1B: Channels and Messaging Core

- Channels and channel memberships
- Message CRUD
- Soft delete
- Cursor pagination
- Unread counters
- Database indexes

### Phase 1C: Realtime Delivery

- Socket auth
- Workspace and channel rooms
- Typing indicators
- Presence heartbeat
- Redis adapter
- Reconnect handling
- State reconciliation baseline

### Phase 1D: Files and Notifications

- File upload API
- Storage abstraction
- Attachment rendering contracts
- Mention-driven notification events

### Phase 1E: Frontend Product Shell

- Auth pages
- Workspace shell
- Channel navigation
- Message timeline and composer
- Upload flows
- Optimistic UX

### Phase 1F: Hardening and Delivery

- Health checks
- Structured logging
- CI baseline
- Playwright coverage
- Deployment notes
- Interview-ready design summary
- API E2E coverage

## 16. Progress Tracking Rule

After each completed feature, update `docs/project-status.md` with:

- Status: Planned, In Progress, Done, or Blocked
- Implementation summary
- Main modules or files touched
- Verification performed
- Deferred follow-up work

## 17. Progress Ledger

| Feature | Status | Summary | Verification | Follow-up |
| --- | --- | --- | --- | --- |
| README rewrite | Done | Replaced informal planning notes with a formal implementation spec, MVP boundary, module map, and progress process. | Manual review | Keep ledger updated after each completed feature. |
| Phase 0 monorepo root | Done | Added pnpm workspace root, shared TypeScript base config, gitignore, editorconfig, environment example, and Docker Compose for PostgreSQL plus Redis. | File review | Keep Docker Compose for later PostgreSQL and Redis hardening. |
| API bootstrap | Done | Added NestJS app shell, global config loading, Swagger setup, Pino logger module wiring, health module, and initial Prisma schema for users, sessions, workspaces, memberships, invitations, channels, messages, attachments, and presence. | File review | Keep the Prisma schema aligned with the local runtime feature set. |
| API local MVP runtime | Done | Added strict env validation, local file-backed persistence, JWT auth with refresh cookie rotation, workspace and channel APIs, message APIs, and local health metrics. | `pnpm --filter @worknext/api typecheck`, `pnpm --filter @worknext/api build`, HTTP smoke test through register, workspace create, channel create, and message send | Keep Prisma and PostgreSQL integration aligned with the local runtime contract. |
| Workspace collaboration core | Done | Added invitations, invitation acceptance, member listing, role management, and owner/admin/member RBAC rules for workspace operations. | `pnpm --filter @worknext/api typecheck`, `pnpm --filter @worknext/api build`, HTTP smoke test for invite creation, invite acceptance, member listing, and role promotion | Add invitation revocation, leave workspace flows, and channel-level membership rules. |
| Private channels and workspace lifecycle | Done | Added functional private channels, explicit channel membership management, invitation revocation, and non-owner leave workspace flows, then wired them into the web shell. | `pnpm --filter @worknext/api typecheck`, `pnpm --filter @worknext/api build`, `pnpm --filter @worknext/web typecheck`, `pnpm --filter @worknext/web build`, HTTP smoke test for private channel visibility, member add/remove, invitation revoke, and leave workspace | Add richer channel moderation UX, creator handoff rules, and optimistic membership updates. |
| Messaging core enhancements | Done | Added cursor-based message pagination, soft delete, message editing, explicit read markers, and unread counts surfaced on channel summaries. | `pnpm --filter @worknext/api typecheck`, local smoke test for unread counts, paginated reads, edit, soft delete, and mark-read flows | Add optimistic updates, richer history loading UX, and mention parsing. |
| Realtime collaboration baseline | Done | Added authenticated Socket.IO workspace and channel joins, message broadcast hooks, typing indicators, presence heartbeats, and reconnect-driven room rejoin logic in the web client. | `pnpm --filter @worknext/api build`, `pnpm --filter @worknext/web build`, local realtime smoke test for presence, typing, and live message delivery | Add Redis adapter, delivery acknowledgements, and persisted presence state for multi-instance deployment. |
| Files and notifications baseline | Done | Added local file uploads, attachment metadata on messages, mention-driven in-app notifications, notification read APIs, and a minimal frontend inbox plus attachment composer flow. | `pnpm --filter @worknext/api typecheck`, `pnpm --filter @worknext/web typecheck` | Add S3-style storage abstraction, richer attachment previews, notification summary endpoints, and realtime notification badges. |
| Web local MVP shell | Done | Replaced the landing placeholder with a React Query plus Zustand workspace client for register/login, workspace selection, invitations, member management, unread channel badges, realtime updates, and messaging controls. | `pnpm --filter @worknext/web typecheck`, `pnpm --filter @worknext/web build`, HTTP check on `http://localhost:3000` | Add optimistic updates, richer error recovery, and multi-page auth plus workspace routing. |
| Dependency installation | Done | Installed a native WSL2 Node.js plus pnpm toolchain, created a local `.env`, and completed workspace dependency installation. | Terminal verification with node, npm, pnpm, and workspace builds | Optionally install PostgreSQL and Redis locally later when moving off file-backed dev mode. |
| Security hardening baseline | Done | Added Helmet security headers, ThrottlerModule rate limiting (60 req/min), and a centralized AllExceptionsFilter providing structured error envelopes with audit-friendly logging. | `pnpm install`, `pnpm --filter @worknext/api typecheck`, manual verification of Helmet response headers and rate limit 429 behavior | Configure per-route throttle overrides for sensitive endpoints in Phase 2. |
| Missing CRUD endpoints | Done | Added PATCH /auth/profile for user display name updates, PATCH and DELETE for channels (with general channel delete protection), and PATCH /workspaces/:id for workspace rename with slug regeneration. DTOs use class-validator. | `pnpm --filter @worknext/api typecheck`, local smoke test for profile update, channel rename, channel delete, and workspace rename | Add frontend UI controls for these new endpoints; add channel archive vs hard delete option. |
| Notification and realtime enhancements | Done | Added GET /notifications/unread-count returning total and per-workspace counts, and wired emitNotification in RealtimeService so mention notifications are pushed live via WebSocket. Updated NotificationsModule to import RealtimeModule. Added NotificationCountSummary to shared types. | `pnpm --filter @worknext/api typecheck`, local smoke test for unread counts and live notification delivery | Add frontend notification badge using unread-count endpoint; add notification sound preferences. |
| UI polish and refinements | Done | Refined CSS with hover-reveal message toolbars, brightness hover micro-animations, pulsing typing indicator dot animation, grayscale styling for deleted messages, and smoother theme transition timing. | Visual review in browser, `pnpm --filter @worknext/web build` | Continue iterating on responsive mobile view and optimistic update animations. |
| Runtime status rewrite | Done | Reclassified the README into implemented, not implemented, and planned-but-not-wired sections so current project state is explicit instead of implied by the target architecture. | Manual review | Keep the status section synchronized with the active runtime instead of the aspirational architecture. |
| PostgreSQL persistence adapter | Done | Extended the Prisma schema and LocalStoreService so the existing business services persist through PostgreSQL, then switched the active local runtime to `STORAGE_DRIVER=database`. The API now boots in database mode and reports PostgreSQL storage in health checks. | `pnpm --filter @worknext/api db:push`, `pnpm --filter @worknext/api db:generate`, `pnpm --filter @worknext/api typecheck`, `pnpm --filter @worknext/api build`, HTTP check on `/api/health`, SQL row-count verification in PostgreSQL | Add a dedicated one-shot migration command for JSON-to-PostgreSQL import instead of relying on first-boot bootstrap behavior. |
| API E2E coverage | Done | Added Jest E2E coverage for register, refresh, profile, workspace creation, invitation acceptance, private channels, file uploads, message lifecycle, read markers, and mention notifications. | `pnpm --filter @worknext/api test` | Expand the suite when new backend capabilities are added; add Redis-backed scenarios later. |
| Web Playwright coverage | Done | Added browser E2E coverage for registration, workspace switching, channel creation, message send, invitation acceptance, and mention notification reading. Stabilized the suite around optimistic invitation tokens and a reproducible API startup path. | `pnpm --filter @worknext/web test` | Add more browser coverage only as new UX flows become user-critical. |
| Optimistic UI pass | Done | Implemented optimistic cache updates plus rollback for main collaboration mutations across workspaces, channels, invitations, memberships, notifications, and message actions. | `pnpm --filter @worknext/web typecheck`, `pnpm --filter @worknext/web test` | Add optimistic treatment for any future mutations introduced in Phase 2. |
| Phase 2 infrastructure baseline | In Progress | Added optional Redis adapter wiring, persisted presence reconciliation, per-user realtime rooms, BullMQ-backed mention notification dispatch with fallback, expanded health reporting, and fixed API dev/start scripts to match real build output. | `pnpm --filter @worknext/api typecheck`, `pnpm --filter @worknext/api test`, `pnpm --filter @worknext/web typecheck`, `pnpm --filter @worknext/web test`, API health checks via `curl` | Validate true multi-instance Redis deployment, broaden queue usage beyond mention notifications, and document production operations. |
| Phase 2 collaboration features | Done | Implemented one-level message threads, emoji reactions, derived per-message read receipts, workspace notification preferences with mute and digest settings, and unified workspace search across channels, messages, files, and members. Wired the new backend APIs into the web shell with thread reply UI, reaction controls, search panel, read-receipt summaries, and notification preference controls. | `pnpm --filter @worknext/api typecheck`, `pnpm --filter @worknext/web typecheck`, `pnpm --filter @worknext/api test`, `pnpm --filter @worknext/web test` | Improve search ranking and filtering, add scheduled digest delivery, and extend audit/admin capabilities without regressing the shipped collaboration surface. |
| Audit trail and search quality pass | Done | Added AuditModule with workspace-scoped admin audit history plus a settings-drawer audit UI, and upgraded search with scope filters, channel filters, ranking, previews, and frontend highlighting. Audit coverage now includes workspace changes, invitations, role changes, channel lifecycle, and private channel membership operations. | `pnpm --filter @worknext/api db:generate`, `pnpm --filter @worknext/api typecheck`, `pnpm --filter @worknext/web typecheck`, `pnpm --filter @worknext/api test`, `pnpm --filter @worknext/web test` | Add scheduled digest delivery, external notification channels, richer audit coverage, organization admin, and analytics. |

## 18. Local Environment Setup

For WSL2, use a native Linux Node.js toolchain inside the distro instead of Windows binaries mounted under `/mnt/c`.

1. Install Node.js 22 and pnpm inside WSL2.
2. Copy `.env.example` to `.env` at the repository root, or use the provided local `.env` defaults.
3. Install dependencies from the repository root.
4. Start the API and web apps directly with pnpm.
5. Open `http://localhost:3000` and register a user.
6. Create a workspace, add a channel, and start messaging.

```sh
pnpm install
pnpm dev
```

Current checked-in `.env` uses `STORAGE_DRIVER=database`, so the active local runtime persists through PostgreSQL.

The legacy JSON state file remains available as a bootstrap source, but PostgreSQL is now the primary store.

Useful PostgreSQL maintenance commands:

```sh
pnpm --filter @worknext/api db:push
pnpm --filter @worknext/api db:generate
pnpm --filter @worknext/api migrate:json-to-db -- --source .data/worknext.json --dry-run
pnpm dev
```

The migration command is explicit and repeatable. It prints source and target counts first, supports `--dry-run`, and refuses to replace non-empty PostgreSQL data unless `--force` is passed.

## 19. Initial Commands

Use pnpm from the repository root.

```sh
pnpm install
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm lint
pnpm typecheck
pnpm test
```
