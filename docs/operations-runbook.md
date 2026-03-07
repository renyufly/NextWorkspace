# WorkNext Operations Runbook

This runbook covers the current modular monolith deployment model for WorkNext. It is written for the repository's active operating modes:

- local-first fallback with `STORAGE_DRIVER=local`
- PostgreSQL-backed runtime with optional Redis and BullMQ

The goal is not to prescribe Docker or Kubernetes. The goal is to give operators a concrete checklist, backup path, restore path, and first-response guide that matches the code in this repository today.

## 1. Service Model

Primary runtime components:

- API: NestJS monolith in `apps/api`
- Web: Next.js app in `apps/web`
- Storage:
  - local mode: JSON state file plus uploads directory
  - database mode: PostgreSQL through Prisma-backed `LocalStoreService`
- Optional infra:
  - Redis for Socket.IO adapter and BullMQ
  - BullMQ worker inside the API process

## 2. Health Probes

Available endpoints:

- `GET /api/health`
  - detailed operational snapshot
  - returns `status: ok | degraded | down`
  - includes dependency checks, required checks, optional checks, and feature flags
- `GET /api/health/live`
  - process liveness only
  - use for shallow runtime probes
- `GET /api/health/ready`
  - dependency-aware readiness
  - returns HTTP `200` when the instance can serve traffic
  - returns HTTP `503` when a required dependency is down

Readiness rules in the current implementation:

- `storage` is always required
- `database` is required only when `STORAGE_DRIVER=database`
- `redis` and `realtime` are required when `ENABLE_REDIS_ADAPTER=true`
- `redis` and `queues` are required when `ENABLE_BULLMQ=true`

## 3. Monitoring Baseline

Minimum signals to collect:

- API availability:
  - probe `GET /api/health/live`
  - probe `GET /api/health/ready`
- Error rate:
  - count `5xx` responses from API logs
- Request latency:
  - p95 and p99 for `POST /auth/*`, `POST /workspaces`, `POST /messages`, `GET /notifications`
- Data growth:
  - local mode: state file size and uploads directory size
  - database mode: PostgreSQL database size, table growth for messages, notifications, audit logs
- Queue health:
  - `checks.queues` from `/api/health`
- Redis health:
  - `checks.redis` from `/api/health`
- Realtime fan-out:
  - `checks.realtime` from `/api/health`

Recommended scrape cadence:

- liveness/readiness: every 15s
- detailed health snapshot: every 60s
- log aggregation: continuous

## 4. Alert Thresholds

Recommended starting thresholds:

- Critical:
  - `/api/health/ready` returns `503` for 2 consecutive minutes
  - API `5xx` ratio exceeds 5% for 5 minutes
  - PostgreSQL unavailable while `STORAGE_DRIVER=database`
  - Redis unavailable while realtime adapter or BullMQ are enabled
- High:
  - `/api/health` returns `status=degraded` for 10 minutes
  - p95 API latency exceeds 1.5s for 10 minutes
  - queue health is `down` for 5 minutes
- Medium:
  - local state file grows unexpectedly fast
  - uploads disk usage exceeds 80%
  - PostgreSQL disk usage exceeds 75%
  - Redis memory usage exceeds 75%

## 4.1 Alert Routing Expectations

The repository does not prescribe a specific alerting product, but the operating model should distinguish between paging alerts and ticket-only alerts.

Recommended routing:

- Page immediately:
  - readiness probe failures
  - PostgreSQL outage in database mode
  - Redis outage when `ENABLE_REDIS_ADAPTER=true` or `ENABLE_BULLMQ=true`
  - sustained API `5xx` surge
- Notify during business hours:
  - degraded health without hard downtime
  - elevated latency
  - queue backlog or queue worker instability
  - disk growth or retention drift
- Create ticket only:
  - runbook drift
  - backup retention anomalies that still have recent restore points
  - missing evidence for the latest drill

Minimum alert payload fields:

- environment
- service name
- failing probe or metric
- first observed timestamp
- current status
- runbook link
- dashboard link if available

Recommended ownership mapping:

- API availability: backend owner
- PostgreSQL health and backups: platform or database owner
- Redis and BullMQ health: platform owner
- Upload disk capacity: backend or platform owner

## 5. Backup Strategy

### 5.1 Local Mode

Artifacts to back up:

- state file from `LOCAL_DATA_FILE`
- uploads directory from `LOCAL_UPLOAD_DIR`
- environment files used for the deployment

Example backup commands:

```bash
set -e
backup_root="/var/backups/worknext/$(date +%F-%H%M%S)"
mkdir -p "$backup_root"
cp "$LOCAL_DATA_FILE" "$backup_root/worknext-state.json"
cp -R "$LOCAL_UPLOAD_DIR" "$backup_root/uploads"
cp /path/to/deployment/.env "$backup_root/.env"
```

Retention suggestion:

- daily backups for 7 days
- weekly backups for 4 weeks

### 5.2 PostgreSQL Mode

Artifacts to back up:

- PostgreSQL logical dump
- uploads directory
- environment files

Example backup commands:

```bash
set -e
backup_root="/var/backups/worknext/$(date +%F-%H%M%S)"
mkdir -p "$backup_root"
pg_dump "$DATABASE_URL" --format=custom --file "$backup_root/worknext.pgdump"
cp -R "$LOCAL_UPLOAD_DIR" "$backup_root/uploads"
cp /path/to/deployment/.env "$backup_root/.env"
```

### 5.3 Redis Snapshot

Redis remains reconstructible for some workloads, but it should still be snapshotted when used for realtime adapter or BullMQ.

Example:

```bash
redis-cli -u "$REDIS_URL" --rdb /var/backups/worknext/redis-$(date +%F-%H%M%S).rdb
```

## 5.4 Backup Drill Cadence

Recommended minimum cadence:

- Local mode backup check: weekly
- PostgreSQL logical backup verification: weekly
- Restore drill to a scratch environment: monthly
- Redis adapter and queue recovery drill: monthly when Redis-backed features are enabled

Each drill should capture:

- date and operator
- source environment
- artifact path used
- restore target
- elapsed time
- smoke-test result
- follow-up actions

## 6. Restore Procedures

### 6.1 Local Mode Restore

1. Stop API and web processes.
2. Restore `LOCAL_DATA_FILE` from backup.
3. Restore `LOCAL_UPLOAD_DIR` from backup.
4. Verify file permissions.
5. Start the API.
6. Check `GET /api/health`, then validate a login and a message read path.

### 6.2 PostgreSQL Restore

1. Stop API instances.
2. Create or clean the target database.
3. Restore the dump:

```bash
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" /path/to/worknext.pgdump
```

4. Restore uploads.
5. Start the API.
6. Verify `GET /api/health/ready` returns `200`.
7. Run a smoke flow: login, list workspaces, send message, open notifications.

### 6.3 Redis Restore

1. Stop processes using Redis.
2. Replace the Redis persistence file with the backup snapshot according to your Redis deployment layout.
3. Restart Redis.
4. Start the API and verify `checks.redis` and `checks.queues`.

## 6.4 Restore Acceptance Criteria

A restore should not be marked successful until all of the following are true:

- `GET /api/health/live` returns `200`
- `GET /api/health/ready` returns `200`
- a known user can authenticate
- at least one workspace loads successfully
- one channel message can be read
- notifications can be listed
- when Redis-backed features are enabled, `checks.redis`, `checks.realtime`, and `checks.queues` report `up`

## 7. Incident Playbooks

### API Not Ready

Symptoms:

- `/api/health/ready` returns `503`

Actions:

1. Call `GET /api/health`.
2. Inspect `issues.required`.
3. If `database` is down, verify PostgreSQL reachability and credentials.
4. If `redis` is down, disable Redis-backed features only if the deployment allows it; otherwise restore Redis.
5. If `queues` are down, verify BullMQ/Redis connectivity.

### Local State Corruption

Symptoms:

- API boots but state parsing fails
- local mode requests return `500`

Actions:

1. Stop the API.
2. Validate the JSON backup.
3. Restore the latest known-good backup.
4. Restart and run a smoke test.

### PostgreSQL Outage

Symptoms:

- `checks.database=down`
- readiness probe fails in database mode

Actions:

1. Validate network path and credentials.
2. Inspect PostgreSQL logs and disk space.
3. If recovery is not immediate, restore to a standby or last good snapshot.

### Redis Outage

Symptoms:

- `checks.redis=down`
- realtime adapter and BullMQ degrade or fail

Actions:

1. Verify Redis process and network path.
2. If BullMQ is optional for the environment, consider temporarily disabling `ENABLE_BULLMQ`.
3. If Redis adapter is optional, consider disabling `ENABLE_REDIS_ADAPTER` and running single-instance fallback.

### Backup Or Restore Failure

Symptoms:

- scheduled backup job exits non-zero
- restore drill cannot reach a healthy state
- smoke test fails after restore

Actions:

1. Preserve the failing backup artifact and job logs.
2. Confirm the issue is artifact corruption, wrong credentials, wrong target environment, or application startup drift.
3. Re-run the restore into a fresh scratch target instead of reusing a half-restored environment.
4. Do not mark the drill complete until a full smoke test passes.
5. Record findings in the validation checklist and open remediation work immediately.

## 8. Redis Multi-Instance Validation

This repository already contains the Redis adapter and BullMQ code paths, but they still need live multi-instance verification in a real environment.

Preconditions:

- reachable Redis instance
- `ENABLE_REDIS_ADAPTER=true`
- optional `ENABLE_BULLMQ=true` when queue validation is included
- two API instances built from the same revision
- one web client or API client that can send and receive realtime events

Suggested validation layout:

- API instance A on port `3101`
- API instance B on port `3102`
- shared Redis from `REDIS_URL`
- shared storage mode appropriate for the environment under test

Validation sequence:

1. Start Redis.
2. Start API instance A and API instance B with identical env except for port.
3. Confirm both instances report `checks.redis=up` and `checks.realtime=up` from `GET /api/health`.
4. Connect one client session that routes to instance A and another that routes to instance B.
5. Join the same workspace and channel from both sessions.
6. Send a message through instance A and verify the session on instance B receives it in realtime.
7. Repeat in the opposite direction.
8. Toggle one instance off and confirm the surviving instance still accepts traffic and the client can reconcile state after reconnect.
9. Re-enable the stopped instance and repeat message fan-out.
10. If BullMQ is enabled, dispatch a mention notification and verify queue health remains `up` throughout the test.

Evidence to capture:

- exact env flags used
- health responses from both instances
- message ids observed across both instances
- reconnect and reconciliation timestamps
- any divergence or duplicate-delivery notes

Exit criteria:

- cross-instance message fan-out succeeds in both directions
- reconnect does not leave the client with missing current state
- both instances remain ready while Redis is healthy
- queue health remains stable when enabled

## 9. Operator Smoke Test

Run after deploy or restore:

1. `GET /api/health/live`
2. `GET /api/health/ready`
3. Register or log in as a test user
4. Load workspace list
5. Open one channel
6. Send one message
7. Check notifications list

## 10. Production Checklist

- Environment variables validated and documented
- Health probes wired to monitoring
- Alert routing configured with paging vs non-paging severity separation
- Backups scheduled and retention confirmed
- Restore drill completed at least once
- Drill evidence recorded in `docs/operations-validation-checklist.md` or an external ops log
- Log aggregation enabled
- Alert routing configured
- Disk capacity thresholds defined for uploads, PostgreSQL, and Redis
- Redis-backed features enabled only when Redis is actually monitored