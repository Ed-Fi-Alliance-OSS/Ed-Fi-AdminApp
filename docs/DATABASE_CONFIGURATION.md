# Database Configuration

This application supports both PostgreSQL and Microsoft SQL Server (MSSQL) databases.

## Configuration

### Database Engine Selection

Set the `DB_ENGINE` configuration variable to choose your database:

- `"pgsql"` - PostgreSQL (default)
- `"mssql"` - Microsoft SQL Server

### Connection String Configuration

The application automatically formats connection strings based on the selected database engine:

#### PostgreSQL
```
postgres://username@host:port/database?password=password&sslmode=require
```

#### MSSQL
```
mssql://username:password@host:port/database?encrypt=true
```

### Environment Variables

For local development, configure these environment variables in your `.env` or configuration:

```bash
# Database engine (pgsql or mssql)
DB_ENGINE=pgsql

# Database connection details
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432  # 5432 for PostgreSQL, 1433 for MSSQL
DB_DATABASE=your_database_name
DB_SSL=true   # true for SSL, false to disable
```

### AWS Secrets Manager

For production deployments using AWS Secrets Manager, the secret should contain:

```json
{
  "username": "db_username",
  "password": "db_password", 
  "host": "db_host",
  "port": 5432,
  "dbname": "database_name"
}
```

## Migrations

Database migrations are organized by database type:

- `packages/api/src/database/migrations/pgsql/` - PostgreSQL migrations
- `packages/api/src/database/migrations/mssql/` - MSSQL migrations

The application automatically loads the appropriate migrations based on the `DB_ENGINE` setting.

### Converting Migrations

When adding new migrations, you may need to create versions for both database types. Key differences:

#### PostgreSQL → MSSQL Conversion Examples

| PostgreSQL | MSSQL |
|------------|-------|
| `SERIAL` | `int IDENTITY(1,1)` |
| `TIMESTAMP` | `datetime2` |
| `character varying` | `nvarchar(255)` |
| `text` | `ntext` |
| `jsonb` | `nvarchar(MAX)` |
| `boolean` | `bit` |
| `now()` | `getdate()` |

### Running Migrations

Migrations run automatically when the application starts if `DB_RUN_MIGRATIONS` is set to `true` (default).

To run migrations manually:

```bash
npm run migrations:run
```

To generate a new migration:

```bash
npm run migrations:generate -- --name YourMigrationName
```

**Note:** Generated migrations may need manual conversion between database types.

## Session Storage

The application uses database-specific session stores:

- **PostgreSQL**: `connect-pg-simple` with `appsession` schema
- **MSSQL**: `connect-mssql-v2` with `sessions` table

Sessions are automatically configured based on the selected database engine.

## Limitations

- **Background Jobs**: The `pg-boss` job queue system requires PostgreSQL and is not available with MSSQL
- **Migration Conversion**: Not all PostgreSQL migrations have been converted to MSSQL yet
- **Testing**: Extensive testing has been done with PostgreSQL; MSSQL support may require additional validation

## Troubleshooting

### Connection Issues

1. Verify the database server is running and accessible
2. Check firewall settings for the database port
3. Ensure the user has proper database permissions
4. For MSSQL, verify SSL/encryption settings match server configuration

### Migration Errors

1. Ensure the database user has DDL permissions (CREATE, ALTER, DROP)
2. Check for syntax differences between PostgreSQL and MSSQL
3. Enable logging by adding `TYPEORM_LOGGING: ["error"],` to the API config file or setting it in an environment variable, then review migration logs for specific error messages
4. Consider running migrations manually if automatic migration fails

### Session Store Issues

1. Verify the session table/schema exists and is accessible
2. Check database user permissions for session storage
3. Review session store configuration in application logs
