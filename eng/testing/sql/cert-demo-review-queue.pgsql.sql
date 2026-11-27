-- Test/demo helper for AC-661 (Review queue). PostgreSQL only. Never run in production.
--
-- Gives two data stores eight certification runs between them, covering every status, so the
-- global Review queue page (/certification/queue) has something to show: all seven statuses, a mix
-- of vendors, and Pick up enabled only where it can work.
--
--   data store  status                          model        submitted     last status change
--   A           READY_FOR_REVIEW                SIS          3 days ago    3 days ago
--   A           IN_REVIEW                       MTSS         6 days ago    1 day ago
--   A           CHANGES_REQUESTED               ASSESSMENTS  8 days ago    2 days ago
--   A           APPROVED                        SIS          25 days ago   20 days ago
--   B           READY_FOR_REVIEW_WITH_CHANGES   SIS          2 days ago    2 days ago
--   B           DRAFT                           MTSS         never         4 days ago
--   B           READY_FOR_REVIEW                ASSESSMENTS  never (null)  5 days ago
--   B           REJECTED                        SIS          18 days ago   15 days ago
--
-- The second READY_FOR_REVIEW run has no submittedAt on purpose: the queue then orders it by its
-- last status change. A data store can have only one open run per model (unique index), so each
-- data store gets one open run per model and one closed run (APPROVED or REJECTED). That also means
-- one data store cannot hold all seven statuses: use two different data stores with no open runs
-- of the SIS, MTSS or ASSESSMENTS models, or the insert fails and nothing is written. The two data
-- stores may belong to the same team or to different teams (different teams show several vendors).
-- The runs use the newest active catalog version. With no active catalog the script inserts
-- nothing. Scenarios are marked completed in cert.certification_run_scenario only (no step
-- results): all for runs the vendor has sent, about a third for the DRAFT, about 80% for
-- CHANGES_REQUESTED, about half for REJECTED.
--
-- Usage: set the six IDs below (team, Ed-Fi tenant and ODS of each data store), then run the whole
-- script in one session (psql, pgAdmin, DBeaver...). Then open /certification/queue as a global
-- admin with certification:read (and certification:review to use Pick up).

DROP TABLE IF EXISTS pg_temp.cert_demo_params;
CREATE TEMP TABLE cert_demo_params AS
SELECT
  0 AS team_a_id,        -- <-- SET DATA STORE A'S TEAM ID HERE
  0 AS edfi_tenant_a_id, -- <-- SET DATA STORE A'S EDFI TENANT ID HERE
  0 AS ods_a_id,         -- <-- SET DATA STORE A'S ODS ID HERE
  0 AS team_b_id,        -- <-- SET DATA STORE B'S TEAM ID HERE
  0 AS edfi_tenant_b_id, -- <-- SET DATA STORE B'S EDFI TENANT ID HERE
  0 AS ods_b_id          -- <-- SET DATA STORE B'S ODS ID HERE
;

DROP TABLE IF EXISTS pg_temp.cert_demo_runs;
CREATE TEMP TABLE cert_demo_runs (
  run_id INT,
  ods_id INT,
  status VARCHAR(50),
  catalog_id INT,
  fraction NUMERIC
);

BEGIN;

-- 1. The eight runs. The newest active catalog version is the run's catalog.
WITH catalog AS (
  SELECT "catalogVersionId" AS catalog_id
  FROM cert.catalog_version
  WHERE "isActive"
  ORDER BY "catalogVersionId" DESC
  LIMIT 1
),
stores (ds, team_id, edfi_tenant_id, ods_id) AS (
  SELECT 'A', team_a_id, edfi_tenant_a_id, ods_a_id FROM cert_demo_params
  UNION ALL
  SELECT 'B', team_b_id, edfi_tenant_b_id, ods_b_id FROM cert_demo_params
),
demo (ds, model, status, fraction, status_age_days, submitted_age_days) AS (
  VALUES
    ('A', 'SIS',         'READY_FOR_REVIEW',               1.0,  3,    3),
    ('A', 'MTSS',        'IN_REVIEW',                      1.0,  1,    6),
    ('A', 'ASSESSMENTS', 'CHANGES_REQUESTED',              0.8,  2,    8),
    ('A', 'SIS',         'APPROVED',                       1.0, 20,   25),
    ('B', 'SIS',         'READY_FOR_REVIEW_WITH_CHANGES',  1.0,  2,    2),
    ('B', 'MTSS',        'DRAFT',                          0.34, 4, NULL),
    ('B', 'ASSESSMENTS', 'READY_FOR_REVIEW',               1.0,  5, NULL),
    ('B', 'SIS',         'REJECTED',                       0.5, 15,   18)
),
inserted AS (
  INSERT INTO cert.certification_run
    ("edfiTenantId", "odsId", "certificationModel", "catalogVersionId", "teamId", "status",
     "statusChangedAt", "submittedAt", "createdAt", "updatedAt")
  SELECT s.edfi_tenant_id, s.ods_id, d.model, c.catalog_id, s.team_id, d.status,
         now() - d.status_age_days * interval '1 day',
         now() - d.submitted_age_days * interval '1 day',
         now() - (COALESCE(d.submitted_age_days, d.status_age_days) + 1) * interval '1 day',
         now() - d.status_age_days * interval '1 day'
  FROM demo d
  JOIN stores s ON s.ds = d.ds
  CROSS JOIN catalog c
  RETURNING "certificationRunId", "odsId", "status", "catalogVersionId"
)
INSERT INTO cert_demo_runs (run_id, ods_id, status, catalog_id, fraction)
SELECT i."certificationRunId", i."odsId", i."status", i."catalogVersionId", d.fraction
FROM inserted i
JOIN stores s ON s.ods_id = i."odsId"
JOIN demo d ON d.ds = s.ds AND d.status = i."status";

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

-- 3. Check: what the page will show for these two data stores.
SELECT r."certificationRunId", r."teamId", r."odsId", r."certificationModel", r."status",
       r."submittedAt", r."statusChangedAt"
FROM cert.certification_run r
JOIN cert_demo_params p ON r."odsId" IN (p.ods_a_id, p.ods_b_id)
ORDER BY r."certificationRunId" DESC;

-- Undo (removes the demo runs; their scenario rows cascade):
--   DELETE FROM cert.certification_run
--   WHERE "certificationRunId" IN (SELECT run_id FROM cert_demo_runs);
