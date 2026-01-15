# PostgreSQL as a Document Database with Vector Search

## Yes, PostgreSQL Can Be a Document Database! 🎉

PostgreSQL has **native document database capabilities** through its **JSONB** data type, making it a hybrid relational + document database.

## JSONB: PostgreSQL's Document Store

### What JSONB Offers

- **Native JSON document storage** (not just text, but parsed binary format)
- **GIN indexes** for fast queries on nested document fields
- **Rich query operators** similar to MongoDB
- **ACID compliance** (unlike MongoDB's eventual consistency in some configs)
- **Schema flexibility** (store any document structure)
- **Vector search** with pgvector extension

### Comparison with MongoDB

| Feature | MongoDB | PostgreSQL JSONB |
|---------|---------|------------------|
| Document Storage | ✅ Yes | ✅ Yes |
| Nested Queries | ✅ Yes | ✅ Yes |
| Array Operations | ✅ Yes | ✅ Yes |
| Flexible Schema | ✅ Yes | ✅ Yes |
| Full Text Search | ✅ Yes | ✅ Yes |
| Vector Search | ✅ Yes (Atlas) | ✅ Yes (pgvector) |
| ACID Transactions | ⚠️ Limited | ✅ Full |
| JSON Indexing | ✅ Yes | ✅ Yes (GIN) |
| SQL Queries | ❌ No | ✅ Yes |

## Real-World Document Query Examples

### MongoDB Style (Current CAMS)
```javascript
db.cases.find({
  "debtor.name": "John Doe",
  "caseStatus": "open",
  "dateFiled": { $gte: "2024-01-01" }
})
```

### PostgreSQL JSONB Style (Equivalent)
```sql
SELECT data
FROM cases
WHERE
  data->'debtor'->>'name' = 'John Doe'
  AND data->>'caseStatus' = 'open'
  AND (data->>'dateFiled')::date >= '2024-01-01'
```

### Or Even Cleaner with JSONB Operators
```sql
SELECT data
FROM cases
WHERE
  data @> '{"debtor": {"name": "John Doe"}, "caseStatus": "open"}'
  AND (data->>'dateFiled')::date >= '2024-01-01'
```

## PostgreSQL + JSONB + pgvector: Complete Solution

This combination gives you:
1. ✅ **Document database** (JSONB)
2. ✅ **Vector search** (pgvector)
3. ✅ **Open source** (fully free)
4. ✅ **Local testing** (easy Podman setup)
5. ✅ **Production ready** (battle-tested, ACID compliant)

## Practical Example for CAMS

### Schema Design

```sql
CREATE TABLE cases (
    id SERIAL PRIMARY KEY,
    case_id TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL,  -- All case data as document
    keywords TEXT[],
    keywords_vector vector(384),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast document queries
CREATE INDEX idx_cases_data_gin ON cases USING GIN (data);

-- Index for specific common queries
CREATE INDEX idx_case_status ON cases ((data->>'caseStatus'));
CREATE INDEX idx_debtor_name ON cases ((data->'debtor'->>'name'));

-- Index for vector search (HNSW for performance)
CREATE INDEX idx_cases_vector ON cases USING hnsw (keywords_vector vector_cosine_ops);
```

### Insert Case Document

```sql
INSERT INTO cases (case_id, data, keywords, keywords_vector)
VALUES (
    '24-00123',
    '{
        "caseId": "24-00123",
        "debtor": {
            "name": "John Doe",
            "address": {
                "street": "123 Main St",
                "city": "New York",
                "state": "NY"
            }
        },
        "caseStatus": "open",
        "dateFiled": "2024-01-15",
        "chapter": "11",
        "courtDivisionCode": "081"
    }'::jsonb,
    ARRAY['John Doe'],
    '[0.1, 0.2, ..., 0.384]'::vector  -- Your embedding
);
```

### Hybrid Query: Vector Search + Document Filters

```sql
-- Find similar cases (vector) that are open (document query)
SELECT
    case_id,
    data->>'caseId' as case_id,
    data->'debtor'->>'name' as debtor_name,
    data->>'caseStatus' as status,
    1 - (keywords_vector <=> $1::vector) AS similarity
FROM cases
WHERE
    data->>'caseStatus' = 'open'
    AND data->>'chapter' = '11'
ORDER BY keywords_vector <=> $1::vector
LIMIT 10;
```

### Complex Nested Query

```sql
-- Find cases where debtor address is in New York
SELECT data
FROM cases
WHERE data->'debtor'->'address'->>'state' = 'NY';

-- Find cases with specific court division
SELECT data
FROM cases
WHERE data @> '{"courtDivisionCode": "081"}';

-- Array containment (if case has multiple debtors)
SELECT data
FROM cases
WHERE data->'debtors' @> '[{"name": "John Doe"}]';
```

## Code Migration Estimate: Revised

### Option 1: Full PostgreSQL Rewrite (Still Significant)
- **Effort**: 2-4 weeks
- **What changes**: Query layer, data access patterns
- **What stays same**: Business logic, embeddings, services

### Option 2: FerretDB Proxy (Best of Both Worlds?)

There's actually an interesting middle ground: **FerretDB with PostgreSQL backend**

```bash
# FerretDB acts as MongoDB-compatible proxy to PostgreSQL
podman run -d \
  --name ferretdb \
  -e FERRETDB_POSTGRESQL_URL=postgres://user:pass@postgres:5432/cams \  # pragma: allowlist secret
  -p 27017:27017 \
  ghcr.io/ferretdb/ferretdb
```

This gives you:
- ✅ **MongoDB wire protocol** (existing CAMS code works)
- ✅ **PostgreSQL backend** (JSONB document storage)
- ✅ **pgvector support** (with custom extensions)
- ❌ **No vector search yet** (FerretDB doesn't support it)

So close, but still no vector search! 😞

## The Trade-off Analysis

### PostgreSQL JSONB + pgvector: Full Rewrite
**Pros:**
- ✅ Everything works (documents + vectors)
- ✅ Fully open source
- ✅ Production ready
- ✅ Can test locally
- ✅ Battle-tested at scale

**Cons:**
- ⏱️ 2-4 weeks development time
- 🔄 Major code changes in query layer
- 📚 Learning curve for team
- 🧪 Extensive testing required

### MongoDB Atlas: Minimal Changes
**Pros:**
- ✅ 2 hours of work
- ✅ Minimal code changes
- ✅ MongoDB compatible
- ✅ Vector search included
- ✅ FedRAMP High authorized

**Cons:**
- 💰 Not free (but has free tier)
- 🏢 Vendor lock-in
- ☁️ External dependency

## Recommendation: It Depends on Your Priorities

### Choose PostgreSQL JSONB + pgvector If:
1. **Open source is a hard requirement** (compliance, policy)
2. **You want to avoid vendor lock-in** at all costs
3. **You have 2-4 weeks of development time**
4. **Your team is comfortable with PostgreSQL**
5. **You want a unified database** (no separate vector DB)

### Choose MongoDB Atlas If:
1. **Time to market is critical** (2 hours vs 2 weeks)
2. **MongoDB expertise exists on team**
3. **Budget allows** for commercial service (~$60-300/month)
4. **FedRAMP compliance required** (Atlas is certified)
5. **You might migrate to Cosmos DB vCore later** (less code change)

## Hybrid Approach: Start with POC, Migrate Later

### Phase 1: Current (MongoDB without vector search)
- Use MongoDB Community locally
- Deploy with traditional search
- Wait for infrastructure

### Phase 2: Quick Win (MongoDB Atlas)
- Adapt code for Atlas (2 hours)
- Deploy with vector search
- Get feature to users fast

### Phase 3: Long-term (PostgreSQL or Cosmos DB)
- **If open source is priority**: Migrate to PostgreSQL JSONB + pgvector
- **If Azure-native is priority**: Migrate to Cosmos DB vCore when available
- Both options preserve functionality

## Code Example: PostgreSQL Adapter

To show feasibility, here's how a PostgreSQL adapter might look:

```typescript
// PostgreSQL JSONB repository
export class CasesPostgresRepository implements CasesRepository {
  constructor(private pool: Pool) {}

  async findByVectorSimilarity(
    embeddings: number[],
    filters: CaseFilters,
    limit: number = 10
  ): Promise<Case[]> {
    const query = `
      SELECT
        data,
        1 - (keywords_vector <=> $1::vector) AS similarity
      FROM cases
      WHERE
        ($2::text IS NULL OR data->>'caseStatus' = $2)
        AND ($3::text IS NULL OR data->>'chapter' = $3)
        AND ($4::text IS NULL OR data->'debtor'->'address'->>'state' = $4)
      ORDER BY keywords_vector <=> $1::vector
      LIMIT $5
    `;

    const result = await this.pool.query(query, [
      `[${embeddings.join(',')}]`,
      filters.caseStatus || null,
      filters.chapter || null,
      filters.state || null,
      limit
    ]);

    return result.rows.map(row => this.mapToCase(row.data));
  }

  private mapToCase(data: any): Case {
    // Map JSONB document to Case domain object
    return {
      caseId: data.caseId,
      debtor: data.debtor,
      // ... rest of mapping
    };
  }
}
```

**Key Point**: The business logic, embedding service, and domain models **don't change**. Only the data access layer needs rewriting.

## Conclusion

**Yes, PostgreSQL can absolutely function as a document database** with JSONB, and combined with pgvector, it provides a complete open-source solution for document storage + vector search.

**However**, the effort required (2-4 weeks) must be weighed against:
- Your timeline requirements
- Team expertise
- Open source requirements
- Budget constraints

For CAMS specifically, **MongoDB Atlas remains the fastest path to deployment**, but **PostgreSQL JSONB + pgvector is a viable long-term open source alternative** if that aligns with your priorities.

---

## References

- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [PostgreSQL JSONB Operators](https://www.postgresql.org/docs/current/functions-json.html)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [FerretDB Documentation](https://docs.ferretdb.io/)
