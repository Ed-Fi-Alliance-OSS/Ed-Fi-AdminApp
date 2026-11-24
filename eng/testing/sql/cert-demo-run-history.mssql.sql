-- Test/demo helper for AC-701 (Run history). SQL Server only. Never run in production.
-- T-SQL twin of cert-demo-run-history.pgsql.sql; see its header for what the five runs are.
--
-- A data store can have only one open run per model (unique index), so pick a data store with no
-- open SIS, MTSS or ASSESSMENTS runs, or the insert fails. The runs use the newest active catalog
-- version, and scenarios are marked completed in cert.certification_run_scenario only.
--
-- Usage: set the three IDs below (team, Ed-Fi tenant, ODS), then run the whole script in one
-- batch (SSMS, Azure Data Studio...). Then open /as/<teamId>/certification/run-history.

SET XACT_ABORT ON;

DECLARE @team_id INT = 0;        -- <-- SET THE TEAM ID HERE
DECLARE @edfi_tenant_id INT = 0; -- <-- SET THE EDFI TENANT ID HERE
DECLARE @ods_id INT = 0;         -- <-- SET THE ODS ID HERE

DECLARE @catalog_id INT = (
  SELECT TOP 1 [catalogVersionId]
  FROM [cert].[catalog_version]
  WHERE [isActive] = 1
  ORDER BY [catalogVersionId] DESC
);

DECLARE @demo TABLE (
  model     NVARCHAR(50),
  status    NVARCHAR(50),
  fraction  DECIMAL(4, 2),
  age_days  INT
);
INSERT INTO @demo (model, status, fraction, age_days) VALUES
  ('SIS',         'APPROVED',         1.00, 30),
  ('SIS',         'REJECTED',         0.50, 20),
  ('SIS',         'DRAFT',            0.34, 10),
  ('MTSS',        'IN_REVIEW',        1.00,  5),
  ('ASSESSMENTS', 'READY_FOR_REVIEW', 1.00,  1);

DECLARE @runs TABLE (run_id INT, status NVARCHAR(50));

BEGIN TRANSACTION;

-- 1. The five runs, started 30, 20, 10, 5 and 1 days ago.
INSERT INTO [cert].[certification_run]
  ([edfiTenantId], [odsId], [certificationModel], [catalogVersionId], [teamId], [status],
   [createdAt], [updatedAt])
OUTPUT inserted.[certificationRunId], inserted.[status] INTO @runs (run_id, status)
SELECT @edfi_tenant_id, @ods_id, d.model, @catalog_id, @team_id, d.status,
       DATEADD(DAY, -d.age_days, SYSUTCDATETIME()), DATEADD(DAY, -d.age_days, SYSUTCDATETIME())
FROM @demo d;

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
SELECT r.run_id, s.[scenarioId], 'completed', SYSUTCDATETIME()
FROM @runs r
JOIN @demo d ON d.status = r.status
JOIN scenarios s ON s.n <= CEILING(s.total * d.fraction);

COMMIT TRANSACTION;

-- 3. Check: what the page will show, newest first.
SELECT r.[certificationRunId], r.[certificationModel], r.[status],
       (SELECT COUNT(*) FROM [cert].[certification_run_scenario] rs
         WHERE rs.[certificationRunId] = r.[certificationRunId] AND rs.[status] = 'completed') AS completed,
       (SELECT COUNT(*) FROM [cert].[domain_catalog] dc
         JOIN [cert].[scenario_catalog] sc ON sc.[domainId] = dc.[domainId] AND sc.[isEnabled] = 1
         WHERE dc.[catalogVersionId] = r.[catalogVersionId] AND dc.[isEnabled] = 1) AS total
FROM [cert].[certification_run] r
WHERE r.[teamId] = @team_id
ORDER BY r.[certificationRunId] DESC;

-- Undo (scenario rows cascade): DELETE FROM [cert].[certification_run]
--   WHERE [certificationRunId] IN (<the run ids the check above shows for the demo runs>);
