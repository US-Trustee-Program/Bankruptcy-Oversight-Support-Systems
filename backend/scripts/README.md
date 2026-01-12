# Backend Scripts

Utility scripts for CAMS backend infrastructure. All scripts are TypeScript and run via `tsx`.

## Vector Search Experiment Scripts

### Quick Start

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Download embedding models
npm run download:models

# 3. Set up experimental database
export MONGO_CONNECTION_STRING="<your-cosmos-connection-string>"
npx tsx scripts/seed-experimental-database.ts

# 4. Update .env to use experimental database
echo "DATABASE_NAME=cams-vector-experiment" >> .env

# 5. Start API
npm start
```

---

## Scripts

### `download-models.mjs`

Downloads embedding model for local use (no TypeScript needed for this one).

```bash
npm run download:models
```

**Output:** `backend/models/Xenova/all-MiniLM-L6-v2/` (~25 MB)

---

### `test-local-model.mjs`

Tests that the local embedding model loads correctly.

```bash
npm run test:models
```

**Expected:** Model loads in <200ms, generates 384-dim vectors in ~50ms each

---

### `seed-experimental-database.ts`

Creates an experimental database with 500 realistic test cases using MockData.

```bash
export MONGO_CONNECTION_STRING="<connection-string>"
export EXPERIMENTAL_DATABASE_NAME="cams-vector-experiment"  # optional
export NUM_TEST_CASES=500  # optional

npx tsx scripts/seed-experimental-database.ts
```

**What it does:**
- Generates 480 random cases + 20 special test cases
- Uses `@common/cams/test-utilities/mock-data` for realistic structure
- Adds `keywords` and `keywordsVector` to all cases
- Creates vector index for cosine similarity search

**Special test patterns for validation:**
- John Smith / Jon Smith / John Smyth (typos)
- Michael Johnson / Mike Johnson (nickname)
- William Brown / Bill Brown (nickname)
- Elizabeth Wilson / Liz Wilson / Elizabeth Willson (variants)

**Output database:**
- Database: `cams-vector-experiment`
- Collection: `cases`
- Documents: 500 `SYNCED_CASE` with vector embeddings

---

### `create-vector-index.mjs`

Manually creates vector index on existing collection.

```bash
export MONGO_CONNECTION_STRING="<connection-string>"
export DATABASE_NAME="cams-vector-experiment"

node scripts/create-vector-index.mjs
```

**Index config:**
- Type: `vector-ivf`
- Dimensions: 384
- Similarity: Cosine (COS)
- NumLists: 100

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_CONNECTION_STRING` | Yes | - | Cosmos DB connection string |
| `EXPERIMENTAL_DATABASE_NAME` | No | `cams-vector-experiment` | Name for experimental DB |
| `DATABASE_NAME` | No | `cams` | Current database name |
| `NUM_TEST_CASES` | No | `500` | Number of test cases |

---

## Testing the Experimental Database

After seeding:

```bash
# Update .env
DATABASE_NAME=cams-vector-experiment

# Start API
npm start

# Test fuzzy search (in another terminal)
curl "http://localhost:3000/api/cases?name=Jon+Smith"
# Should find "John Smith" cases

curl "http://localhost:3000/api/cases?name=Mike+Johnson"
# Should find "Michael Johnson" cases
```

---

## Troubleshooting

**Models not found:**
```bash
npm run download:models
ls backend/models/Xenova/all-MiniLM-L6-v2/
```

**Connection issues:**
```bash
mongosh "$MONGO_CONNECTION_STRING" --eval "db.adminCommand('ping')"
```

**TypeScript errors:**
```bash
npm install
npx tsx --version
```

**Vector index fails:**
- Ensure using Azure Cosmos DB for MongoDB (vCore)
- Regular MongoDB doesn't support vector search

---

## Related Documentation

- [CAMS-376-IMPLEMENTATION_PLAN.md](../../CAMS-376-IMPLEMENTATION_PLAN.md) - Full implementation guide
- [Azure Cosmos Vector Search](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/vcore/vector-search)
