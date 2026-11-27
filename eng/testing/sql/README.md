# Certification demo SQL scripts

Helpers for trying the Certification pages by hand. They write straight to the Admin App
database and skip the workflow rules, so run them **only on test databases**, never in
production.

| Script | Engine | What it does |
| --- | --- | --- |
| `cert-demo-run-history.pgsql.sql` | PostgreSQL | Adds five runs to a team (AC-701) so its Run history page has data |
| `cert-demo-run-history.mssql.sql` | SQL Server | Same as above, in T-SQL |
| `cert-demo-review-queue.pgsql.sql` | PostgreSQL | Adds eight runs on two data stores, covering every status, for the global Review queue page (AC-661) |
| `cert-demo-review-queue.mssql.sql` | SQL Server | Same as above, in T-SQL |
| `cert-complete-run-scenarios.pgsql.sql` | PostgreSQL | Marks every scenario of one run as completed (AC-659, Send to Review) |

## Run history demo data (AC-701)

The script gives one team five runs on one data store, in different statuses and with
different progress:

| Status | Model | Started | Completed scenarios |
| --- | --- | --- | --- |
| `APPROVED` | SIS | 30 days ago | all |
| `REJECTED` | SIS | 20 days ago | about half |
| `DRAFT` | SIS | 10 days ago | about a third |
| `IN_REVIEW` | MTSS | 5 days ago | all |
| `READY_FOR_REVIEW` | ASSESSMENTS | 1 day ago | all |

### Before you run it

- A **vendor user** of the team, with `certification:read`, to open the page afterwards.
- An **active catalog version**: `SELECT * FROM cert.catalog_version WHERE "isActive"` must
  return a row. Without one the PostgreSQL script inserts nothing and says nothing; the SQL
  Server script inserts runs with no catalog.
- A data store (ODS) with **no open run** of the SIS, MTSS or ASSESSMENTS models. A data store
  can have only one open run per model, so an existing open run makes the insert fail.

### 1. Find the three IDs

PostgreSQL:

```sql
SELECT id, name FROM team;                                      -- team_id
SELECT id, "displayName", "sbEnvironmentId" FROM edfi_tenant;   -- edfi_tenant_id
SELECT id, "displayName", "edfiTenantId" FROM ods;              -- ods_id, must belong to that tenant
```

SQL Server: the same queries with `[team]`, `[edfi_tenant]` and `[ods]` and bracketed column
names. The team ID is also in the app's URL: `/as/<teamId>/my-products`.

### 2. Set them in the script

Replace the three `0` values at the top of the script (team, Ed-Fi tenant, ODS).

### 3. Run the whole script

Run it as **one script in one session**. The PostgreSQL version uses temporary tables, so
running it statement by statement breaks it.

PostgreSQL, from a SQL client: open the file in DBeaver or pgAdmin and run it as a script (in
DBeaver, Alt+X).

PostgreSQL, with `psql`:

```bash
psql -h localhost -U <user> -d <database> -f eng/testing/sql/cert-demo-run-history.pgsql.sql
```

PostgreSQL in Docker (find the container with `docker ps`). Copy the file in and run it with
`-f`; this works the same in PowerShell, cmd, bash and zsh:

```bash
docker cp eng/testing/sql/cert-demo-run-history.pgsql.sql <container>:/tmp/demo.sql
docker exec <container> psql -U <user> -d <database> -f /tmp/demo.sql
```

Do not use `docker exec -i ... < file`: PowerShell reserves the `<` operator and fails with
"The '<' operator is reserved for future use". In PowerShell you can pipe instead:

```powershell
Get-Content eng/testing/sql/cert-demo-run-history.pgsql.sql -Raw | docker exec -i <container> psql -U <user> -d <database>
```

SQL Server: open `cert-demo-run-history.mssql.sql` in SSMS or Azure Data Studio and run the
whole batch, or:

```bash
sqlcmd -S <server> -U <user> -P <password> -d <database> -i eng/testing/sql/cert-demo-run-history.mssql.sql
```

The script ends with a table of the team's runs: ID, model, status, `completed` and `total`.

### 4. Check it in the app

Sign in as a vendor of that team and open `/as/<teamId>/certification/run-history`. You should
see five rows, newest first. Each progress bar and "X / Y scenarios completed" should match the
`completed` and `total` the script printed. **Open** goes to the run's Scenarios page.

### If the insert fails

An error such as a duplicate key on `UQ_cert_certification_run_open_ods` means the data store
already has an open run of one of those models. In PostgreSQL the transaction stays aborted, so
run `ROLLBACK;` first, then pick another ODS and run the script again.

### Undo

PostgreSQL, in the same session (the temporary table is gone once the session closes):

```sql
DELETE FROM cert.certification_run
WHERE "certificationRunId" IN (SELECT run_id FROM cert_demo_runs);
```

From another session, delete by the run IDs the script printed:

```sql
DELETE FROM cert.certification_run
WHERE "teamId" = <team_id> AND "odsId" = <ods_id>
  AND "certificationRunId" IN (<run IDs from the script's last table>);
```

SQL Server: the same `DELETE` with bracketed names and the run IDs from the script's last
table. The runs' scenario rows are removed by cascade.

## Review queue demo data (AC-661)

The script gives two data stores eight runs between them, so the global Review queue page
shows every status, and Pick up is enabled only on runs that can be picked up:

| Data store | Status | Model | Submitted |
| --- | --- | --- | --- |
| A | `READY_FOR_REVIEW` | SIS | 3 days ago |
| A | `IN_REVIEW` | MTSS | 6 days ago |
| A | `CHANGES_REQUESTED` | ASSESSMENTS | 8 days ago |
| A | `APPROVED` | SIS | 25 days ago |
| B | `READY_FOR_REVIEW_WITH_CHANGES` | SIS | 2 days ago |
| B | `DRAFT` | MTSS | never |
| B | `READY_FOR_REVIEW` | ASSESSMENTS | never (`submittedAt` is null, so the queue uses the last status change) |
| B | `REJECTED` | SIS | 18 days ago |

### Before you run it

- Two **different** data stores, each with **no open run** of the SIS, MTSS or ASSESSMENTS
  models. A data store can have only one open run per model, so seven statuses do not fit in
  one. The two may belong to the same team or to different teams (different teams show several
  vendors in the Vendor column).
- An **active catalog version**, as for the Run history demo.
- A **global admin** with `certification:read` (to see the page) and `certification:review`
  (to use Open and Pick up; without it both buttons are disabled).

### Run it

Find the team, Ed-Fi tenant and ODS IDs of both data stores as in the Run history demo, replace
the six `0` values at the top of the script, and run the whole script in one session, with the
same tools as the Run history demo:

```bash
psql -h localhost -U <user> -d <database> -f eng/testing/sql/cert-demo-review-queue.pgsql.sql
sqlcmd -S <server> -U <user> -P <password> -d <database> -i eng/testing/sql/cert-demo-review-queue.mssql.sql
```

The script ends with a table of the runs it created.

### Check it in the app

Sign in as a global admin and open **Certification > Review queue** (`/certification/queue`).
You should see eight rows; the Status column shows each status in its own color, filtering by
status narrows the list, **Open** goes to the run's review page and **Pick up** is enabled only
for the two `READY_FOR_REVIEW` runs and the one `READY_FOR_REVIEW_WITH_CHANGES` run. Picking up
a run moves it to `IN_REVIEW` and opens its review page.

### Undo

PostgreSQL, in the same session:

```sql
DELETE FROM cert.certification_run
WHERE "certificationRunId" IN (SELECT run_id FROM cert_demo_runs);
```

From another session, or on SQL Server, delete by the run IDs the script printed (the runs' scenario
rows are removed by cascade).

## Complete a run's scenarios (AC-659)

`cert-complete-run-scenarios.pgsql.sql` is described in
[UI Playwright E2E Tests](../README.md): set the run ID at the top, then run the whole script in
one session against the Admin App PostgreSQL database.
