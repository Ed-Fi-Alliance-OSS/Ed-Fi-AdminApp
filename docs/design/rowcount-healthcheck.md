# Design: Re-Introducing Row-Count "Health Check"

## Feature

Context: Ed-Fi Admin App running outside of a Starting Blocks Environment.

User Story: _As a system administrator or an education agency user, I want to view basic data profile information about records inserted into a given Ed-Fi ODS/API database instance, so that I will be able to see that (a) data are flowing and (b) how recently each resource was updated._

Feature Name: the feature name is yet to be determined. Possibilities include: Health Check, Data Profile, Data Freshness.

## Design

This design re-introduces the Row-Count function which served as a "Health Check" for an ODS instance (called "Data Freshness" in Starting Blocks).

The existing implementation utilized an AWS Lambda function, which had the benefit of existing "above" this ecosystem, with greater privileges than might be given to this application, accessing the ODS database through secure secret storage in the cloud. We can access ODS connection strings instead through the `OdsInstances` in Admin API, which becomes the new executor of this functionality.

_An important caveat: While testing I was unenable to access the health check output from `OdsPage`, even with a configured v7 ODS and the expected permissions set. Reading through the code, it dumps the JSON response to a table._

### In Admin App

Update the `OdsRowCountService` to call a new endpoint on the Admin API (outlined below) instead of the AWS lambda function. Output the serialized JSON in a tabular format.

_Alternatively, this change could be made in the callers `OdssController.getOdsRowCounts` or `OdssService.getOdsRowCount` to utilize a different service with the above changed behavior. The placement of this depends on the broader usage of `OdssService`. There is a lot of nesting._

### In Admin API

Introduce a new endpoint to Admin API which executes a row count query (below) against the ODS database and returns the result serialized as JSON, utilizing the stored connection strings found in `OdsInstances`.

### Original Row Count SQL Query

The below query is taken from the `DataFreshnessFunction` Lambda in the Starting Blocks OSS repository. It enumerates tables in a set of ODS schemas and returns, per table, the row count plus min/max `createdate` and max `lastmodifieddate` where those columns exist.

> [!NOTE]
> The `{schemas}` placeholder allows a given deployment to inject its own set of schemas to monitor. The default list would have `'edfi', 'tpdm'`; the system being monitored may have other extensions installed, whose schemas would also need to be listed.

```sql
SELECT
  t.table_schema,
  t.table_name, 
  (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count,
  (xpath('/row/mincd/text()', xml_cd))[1]::text as min_cd,
  (xpath('/row/maxcd/text()', xml_cd))[1]::text as max_cd,
  (xpath('/row/maxlmd/text()', xml_lmd))[1]::text as max_lmd

FROM (
  SELECT
    table_name,
    table_schema, 
    query_to_xml(format('select count(*) as cnt from %I.%I',table_schema, table_name), false, true, '') as xml_count
  FROM information_schema.tables
  WHERE table_schema in ({schemas})
    AND table_catalog = '{ods_db_name}'
    AND table_name not like '%descriptor'
) t

LEFT JOIN (
  SELECT
    table_name,
    table_schema,
    query_to_xml(format('select min(createdate) as mincd,
    max(createdate) as maxcd from %I.%I', table_schema, table_name), false, true, '') as xml_cd
  FROM information_schema.columns
  WHERE column_name ='createdate'
    AND table_schema in ({schemas})
    AND table_catalog = '{ods_db_name}'
    AND table_name not like '%descriptor'
) cd 
  ON t.table_name = cd.table_name and t.table_schema = cd.table_schema

LEFT JOIN (
  SELECT
    table_name,
    table_schema,
    query_to_xml(format('select max(lastmodifieddate) as maxlmd from %I.%I', table_schema, table_name), false, true, '') as xml_lmd
  FROM information_schema.columns
  WHERE column_name ='lastmodifieddate'
    AND table_schema in ({schemas})
    AND table_catalog = '{ods_db_name}'
    AND table_name not like '%descriptor'
) lmd 
  ON t.table_name = lmd.table_nameand t.table_schema = lmd.table_schema
```

Notes on behavior and performance:

- This approach runs a tiny SQL per table via query_to_xml; for many tables this can be expensive.
- The query uses PostgreSQL-specific functions (query_to_xml, xpath), so the target must be PostgreSQL with those functions available.
- Results are assembled server-side and returned as rows; consider limiting scope or running during off-peak times for large ODS instances.
