-- Test/demo helper for AC-701 (Run history). PostgreSQL only. Never run in production.
--
-- Gives one team five certification runs on one data store, in different statuses and with
-- different progress, so the team's Run history page has something to show: newest first, each
-- with a progress bar ("X / Y scenarios completed") and an Open link.
--
--   status             model        started       completed scenarios
--   APPROVED           SIS          30 days ago   all
--   REJECTED           SIS          20 days ago   about half
--   DRAFT              SIS          10 days ago   about a third
--   IN_REVIEW          MTSS         5 days ago    all
--   READY_FOR_REVIEW   ASSESSMENTS  1 day ago     all
--
-- A data store can have only one open run per model (unique index), so the statuses are spread
-- over models: only one SIS run is open. Pick a data store with no open runs of these models, or
-- the insert fails and nothing is written. The runs use the newest active catalog version.
-- Scenarios are marked completed in cert.certification_run_scenario only (no step results), which
-- is what the page's progress reads.
--
-- Usage: set the three IDs below (team, Ed-Fi tenant, ODS), then run the whole script in one
-- session (psql, pgAdmin, DBeaver...). Then open /as/<teamId>/certification/run-history.

DROP TABLE IF EXISTS pg_temp.cert_demo_params;
CREATE TEMP TABLE cert_demo_params AS
SELECT
  0 AS team_id,        -- <-- SET THE TEAM ID HERE
  0 AS edfi_tenant_id, -- <-- SET THE EDFI TENANT ID HERE
  0 AS ods_id          -- <-- SET THE ODS ID HERE
;

DROP TABLE IF EXISTS pg_temp.cert_demo_runs;
CREATE TEMP TABLE cert_demo_runs (
  run_id INT,
  status VARCHAR(50),
  catalog_id INT,
  fraction NUMERIC
);

BEGIN;

-- 1. The five runs. The newest active catalog version is the run's catalog.
WITH catalog AS (
  SELECT "catalogVersionId" AS catalog_id
  FROM cert.catalog_version
  WHERE "isActive"
  ORDER BY "catalogVersionId" DESC
  LIMIT 1
),
demo (model, status, fraction, age_days) AS (
  VALUES
    ('SIS',         'APPROVED',         1.0,  30),
    ('SIS',         'REJECTED',         0.5,  20),
    ('SIS',         'DRAFT',            0.34, 10),
    ('MTSS',        'IN_REVIEW',        1.0,   5),
    ('ASSESSMENTS', 'READY_FOR_REVIEW', 1.0,   1)
),
inserted AS (
  INSERT INTO cert.certification_run
    ("edfiTenantId", "odsId", "certificationModel", "catalogVersionId", "teamId", "status",
     "createdAt", "updatedAt")
  SELECT p.edfi_tenant_id, p.ods_id, d.model, c.catalog_id, p.team_id, d.status,
         now() - d.age_days * interval '1 day', now() - d.age_days * interval '1 day'
  FROM cert_demo_params p
  CROSS JOIN catalog c
  CROSS JOIN demo d
  RETURNING "certificationRunId", "status", "catalogVersionId"
)
INSERT INTO cert_demo_runs (run_id, status, catalog_id, fraction)
SELECT i."certificationRunId", i."status", i."catalogVersionId", d.fraction
FROM inserted i
JOIN demo d ON d.status = i."status";

-- 2. Each run completes the first <fraction> of the enabled scenarios of its catalog.
INSERT INTO cert.certification_run_scenario ("certificationRunId", "scenarioId", "status", "updatedAt")
SELECT r.run_id, s."scenarioId", 'completed', now()
FROM cert_demo_runs r
JOIN LATERAL (
  SELECT sc."scenarioId",
         row_number() OVER (ORDER BY sc."scenarioId") AS n,
         count(*) OVER () AS total
  FROM cert.domain_catalog d
  JOIN cert.scenario_catalog sc ON sc."domainId" = d."domainId" AND sc."isEnabled"
  WHERE d."catalogVersionId" = r.catalog_id AND d."isEnabled"
) s ON s.n <= ceil(s.total * r.fraction);

COMMIT;

-- 3. Check: what the page will show, newest first.
SELECT r."certificationRunId", r."certificationModel", r."status",
       (SELECT count(*) FROM cert.certification_run_scenario rs
         WHERE rs."certificationRunId" = r."certificationRunId" AND rs."status" = 'completed') AS completed,
       (SELECT count(*) FROM cert.domain_catalog d
         JOIN cert.scenario_catalog sc ON sc."domainId" = d."domainId" AND sc."isEnabled"
         WHERE d."catalogVersionId" = r."catalogVersionId" AND d."isEnabled") AS total
FROM cert.certification_run r
JOIN cert_demo_params p ON p.team_id = r."teamId"
ORDER BY r."certificationRunId" DESC;

-- Undo (removes the demo runs of the team on that data store; their scenario rows cascade):
--   DELETE FROM cert.certification_run
--   WHERE "certificationRunId" IN (SELECT run_id FROM cert_demo_runs);
