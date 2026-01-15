# Alternative: PostgreSQL with pgvector for Local Vector Search Testing

## Overview

Since there is no open source MongoDB-compatible database with vector search support, **PostgreSQL + pgvector** is the best open source alternative for local vector search testing.

## Why PostgreSQL + pgvector?

### ✅ Advantages

- **Fully Open Source**: No licensing restrictions
- **Production Ready**: ACID compliant, battle-tested
- **Excellent Vector Search**: Supports HNSW and IVFFlat indexes
- **Rich Features**:
  - Multiple distance metrics (L2, cosine, inner product)
  - Exact and approximate nearest neighbor search
  - Up to 2,000 dimensions supported
  - Full PostgreSQL query capabilities (JOINs, transactions, etc.)
- **Easy Local Testing**: Simple Docker/Podman setup

### ❌ Disadvantages for CAMS

- **Significant Code Changes Required**:
  - Complete rewrite of data access layer
  - MongoDB queries → SQL queries
  - Different data modeling approach
- **Not MongoDB-Compatible**: Can't use existing MongoDB driver/code
- **Migration Effort**: Weeks of development work

## What You'd Need to Change

### Current Architecture
```typescript
// MongoDB with CAMS query pipeline
const pipeline = QueryBuilder.from('cases')
  .vectorSearch({
    vector: embeddings,
    path: 'keywordsVector',
    k: 10
  })
  .match({ caseStatus: 'open' })
  .sort('caseDate', 'DESC')
  .build();
```

### PostgreSQL Architecture
```typescript
// PostgreSQL with pgvector
const query = `
  SELECT *
  FROM cases
  WHERE case_status = 'open'
  ORDER BY keywords_vector <-> $1::vector
  LIMIT 10
`;
const results = await pool.query(query, [embeddings]);
```

**Effort Estimate**: 2-4 weeks of development work

## Local Setup with Podman

### Start PostgreSQL + pgvector

```bash
podman run -d \
  --name cams-pgvector-test \
  -e POSTGRES_PASSWORD=local-dev-password \
  -e POSTGRES_DB=cams-local \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# Wait for startup
sleep 5

# Enable pgvector extension
podman exec -it cams-pgvector-test psql -U postgres -d cams-local -c "CREATE EXTENSION vector;"
```

### Create Test Schema

```sql
CREATE TABLE cases (
    case_id TEXT PRIMARY KEY,
    debtor_name TEXT,
    joint_debtor_name TEXT,
    keywords TEXT[],
    keywords_vector vector(384)  -- 384 dimensions for all-MiniLM-L6-v2
);

-- Create HNSW index for fast vector search
CREATE INDEX ON cases USING hnsw (keywords_vector vector_cosine_ops);
```

### Insert Test Data

```sql
INSERT INTO cases (case_id, debtor_name, keywords, keywords_vector)
VALUES (
    'test-001',
    'John Doe',
    ARRAY['John Doe'],
    '[0.1, 0.2, 0.3, ...]'::vector  -- Your 384-dim embedding
);
```

### Vector Search Query

```sql
-- Find 10 nearest neighbors by cosine similarity
SELECT case_id, debtor_name,
       1 - (keywords_vector <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM cases
ORDER BY keywords_vector <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

## Recommendation for CAMS

### ❌ Don't Use PostgreSQL for This Project

**Reason**: The effort to rewrite the data access layer (2-4 weeks) **far exceeds** the effort to adapt the existing MongoDB code for Atlas (2 hours).

### ✅ Recommended Path

1. **Short-term**: Use **MongoDB Atlas Free Tier** for local testing
   - FedRAMP authorized for production
   - Minimal code changes (2 hours)
   - Free for development
   - Can test actual vector search

2. **Long-term**: Wait for **Azure Cosmos DB vCore** in US Gov cloud
   - No code changes needed
   - Azure-native integration
   - Timeline: 3-12 months

## Comparison Matrix

| Option | Vector Search | MongoDB Compatible | Open Source | Code Changes | Effort |
|--------|---------------|-------------------|-------------|--------------|--------|
| **MongoDB Community** | ❌ No | ✅ Yes | ✅ Yes | None | 0 hours |
| **MongoDB Atlas** | ✅ Yes | ✅ Yes | ❌ No | Minimal | 2 hours |
| **Cosmos DB vCore** | ✅ Yes | ✅ Yes | ❌ No | None | 0 hours |
| **FerretDB** | ❌ No | ✅ Yes | ✅ Yes | None | 0 hours |
| **PostgreSQL + pgvector** | ✅ Yes | ❌ No | ✅ Yes | Major | 2-4 weeks |

## Conclusion

While **PostgreSQL + pgvector** is an excellent open source vector database, it's **not recommended for CAMS** because:

1. You'd need to rewrite the entire data access layer
2. You'd lose MongoDB query compatibility
3. The effort (2-4 weeks) is **60-120x more** than adapting for Atlas (2 hours)

### Better Alternatives

1. **For Local Testing**: Use your current POC setup (validates code without vector search)
2. **For Real Vector Search Testing**: MongoDB Atlas Free Tier (M0)
3. **For Production**: MongoDB Atlas US Gov (FedRAMP High) or wait for Cosmos DB vCore

---

## References

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [FerretDB Documentation](https://docs.ferretdb.io/)
- [MongoDB Atlas Government](https://www.mongodb.com/cloud/atlas/government)
