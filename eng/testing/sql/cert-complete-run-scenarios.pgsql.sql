-- Test/demo helper for AC-659 (Send to Review). PostgreSQL only. Never run in production.
--
-- Marks every scenario of one certification run as completed, the way running every step
-- successfully would, so "Send to Review" becomes enabled without running each scenario.
-- Both levels are written, so they agree the way a real run does: every enabled step gets a
-- passed result (cert.scenario_step) and every scenario is completed
-- (cert.certification_run_scenario). No response snapshot is written (the API encrypts it), so
-- a step's response details show none.
--
-- "Every scenario" is what the API checks: enabled scenarios in enabled domains of the run's
-- catalog version.
--
-- Usage: set the run ID below (the number at the end of /certification/runs/<runId>), then
-- run the whole script in one session (psql, pgAdmin, DBeaver...).

DROP TABLE IF EXISTS pg_temp.cert_demo_params;
CREATE TEMP TABLE cert_demo_params AS
SELECT
  0 AS run_id -- <-- SET THE RUN ID HERE
;

BEGIN;

-- 1. The run before the change. Expect one row with status DRAFT or CHANGES_REQUESTED.
SELECT r."certificationRunId", r."status", r."certificationModel", r."catalogVersionId"
FROM cert.certification_run r
JOIN cert_demo_params p ON p.run_id = r."certificationRunId";

-- 2. Every enabled scenario of the run's catalog version becomes completed.
INSERT INTO cert.certification_run_scenario ("certificationRunId", "scenarioId", "status", "updatedAt")
SELECT r."certificationRunId", s."scenarioId", 'completed', now()
FROM cert_demo_params p
JOIN cert.certification_run r ON r."certificationRunId" = p.run_id
JOIN cert.domain_catalog d ON d."catalogVersionId" = r."catalogVersionId" AND d."isEnabled"
JOIN cert.scenario_catalog s ON s."domainId" = d."domainId" AND s."isEnabled"
ON CONFLICT ("certificationRunId", "scenarioId")
DO UPDATE SET "status" = 'completed', "updatedAt" = now();

-- 3. Every enabled step of those scenarios passes, with errors from earlier failed runs removed.
--    A step that already passed for real is left as it ran (time, response code, snapshot);
--    a step that failed for real is overwritten to passed, keeping its inputs and snapshot.
INSERT INTO cert.scenario_step
  ("certificationRunId", "scenarioId", "stepId", "status", "inputs", "runAt", "responseStatus")
SELECT r."certificationRunId", s."scenarioId", st."stepId", 'success', '{}'::jsonb, now(), 200
FROM cert_demo_params p
JOIN cert.certification_run r ON r."certificationRunId" = p.run_id
JOIN cert.domain_catalog d ON d."catalogVersionId" = r."catalogVersionId" AND d."isEnabled"
JOIN cert.scenario_catalog s ON s."domainId" = d."domainId" AND s."isEnabled"
JOIN cert.step_catalog st ON st."scenarioId" = s."scenarioId" AND st."isEnabled"
ON CONFLICT ("certificationRunId", "stepId")
DO UPDATE SET "status" = 'success', "runAt" = now(), "responseStatus" = 200
WHERE cert.scenario_step."status" <> 'success';

DELETE FROM cert.scenario_step_error e
USING cert.scenario_step ss, cert_demo_params p
WHERE e."stepRunId" = ss."stepRunId"
  AND ss."certificationRunId" = p.run_id
  AND ss."status" = 'success';

-- 4. OPTIONAL: demo "Send it again after changes were requested". Uncomment to put the run in
--    Changes requested (normally a reviewer does this, AC-660). This skips the workflow rules.
-- UPDATE cert.certification_run r
-- SET "status" = 'CHANGES_REQUESTED', "updatedAt" = now()
-- FROM cert_demo_params p
-- WHERE r."certificationRunId" = p.run_id;

COMMIT;

-- 5. Check: completed must equal enabled for Send to Review to be enabled.
SELECT
  (SELECT count(*)
   FROM cert_demo_params p
   JOIN cert.certification_run r ON r."certificationRunId" = p.run_id
   JOIN cert.domain_catalog d ON d."catalogVersionId" = r."catalogVersionId" AND d."isEnabled"
   JOIN cert.scenario_catalog s ON s."domainId" = d."domainId" AND s."isEnabled") AS enabled_scenarios,
  (SELECT count(*)
   FROM cert_demo_params p
   JOIN cert.certification_run r ON r."certificationRunId" = p.run_id
   JOIN cert.domain_catalog d ON d."catalogVersionId" = r."catalogVersionId" AND d."isEnabled"
   JOIN cert.scenario_catalog s ON s."domainId" = d."domainId" AND s."isEnabled"
   JOIN cert.certification_run_scenario rs
     ON rs."certificationRunId" = r."certificationRunId"
    AND rs."scenarioId" = s."scenarioId"
    AND rs."status" = 'completed') AS completed_scenarios,
  (SELECT r."status"
   FROM cert.certification_run r
   JOIN cert_demo_params p ON p.run_id = r."certificationRunId") AS run_status;

-- Other handy statements (replace <runId>):
--
-- Make one scenario fail again, to see Send to Review disable:
--   UPDATE cert.certification_run_scenario SET "status" = 'failed', "updatedAt" = now()
--   WHERE "certificationRunId" = <runId>
--     AND "scenarioId" = (SELECT min("scenarioId") FROM cert.certification_run_scenario
--                         WHERE "certificationRunId" = <runId>);
--
-- Put a sent run back to Draft to repeat the demo (skips the workflow rules):
--   UPDATE cert.certification_run SET "status" = 'DRAFT', "updatedAt" = now()
--   WHERE "certificationRunId" = <runId>;
--
-- Undo this script (removes every scenario and step result of the run, including real ones):
--   DELETE FROM cert.scenario_step WHERE "certificationRunId" = <runId>;
--   DELETE FROM cert.certification_run_scenario WHERE "certificationRunId" = <runId>;
