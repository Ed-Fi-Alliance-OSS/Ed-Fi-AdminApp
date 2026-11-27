-- Test/demo helper for AC-661 (Review queue). SQL Server only. Never run in production.
-- T-SQL twin of cert-demo-review-queue.pgsql.sql; see its header for the eight runs.
--
-- One data store cannot hold all seven statuses (a data store can have only one open run per
-- model, so at most three open runs), so the script uses two data stores. Pick two different data
-- stores with no open SIS, MTSS or ASSESSMENTS runs, or the insert fails. They may belong to the
-- same team or to different teams. The runs use the newest active catalog version. With no active
-- catalog they are inserted with a NULL catalogVersionId (progress shows 0 scenarios), unlike the
-- PostgreSQL script, which inserts nothing. Scenarios are marked completed in
-- cert.certification_run_scenario only.
--
-- Usage: set the six IDs below (team, Ed-Fi tenant and ODS of each data store), then run the whole
-- script in one batch (SSMS, Azure Data Studio...). Then open /certification/queue as a global
-- admin with certification:read (and certification:review to use Pick up).

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON; -- required by the filtered unique indexes on cert.certification_run (classic sqlcmd defaults to OFF)

DECLARE @team_a_id INT = 0;        -- <-- SET DATA STORE A'S TEAM ID HERE
DECLARE @edfi_tenant_a_id INT = 0; -- <-- SET DATA STORE A'S EDFI TENANT ID HERE
DECLARE @ods_a_id INT = 0;         -- <-- SET DATA STORE A'S ODS ID HERE
DECLARE @team_b_id INT = 0;        -- <-- SET DATA STORE B'S TEAM ID HERE
DECLARE @edfi_tenant_b_id INT = 0; -- <-- SET DATA STORE B'S EDFI TENANT ID HERE
DECLARE @ods_b_id INT = 0;         -- <-- SET DATA STORE B'S ODS ID HERE

DECLARE @catalog_id INT = (
  SELECT TOP 1 [catalogVersionId]
  FROM [cert].[catalog_version]
  WHERE [isActive] = 1
  ORDER BY [catalogVersionId] DESC
);

DECLARE @stores TABLE (
  ds CHAR(1),
  team_id INT,
  edfi_tenant_id INT,
  ods_id INT
);
INSERT INTO @stores (ds, team_id, edfi_tenant_id, ods_id) VALUES
  ('A', @team_a_id, @edfi_tenant_a_id, @ods_a_id),
  ('B', @team_b_id, @edfi_tenant_b_id, @ods_b_id);

DECLARE @demo TABLE (
  ds                  CHAR(1),
  model               NVARCHAR(50),
  status              NVARCHAR(50),
  fraction            DECIMAL(4, 2),
  status_age_days     INT,
  submitted_age_days  INT NULL
);
INSERT INTO @demo (ds, model, status, fraction, status_age_days, submitted_age_days) VALUES
  ('A', 'SIS',         'READY_FOR_REVIEW',               1.00,  3,    3),
  ('A', 'MTSS',        'IN_REVIEW',                      1.00,  1,    6),
  ('A', 'ASSESSMENTS', 'CHANGES_REQUESTED',              0.80,  2,    8),
  ('A', 'SIS',         'APPROVED',                       1.00, 20,   25),
  ('B', 'SIS',         'READY_FOR_REVIEW_WITH_CHANGES',  1.00,  2,    2),
  ('B', 'MTSS',        'DRAFT',                          0.34,  4, NULL),
  ('B', 'ASSESSMENTS', 'READY_FOR_REVIEW',               1.00,  5, NULL),
  ('B', 'SIS',         'REJECTED',                       0.50, 15,   18);

DECLARE @runs TABLE (run_id INT, ods_id INT, status NVARCHAR(50));

BEGIN TRANSACTION;

-- 1. The eight runs. The second READY_FOR_REVIEW run has no submittedAt on purpose.
INSERT INTO [cert].[certification_run]
  ([edfiTenantId], [odsId], [certificationModel], [catalogVersionId], [teamId], [status],
   [statusChangedAt], [submittedAt], [createdAt], [updatedAt])
OUTPUT inserted.[certificationRunId], inserted.[odsId], inserted.[status] INTO @runs (run_id, ods_id, status)
SELECT s.edfi_tenant_id, s.ods_id, d.model, @catalog_id, s.team_id, d.status,
       DATEADD(DAY, -d.status_age_days, SYSUTCDATETIME()),
       CASE WHEN d.submitted_age_days IS NULL THEN NULL
            ELSE DATEADD(DAY, -d.submitted_age_days, SYSUTCDATETIME()) END,
       DATEADD(DAY, -(COALESCE(d.submitted_age_days, d.status_age_days) + 1), SYSUTCDATETIME()),
       DATEADD(DAY, -d.status_age_days, SYSUTCDATETIME())
FROM @demo d
JOIN @stores s ON s.ds = d.ds;

-- 2. Each run completes the first <fraction> of the enabled scenarios of its catalog.
WITH scenarios AS (
  SELECT sc.[scenarioId],
         ROW_NUMBER() OVER (ORDER BY sc.[scenarioId]) AS n,
         COUNT(*) OVER () AS total
  FROM [cert].[domain_catalog] dc
  JOIN [cert].[scenario_catalog] sc ON sc.[domainId] = dc.[domainId] AND sc.[isEnabled] = 1
  WHERE dc.[catalogVersionId] = @catalog_id AND dc.[isEnabled] = 1
)
INSERT INTO [cert].[certification_run_scenario] ([certificationRunId], [scenarioId], [status], [updatedAt])
SELECT r.run_id, sc.[scenarioId], 'completed', SYSUTCDATETIME()
FROM @runs r
JOIN @stores s ON s.ods_id = r.ods_id
JOIN @demo d ON d.ds = s.ds AND d.status = r.status
JOIN scenarios sc ON sc.n <= CEILING(sc.total * d.fraction);

COMMIT TRANSACTION;

-- 3. Check: what the page will show for these two data stores.
SELECT r.[certificationRunId], r.[teamId], r.[odsId], r.[certificationModel], r.[status],
       r.[submittedAt], r.[statusChangedAt]
FROM [cert].[certification_run] r
WHERE r.[odsId] IN (@ods_a_id, @ods_b_id)
ORDER BY r.[certificationRunId] DESC;

-- Undo (scenario rows cascade), using the run IDs the check above printed:
--   DELETE FROM [cert].[certification_run] WHERE [certificationRunId] IN (<run IDs>);
