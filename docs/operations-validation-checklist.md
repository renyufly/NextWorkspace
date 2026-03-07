# WorkNext Operations Validation Checklist

This checklist is the repository companion to `docs/operations-runbook.md`. Use it to record evidence for alert wiring, backup drills, restore drills, and Redis multi-instance verification.

The goal is to move operations work from “documented in principle” to “executed and evidenced”.

## 1. Current Validation Scope

Track these four operating proofs:

- alert routing is wired and reaches the right destination
- backups are being created on schedule
- restores have been exercised in a scratch target
- Redis-backed multi-instance fan-out has been validated when Redis features are enabled

## 2. Preflight

Before any drill, record:

| Field | Value |
| --- | --- |
| Date |  |
| Operator |  |
| Environment |  |
| Git revision |  |
| Storage mode | `local` or `database` |
| Redis enabled | `true` or `false` |
| BullMQ enabled | `true` or `false` |

## 3. Alert Wiring Checklist

Required checks:

- readiness alert destination configured
- API `5xx` alert destination configured
- PostgreSQL alert destination configured when database mode is used
- Redis alert destination configured when Redis-backed features are used
- queue alert destination configured when BullMQ is enabled
- non-paging operational warnings routed to a ticket or team channel

Evidence to capture:

- screenshot or exported rule definition
- routing destination name
- sample fired test alert timestamp
- acknowledgement timestamp

Recording table:

| Alert | Routed to | Severity | Test fired | Acknowledged | Notes |
| --- | --- | --- | --- | --- | --- |
| Readiness failure |  |  |  |  |  |
| API `5xx` ratio |  |  |  |  |  |
| PostgreSQL down |  |  |  |  |  |
| Redis down |  |  |  |  |  |
| Queue down |  |  |  |  |  |

## 4. Backup Drill Checklist

Required checks:

- latest backup artifact exists
- artifact timestamp matches schedule expectation
- artifact size is plausible
- uploads backup exists when uploads are in use
- environment snapshot exists where required

Recording table:

| Artifact | Expected path | Found | Timestamp | Size | Notes |
| --- | --- | --- | --- | --- | --- |
| Local state or PostgreSQL dump |  |  |  |  |  |
| Uploads backup |  |  |  |  |  |
| Env snapshot |  |  |  |  |  |
| Redis snapshot |  |  |  |  |  |

## 5. Restore Drill Record

Use a disposable target whenever possible.

Procedure summary:

1. Stop the target app processes.
2. Restore state, database dump, uploads, and Redis snapshot as applicable.
3. Start services.
4. Run the smoke test.
5. Record elapsed time and failures.

Recording table:

| Step | Result | Started at | Ended at | Notes |
| --- | --- | --- | --- | --- |
| Restore artifacts |  |  |  |  |
| Start API |  |  |  |  |
| `GET /api/health/live` |  |  |  |  |
| `GET /api/health/ready` |  |  |  |  |
| Login smoke test |  |  |  |  |
| Workspace load |  |  |  |  |
| Message read |  |  |  |  |
| Notifications load |  |  |  |  |

Restore acceptance:

- mark the drill failed if any smoke-test step fails
- open remediation work for any manual workaround needed to complete the drill

## 6. Redis Multi-Instance Validation Record

Run this only when Redis-backed realtime or BullMQ is enabled.

Preconditions:

- two API instances started from the same revision
- both instances connected to the same Redis
- both instances healthy before test start

Recording table:

| Check | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Instance A `/api/health` shows `redis=up` |  |  |  |
| Instance B `/api/health` shows `redis=up` |  |  |  |
| Message from A reached client on B |  |  |  |
| Message from B reached client on A |  |  |  |
| Reconnect after stopping one instance recovered state |  |  |  |
| Re-enabled instance resumed healthy fan-out |  |  |  |
| BullMQ health stable during test |  |  |  |

Suggested evidence:

- timestamps
- message ids
- screen recording or log excerpts
- health response snapshots from both instances

## 7. Sign-Off

| Area | Status | Owner | Follow-up |
| --- | --- | --- | --- |
| Alert wiring |  |  |  |
| Backup drill |  |  |  |
| Restore drill |  |  |  |
| Redis multi-instance validation |  |  |  |

## 8. Repository Reality Check

As of the current repository state:

- the runbook and validation procedure are documented in-repo
- health probes and dependency reporting are implemented in code
- Redis adapter and BullMQ are implemented behind env flags
- live Redis validation still depends on a reachable Redis installation outside this repository

## 9. Latest Recorded Validation

Latest local Redis validation run:

| Field | Value |
| --- | --- |
| Date | 2026-03-07 |
| Environment | local isolated validation sandbox |
| Storage mode | `local` |
| Redis enabled | `true` |
| BullMQ enabled | `true` |
| API instances | `3111` and `3112` |
| Shared state path | `/tmp/worknext-redis-validate-shared/state.json` |
| Result | passed |

Observed outcomes:

- both instances reported `/api/health` with `redis=up`, `realtime=up`, and `queues=up`
- message delivery from instance A to a websocket client connected to instance B passed
- message delivery from instance B to a websocket client connected to instance A passed
- after stopping instance A, instance B remained healthy and `state:sync` plus `state:reconciled` rebuilt the online user view successfully
- validation exposed a Redis adapter bootstrap bug in the realtime module, which was fixed by applying the adapter to the root Socket.IO server instead of the namespace object