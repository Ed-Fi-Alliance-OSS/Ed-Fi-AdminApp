# Audit Logging

The Admin App API keeps an audit trail of who changed what, and of sign-in activity. Entries are
written to the `audit_log` table in the Admin App database (PostgreSQL or SQL Server). There is no
API or UI for reading the log; query the table with SQL.

## What is logged

Every entry has an `eventType`:

| `eventType`    | Produced when                                                                   |
| -------------- | ------------------------------------------------------------------------------- |
| `Action`       | A `POST`, `PUT`, `PATCH` or `DELETE` request reaches the API, whatever the outcome. |
| `LoginSuccess` | An OIDC login completes and the session is saved.                               |
| `LoginFailure` | An OIDC login fails. One row per login attempt.                                 |
| `Logout`       | `auth/logout` is called, including without a session (the actor is then null).  |

A session that ends other than through `auth/logout` leaves no `Logout` row, for example when the
session of a deactivated user is destroyed on that user's next request.

Because `POST /api/auth/logout` is a write request, one logout produces two rows: the `Logout` row and an
`Action` row for the request (status 302, the redirect). The login callback is a `GET`, so a login
produces only a `LoginSuccess` or `LoginFailure` row.

`Action` rows are written by a middleware that runs before the body parser and the CSRF origin guard,
so requests rejected by those, or by an authorization guard, are recorded too, with their final
`statusCode` (for example 400, 401 or 403). The actor is resolved when the response finishes, and is
null if the request was rejected before authentication. Machine (bearer token) callers are recorded
with `actorType = 'machine'`.

If the connection closes before the response is finished (for example the client disconnects early),
the row gets the sentinel `statusCode = 499` ("client closed request"). The outcome of such a request
is unknown: the handler may or may not have completed its change.

Not logged:

- `GET` and other read-only requests.
- Request bodies, headers, cookies, tokens and session ids.
- Query strings, which are stripped from `httpUrl`.

### Login events

Login rows carry `sourceIpAddress` and `oidcId` (the identity provider id). On failures, `details`
holds a short reason code, never the raw error message:

| `details`        | Meaning                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `user-not-found` | The provider authenticated the user but no Admin App user exists.          |
| `no-role`        | The user exists but has no role assigned.                                  |
| `error`          | Any other failure.                                                         |

A `LoginFailure` row records the username claimed by the identity provider. The Admin App has not
verified that claim, so treat it as unconfirmed. `actorUsername` is null when no claim is available.
`LoginSuccess` rows have `actorType = 'user'`.

## The `audit_log` table

The table has no foreign keys. Entries are denormalized (names, not ids) so they outlive the rows they
describe. The application only inserts into it; it never updates or deletes entries.

| Column            | PostgreSQL                 | SQL Server              | Notes                                                    |
| ----------------- | -------------------------- | ----------------------- | -------------------------------------------------------- |
| `id`              | `bigint` identity, PK      | `BIGINT` identity, PK   | Constraint `PK_audit_log`.                               |
| `eventType`       | `varchar(30)` not null     | `NVARCHAR(30)` not null | See above.                                               |
| `timestamp`       | `timestamptz` not null     | `datetimeoffset` not null | An absolute instant, when the request or login event started. Indexed (`IDX_audit_log_timestamp`). |
| `actorUsername`   | `varchar(256)`             | `NVARCHAR(256)`         | Null if unknown. Indexed (`IDX_audit_log_actorUsername`). |
| `actorType`       | `varchar(20)`              | `NVARCHAR(20)`          | `user` or `machine`; null if unknown.                    |
| `sourceIpAddress` | `varchar(45)`              | `NVARCHAR(45)`          | Client address as seen by Express (`req.ip`).            |
| `httpVerb`        | `varchar(10)`              | `NVARCHAR(10)`          | `Action` rows only.                                      |
| `httpUrl`         | `varchar(2048)`            | `NVARCHAR(2048)`        | `Action` rows only; no query string.                     |
| `statusCode`      | `integer`                  | `INT`                   | `Action` rows only.                                      |
| `oidcId`          | `varchar(100)`             | `NVARCHAR(100)`         | Login and logout rows.                                   |
| `details`         | `text`                     | `NVARCHAR(max)`         | Delete snapshot JSON, or login failure reason.           |

The table is created by migration `1792000000001-CreateAuditLog` for both engines. Before storage,
every string column except `details` is capped at its column length (for example `actorUsername` at
256 characters, `sourceIpAddress` at 45, `httpUrl` at 2048), and control characters are removed from
them.

## Delete snapshots

A deleted row can no longer be looked up, so for deletes of the entities below the `Action` row's
`details` column holds a JSON snapshot of the entity taken just before the handler runs. Each snapshot
is an allowlist of fields and uses names rather than ids. Emails, secrets, credentials and tokens are
never included.

| Entity                 | Snapshot fields                                           |
| ---------------------- | --------------------------------------------------------- |
| User                   | `username`, `userType`, `role`                            |
| Team                   | `name`                                                    |
| Ownership              | `team`, `role`, `resourceType`, `resource` (an ODS or edorg resource is labelled with its tenant, e.g. `ods_1 (tenant1)`) |
| User team membership   | `username`, `team`, `role`                                |
| Ed-Fi tenant           | `name`, `environment`                                     |
| ODS                    | `dbName`, `tenant`                                        |
| Education organization | `nameOfInstitution`, `educationOrganizationId`, `ods`     |
| Role                   | `name`, `type`                                            |
| Integration provider   | `name`                                                    |
| Environment            | `name` (its URL and encrypted configuration are not read) |

Limits:

- The snapshot is taken only after the authorization guard passes. A delete denied with 401 or 403
  gets the basic `Action` row and no snapshot.
- There is no snapshot if the id is not numeric or the row does not exist, or if loading it fails (a
  warning goes to the application log and the request proceeds).
- Deletes that the Admin App passes through to the Ed-Fi Admin API (Starting Blocks v1, v2 and v3
  resources) are not snapshotted and get only the basic row.

## Configuration

`AUDIT_LOGGING_ENABLED` turns audit logging on or off. It defaults to on, and an unset variable means
on. It is read from the environment variable of the same name (see
`packages/api/config/custom-environment-variables.js`; with Docker Compose, set it in `compose/.env`)
once at startup, so changing it requires a
restart of the API. When it is off, no rows are written, the background writer does nothing, and
deletes do not load the entity for a snapshot.

## Queue, retries and fallback

Requests do not wait for audit rows to be written. Events are sanitized and put in an in-memory
queue with a capacity of 10 000 events. The one database read on the request path is the delete
snapshot: a delete of one of the entities listed under [Delete snapshots](#delete-snapshots) waits
for the entity to be loaded before its handler runs.

- A background writer flushes every 1 second, inserting up to 100 events per batch.
- A failed insert is retried twice, after 250 ms and 1 000 ms. If the third attempt fails, the application log gets `Audit insert failed after 3 attempts: {error}` and the
  events of the batch are then inserted one at a time, so one bad event cannot keep the others out of
  the table. Each event that still fails is written to the application log
  (`Audit event not persisted: {json}`).
- When the queue is full, the new event is written to the application log instead
  (`Audit queue full, event not persisted: {json}`).
- On graceful shutdown the writer finishes any in-flight batch and drains the queue, waiting at most
  5 seconds. Events still unwritten after that (for example because the database hangs) are written
  to the application log (`Audit event not persisted: {json}`).
- Events still in memory are lost if the process is killed without a graceful shutdown.

A failure while recording an event is logged and never affects the request.

## Retention

The Admin App does not purge or archive the table. Rows accumulate until the operator removes them,
for example with a scheduled job that deletes by `timestamp`. The table is append-only by application
behaviour only; use database permissions if you need protection against tampering.

## Examples

Sample rows (some columns omitted; `actorType`, `sourceIpAddress` and `oidcId` are also populated):

| id  | eventType    | timestamp (UTC)     | actorUsername     | httpVerb | httpUrl                | statusCode | details                         |
| --- | ------------ | ------------------- | ----------------- | -------- | ---------------------- | ---------- | ------------------------------- |
| 101 | LoginSuccess | 2026-10-20 14:02:11 | maria@example.org |          |                        |            |                                 |
| 102 | Action       | 2026-10-20 14:05:40 | maria@example.org | POST     | /api/teams             | 201        |                                 |
| 103 | Action       | 2026-10-20 14:09:02 | maria@example.org | DELETE   | /api/teams/12          | 200        | `{"name":"District Analytics"}` |
| 104 | Action       | 2026-10-20 14:11:37 | sam@example.org   | DELETE   | /api/teams/12          | 403        |                                 |
| 105 | LoginFailure | 2026-10-20 15:30:05 | lee@example.org   |          |                        |            | `user-not-found`                |
| 106 | Logout       | 2026-10-20 16:00:00 | maria@example.org |          |                        |            |                                 |
| 107 | Action       | 2026-10-20 16:00:00 | maria@example.org | POST     | /api/auth/logout       | 302        |                                 |

Row 104 was denied by authorization, so it has no snapshot. Rows 106 and 107 are the two rows one logout produces.

`timestamp` is an absolute instant on both engines, whatever the time zone of the API host:
PostgreSQL `timestamptz` (shown in the session time zone) and SQL Server `datetimeoffset` (stored with
the API host's UTC offset at the time of the event). Compare it with `NOW()` on PostgreSQL and
`SYSDATETIMEOFFSET()` on SQL Server, as below; both comparisons are offset-aware.

PostgreSQL needs double quotes around the camelCase column names. SQL Server accepts brackets, or the
bare names.

PostgreSQL:

```sql
-- Failed logins in the last 24 hours
SELECT "timestamp", "actorUsername", "sourceIpAddress", "details"
FROM audit_log
WHERE "eventType" = 'LoginFailure' AND "timestamp" > NOW() - INTERVAL '1 day'
ORDER BY "timestamp" DESC;

-- Deletes with their snapshots, newest first
SELECT "timestamp", "actorUsername", "httpUrl", "statusCode", "details"
FROM audit_log
WHERE "eventType" = 'Action' AND "httpVerb" = 'DELETE'
ORDER BY "timestamp" DESC;
```

SQL Server:

```sql
-- Failed logins in the last 24 hours
SELECT [timestamp], [actorUsername], [sourceIpAddress], [details]
FROM audit_log
WHERE [eventType] = 'LoginFailure' AND [timestamp] > DATEADD(day, -1, SYSDATETIMEOFFSET())
ORDER BY [timestamp] DESC;

-- Deletes with their snapshots, newest first
SELECT [timestamp], [actorUsername], [httpUrl], [statusCode], [details]
FROM audit_log
WHERE [eventType] = 'Action' AND [httpVerb] = 'DELETE'
ORDER BY [timestamp] DESC;
```
