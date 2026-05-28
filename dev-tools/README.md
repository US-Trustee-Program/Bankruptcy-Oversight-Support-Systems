# dev-tools

Development tools for CAMS, including database seeding utilities and test data generators.

## Database Seeding

### Quick Start

1. **Copy environment templates:**
   ```bash
   cd dev-tools
   cp .env.template .env
   cp .env-dev-local.template .env-dev-local
   cp .env-dev-main.template .env-dev-main
   ```

2. **Fill in connection strings** (get from Azure portal / team vault):
   - `.env` — custom/current working environment
   - `.env-dev-local` — cosmos-mongo-ustp-cams-dev
   - `.env-dev-main` — cosmos-mongo-ustp-cams

3. **Seed databases:**
   ```bash
   npm run seed:local   # Seeds cosmos-dev
   npm run seed:main    # Seeds cosmos-main
   npm run seed         # Seeds custom env (.env)
   ```

### Available Commands

```bash
# Multi-environment seeding (recommended)
npm run seed:local      # Seeds cosmos-mongo-ustp-cams-dev
npm run seed:main       # Seeds cosmos-mongo-ustp-cams
npm run unseed:local    # Cleans cosmos-dev
npm run unseed:main     # Cleans cosmos-main

# Custom environment seeding
npm run seed            # Seeds using .env (your working config)
npm run unseed          # Cleans using .env

# Filtered seeding (works with any of the above)
npm run seed:local -- --db=cams                    # Only CAMS (Cosmos)
npm run seed:local -- --db=dxtr                    # Only DXTR
npm run seed:local -- --db=cams --entity=cases     # Only CAMS cases
npm run seed:local -- --scenario=trustee-data      # One scenario
```

### Seed Scripts Organization

```
db_scripts/
├── cams/                        # Direct Cosmos seeds (SYNCED_CASE docs)
│   └── cases/
│       ├── chapter7.ts          # 091-99-87899
│       ├── chapter11.ts         # 091-99-86706
│       └── chapter13.ts         # 091-99-86447
├── acms/                        # ACMS SQL seeds
│   ├── professionals/basic.ts   # PROF_CODE=99901
│   └── appointments/basic.ts    # 2 appointments for NY-99901
├── scenarios/                   # Cross-database scenarios (DXTR + CAMS)
│   ├── ch7-with-assignment.ts   # Case + assignment + note
│   ├── ch11-with-transfer-orders.ts  # Case + transfer orders
│   ├── consolidation-scenarios.ts    # 3 cases + consolidations
│   ├── trustee-data.ts          # Trustees + appointments + matching
│   ├── oversight-assignments.ts # Trustees with oversight assignments (attorney/auditor/paralegal)
│   └── admin-data.ts            # Banks + bankruptcy software
└── lib/                         # Shared utilities
    ├── sql-config.ts            # Shared SQL connection config
    ├── sql-upsert.ts            # SQL upsert helpers
    ├── mongo-upsert.ts          # MongoDB upsert helpers
    └── ensure-dxtr-case.ts      # DXTR case creation helper
```

### Seed Data Conventions

All seed data follows these patterns for easy identification and cleanup:

- **DXTR case IDs:** `CASE_NUMBER` in 90000-99999 range, `CS_CASEID` = `SEED9XXXX`
- **Cosmos case IDs:** Match pattern `/^\d{3}-\d{2}-9\d{4}$/` (e.g., `091-99-87899`)
- **Cosmos documents:** `id` field starts with `seed-` prefix
- **ACMS cases:** `CASE_NUMBER` in 90000-99999 range

The `unseed` command removes all data matching these patterns.

### Test Data Requirements

**IMPORTANT: All seed scenarios must use existing DXTR case IDs.**

The backend queries DXTR for full case details. If a case exists only in CAMS but not DXTR, case detail pages will fail to load.

**Strategy when creating new test data:**
1. **Reuse existing scenarios** - Check if current scenarios already cover your needs
2. **Augment existing cases** - Add fields/documents to existing cases rather than creating new ones
3. **Only create new scenarios** when reuse/augmentation won't work

**Chapter availability in DXTR:**
- ✅ Chapter 11 (~50 cases)
- ✅ Chapter 12 (~495 cases)
- ✅ Chapter 15 (~1297 cases)
- ✅ Chapter 9 (~23 cases)
- ❌ Chapter 7 (none - must seed DXTR if needed)
- ❌ Chapter 13 (none - must seed DXTR if needed)

**Seeding patterns:**

For **any chapter**, use `ensureDxtrCase()` helper to automatically seed DXTR if needed:
```typescript
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  // Checks if case exists in DXTR, seeds AO_CS + AO_PY if not
  const { operations: dxtrOps, caseInfo } = await ensureDxtrCase(ctx, {
    divisionCode: '081',
    chapter: '7',
    debtorName: 'Test Debtor',
    courtId: '0208',
    groupDesignator: 'NY',
  });

  return [
    ...dxtrOps,  // DXTR operations (empty if case already exists)
    { db: 'cams', collectionOrTable: 'cases', data: [...] },
  ];
}
```

This helper:
- Checks if case exists in DXTR AO_CS table
- Returns empty operations if case already exists
- Returns DXTR seed operations (AO_CS + AO_PY) if case doesn't exist
- Works for all chapters (7, 11, 12, 13, 15, 9)

For **other chapters**, reference existing DXTR cases (see `cases-fuzzy-search.ts`):
```typescript
// Use real DXTR case IDs from available divisions
const REAL_CASES = [
  '081-26-63921', // Ch 15 - Manhattan
  '091-99-87899', // Ch 11 - Buffalo
  '111-90-62941', // Ch 15 - Chicago
];
```

**Verification after seeding:**
1. Check case detail pages load correctly (backend must find case in DXTR)
2. Verify all expected data appears in the UI
3. Check that relationships (assignments, notes, etc.) are correct

### Environment Files

Three environment file templates are provided:

- **`.env.template`** — Base template for custom seeding (copied to `.env`)
- **`.env-dev-local.template`** — cosmos-mongo-ustp-cams-dev (copied to `.env-dev-local`)
- **`.env-dev-main.template`** — cosmos-mongo-ustp-cams (copied to `.env-dev-main`)

Each file contains:
- `MONGO_CONNECTION_STRING` — Cosmos MongoDB connection (different per env)
- `MSSQL_*` vars — DXTR SQL Server connection (same in all files)
- `ACMS_MSSQL_*` vars — ACMS SQL Server connection (same in all files)

DXTR and ACMS are shared SQL databases, so their connection strings are identical across all environments.

**Note:** Actual `.env*` files are gitignored. Only templates are committed.

### User-Groups and Oversight Assignments

The `oversight-assignments` scenario requires existing user-groups in the database. User-groups contain real Okta users for roles like Trial Attorney, Auditor, and Paralegal.

**Syncing user-groups from production to dev:**

```bash
cd dev-tools
npx tsx sync-user-groups.ts
```

This utility:
- Reads user-groups from `cosmos-mongo-ustp-cams` (production)
- Clears all user-groups from `cosmos-mongo-ustp-cams-dev`
- Copies production user-groups to dev

**Seeding oversight assignments:**

```bash
npm run seed:local -- --scenario=oversight-assignments
```

The `oversight-assignments` scenario:
- **Dynamically queries** existing user-groups for real Okta users
- Creates 5 test trustees with different oversight assignment states:
  - Oliver Attorneyonly (Trial Attorney assigned)
  - Paula Auditoronly (Auditor assigned)
  - Quinn Bothassigned (Both Trial Attorney and Auditor)
  - Rachel Paralegalassigned (Paralegal assigned)
  - Steven Noassignments (No assignments)

**SeedContext API:**

Seed scripts can access the MongoDB client via `ctx.mongoClient` to query existing data during generation:

```typescript
export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  // Query existing user-groups
  const db = ctx.mongoClient!.db('cams');
  const group = await db.collection('user-groups').findOne({ groupName: 'USTP CAMS Trial Attorney' });
  const users = group?.users || [];

  // Use queried data in seed operations
  return [
    { db: 'cams', collectionOrTable: 'trustees', data: [...] }
  ];
}
```

### Migration vs. Direct Seeding

CAMS uses two patterns for populating Cosmos:

1. **Direct seed** — Data written directly to Cosmos via seed scripts (e.g., cases, banks, assignments)
2. **Migration-driven** — DXTR/ACMS seeded, then migrations populate Cosmos (e.g., `MigrateCaseAppointmentsUseCase` reads ACMS.CMMAP → writes Cosmos case_appointments)

Which pattern to use is determined per-feature during test data planning.

---

# test-data (Legacy)

## Generate SQL

```
npm run test-data:{sql | json} [number of cases to create]
```

SQL statements are written to `data/test-data.sql` when `test-data:sql` is run.

JSON objects are written to `data/test-data.json` when `test-data:json` is run.

## Fixtures

Fixtures are declarations of test data. Fixtures declare records to be inserted into the database.

Scripts that generate fixtures are found in the `test-data/fixtures` directory.

Fixtures use the domain model to declare the test data to be generated.

### Adding a Fixture

1. Use descriptive source file and function names to describe the feature or problem domain the
   fixtures are built to represent.
1. Create a new `.ts` script in the `test-data/fixtures` directory.
1. Export a function that builds one or more fixtures.
1. Multiple functions can be defined in a given source file.
1. Functions must return a `DatabaseRecords` object. The function prototype is
   `(): DatabaseRecords`;
1. Import the function into the `test-data/scripts/index.ts` file. Add it to the `fixturesToCreate`
   array.

## Scripts

The Scripts folder contains stand-alone scripts that generate sql output.

### Case Parties

The caseParties.ts script generates SQL statements for inserting case parties, such as debtors into
the AO_PY table.

caseParties.ts takes input from a file piped into it on stdin. File format for input is in the form
of CS Case Id and Court Id separated by comma, per line.

Example input file format:

```csv
12345,0208
23456,0208
34578,0210
```

To run the script:

```sh
tsx test-data/scripts/caseParties.ts < input_file
```

### Update Case Party Addresses

The updateCasePartyAddresses.ts script generates SQL statements to update case party addresses in
the AO_PY table.

updateCasePartyAddresses.ts takes input from a file piped into it on stdin. File format for input is
in the form of CS Case Id, Court Id and role separated by comma, per line.

Example input file format:

```csv
12345,0208,db
23456,0208,db
34578,0210,db
```

To run the script:

```sh
# Assumes the CSV input is in the `data` directory with file name `input_file.csv`.
cat data/input_file.csv | tsx test-data/scripts/updateCasePartyAddresses.ts > data/update.sql
```

## Domain Models

See existing scripts in the `test-data/domain` directory for examples.

The domain model consists of TypeScript interfaces that guide the definition of object literals used
to describe a fixture.

The domain model is responsible for mapping the domain to the underlying records in the database.

## Tables

See existing scripts in the `test-data/tables` directory for examples.

Supported tables are modeled in TypeScript and are used by code generation to generate SQL from the
domain model.
