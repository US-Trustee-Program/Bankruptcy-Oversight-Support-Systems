# MongoDB for E2E Testing

The containerized E2E testing environment includes MongoDB 7.0, which is compatible with Azure Cosmos DB's MongoDB API.

## Overview

MongoDB provides a local, containerized database that:
- ✅ **ARM64 compatible** - Works on Apple Silicon Macs
- ✅ **Fast startup** - Ready in ~10 seconds
- ✅ **Compatible with Cosmos DB MongoDB API** - ~95% feature parity
- ✅ **No credentials needed** - Simple connection string
- ✅ **Automatically starts** with the E2E workflow

## Why MongoDB instead of Cosmos Emulator?

The Azure Cosmos DB Emulator doesn't support ARM64 architecture (Apple Silicon). MongoDB 7.0 provides:
- Native ARM64 support for M1/M2/M3 Macs
- Much faster startup (10s vs 2-3 minutes)
- Smaller image size (~500MB vs ~2GB)
- Compatible MongoDB API for testing

**Trade-off**: MongoDB doesn't perfectly emulate all Cosmos DB features, but it's sufficient for E2E testing where we test application behavior, not database-specific features.

## Configuration

### Connection String

```bash
# In .env
MONGO_CONNECTION_STRING=mongodb://mongodb:27017/cams-e2e?retrywrites=false
COSMOS_DATABASE_NAME=cams-e2e
DATABASE_MOCK=false
```

The connection string:
- Uses service name `mongodb` (Docker network DNS)
- Connects to port `27017` (MongoDB default)
- Database name: `cams-e2e`
- Disables retryWrites (not supported in standalone mode)

## Startup Time

MongoDB starts quickly:
- Image download: ~500MB (first time only)
- Container startup: ~5 seconds
- Service ready: ~10 seconds total

The workflow waits up to 2 minutes for all services to become healthy.

## Seeding the Database

### How It Works

Test data lives in `fixtures/mongo-fixture.json` — a committed, PII-free snapshot derived from
a known-good e2e database. The seed script reads this fixture and replays it into the local
MongoDB container, generating synthetic Faker values for any nulled PII fields at seed time.

This means **no live database credentials are required to run tests** — the fixture is
self-contained.

### Automatic Seeding (via workflow)

```bash
npm run e2e          # Uses existing database data (faster)
npm run e2e:reseed   # Clear and reseed both MongoDB and SQL Server
```

**When to reseed**:
- First time running tests (no data exists yet)
- Data corruption or inconsistent test state
- After pulling updated fixture files from the repo

### Manual Seeding

```bash
cd test/e2e
npm run seed        # MongoDB only
npm run seed:sql    # SQL Server only
npm run seed:all    # Both databases
```

The seed script:
- Connects to the database specified in `.env`
- Verifies the database name contains "e2e" (safety check)
- Clears all collections
- Reads `fixtures/mongo-fixture.json` and inserts documents with Faker PII regenerated

## Fixture Files

The committed fixture files are the source of truth for test data:

```
fixtures/
  mongo-fixture.json       ← committed, no PII, read by seed-database.ts
  sqlserver-fixture.json   ← committed, no PII, read by seed-sqlserver.ts
```

### Updating Fixtures

If the e2e test data needs to be refreshed from a live source:

```bash
# Dump existing e2e MongoDB and re-harvest SQL from DXTR (most common)
npm run harvest

# OR: Re-seed MongoDB from DXTR first, then harvest both (full refresh)
npm run harvest:reseed
```

This requires `.env` to have `MONGO_CONNECTION_STRING` pointing at the source e2e MongoDB
and `MSSQL_HOST`/`MSSQL_USER`/`MSSQL_PASS` pointing at the dev DXTR SQL Server.

After harvesting, commit the updated `fixtures/mongo-fixture.json` and
`fixtures/sqlserver-fixture.json`.

## Accessing MongoDB

### MongoDB Compass

Connect with MongoDB Compass GUI:

```
mongodb://localhost:27017/cams-e2e
```

### mongosh CLI

Connect with MongoDB shell:

```bash
mongosh "mongodb://localhost:27017/cams-e2e"

# List collections
show collections

# Query cases
db.cases.find().limit(5)

# Count documents
db.cases.countDocuments()
```

## Data Persistence

MongoDB data is **persisted to disk** in the `test/e2e/mongodb-data/` directory (gitignored). This allows:
- Preserving test data between runs (faster workflow)
- Inspecting data after tests complete
- Avoiding re-seeding on every run

To reset persisted data, reseed rather than deleting the directory:

```bash
npm run e2e:reseed   # Clears and reseeds — no need to remove mongodb-data/
```

## Troubleshooting

### MongoDB won't start

```bash
# Check MongoDB logs
podman-compose logs mongodb

# Common issues:
# - Port 27017 already in use (another MongoDB instance?)
# - Insufficient disk space
```

### Backend can't connect

```bash
# Error: "unable to connect to MongoDB"
# Solution: Verify MONGO_CONNECTION_STRING in .env

# Error: "connect ECONNREFUSED"
# Solution: Wait for MongoDB to fully start (~10 seconds)
```

## MongoDB vs Cosmos DB Compatibility

MongoDB 7.0 provides good compatibility with Cosmos DB's MongoDB API:

| Feature | MongoDB 7.0 | Cosmos DB MongoDB API |
|---------|-------------|----------------------|
| CRUD Operations | ✅ Full support | ✅ Full support |
| Aggregation | ✅ Full support | ✅ Mostly supported |
| Transactions | ✅ Full support | ✅ Limited support |
| Change Streams | ✅ Supported | ✅ Supported |
| Geospatial | ✅ Full support | ✅ Supported |
| TTL Indexes | ✅ Supported | ✅ Supported |

**For E2E Testing**: The differences are minimal and don't affect application testing. We test business logic, not database-specific features.

## Further Reading

- [MongoDB 7.0 Documentation](https://www.mongodb.com/docs/v7.0/)
- [MongoDB Docker Image](https://hub.docker.com/_/mongo)
- [Cosmos DB MongoDB API Compatibility](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/feature-support-42)
