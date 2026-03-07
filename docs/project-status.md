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
- README progress must be updated after each completed feature.

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

- Local infrastructure: Docker Compose
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
├── docker-compose.yml
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
- Messaging: send, edit, soft delete, cursor pagination, mark-as-read, unread counts, and attachment linking.
- Files: local disk uploads, file validation, attachment metadata persistence, and `/uploads` static serving.
- Notifications: mention parsing, in-app notification listing, unread count summary, single-item read, and mark-all-read.
- Realtime: authenticated Socket.IO connection, workspace/channel joins, message create/update/delete broadcasts, typing indicators, and presence heartbeat.
- Engineering baseline: Swagger, Pino logging, ValidationPipe, centralized exception filter, Helmet, throttling, and health reporting.
- Frontend shell: register/login, workspace and channel navigation, chat timeline, composer, notifications, theme toggle, responsive layout work, and workspace settings drawer.

### 5.2 Current TODO Board

Current planning rule for the active MVP:

- Do not spend time on Docker.
- Do not spend time on S3-compatible storage for now.
- Continue using WSL2 local services plus PostgreSQL and local disk uploads.

| Priority | Area | Remaining work | Current gap | Suggested done criteria |
| --- | --- | --- | --- | --- |
| P0 | Testing | Add real API E2E coverage for auth, workspace, channel, message, invitation, upload, and notification flows. | API only has a placeholder E2E baseline. | Critical business flows run in automated CI-friendly tests against the active PostgreSQL runtime. |
| P0 | Testing | Add frontend Playwright coverage for login, workspace switching, messaging, invitation acceptance, and notification interactions. | Playwright is installed but no real test suites are authored. | Web critical path can be smoke-tested automatically before release. |
| P0 | Frontend UX | Finish end-to-end optimistic updates and failure rollback for message send/edit/delete, channel operations, invitations, and membership changes. | Current UI works but still falls back to refetch-driven updates in several flows. | Main collaboration actions feel immediate and recover cleanly from API errors. |
| P1 | Realtime scaling | Add Redis-backed Socket.IO adapter for horizontal scaling. | Realtime currently works only as a single-instance deployment path. | Multiple API instances can fan out events consistently through Redis. |
| P1 | Realtime reliability | Add multi-instance delivery acknowledgement, reconnect reconciliation, and stronger realtime consistency rules. | Socket events exist, but cross-instance durability and reconciliation are not implemented. | Clients can recover state cleanly after reconnects or instance changes without silent message divergence. |
| P1 | Background jobs | Introduce BullMQ for async notification fan-out, cleanup jobs, and retryable background work. | All current flows execute inline in the request path. | Long-running or retryable work is moved out of synchronous API requests. |
| P1 | Ops hardening | Complete production-oriented PostgreSQL plus Redis operational hardening. | Local runtime is usable, but production deployment, observability, and failure-handling are still thin. | Runtime has a documented production checklist covering backups, env handling, health, and scaling assumptions. |
| P2 | Backend modules | Wire real SearchModule and AuditModule implementations into active code paths. | These modules are reserved in the architecture only. | Search and audit move from design placeholders to callable backend features. |
| P2 | Product features | Implement deferred collaboration features such as threads, reactions, read receipts, and richer notification preferences. | MVP currently stops at core chat, files, mentions, and inbox notifications. | Collaboration surface goes beyond baseline chat and workspace management. |
| P2 | Auth and platform | Add OAuth, organization administration, analytics, AI workflows, and later decomposition work only after MVP is stable. | These remain roadmap items, not active MVP scope. | Roadmap items are evaluated after core stability, testing, and scaling work are complete. |

### 5.3 Deferred For Now

- Docker-based local workflow is intentionally out of scope for the current WSL2-first setup.
- S3-compatible storage abstraction is intentionally deferred; local disk uploads remain the active file path.
- Phase 2 roadmap items remain deferred until testing, reliability, and operational hardening are in better shape.

## 6. Phase 2 Backlog

The following features stay deferred until the MVP todo board above is substantially complete:

- OAuth login providers
- Threads
- Emoji reactions
- Read receipts
- Full-text search
- Email notifications
- Push notifications
- Advanced notification preferences
- Audit logs
- Admin analytics dashboards
- AI assistant and summarization workflows
- Organization-level administration
- Microservice decomposition

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

### Reserved Phase 2 Modules

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
- Frontend end-to-end tests with Playwright after core flows stabilize

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

## 16. Progress Tracking Rule

After each completed feature, update this README with:

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
