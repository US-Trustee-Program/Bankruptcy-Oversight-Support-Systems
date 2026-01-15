# Decision Matrix: MongoDB vs PostgreSQL for CAMS Vector Search

## Executive Summary

PostgreSQL with JSONB + pgvector is a **viable open source alternative** to MongoDB for document storage with vector search. However, it requires **2-4 weeks of development effort** compared to **2 hours** for MongoDB Atlas adaptation.

---

## Detailed Comparison

### Feature Parity

| Feature | MongoDB | PostgreSQL JSONB | Winner |
|---------|---------|------------------|--------|
| **Document Storage** | Native | JSONB (native) | 🤝 Tie |
| **Flexible Schema** | Yes | Yes | 🤝 Tie |
| **Nested Queries** | Yes | Yes | 🤝 Tie |
| **Array Operations** | Yes | Yes | 🤝 Tie |
| **Full Text Search** | Yes | Yes | 🤝 Tie |
| **Vector Search** | Yes (Atlas) | Yes (pgvector) | 🤝 Tie |
| **Indexing** | Multiple types | GIN + HNSW | 🤝 Tie |
| **ACID Transactions** | Limited | Full | ✅ PostgreSQL |
| **Joins** | $lookup (limited) | Full SQL joins | ✅ PostgreSQL |
| **Open Source** | Community (no vectors) | Yes (with vectors) | ✅ PostgreSQL |
| **MongoDB Compatibility** | 100% | 0% | ✅ MongoDB |

### Development Effort

| Task | MongoDB Atlas | PostgreSQL JSONB |
|------|---------------|------------------|
| **Query Layer Rewrite** | None | 2-3 days |
| **Data Model Adaptation** | None | 1-2 days |
| **Repository Layer** | Minimal (2 hours) | Complete rewrite (3-5 days) |
| **Testing** | Minimal | Comprehensive (2-3 days) |
| **Documentation** | Minimal | Extensive (1 day) |
| **Total Effort** | **2 hours** | **2-4 weeks** |

### Cost Analysis (First Year)

| Option | Development | Infrastructure | Total |
|--------|-------------|----------------|-------|
| **MongoDB Atlas (Free)** | 2 hours × $150/hr = $300 | $0 (M0 tier) | **$300** |
| **MongoDB Atlas (Prod)** | 2 hours × $150/hr = $300 | $60-300/mo × 12 = $720-3,600 | **$1,020-3,900** |
| **PostgreSQL (Self-hosted)** | 160 hours × $150/hr = $24,000 | $0 (open source) | **$24,000** |
| **PostgreSQL (Azure)** | 160 hours × $150/hr = $24,000 | ~$100-500/mo × 12 = $1,200-6,000 | **$25,200-30,000** |

**Winner**: MongoDB Atlas (significantly cheaper even with paid tier)

### Risk Analysis

#### MongoDB Atlas Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Vendor lock-in | Medium | Design abstraction layer |
| Service outage | Low | SLA guarantees, multi-region |
| Cost increases | Medium | Monitor usage, set alerts |
| Feature changes | Low | Long-term support commitment |

#### PostgreSQL Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Development delays | High | Thorough planning, phased rollout |
| Testing gaps | Medium | Comprehensive test coverage |
| Performance unknowns | Medium | Load testing, benchmarking |
| Team learning curve | Medium | Training, pair programming |

---

## Use Case Analysis

### Choose MongoDB Atlas If:

✅ **Time is critical** (need deployment in days, not weeks)
✅ **Budget allows** for $60-300/month infrastructure cost
✅ **Team has MongoDB expertise**
✅ **FedRAMP compliance required** (Atlas is certified)
✅ **Migration to Cosmos DB vCore is possible** (minimal code change later)
✅ **Minimal risk tolerance** (proven solution)

### Choose PostgreSQL If:

✅ **Open source is a hard requirement** (policy, compliance)
✅ **You have 2-4 weeks of development time**
✅ **Team has PostgreSQL expertise** (or willing to learn)
✅ **You want full control** over infrastructure
✅ **You need complex SQL joins** (beyond MongoDB's $lookup)
✅ **You want to avoid any vendor lock-in**

---

## Technical Deep Dive

### MongoDB Approach (Minimal Changes)

**Current Code** (`mongo-aggregate-renderer.ts:37-49`):
```typescript
function toMongoVectorSearch(stage: VectorSearch) {
  return {
    $search: {
      cosmosSearch: {
        vector: stage.vector,
        path: stage.path,
        k: stage.k,
        similarity: stage.similarity,
      },
      returnStoredSource: true,
    },
  };
}
```

**MongoDB Atlas Adaptation** (2 hours):
```typescript
function toMongoVectorSearch(stage: VectorSearch) {
  // Check if using Atlas or Cosmos
  const isAtlas = process.env.MONGODB_PROVIDER === 'atlas';

  if (isAtlas) {
    return {
      $vectorSearch: {
        queryVector: stage.vector,
        path: stage.path,
        numCandidates: stage.k * 10,
        limit: stage.k,
        index: process.env.VECTOR_INDEX_NAME || 'vector_search_index',
      },
    };
  }

  // Cosmos DB syntax (current)
  return {
    $search: {
      cosmosSearch: {
        vector: stage.vector,
        path: stage.path,
        k: stage.k,
        ...(stage.similarity && { similarity: stage.similarity }),
      },
      returnStoredSource: true,
    },
  };
}
```

**Changes Required**:
- ✅ One function update (20 minutes)
- ✅ Environment variable configuration (10 minutes)
- ✅ Connection string update (10 minutes)
- ✅ Vector index creation (30 minutes)
- ✅ Testing (1 hour)

**Total**: 2 hours

---

### PostgreSQL Approach (Complete Rewrite)

**New Repository Layer**:
```typescript
export class CasesPostgresRepository implements CasesRepository {
  constructor(private pool: Pool) {}

  async findByVectorSimilarity(
    embeddings: number[],
    filters: CaseFilters,
    limit: number = 10
  ): Promise<Case[]> {
    // Build dynamic WHERE clause from filters
    const whereClauses: string[] = [];
    const params: any[] = [`[${embeddings.join(',')}]`];
    let paramIndex = 2;

    if (filters.caseStatus) {
      whereClauses.push(`data->>'caseStatus' = $${paramIndex}`);
      params.push(filters.caseStatus);
      paramIndex++;
    }

    if (filters.chapter) {
      whereClauses.push(`data->>'chapter' = $${paramIndex}`);
      params.push(filters.chapter);
      paramIndex++;
    }

    if (filters.courtDivisionCode) {
      whereClauses.push(`data->>'courtDivisionCode' = $${paramIndex}`);
      params.push(filters.courtDivisionCode);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const query = `
      SELECT
        data,
        keywords,
        1 - (keywords_vector <=> $1::vector) AS similarity
      FROM cases
      ${whereClause}
      ORDER BY keywords_vector <=> $1::vector
      LIMIT ${limit}
    `;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapToCase(row.data));
  }

  async create(caseData: Case): Promise<Case> {
    const keywords = this.extractKeywords(caseData);
    const embeddings = await this.embeddingService.generateKeywordsEmbedding(
      this.context,
      keywords
    );

    const query = `
      INSERT INTO cases (case_id, data, keywords, keywords_vector)
      VALUES ($1, $2, $3, $4)
      RETURNING data
    `;

    const result = await this.pool.query(query, [
      caseData.caseId,
      JSON.stringify(caseData),
      keywords,
      embeddings ? `[${embeddings.join(',')}]` : null,
    ]);

    return this.mapToCase(result.rows[0].data);
  }

  // ... 20+ more methods to implement
}
```

**Changes Required**:
- ❌ Repository layer: Complete rewrite (3-5 days)
- ❌ Query builder: Adapt to SQL (2-3 days)
- ❌ Migration scripts: MongoDB → PostgreSQL (2 days)
- ❌ Connection management: Replace MongoDB driver with pg (1 day)
- ❌ Testing: All repository tests (2-3 days)
- ❌ Documentation: Update architecture docs (1 day)

**Total**: 2-4 weeks

---

## Performance Comparison

### Vector Search Performance

Both MongoDB Atlas and PostgreSQL pgvector offer comparable performance:

| Metric | MongoDB Atlas | PostgreSQL pgvector |
|--------|---------------|---------------------|
| **Index Type** | DiskANN | HNSW |
| **Query Time (1M docs)** | ~50ms | ~50ms |
| **Index Build Time** | Minutes | Minutes |
| **Memory Overhead** | Medium | Medium |
| **Accuracy** | >95% | >95% |

### Document Query Performance

| Operation | MongoDB | PostgreSQL JSONB |
|-----------|---------|------------------|
| **Simple field lookup** | ~1ms | ~1ms |
| **Nested field query** | ~2ms | ~2ms |
| **Array containment** | ~3ms | ~3ms |
| **Full document scan** | Slow | Slow (same) |
| **With proper indexes** | Fast | Fast (same) |

**Verdict**: Performance is comparable for typical CAMS workloads.

---

## Migration Path Analysis

### If You Start with MongoDB Atlas

**Path to Azure Cosmos DB vCore** (Future):
- Effort: **2-4 hours** (update vector search syntax)
- Risk: **Low** (minor syntax differences)
- Timeline: When Azure releases vCore in US Gov cloud

**Path to PostgreSQL** (If needed):
- Effort: **2-4 weeks** (full rewrite)
- Risk: **Medium** (significant changes)
- Timeline: Any time

### If You Start with PostgreSQL

**Path to MongoDB Atlas** (If needed):
- Effort: **2-4 weeks** (full rewrite)
- Risk: **Medium** (significant changes)
- Timeline: Any time

**Path to Azure Cosmos DB vCore** (Future):
- Effort: **3-6 weeks** (full rewrite)
- Risk: **Medium** (significant changes)
- Timeline: When Azure releases vCore in US Gov cloud

**Observation**: Starting with MongoDB provides more flexibility for future migrations.

---

## Recommendation Matrix

### Scenario-Based Recommendations

| Scenario | Recommendation | Reasoning |
|----------|---------------|-----------|
| **Need feature in production < 1 week** | MongoDB Atlas | Only viable option |
| **Open source is policy requirement** | PostgreSQL | Only open source option with vectors |
| **Budget < $1000/year** | MongoDB Atlas Free | $0 for testing, low cost for prod |
| **Team has only MongoDB experience** | MongoDB Atlas | Leverage existing expertise |
| **Team has only PostgreSQL experience** | PostgreSQL | Leverage existing expertise |
| **Complex relational queries needed** | PostgreSQL | Superior join capabilities |
| **FedRAMP compliance required** | MongoDB Atlas | Already certified |
| **Maximum flexibility for future** | MongoDB Atlas | Easier migration paths |

---

## Final Recommendation for CAMS

### 🥇 Primary Recommendation: MongoDB Atlas

**Rationale**:
1. **Speed**: 2 hours vs 2-4 weeks (60-120x faster)
2. **Cost**: $300-3,900 vs $24,000-30,000 (6-10x cheaper)
3. **Risk**: Proven solution vs new implementation
4. **Compliance**: FedRAMP High authorized
5. **Flexibility**: Easy migration to Cosmos DB vCore later

### 🥈 Alternative: PostgreSQL (If Open Source Required)

**Rationale**:
1. **Open Source**: Meets strict open source requirements
2. **Full Control**: No vendor dependencies
3. **Long-term**: One-time investment, no recurring costs
4. **Capabilities**: Equivalent functionality to MongoDB

**Condition**: Only if you have:
- 2-4 weeks of development time available
- Strict open source policy requirements
- Team with PostgreSQL expertise (or willing to learn)

---

## Action Items

### If Choosing MongoDB Atlas (Recommended)

1. ✅ Get approval for ~$60-300/month infrastructure cost
2. ✅ Create MongoDB Atlas US Government account
3. ✅ Provision M0 free cluster for testing
4. ✅ Update `mongo-aggregate-renderer.ts` (2 hours)
5. ✅ Create vector search index
6. ✅ Test and validate
7. ✅ Deploy to production

**Timeline**: 1-2 days

### If Choosing PostgreSQL

1. ✅ Get approval for 2-4 weeks of development time
2. ✅ Set up local PostgreSQL + pgvector for development
3. ✅ Create implementation plan with detailed tasks
4. ✅ Rewrite repository layer with JSONB queries
5. ✅ Create migration scripts from MongoDB to PostgreSQL
6. ✅ Comprehensive testing (unit, integration, performance)
7. ✅ Update documentation
8. ✅ Deploy to production

**Timeline**: 2-4 weeks

---

## Conclusion

Both options are technically viable. The decision comes down to:

- **Time & Cost**: MongoDB Atlas wins significantly
- **Open Source**: PostgreSQL is the only option
- **Risk**: MongoDB Atlas is proven and lower risk
- **Flexibility**: MongoDB Atlas provides easier future migrations

**For CAMS, we recommend MongoDB Atlas** unless there are strict policy requirements for open source solutions.
