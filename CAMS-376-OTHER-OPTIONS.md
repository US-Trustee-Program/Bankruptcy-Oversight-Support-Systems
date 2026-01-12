# Alternative Approaches for Fuzzy Name Search

**Related Documents:**
- [CAMS-376-IMPLEMENTATION_PLAN.md](./CAMS-376-IMPLEMENTATION_PLAN.md) - Current vector search implementation plan
- [ADR: Vector Search for Fuzzy Name Matching](./docs/architecture/decision-records/VectorSearchForFuzzyNameMatching.md)

**Purpose:** Evaluation of alternative approaches to fuzzy name search for team discussion.

**Status:** For Discussion - Team members exploring various options

---

## Current Proposed Solution: Vector Search with Local Embeddings

### Quick Summary
- Local embedding model (`all-MiniLM-L6-v2`, 384 dimensions)
- Cosmos DB vector index with cosine similarity
- Hybrid pre-filtering (traditional + vector search)
- Model bundled in deployment (~25 MB)

**Key Metrics:**
- Latency: 200-700ms total (50-100ms embedding, 100-500ms vector search)
- Cost: $0 per request (local inference)
- Accuracy: Good semantic understanding (nicknames, typos)

---

## Alternative 1: Azure AI Search (Cognitive Search)

### Description
Managed search service with built-in fuzzy matching, phonetic search, and AI-powered semantic ranking.

### Architecture
```
User Query → API → Azure AI Search Service → Results
                    ↑
            Synced Case Index
            (separate from Cosmos DB)
```

### Features Available
- **Fuzzy Search**: Edit distance matching (Damerau-Levenshtein)
- **Phonetic Search**: Soundex, Metaphone analyzers built-in
- **Semantic Search**: Microsoft's semantic ranking (AI-powered)
- **Synonyms**: Built-in synonym maps
- **Auto-complete**: Type-ahead suggestions
- **Faceting**: Group by first letter, division, etc.
- **Highlighting**: Show matched portions of text
- **Search Analytics**: Built-in dashboards

### Implementation Example
```typescript
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

const searchClient = new SearchClient(
  "https://cams-search.search.windows.net",
  "cases-index",
  new AzureKeyCredential(process.env.SEARCH_API_KEY)
);

async function searchCases(name: string, filters: any) {
  const results = await searchClient.search(name, {
    searchFields: ["debtorName", "jointDebtorName"],
    searchMode: "any",
    queryType: "full", // Enables ~ for fuzzy
    facets: ["chapter", "division"],
    highlightFields: ["debtorName"],
    filter: buildODataFilter(filters),
    top: 25,
    skip: 0
  });

  return results;
}

// Query syntax: "Jon~2" = fuzzy with edit distance 2
// Query: "Smith AND chapter:11"
```

### Data Sync Strategy
```typescript
// Option 1: Push-based sync (during case sync)
async function syncCase(bCase: SyncedCase) {
  // 1. Save to Cosmos DB
  await cosmosRepository.syncDxtrCase(bCase);

  // 2. Index in Azure Search
  await searchClient.uploadDocuments([{
    id: bCase.caseId,
    debtorName: bCase.debtor.name,
    jointDebtorName: bCase.jointDebtor?.name,
    chapter: bCase.chapter,
    division: bCase.courtDivisionCode,
    dateFiled: bCase.dateFiled,
    // ... other searchable fields
  }]);
}

// Option 2: Pull-based sync (scheduled indexer)
// Azure Search can automatically pull from Cosmos DB
// Configure indexer to run every 5-15 minutes
```

### Comparison Matrix

| Factor | Azure AI Search | Vector Search (Current) |
|--------|----------------|------------------------|
| **Setup Complexity** | Medium (new service) | Low (use existing DB) |
| **Operational Overhead** | High (another service) | Low (in-process) |
| **Monthly Cost** | $75-$300/month | $0 (compute only) |
| **Per-Request Cost** | $0 | $0 |
| **Latency** | 50-150ms | 200-700ms |
| **Fuzzy Matching** | Excellent (built-in) | Good (semantic) |
| **Semantic Understanding** | Good (with semantic ranking) | Excellent |
| **Nickname Handling** | Manual (synonyms) | Automatic |
| **Scalability** | Excellent (auto-scale) | Good (DB scaling) |
| **Data Consistency** | Eventually consistent | Strongly consistent |
| **Feature Richness** | Very high | Low |
| **Debugging Tools** | Excellent | Basic |
| **Lock-in Risk** | High (Azure-specific) | Low (OSS model) |

### Pros
- ✅ **Fully managed** - Azure handles scaling, monitoring, updates
- ✅ **Built-in fuzzy matching** - Edit distance out-of-the-box
- ✅ **Multiple search modes** - Combine fuzzy, phonetic, semantic
- ✅ **Rich debugging tools** - Score explanations, query analyzer
- ✅ **Battle-tested** - Used by thousands of enterprises
- ✅ **Advanced features** - Auto-complete, faceting, highlighting
- ✅ **No cold start** - Always warm, no model loading
- ✅ **Lower latency** - Optimized search infrastructure (50-150ms)

### Cons
- ❌ **Additional cost** - ~$75-$300/month depending on tier and load
- ❌ **Data replication** - Must sync case data to separate index
- ❌ **Eventual consistency** - Search index lags behind Cosmos DB
- ❌ **Operational complexity** - Another service to monitor, secure, backup
- ❌ **Network latency** - Additional hop to search service
- ❌ **Vendor lock-in** - Azure-specific service, harder to migrate
- ❌ **Learning curve** - Team needs to learn OData, Lucene syntax

### When to Choose This
- Building a comprehensive search platform (not just name search)
- Need advanced features (auto-complete, faceting, analytics)
- Have budget for managed services
- Search quality is business-critical
- Team has Azure Search expertise or willing to learn

### Cost Breakdown
**Basic Tier (~$75/month):**
- 2 GB storage
- 3 replicas, 1 partition
- ~1M documents
- Good for development/staging

**Standard S1 (~$250/month):**
- 25 GB storage
- 12 replicas, 12 partitions
- Better performance
- Recommended for production

**Semantic Search Add-on:**
- +$500-$1000/month depending on usage
- Needed for AI-powered ranking

---

## Alternative 2: Advanced Phonetic Matching

### Description
Specialized phonetic algorithms (Metaphone3) combined with weighted edit distance, designed specifically for name matching.

### Algorithm Overview
```typescript
import metaphone from 'metaphone';
import { levenshtein } from 'fastest-levenshtein';

interface NameMatch {
  case: SyncedCase;
  score: number;
  matchType: 'exact' | 'phonetic' | 'fuzzy' | 'substring';
}

function searchCasesByName(query: string, cases: SyncedCase[]): NameMatch[] {
  const queryLower = query.toLowerCase();
  const queryPhonetic = metaphone(query, 4); // 4-char encoding

  const matches = cases.map(bCase => {
    const debtorName = bCase.debtor.name;
    const debtorPhonetic = metaphone(debtorName, 4);

    // Calculate individual scores
    const exactMatch = queryLower === debtorName.toLowerCase();
    const phoneticMatch = queryPhonetic === debtorPhonetic;
    const editSimilarity = calculateEditSimilarity(query, debtorName);
    const substringMatch = debtorName.toLowerCase().includes(queryLower);

    // Weighted combination
    let score = 0;
    let matchType: NameMatch['matchType'] = 'fuzzy';

    if (exactMatch) {
      score = 1.0;
      matchType = 'exact';
    } else if (phoneticMatch) {
      score = 0.85;
      matchType = 'phonetic';
    } else if (substringMatch) {
      score = 0.7 + (editSimilarity * 0.2);
      matchType = 'substring';
    } else {
      score = editSimilarity * 0.6;
      matchType = 'fuzzy';
    }

    // Joint debtor check
    if (bCase.jointDebtor && score < 0.7) {
      const jointScore = calculateNameScore(query, bCase.jointDebtor.name, queryPhonetic);
      if (jointScore > score) {
        score = jointScore;
      }
    }

    return { case: bCase, score, matchType };
  });

  return matches
    .filter(m => m.score >= 0.6) // Threshold
    .sort((a, b) => b.score - a.score);
}

function calculateEditSimilarity(str1: string, str2: string): number {
  const distance = levenshtein(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - (distance / maxLength);
}
```

### Nickname Dictionary
```typescript
const NICKNAME_MAP: Record<string, string[]> = {
  // Common male nicknames
  'william': ['bill', 'billy', 'will', 'willie'],
  'robert': ['bob', 'bobby', 'rob', 'robbie'],
  'richard': ['dick', 'rick', 'ricky', 'rich'],
  'michael': ['mike', 'mikey', 'mick'],
  'james': ['jim', 'jimmy', 'jamie'],
  'john': ['jack', 'johnny'],
  'thomas': ['tom', 'tommy'],
  'charles': ['charlie', 'chuck'],
  'joseph': ['joe', 'joey'],
  'daniel': ['dan', 'danny'],
  'david': ['dave', 'davey'],
  'christopher': ['chris'],
  'anthony': ['tony'],
  'jonathan': ['jon', 'nathan'],

  // Common female nicknames
  'elizabeth': ['liz', 'lizzy', 'beth', 'betty', 'eliza'],
  'margaret': ['maggie', 'meg', 'peggy'],
  'katherine': ['kate', 'katie', 'kathy', 'cathy'],
  'patricia': ['pat', 'patty', 'tricia'],
  'jennifer': ['jen', 'jenny'],
  'jessica': ['jess', 'jessie'],
  'susan': ['sue', 'susie'],
  'barbara': ['barb', 'barbie'],
  'deborah': ['deb', 'debbie'],
  'sarah': ['sally'],
  'rebecca': ['becky', 'becca'],
};

function expandQueryWithNicknames(query: string): string[] {
  const nameParts = query.toLowerCase().split(' ');
  const variants = [query];

  for (const [formal, nicknames] of Object.entries(NICKNAME_MAP)) {
    if (nameParts.includes(formal)) {
      nicknames.forEach(nick => {
        variants.push(query.replace(formal, nick));
      });
    }
    nicknames.forEach(nick => {
      if (nameParts.includes(nick)) {
        variants.push(query.replace(nick, formal));
      }
    });
  }

  return variants;
}
```

### Optimization: Pre-filtered Search
```typescript
async function optimizedPhoneticSearch(
  predicate: CasesSearchPredicate
): Promise<SyncedCase[]> {
  // Step 1: Use traditional filters to get candidate set
  const candidates = await this.searchCases({
    ...predicate,
    name: undefined, // Don't use name yet
    limit: 1000 // Get larger candidate pool
  });

  // Step 2: Apply phonetic matching on candidates only
  if (predicate.name) {
    const nameMatches = searchCasesByName(predicate.name, candidates.data);
    return nameMatches
      .slice(predicate.offset, predicate.offset + predicate.limit)
      .map(m => m.case);
  }

  return candidates.data;
}
```

### Comparison Matrix

| Factor | Phonetic Matching | Vector Search (Current) |
|--------|------------------|------------------------|
| **Implementation Time** | 1-2 days | 1-2 weeks |
| **Deployment Size** | +5 KB | +25 MB |
| **Cold Start Time** | 0ms | 100-200ms |
| **Memory Usage** | ~1 MB | ~150 MB |
| **Fuzzy Matching** | Excellent | Good |
| **Semantic Understanding** | Poor (needs dictionary) | Excellent |
| **Nickname Handling** | Manual dictionary | Automatic |
| **Deterministic** | Yes | Yes |
| **Explainability** | High | Medium |
| **Maintenance** | Medium (dictionary) | Low |
| **Scaling** | O(n) scan | O(log n) indexed |
| **Sweet Spot** | <5K cases | >5K cases |

### Pros
- ✅ **Name-specific** - Metaphone designed explicitly for English names
- ✅ **Deterministic** - Same query always returns same results
- ✅ **Explainable** - Can show exact match type and score to users
- ✅ **Zero dependencies** - No ML models, no heavy libraries
- ✅ **Tiny footprint** - ~5 KB vs 25 MB model
- ✅ **Instant startup** - No model loading time
- ✅ **Memory efficient** - No model cache needed
- ✅ **Simple debugging** - Easy to step through algorithm
- ✅ **Fast for small datasets** - Sub-10ms for <1K cases

### Cons
- ❌ **No automatic semantic understanding** - Needs manual nickname dictionary
- ❌ **Dictionary maintenance** - Must update as new patterns emerge
- ❌ **Doesn't scale** - O(n) complexity, slow for >5K cases
- ❌ **Manual tuning** - Need to adjust weights and thresholds
- ❌ **English-only** - Metaphone designed for English phonetics
- ❌ **No indexing** - Can't leverage database indexes
- ❌ **False positives** - Phonetic collisions (e.g., "Smith" sounds like "Smythe")

### When to Choose This
- Dataset is <5K cases (acceptable to scan all)
- Can pre-filter to small candidate set (<1K cases)
- Deterministic/explainable results are critical
- Want to avoid ML complexity entirely
- Team prefers algorithmic approaches over ML
- Need immediate solution (1-2 days vs 1-2 weeks)

### Performance Characteristics
```
Dataset Size | Search Time | Recommendation
-------------|-------------|---------------
< 1,000      | < 10ms      | ✅ Excellent choice
1K - 5K      | 10-50ms     | ✅ Good choice
5K - 10K     | 50-100ms    | ⚠️ Acceptable with pre-filtering
10K - 50K    | 100-500ms   | ❌ Too slow without indexing
> 50K        | > 500ms     | ❌ Not recommended
```

---

## Alternative 3: Hybrid Cosmos DB (Text + Vector)

### Description
Combine Cosmos DB's full-text search for fast candidate retrieval with vector search for intelligent re-ranking.

### Architecture Flow
```
Query: "Jon Smith"
    ↓
1. Full-text fuzzy search (fast, broad)
   → Finds: ["John Smith", "Jon Smith", "Jonathan Smith", "John Smyth"]
    ↓
2. Traditional filters (division, chapter)
   → Narrows to matching criteria
    ↓
3. Vector search re-ranking (top N candidates)
   → Semantic ranking by relevance
    ↓
4. Final pagination
   → Return top results
```

### Implementation Example
```typescript
async searchCasesHybrid(predicate: CasesSearchPredicate) {
  const queryVector = await embeddingService.generateEmbedding(
    this.context,
    predicate.name
  );

  const pipeline = [
    // Stage 1: Full-text search with fuzzy matching (fast)
    {
      $search: {
        text: {
          query: predicate.name,
          path: ['debtor.name', 'jointDebtor.name'],
          fuzzy: {
            maxEdits: 2,        // Allow 2-character edits
            prefixLength: 1,    // First char must match
            maxExpansions: 100  // Limit expansions
          }
        }
      }
    },

    // Stage 2: Traditional filters
    {
      $match: {
        documentType: 'SYNCED_CASE',
        courtDivisionCode: { $in: predicate.divisionCodes },
        chapter: { $in: predicate.chapters }
      }
    },

    // Stage 3: Take top 100 candidates from text search
    { $limit: 100 },

    // Stage 4: Vector search for semantic re-ranking
    {
      $search: {
        cosmosSearch: {
          vector: queryVector,
          path: 'keywordsVector',
          k: 50  // Re-rank top 50
        }
      }
    },

    // Stage 5: Sort by combined score (text + vector)
    {
      $addFields: {
        combinedScore: {
          $add: [
            { $multiply: ['$textScore', 0.4] },    // 40% weight to text
            { $multiply: ['$vectorScore', 0.6] }   // 60% weight to vector
          ]
        }
      }
    },
    { $sort: { combinedScore: -1 } },

    // Stage 6: Final pagination
    { $skip: predicate.offset },
    { $limit: predicate.limit }
  ];

  return await this.getAdapter<SyncedCase>().aggregate(pipeline);
}
```

### Index Configuration
```javascript
// Text Index
db.cases.createIndex(
  {
    'debtor.name': 'text',
    'jointDebtor.name': 'text'
  },
  {
    name: 'case_names_text',
    default_language: 'english',
    weights: {
      'debtor.name': 10,
      'jointDebtor.name': 5
    }
  }
);

// Vector Index
db.cases.createIndex(
  { keywordsVector: 1 },
  {
    name: 'keywordsVector_index',
    cosmosSearchOptions: {
      kind: 'vector-ivf',
      numLists: 100,
      similarity: 'COS',
      dimensions: 384
    }
  }
);
```

### Comparison Matrix

| Factor | Hybrid Approach | Vector Only | Text Only |
|--------|----------------|-------------|-----------|
| **Latency** | 100-300ms | 200-700ms | 50-150ms |
| **Accuracy** | Excellent | Good | Good |
| **Semantic Understanding** | Excellent | Excellent | Poor |
| **Fuzzy Matching** | Excellent | Good | Excellent |
| **Scalability** | Excellent | Good | Excellent |
| **Index Size** | Large (both) | Medium | Small |
| **Complexity** | High | Medium | Low |
| **Fallback** | Built-in | Manual | N/A |

### Pros
- ✅ **Best of both worlds** - Fast text search + intelligent ranking
- ✅ **Lower latency** - Text search faster than vector (10-20ms vs 100ms)
- ✅ **More accurate** - Vectors re-rank fuzzy results semantically
- ✅ **Better scaling** - Text index handles large datasets well
- ✅ **Redundancy** - Either index can work independently
- ✅ **Tunable** - Adjust weights between text/vector scores
- ✅ **No additional services** - Everything in Cosmos DB

### Cons
- ❌ **Cosmos DB requirement** - Needs both text and vector index support
- ❌ **Higher complexity** - Two indexes to manage and tune
- ❌ **Larger index size** - Both text and vector indexes
- ❌ **Query complexity** - More pipeline stages
- ❌ **Version dependency** - Requires newer Cosmos DB features
- ❌ **Debugging harder** - Two search stages to troubleshoot

### When to Choose This
- **IF available in your Cosmos DB version** (critical requirement)
- Need best possible search quality
- Have >10K cases (text search scales better)
- Want sub-200ms latency
- Can handle operational complexity

### Cosmos DB Support Check
```typescript
// Check if hybrid search is supported
async function checkHybridSupport() {
  try {
    const testPipeline = [
      { $search: { text: { query: 'test', path: 'name' } } },
      { $limit: 1 }
    ];
    await collection.aggregate(testPipeline).toArray();
    console.log('✅ Text search supported');

    const vectorPipeline = [
      { $search: { cosmosSearch: { vector: [0.1], path: 'vec', k: 1 } } }
    ];
    await collection.aggregate(vectorPipeline).toArray();
    console.log('✅ Vector search supported');

    return { textSearch: true, vectorSearch: true };
  } catch (error) {
    console.log('❌ Hybrid search not fully supported:', error.message);
    return { textSearch: false, vectorSearch: false };
  }
}
```

---

## Alternative 4: Simple Fuzzy Service with Redis Caching

### Description
Lightweight in-memory fuzzy matching (Fuse.js) with aggressive Redis caching for popular queries.

### Architecture
```
User Query → API → Check Redis Cache
                    ↓ miss
                    Fuse.js In-Memory Search
                    ↓
                    Cache Result → Return
```

### Implementation
```typescript
import Fuse from 'fuse.js';
import Redis from 'ioredis';

class CachedFuzzySearchService {
  private fuse: Fuse<SyncedCase>;
  private redis: Redis;
  private caseData: SyncedCase[] = [];

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async initialize(cases: SyncedCase[]) {
    this.caseData = cases;

    // Configure Fuse.js for name search
    this.fuse = new Fuse(cases, {
      keys: [
        { name: 'debtor.name', weight: 0.7 },
        { name: 'jointDebtor.name', weight: 0.3 }
      ],
      threshold: 0.3,        // 0 = exact, 1 = match anything
      distance: 100,         // Max distance for match
      includeScore: true,
      useExtendedSearch: true // Enable advanced queries
    });

    console.log(`Fuzzy search initialized with ${cases.length} cases`);
  }

  async search(query: string, filters: any): Promise<SyncedCase[]> {
    const cacheKey = `fuzzy:${query}:${JSON.stringify(filters)}`;

    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      console.log('Cache hit for:', query);
      return JSON.parse(cached);
    }

    // Search with Fuse.js
    const results = this.fuse.search(query, { limit: 100 });

    // Apply additional filters (division, chapter, etc.)
    const filtered = this.applyFilters(results, filters);

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(filtered));

    return filtered;
  }

  private applyFilters(results: any[], filters: any): SyncedCase[] {
    return results
      .map(r => r.item)
      .filter(c => {
        if (filters.divisionCodes && !filters.divisionCodes.includes(c.courtDivisionCode)) {
          return false;
        }
        if (filters.chapters && !filters.chapters.includes(c.chapter)) {
          return false;
        }
        return true;
      });
  }

  async refreshIndex() {
    // Reload cases from database
    const cases = await casesRepository.getAllCases();
    await this.initialize(cases);

    // Clear cache
    await this.redis.flushdb();
  }
}

// Usage
const fuzzyService = new CachedFuzzySearchService(redisClient);

// Initialize on startup
app.on('ready', async () => {
  const allCases = await casesRepository.getAllCases();
  await fuzzyService.initialize(allCases);
});

// Refresh periodically
setInterval(() => fuzzyService.refreshIndex(), 5 * 60 * 1000); // Every 5 min

// Search endpoint
app.get('/api/cases', async (req, res) => {
  const results = await fuzzyService.search(req.query.name, req.query);
  res.json(results);
});
```

### Cache Strategy
```typescript
// Cache warming strategy
async function warmCache() {
  // Pre-cache common names
  const commonNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
    'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson'
  ];

  for (const name of commonNames) {
    await fuzzyService.search(name, {});
  }

  console.log('Cache warmed with common queries');
}

// Cache analytics
async function getCacheStats() {
  const info = await redis.info('stats');
  const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
  const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
  const hitRate = hits / (hits + misses);

  return { hits, misses, hitRate: (hitRate * 100).toFixed(2) + '%' };
}
```

### Comparison Matrix

| Factor | Cached Fuzzy | Vector Search | Phonetic |
|--------|-------------|---------------|----------|
| **Cache Hit Latency** | <5ms | 200-700ms | 10-50ms |
| **Cache Miss Latency** | 50-200ms | 200-700ms | 10-50ms |
| **Memory Usage** | High (all cases) | Medium (model) | Low |
| **Operational Complexity** | High (Redis) | Low | Low |
| **Startup Time** | Slow (load index) | Medium (load model) | Fast |
| **Data Freshness** | Delayed (5 min) | Immediate | Immediate |
| **Accuracy** | Good | Excellent | Good |

### Pros
- ✅ **Blazing fast cache hits** - <5ms for cached queries
- ✅ **Popular queries benefit** - 80/20 rule applies (common names cached)
- ✅ **Simple concept** - Team understands caching easily
- ✅ **No ML complexity** - Just string matching
- ✅ **Instant deployment** - No model downloads
- ✅ **Tiny footprint** - ~100KB library
- ✅ **Good fuzzy matching** - Fuse.js is well-tested

### Cons
- ❌ **Cold performance** - First query for name is slow
- ❌ **Memory intensive** - Entire case dataset in memory per instance
- ❌ **Cache invalidation** - Complex with frequent case updates
- ❌ **Another service** - Redis adds operational complexity
- ❌ **Stale data risk** - Cache may be out of sync
- ❌ **Scale-out challenges** - Each instance has separate index
- ❌ **No semantic understanding** - Pure string matching

### When to Choose This
- Query patterns are repetitive (80% of searches are top 20 names)
- Redis is already available in infrastructure
- Simplicity is paramount
- Can tolerate occasional stale data
- Budget for Redis hosting (~$15-30/month)

### Cost Breakdown
**Redis Cache:**
- Basic: ~$15/month (256 MB)
- Standard: ~$30/month (1 GB)
- Premium: ~$120/month (6 GB with replication)

**Memory Requirements:**
- 10K cases × ~2 KB each = ~20 MB
- Fuse.js index overhead: ~2x = ~40 MB
- Recommended: 256 MB Redis for headroom

---

## Alternative 5: LLM Query Enhancement

### Description
Use a Large Language Model to normalize and expand user queries before searching with traditional exact matching.

### Architecture Flow
```
User Query: "Jon Smith"
    ↓
LLM API (Azure OpenAI)
    ↓
Expanded Queries: ["Jon Smith", "John Smith", "Jonathan Smith"]
    ↓
Traditional OR Search (Cosmos DB)
    ↓
Return Results
```

### Implementation
```typescript
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";

class LLMSearchEnhancer {
  private openai: OpenAIClient;

  constructor(endpoint: string, apiKey: string) {
    this.openai = new OpenAIClient(
      endpoint,
      new AzureKeyCredential(apiKey)
    );
  }

  async enhanceQuery(userQuery: string): Promise<string[]> {
    const prompt = `You are helping with bankruptcy case search. The user is searching for: "${userQuery}"

Expand this name to include:
1. Common spelling variations (Jon → John, Jon)
2. Full forms (Jon → Jonathan)
3. Nicknames (Bill → William, Mike → Michael)
4. Common typos (Smith → Smyth)

Return a JSON array of 3-5 variations, most likely first.
Format: ["variation1", "variation2", ...]

Only include realistic name variations. Do not add unrelated names.`;

    const response = await this.openai.getChatCompletions(
      "gpt-4",
      [
        { role: "system", content: "You are a name variation expert." },
        { role: "user", content: prompt }
      ],
      {
        temperature: 0.3,  // Lower = more consistent
        maxTokens: 200
      }
    );

    const content = response.choices[0].message.content;
    const variants = JSON.parse(content);

    // Always include original query
    if (!variants.includes(userQuery)) {
      variants.unshift(userQuery);
    }

    return variants;
  }

  async searchWithEnhancement(predicate: CasesSearchPredicate) {
    // Expand query with LLM
    const nameVariants = await this.enhanceQuery(predicate.name);

    console.log(`Query "${predicate.name}" expanded to:`, nameVariants);

    // Search for all variants (OR query)
    const conditions = nameVariants.map(name => ({
      $or: [
        { 'debtor.name': { $regex: name, $options: 'i' } },
        { 'jointDebtor.name': { $regex: name, $options: 'i' } }
      ]
    }));

    const results = await casesRepository.searchCases({
      ...predicate,
      $or: conditions
    });

    return results;
  }
}

// Usage
const enhancer = new LLMSearchEnhancer(
  process.env.AZURE_OPENAI_ENDPOINT,
  process.env.AZURE_OPENAI_KEY
);

app.get('/api/cases', async (req, res) => {
  if (req.query.name) {
    const results = await enhancer.searchWithEnhancement(req.query);
    res.json(results);
  } else {
    // Traditional search without name
    const results = await casesRepository.searchCases(req.query);
    res.json(results);
  }
});
```

### Natural Language Queries
```typescript
async function handleNaturalLanguageQuery(query: string) {
  const prompt = `Convert this natural language query to structured search parameters:
"${query}"

Return JSON with:
{
  "name": "debtor name or null",
  "chapter": "chapter number or null",
  "divisionCode": "division code or null",
  "dateFrom": "ISO date or null",
  "dateTo": "ISO date or null"
}`;

  const response = await openai.getChatCompletions("gpt-4", [
    { role: "user", content: prompt }
  ]);

  const params = JSON.parse(response.choices[0].message.content);
  return await casesRepository.searchCases(params);
}

// Example queries:
// "Cases filed by John Smith in Manhattan last month"
// "Chapter 11 cases from Brooklyn filed in 2023"
// "Find Smith cases"
```

### Comparison Matrix

| Factor | LLM Enhancement | Vector Search | Phonetic |
|--------|-----------------|---------------|----------|
| **Flexibility** | Excellent | Good | Poor |
| **Per-Query Cost** | $0.0001-0.001 | $0 | $0 |
| **Latency** | 200-500ms | 200-700ms | 10-50ms |
| **Accuracy** | Excellent | Excellent | Good |
| **Explainability** | High | Medium | High |
| **Deterministic** | No | Yes | Yes |
| **Privacy** | Low (external) | High (local) | High |
| **Operational** | Medium | Low | Low |

### Pros
- ✅ **Most flexible** - Can handle any query complexity
- ✅ **Natural language** - Users can type conversationally
- ✅ **Continuously improving** - LLMs get better over time
- ✅ **Explainable** - Can show user what expansions were tried
- ✅ **No vector index** - Uses traditional database indexes
- ✅ **Handles edge cases** - Abbreviations, initials, cultural variations
- ✅ **Multi-field search** - Can combine name, date, location in NL query

### Cons
- ❌ **External dependency** - Requires Azure OpenAI / OpenAI API
- ❌ **Cost per query** - ~$0.0001-0.001 per search (adds up)
- ❌ **Additional latency** - 200-500ms LLM call before search
- ❌ **Nondeterministic** - Same query might expand differently
- ❌ **Privacy concerns** - Sending names to external API (even Azure)
- ❌ **Rate limits** - API rate limits could impact search availability
- ❌ **Model cost** - GPT-4 is expensive, GPT-3.5 less accurate
- ❌ **Prompt engineering** - Requires careful prompt design

### When to Choose This
- Already using Azure OpenAI for other features (chat, summarization)
- Need natural language query capability
- Want to handle complex queries ("Find John Smith from Manhattan, Chapter 11")
- Search volume is low (cost acceptable)
- Have budget for LLM costs (~$10-50/month for moderate usage)
- Privacy concerns are addressed (Azure OpenAI in same region)

### Cost Estimate
**GPT-4:**
- ~$0.03 per 1K input tokens
- ~$0.06 per 1K output tokens
- Average query: ~200 tokens = $0.001 per search
- 1000 searches/day = ~$30/month

**GPT-3.5-Turbo:**
- ~$0.0015 per 1K input tokens
- ~$0.002 per 1K output tokens
- Average query: ~200 tokens = $0.0001 per search
- 1000 searches/day = ~$3/month (much more affordable)

---

## Comparative Analysis

### Quick Reference Matrix

| Factor | Vector (Current) | Azure AI Search | Phonetic | Hybrid | Cached Fuzzy | LLM Enhancement |
|--------|-----------------|----------------|----------|--------|-------------|-----------------|
| **Setup Time** | 1-2 weeks | 1 week | 1-2 days | 2-3 weeks | 3-5 days | 1 week |
| **Monthly Cost** | $0 | $75-300 | $0 | $0 | $15-30 | $3-50 |
| **Latency (p95)** | 700ms | 150ms | 50ms | 300ms | 5ms (hit) | 800ms |
| **Accuracy** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Scalability** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Complexity** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Operational** | Low | High | Low | Medium | High | Medium |
| **Privacy** | High | Medium | High | High | High | Low |

### Use Case Recommendations

#### Small Dataset (<5K cases)
**Recommendation:** Phonetic Matching
- Fast enough without indexing
- Simple to implement and maintain
- Can pre-filter to <1K candidates easily

#### Medium Dataset (5K-50K cases)
**Recommendation:** Vector Search (Current Plan) or Hybrid
- Vector search provides good balance
- Hybrid if Cosmos DB supports it (best performance)

#### Large Dataset (>50K cases)
**Recommendation:** Azure AI Search or Hybrid
- Need specialized search infrastructure
- Azure AI Search if budget allows
- Hybrid if staying with Cosmos DB

#### Need Rich Features (auto-complete, facets, analytics)
**Recommendation:** Azure AI Search
- Built-in features save development time
- Worth the operational complexity

#### Budget Constrained
**Recommendation:** Phonetic or Vector Search
- Both are essentially free (compute only)
- Phonetic simpler, Vector more accurate

#### Natural Language Requirements
**Recommendation:** LLM Enhancement + Vector Search
- Use LLM for query understanding
- Vector search for actual matching
- Best of both approaches

---

## Team Discussion Questions

### 1. Dataset Size and Growth
- Current case count: _______
- Expected growth rate: _______
- 3-year projection: _______

**Impact:** Affects whether phonetic matching is viable long-term

### 2. Search Volume and Patterns
- Expected searches per day: _______
- Are queries repetitive? (same names frequently): Yes / No
- Peak traffic times: _______

**Impact:** High volume + repetitive = caching makes sense

### 3. Budget and Resources
- Monthly budget for search infrastructure: $_______
- Team expertise: Azure services / ML / Redis / Traditional DB
- Operational capacity: Can we manage additional services?

**Impact:** Determines if Azure AI Search or Redis viable

### 4. Feature Requirements
- Need auto-complete? Yes / No
- Need faceted navigation? Yes / No
- Need search analytics? Yes / No
- Need natural language queries? Yes / No

**Impact:** Rich features push toward Azure AI Search or LLM

### 5. Performance Requirements
- Target latency (p95): _____ms
- Acceptable cold start time: _____ms
- Accuracy threshold: _____%

**Impact:** Strict latency requirements may rule out vector search

### 6. Privacy and Compliance
- Can we use external APIs (Azure OpenAI)? Yes / No
- Data residency requirements: _______
- Audit/logging requirements: _______

**Impact:** Privacy requirements may eliminate LLM option

### 7. Technical Constraints
- Cosmos DB version supports text search? Yes / No / Unknown
- Cosmos DB version supports vector search? Yes / No / Unknown
- Redis available? Yes / No / Can provision

**Impact:** Determines if Hybrid approach is possible

### 8. Team Experiments
What are team members currently exploring?
- [ ] Azure AI Search
- [ ] Phonetic algorithms
- [ ] Vector embeddings
- [ ] LLM-based approaches
- [ ] Other: __________

---

## Recommended Decision Process

### Phase 1: Quick Validation (Week 1)
1. **Implement Phonetic Matching** (1-2 days)
   - Quick baseline to validate approach
   - A/B test dataset for comparison

2. **Cosmos DB Capability Check** (1 day)
   - Test if text + vector hybrid works
   - Document limitations

3. **Performance Benchmarking** (1 day)
   - Test each approach with 500-case experimental DB
   - Measure latency, accuracy, resource usage

### Phase 2: Prototype Top 2 Options (Week 2)
Based on Phase 1 results, prototype the two most promising:
- Likely candidates: Vector Search + Phonetic OR Hybrid + Vector

### Phase 3: A/B Testing (Week 3-4)
- Deploy both to staging
- Run controlled tests with QA team
- Gather metrics on accuracy and user experience

### Phase 4: Decision (Week 5)
Team decision based on:
- Performance data
- User feedback
- Operational considerations
- Long-term scalability

---

## My Recommendation

### For Immediate Implementation
**Dual-track approach:**

1. **Track 1 (Quick Win):** Phonetic Matching
   - 1-2 days to implement
   - Gives you something working now
   - "Good enough" for many cases

2. **Track 2 (Best Solution):** Check Hybrid Feasibility
   - If Cosmos DB supports text + vector → Hybrid is best
   - If not → Vector Search as planned
   - 1-2 weeks to implement properly

### Why Both?
- Phonetic gives you results immediately
- Can A/B test quality vs vector search
- Might discover phonetic is "good enough" (save ML complexity)
- Or confirm vector search worth the effort

### Decision Tree
```
Does Cosmos DB support text + vector hybrid?
├─ Yes → Implement Hybrid (best performance)
├─ No, and dataset < 5K cases → Phonetic might suffice
└─ No, and dataset > 5K cases → Vector Search as planned

Do you need advanced features (auto-complete, facets, analytics)?
├─ Yes → Consider Azure AI Search
└─ No → Stick with Cosmos DB approach

Is search quality critical vs. speed to market?
├─ Quality critical → Vector or Hybrid
└─ Speed critical → Phonetic now, enhance later
```

---

## Action Items for Team

- [ ] Survey team members on their experiments - consolidate findings
- [ ] Verify Cosmos DB version and feature support (text search + vector)
- [ ] Prototype phonetic matching (1-2 day spike)
- [ ] Define success metrics (accuracy %, latency p95, user satisfaction)
- [ ] Set up experimental database (already planned in Phase 0)
- [ ] Schedule decision meeting after prototypes complete
- [ ] Document team decision in ADR

---

## References

- [Current Implementation Plan](./CAMS-376-IMPLEMENTATION_PLAN.md)
- [ADR: Vector Search](./docs/architecture/decision-records/VectorSearchForFuzzyNameMatching.md)
- [Azure AI Search Documentation](https://learn.microsoft.com/en-us/azure/search/)
- [Metaphone Algorithm](https://en.wikipedia.org/wiki/Metaphone)
- [Fuse.js Documentation](https://fusejs.io/)
- [Azure OpenAI Service](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/)
