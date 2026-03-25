# Azure SQL Edge for E2E Testing

The containerized E2E testing environment includes Azure SQL Edge, a lightweight, ARM64-compatible SQL Server variant designed for IoT and edge computing.

## Overview

Azure SQL Edge provides a local, containerized SQL Server database that:
- ✅ **ARM64 compatible** - Works natively on Apple Silicon Macs
- ✅ **Fast startup** - Ready in ~30 seconds
- ✅ **SQL Server compatible** - Uses T-SQL and SQL Server client libraries
- ✅ **No Azure credentials needed** - Runs completely offline
- ✅ **Automatically starts** with the E2E workflow

## Why Azure SQL Edge instead of SQL Server?

Microsoft SQL Server doesn't support ARM64 architecture. Azure SQL Edge provides:
- Native ARM64 support for M1/M2/M3 Macs
- SQL Server-compatible API (T-SQL)
- Smaller image size (~500MB vs 2GB+)
- Suitable for E2E testing

**Trade-off**: Azure SQL Edge lacks some enterprise features, but it's sufficient for E2E testing where we test application behavior against a read-only SQL database.

## Configuration

### Connection String

```bash
# In .env
MSSQL_HOST=localhost           # From host machine
MSSQL_HOST=sqlserver           # From backend container (DNS name)
MSSQL_DATABASE=
MSSQL_DATABASE_DXTR=CAMS_E2E
MSSQL_USER=sa
MSSQL_PASS=YourStrong!Passw0rd
MSSQL_ENCRYPT=false
MSSQL_TRUST_UNSIGNED_CERT=true
```

The connection:
- Uses service name `sqlserver` (Docker network DNS) from containers
- Uses `localhost` from host machine
- Port `1433` (SQL Server default)
- Database name: `CAMS_E2E`
- SA account with strong password (EULA requirement)

## Startup Time

Azure SQL Edge starts moderately fast:
- Image download: ~500MB (first time only)
- Container startup: ~15 seconds
- Service ready: ~30 seconds total

The workflow waits up to 2 minutes for all services to become healthy.

## Seeding the Database

### How It Works

Test data lives in `fixtures/sqlserver-fixture.json` — a committed, PII-free snapshot of the
DXTR tables required by the E2E specs. The seed script reads this fixture, creates the schema
in the local `CAMS_E2E` database, and inserts rows with synthetic Faker values replacing any
nulled PII columns at seed time.

This means **no live DXTR credentials are required to run tests** — the fixture is
self-contained.

The seed script uses `DROP TABLE IF EXISTS` + `CREATE TABLE` before every insert, so the
database is always reset to a clean state. **Do not delete `sqlserver-data/`** to "reset" the
database — reseeding is sufficient and avoids the ~30s SQL Edge re-initialization overhead.

### Automatic Seeding (via workflow)

```bash
npm run e2e          # Uses existing database data (faster)
npm run e2e:reseed   # Clear and reseed both SQL Server and MongoDB
```

**When to reseed**:
- First time running tests (no schema exists yet)
- Data corruption or inconsistent test state
- After pulling updated fixture files from the repo

### Manual Seeding

```bash
cd test/e2e
npm run seed:sql    # SQL Server only
npm run seed        # MongoDB only
npm run seed:all    # Both databases
```

## Fixture Files

The committed fixture files are the source of truth for test data:

```
fixtures/
  sqlserver-fixture.json   ← committed, no PII, read by seed-sqlserver.ts
  mongo-fixture.json       ← committed, no PII, read by seed-database.ts
```

### Updating Fixtures

If the SQL test data needs to be refreshed from a live source:

```bash
# Dump existing e2e MongoDB and re-harvest SQL from DXTR (most common)
npm run harvest

# OR: Re-seed MongoDB from DXTR first, then harvest both (full refresh)
npm run harvest:reseed
```

This requires `.env` to have `MSSQL_HOST`/`MSSQL_USER`/`MSSQL_PASS` pointing at the dev DXTR
SQL Server and `MONGO_CONNECTION_STRING` pointing at the source e2e MongoDB.

After harvesting, commit the updated `fixtures/sqlserver-fixture.json` and
`fixtures/mongo-fixture.json`.

## Manual Connection

Connect using any SQL Server client:

**sqlcmd (from container):**
```bash
podman exec -it cams-sqlserver-e2e /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P 'YourStrong!Passw0rd'
```

**Azure Data Studio / VS Code:**
```
Server: localhost
Port: 1433
Username: sa
Password: YourStrong!Passw0rd
Database: CAMS_E2E
Encrypt: No
Trust Server Certificate: Yes
```

## Data Persistence

SQL Server data is **persisted to disk** in the `test/e2e/sqlserver-data/` directory (gitignored). This allows:
- Preserving seeded data between runs (faster workflow)
- Inspecting schema and data after tests complete
- Avoiding re-seeding on every run

To reset persisted data, reseed rather than deleting the directory:

```bash
npm run e2e:reseed   # Drops and recreates all tables — no need to remove sqlserver-data/
```

## Troubleshooting

### SQL Server won't start

```bash
# Check SQL Server logs
podman-compose logs sqlserver

# Common issues:
# - Port 1433 already in use (another SQL Server instance?)
# - Insufficient disk space
# - Password doesn't meet complexity requirements
```

### Backend can't connect

```bash
# Error: "unable to connect to SQL Server"
# Solution: Verify MSSQL_HOST and MSSQL_PASS in .env

# Error: "connect ECONNREFUSED"
# Solution: Wait for SQL Server to fully start (~30 seconds)

# Error: "Login failed for user 'sa'"
# Solution: Check password in .env matches container (YourStrong!Passw0rd)
```

## Azure SQL Edge vs SQL Server Compatibility

Azure SQL Edge provides good compatibility with SQL Server for read-only operations:

| Feature | Azure SQL Edge | SQL Server |
|---------|---------------|------------|
| T-SQL Queries | ✅ Full support | ✅ Full support |
| Stored Procedures | ✅ Supported | ✅ Full support |
| Views | ✅ Full support | ✅ Full support |
| Indexes | ✅ Full support | ✅ Full support |
| Transactions | ✅ Full support | ✅ Full support |
| Always Encrypted | ❌ Not supported | ✅ Supported |
| Columnstore Indexes | ❌ Not supported | ✅ Supported |

**For E2E Testing**: The differences don't affect CAMS, which uses SQL Server as a **read-only data source**. We test business logic, not database-specific features.

## Further Reading

- [Azure SQL Edge Documentation](https://learn.microsoft.com/en-us/azure/azure-sql-edge/overview)
- [Azure SQL Edge Docker Image](https://hub.docker.com/_/microsoft-azure-sql-edge)
- [SQL Server Compatibility](https://learn.microsoft.com/en-us/azure/azure-sql-edge/features)
