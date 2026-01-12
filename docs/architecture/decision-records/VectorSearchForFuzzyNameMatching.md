# Vector Search for Fuzzy Name Matching

## Context

### Problem Statement

Users need to search for bankruptcy cases by debtor name, but exact string matching is insufficient for real-world use cases:

- **Typos and Spelling Variants**: "Jon Smith" vs "John Smith", "Smyth" vs "Smith"
- **Nicknames**: "Mike Johnson" should find "Michael Johnson", "Bill" should find "William"
- **Incomplete Information**: Users may only remember part of a name
- **Data Entry Inconsistencies**: Names may be entered with variations across different systems
- **Cultural Name Variations**: Formal vs informal names, abbreviated middle names, etc.

Traditional database queries using `LIKE`, `REGEX`, or full-text search have limitations:
- **LIKE queries** require exact substring matches and don't handle variations
- **Regular expressions** are complex to write and maintain for name matching
- **Full-text search** is designed for documents, not for semantic similarity of short strings
- None of these approaches understand semantic similarity (that "Mike" and "Michael" are the same person)

### Requirements

1. **Fuzzy Matching**: Find cases even with typos or spelling variations
2. **Semantic Understanding**: Recognize nicknames and name variants
3. **Performance**: Sub-second search latency for production use
4. **Scalability**: Support growing case database (10K+ cases)
5. **Cost-Effective**: Minimize per-request costs (no external API calls)
6. **Hybrid Search**: Combine with existing filters (division, chapter, date range)
7. **Privacy**: Keep sensitive name data within our infrastructure
8. **Maintainability**: Simple to operate and troubleshoot

### Technology Landscape

Several approaches were considered:

#### Option 1: Fuzzy String Matching Libraries (Levenshtein Distance)
- **Pros**: Simple, no ML required, deterministic results
- **Cons**: Poor with nicknames, slow for large datasets, threshold tuning difficult
- **Examples**: `fuzzywuzzy`, `fuse.js`, Levenshtein algorithms

#### Option 2: Full-Text Search Engines
- **Pros**: Fast, mature technology, good documentation
- **Cons**: Not designed for semantic similarity, requires separate infrastructure
- **Examples**: Elasticsearch, Azure Cognitive Search

#### Option 3: External Embedding APIs
- **Pros**: State-of-art models, no model management
- **Cons**: Cost per request, latency, privacy concerns, external dependency
- **Examples**: Azure OpenAI, OpenAI Embeddings API

#### Option 4: Vector Search with Local Embeddings
- **Pros**: Semantic understanding, fast, no per-request cost, works offline
- **Cons**: Model management, deployment size, requires vector database support
- **Examples**: Sentence transformers with vector-enabled databases

### Azure Cosmos DB for MongoDB (vCore) Capabilities

Azure Cosmos DB for MongoDB vCore includes native vector search support:
- **Vector Indexing**: IVF (Inverted File) and DiskANN index types
- **Similarity Metrics**: Cosine similarity, Inner product, Euclidean distance
- **Integration**: Works with MongoDB aggregation pipeline via `$search` stage
- **Performance**: Optimized for Azure infrastructure
- **Availability**: No additional service setup required

## Decision

We will implement fuzzy name search using **vector embeddings with local model inference** and **Azure Cosmos DB vector indexing**.

### Architecture Components

1. **Embedding Model**: `Xenova/all-MiniLM-L6-v2`
   - 384-dimensional sentence transformer
   - Runs locally via `@xenova/transformers` (ONNX Runtime)
   - ~25 MB model size
   - ~50-100ms inference time per name

2. **Data Model Extension**: Add to `SyncedCase` documents:
   - `keywords: string[]` - Human-readable names (debtor, joint debtor)
   - `keywordsVector: number[]` - 384-dimensional embedding

3. **Vector Index**: Azure Cosmos DB vector-ivf index
   - Index path: `keywordsVector`
   - Dimensions: 384
   - Similarity: Cosine (COS)
   - NumLists: 100 (tunable based on dataset size)

4. **Search Strategy**: Hybrid approach
   - Pre-filter with traditional conditions (division, chapter, etc.)
   - Apply vector search on filtered subset
   - Sort and paginate results

5. **Embedding Service**: Singleton service in backend
   - Lazy-loads model on first request
   - Caches model in memory (reused across requests)
   - Generates embeddings during case sync
   - Generates query embeddings during search

### Implementation Approach

**Phase 0 - Experimental Database**:
- Create isolated test environment with 500 realistic test cases
- Include special test patterns (typos, nicknames, variants)
- Validate search quality before production deployment

**Phase 1-8 - Incremental Implementation**:
- Set up embedding infrastructure
- Extend data models and query DSL
- Integrate into case sync process
- Add vector search to repository layer
- Configure Cosmos DB indexes
- Deploy with bundled model

### Deployment Strategy

- **Model Bundling**: Include model in deployment package (~25 MB overhead)
- **Cold Start Optimization**: Model loads in 100-200ms (vs 2-3s if downloaded)
- **Graceful Degradation**: Falls back to traditional search if vector generation fails
- **Progressive Rollout**: Deploy to lower environments first, validate before production

## Status

**Proposed** - Implementation plan documented, awaiting approval for development

## Consequences

### Positive

1. **Better User Experience**
   - Users can find cases with typos or partial information
   - Nickname matching improves discoverability
   - Reduced frustration from failed searches

2. **Cost Efficiency**
   - No per-request API costs
   - Local model inference (~$0 operational cost)
   - Single Azure Cosmos DB service (no additional infrastructure)

3. **Performance**
   - Sub-second search latency (<700ms total)
   - Embedding generation: 50-100ms
   - Vector search: 100-500ms (depends on dataset size)
   - Pre-filtering reduces search scope

4. **Privacy and Security**
   - All data stays within our Azure environment
   - No external API calls with sensitive name data
   - Model runs in-process (no separate service)

5. **Operational Simplicity**
   - Model bundled with deployment (no separate model management)
   - Works offline (no external dependencies)
   - Standard MongoDB aggregation pipeline syntax

6. **Maintainability**
   - Well-documented open-source model
   - Active community (`@xenova/transformers` by Hugging Face)
   - Clear separation of concerns (EmbeddingService)

### Negative

1. **Deployment Package Size**
   - +25 MB to deployment package (model files)
   - Still within Azure Functions limits (1.5 GB uncompressed)
   - Mitigated by: Acceptable tradeoff for cold start performance

2. **Memory Footprint**
   - Model cached in memory (~100-150 MB per instance)
   - Singleton pattern ensures single copy per instance
   - Mitigated by: Azure Functions scale-out handles load

3. **Data Migration Required**
   - Existing cases need vector embeddings backfilled
   - One-time operation during deployment
   - Mitigated by: Backfill script provided, can run during low-traffic period

4. **Query Complexity**
   - Vector search adds complexity to query pipeline
   - New stage in aggregation pipeline
   - Mitigated by: Encapsulated in repository layer, clear abstractions

5. **Index Storage**
   - Vector index requires additional storage
   - ~4 KB per document (384 dimensions × 4 bytes × overhead)
   - For 10K cases: ~40 MB additional storage
   - Mitigated by: Negligible cost, optimized index structure

6. **Model Limitations**
   - all-MiniLM-L6-v2 trained on general text, not legal names
   - May not handle very unusual names optimally
   - No multilingual support (English-focused)
   - Mitigated by: Good enough for common cases, can upgrade model if needed

### Risk Mitigation

1. **Search Quality Validation**
   - Experimental database with test patterns
   - A/B testing capability (compare vector vs traditional)
   - Metrics tracking for search success rates

2. **Performance Monitoring**
   - Application Insights metrics for embedding generation
   - Track vector search latency
   - Alert on degraded performance

3. **Graceful Degradation**
   - Falls back to traditional search if embedding fails
   - User experience not broken by vector search issues
   - Logged errors for troubleshooting

4. **Model Update Path**
   - Can swap models by changing model name constant
   - Rerun backfill script with new model
   - No code changes required for model upgrades

### Future Considerations

1. **Enhanced Features** (if needed)
   - Add case title to keywords
   - Include attorney names in searchable text
   - Implement relevance scoring (combine vector similarity with recency)

2. **Index Tuning** (based on growth)
   - Increase `numLists` parameter for larger datasets
   - Switch to `diskANN` index for >100K cases
   - Adjust `k` parameter based on usage patterns

3. **Model Upgrades** (if needed)
   - Larger models for better accuracy (at cost of speed)
   - Legal domain-specific models if available
   - Multilingual models for international cases

4. **Query Expansion**
   - Apply to other search scenarios (attorney search, case title search)
   - Extend to document content search (docket entries)
   - Cross-entity similarity (find similar cases)

### Alternatives Considered and Rejected

**Azure Cognitive Search**:
- **Rejected because**: Additional service to manage, higher cost, overkill for name matching
- Would require replicating case data to search index

**OpenAI Embeddings API**:
- **Rejected because**: Per-request cost adds up, latency from external API, privacy concerns
- Would cost ~$0.0001 per search × 1000 searches/day = $36/year (minimal but unnecessary)

**Elasticsearch**:
- **Rejected because**: Requires separate infrastructure, additional operational complexity
- Would need separate deployment, monitoring, backup strategy

**Phonetic Algorithms (Soundex, Metaphone)**:
- **Rejected because**: Poor with nicknames, doesn't understand semantic similarity
- Good for exact phonetic matches but not "Mike" → "Michael" type matching

**Hybrid: Elasticsearch + Vector Search**:
- **Rejected because**: Cosmos DB already supports vector search, unnecessary complexity
- Would split search logic across two systems

## References

- [Azure Cosmos DB Vector Search Documentation](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/vcore/vector-search)
- [Sentence Transformers: all-MiniLM-L6-v2 Model Card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [@xenova/transformers Documentation](https://huggingface.co/docs/transformers.js)
- [CAMS-376-IMPLEMENTATION_PLAN.md](../../../CAMS-376-IMPLEMENTATION_PLAN.md) - Detailed implementation guide

## Related ADRs

- [ApiTechnology.md](./ApiTechnology.md) - Azure Functions platform choice
- [Authentication.md](./Authentication.md) - Security considerations for search
- [Dataflows.md](./Dataflows.md) - Case sync process integration

## Implementation Tracking

- **Feature Branch**: `CAMS-376-vector-encodings`
- **Ticket**: CAMS-376
- **Implementation Plan**: [CAMS-376-IMPLEMENTATION_PLAN.md](../../../CAMS-376-IMPLEMENTATION_PLAN.md)
- **Scripts**: `backend/scripts/seed-experimental-database.ts`
- **Status**: Planning Phase → Development → Testing → Production
