# Azure AI Search Implementation for 28M Bankruptcy Records
<!-- Note: Azure AI Search was renamed to Azure AI Search in October 2023 -->

## Status
In Progress (POC Phase 2 Completed)

## Context
The Bankruptcy Oversight Support System currently manages over 28 million debtor records dating back to the 1970s, stored in Azure Cosmos DB with MongoDB API. Users need to search for debtors by name, SSN, and Tax ID with support for:
- Typo tolerance (fuzzy matching)
- Name variations and misspellings
- Fast response times despite the massive dataset
- Historical data from multiple decades

Current limitations with Cosmos DB:
- No native fuzzy search support
- Regex queries don't scale well for 28M records
- No phonetic matching capabilities
- Limited full-text search features

## Pros and Cons of Azure AI Search

### Pros
- **Fuzzy Matching**: Built-in support for typo tolerance with configurable edit distance
- **Phonetic Search**: Can find "Johnson" when users type "Jonson" using Soundex/Metaphone
- **Performance at Scale**: Optimized for searching millions of records with sub-second response times
- **Faceted Search**: Built-in support for filtering by decade, state, chapter with counts
- **Autocomplete**: Type-ahead suggestions improve user experience
- **Highlighting**: Shows matched terms in context within results
- **Scoring & Relevance**: ML-based relevance scoring ranks best matches first
- **Real-time Sync**: Change Feed integration keeps index current with < 5 minute lag
- **Azure Integration**: Native integration with Cosmos DB and other Azure services
- **No Infrastructure Management**: Fully managed service with automatic scaling and maintenance
- **Advanced Query Syntax**: Supports complex boolean queries, wildcards, and regex
- **Multi-language Support**: Analyzers for 50+ languages if needed for names

### Cons
- **Additional Cost**: $250-750/month ongoing expense for the search service
- **Data Duplication**: Search index duplicates data from Cosmos DB (storage overhead)
- **Complexity**: Another service to monitor, manage, and troubleshoot
- **Sync Delay**: Up to 5-minute lag between Cosmos DB updates and search index
- **Learning Curve**: Team needs to learn new query syntax and management tools
- **Vendor Lock-in**: Tightly coupled to Azure ecosystem
- **Index Rebuild Risk**: Corruption or schema changes may require full reindex (12-15 days for 28M records)
- **Query Limitations**: Some complex queries may still require falling back to Cosmos DB
- **Initial Migration Effort**: Significant effort to index 28M historical records
- **Maintenance Overhead**: Requires ongoing index optimization and monitoring

### Alternative Approaches Considered

1. **Elasticsearch**: More flexible but requires infrastructure management
2. **In-memory search (application layer)**: Not viable for 28M records
3. **Enhanced Cosmos DB queries**: Performance degrades significantly at this scale
4. **SQL Database with full-text search**: Migration complexity and less fuzzy matching capability
5. **Third-party search service (Algolia)**: Higher cost and data sovereignty concerns

## Decision
Implement Azure AI Search as the primary search solution for debtor records, with Cosmos DB as the source of truth and fallback search mechanism.

## Implementation Architecture

### Service Configuration
- **Azure AI Search Tier**: S2 Standard ($750/month)
  - 100 GB storage capacity
  - 4 replicas for high availability
  - 200 requests/second capacity
- **Alternative**: Start with S1 ($250/month) and scale as needed

### Index Schema Design

```json
{
  "name": "bankruptcy-debtors-index",
  "fields": [
    // Core identity fields
    {"name": "id", "type": "Edm.String", "key": true},
    {"name": "name", "type": "Edm.String", "searchable": true, "filterable": true, "sortable": true, "analyzer": "custom_name_analyzer"},
    {"name": "firstName", "type": "Edm.String", "searchable": true, "analyzer": "custom_name_analyzer"},
    {"name": "lastName", "type": "Edm.String", "searchable": true, "analyzer": "custom_name_analyzer"},
    {"name": "nameNormalized", "type": "Edm.String", "searchable": true, "analyzer": "normalized_analyzer"},
    {"name": "namePhonetic", "type": "Edm.String", "searchable": true, "analyzer": "phonetic_analyzer"},

    // PII fields - NOT searchable for security
    {"name": "taxId", "type": "Edm.String", "searchable": false, "filterable": true},
    {"name": "ssn", "type": "Edm.String", "searchable": false, "filterable": true},

    // Historical categorization
    {"name": "filingYear", "type": "Edm.Int32", "filterable": true, "facetable": true},
    {"name": "filingDecade", "type": "Edm.String", "filterable": true, "facetable": true},
    {"name": "caseNumber", "type": "Edm.String", "searchable": true, "filterable": true},
    {"name": "chapter", "type": "Edm.String", "filterable": true, "facetable": true},

    // Location fields
    {"name": "address", "type": "Edm.String", "searchable": true},
    {"name": "city", "type": "Edm.String", "filterable": true, "facetable": true},
    {"name": "state", "type": "Edm.String", "filterable": true, "facetable": true},

    // Metadata
    {"name": "lastModified", "type": "Edm.DateTimeOffset", "filterable": true},
    {"name": "dataSource", "type": "Edm.String", "filterable": true}
  ],
  "suggesters": [
    {
      "name": "debtor-suggester",
      "searchMode": "analyzingInfixMatching",
      "sourceFields": ["name"]
    }
  ]
}
```

### Custom Analyzers Configuration

```json
{
  "analyzers": [
    {
      "name": "custom_name_analyzer",
      "@odata.type": "#Microsoft.Azure.Search.CustomAnalyzer",
      "tokenizer": "standard",
      "tokenFilters": ["lowercase", "asciifolding", "edge_ngram_filter"],
      "charFilters": ["html_strip"]
    },
    {
      "name": "normalized_analyzer",
      "@odata.type": "#Microsoft.Azure.Search.CustomAnalyzer",
      "tokenizer": "standard",
      "tokenFilters": ["lowercase", "asciifolding"],
      "charFilters": ["suffix_strip", "punctuation_strip"]
    },
    {
      "name": "phonetic_analyzer",
      "@odata.type": "#Microsoft.Azure.Search.CustomAnalyzer",
      "tokenizer": "standard",
      "tokenFilters": ["lowercase", "phonetic_token_filter"]
    }
  ],
  "tokenFilters": [
    {
      "name": "edge_ngram_filter",
      "@odata.type": "#Microsoft.Azure.Search.EdgeNGramTokenFilterV2",
      "minGram": 2,
      "maxGram": 15
    },
    {
      "name": "phonetic_token_filter",
      "@odata.type": "#Microsoft.Azure.Search.PhoneticTokenFilter",
      "encoder": "metaphone"
    }
  ],
  "scoringProfiles": [
    {
      "name": "name-boost-profile",
      "text": {
        "weights": {
          "name": 5,
          "lastName": 3,
          "firstName": 2,
          "nameNormalized": 1.5,
          "namePhonetic": 1
        }
      }
    }
  ],
  "defaultScoringProfile": "name-boost-profile",
  "synonymMaps": [
    {
      "name": "name-synonyms",
      "format": "solr",
      "synonyms": "Bob,Robert\nLiz,Elizabeth\nBill,William\nDick,Richard\n"
    },
    {
      "name": "corp-synonyms",
      "format": "solr",
      "synonyms": "Co,Company\nCorp,Corporation\nInc,Incorporated\nLLC,Limited Liability Company"
    }
  ]
}
```

## Security & PII Considerations

### PII Protection Strategy

1. **SSN/TaxID Handling**:
   - Fields are **not searchable** (only filterable for exact match)
   - Use filter queries for lookups: `$filter=ssn eq '123456789'`
   - Never include in autocomplete or suggestions
   - Implement field-level masking in response (e.g., `***-**-6789`)

2. **Access Control**:
   - Use Azure AD / RBAC for authentication
   - Implement role-based field projection
   - Audit all SSN/TaxID-based searches separately
   - Consider separate indexes for different access levels

3. **Query Security**:
   - Sanitize all user input to prevent injection
   - Escape special Lucene syntax characters
   - Implement query timeout limits
   - Add circuit breakers for expensive queries

## Index Management Strategy

### Blue/Green Index Deployment

To enable zero-downtime schema changes and safe rollbacks:

```typescript
export class IndexVersionManager {
  // Always maintain two indexes with an alias
  private readonly indexPattern = 'bankruptcy-debtors-index-v{version}';
  private readonly aliasName = 'bankruptcy-debtors';

  async deployNewIndexVersion(newVersion: number) {
    // Step 1: Create new index with updated schema
    const newIndexName = `bankruptcy-debtors-index-v${newVersion}`;
    await this.createIndex(newIndexName, newSchema);

    // Step 2: Reindex all data (can run in parallel with old index)
    await this.reindexData(newIndexName);

    // Step 3: Validate new index
    await this.runValidationSuite(newIndexName);

    // Step 4: Atomic alias swap
    await this.swapAlias(this.aliasName, newIndexName);

    // Step 5: Keep old index for rollback (delete after bake-in period)
    await this.scheduleOldIndexCleanup(oldIndexName, days = 7);
  }
}
```

## Phased Implementation Plan

### Phase 1: Immediate Regex Search Enhancement
Deploy optimized regex search while preparing Azure infrastructure.

#### Database Optimizations
```javascript
// Create compound indexes for 28M records
db.debtors.createIndex({ "name": 1, "_id": 1 })
db.debtors.createIndex({ "taxId": 1 })
db.debtors.createIndex({ "ssn": 1 })
db.debtors.createIndex({ "documentType": 1, "name": 1 })
```

#### Tiered Search Strategy
```typescript
export class DebtorSearchUseCase {
  async searchDebtors(searchTerm: string, options: SearchOptions) {
    // Tier 1: Exact match (fastest)
    if (searchTerm.length >= 9) {
      const exactResults = await this.exactSearch(searchTerm);
      if (exactResults.data.length > 0) return exactResults;
    }

    // Tier 2: Prefix match (indexed)
    if (searchTerm.length >= 3) {
      const prefixResults = await this.prefixSearch(searchTerm);
      if (prefixResults.data.length >= 10) return prefixResults;
    }

    // Tier 3: Contains search (limited scope)
    return await this.containsSearch(searchTerm, {
      limit: 100,
      yearRange: this.getSearchYearRange(options)
    });
  }
}
```

### Phase 2: Azure AI Search Setup (COMPLETED)

#### POC Implementation Completed (January 2025)

The foundational POC for Azure AI Search has been successfully implemented with the following components:

##### 1. Core Search Infrastructure

**Gateway Implementation** (`azure-search-gateway.ts`):
- Implements SearchGateway interface with CAMS architectural patterns
- Defines bankruptcy debtor index schema with 9 searchable fields
- SSN/TaxID fields are filterable only (not searchable) for PII security
- Batch upload support (1000 documents per batch)
- Fuzzy search with Lucene ~1 operator (edit distance 1)

**Humble Object Layer** (`azure-search-humble.ts`):
- Wraps @azure/search-documents SDK
- Methods: createIndex, deleteIndex, uploadDocuments, search, getDocumentCount
- Error serialization for Azure SDK errors
- Handles 404 checks for index existence

**Mock Implementation** (`mock-azure-search.gateway.ts`):
- In-memory search for testing without Azure service
- Improved fuzzy matching with proper Levenshtein distance algorithm
- Supports substring matching with edit distance ≤ 1
- Helper methods: reset(), getAllDocuments()
- Deep copy protection to prevent external modification

##### 2. API Layer Implementation

**Use Case** (`debtor-search.use-case.ts`):
- Business logic for debtor search operations
- Search with fuzzy matching support
- Batch document synchronization (handles 1000 docs per batch)
- Index initialization and statistics
- Validation: minimum 2 characters, required search text

**Controller** (`debtor-search.controller.ts`):
- RESTful endpoints for search functionality
- Query parameter support: q, fuzzy, top, skip, fields
- Pagination metadata in response
- Admin endpoints for index management

**API Endpoints Added**:
```
GET  /api/debtors/search       - Search with query parameters
GET  /api/debtors/search/stats - Get index document count
POST /api/debtors/search/init  - Initialize search index
POST /api/debtors/search/sync  - Sync debtor documents
```

##### 3. Testing & Quality Assurance

**Unit Tests** (`mock-azure-search.gateway.test.ts`):
- 30 comprehensive test cases
- Coverage: exact matching, fuzzy matching, pagination, field selection
- Edge cases: empty queries, special characters, index state
- All tests passing with 100% success rate

**Integration Test Script** (`test-debtor-search-api.ts`):
- End-to-end API validation
- Tests all endpoints with various scenarios
- Pagination and field selection verification
- Error handling validation

**POC Demonstration Script** (`azure-search-poc.ts`):
- Indexes 10 mock debtors from test data
- Demonstrates exact and fuzzy matching
- Performance metrics display
- Mock and real Azure mode support

##### 4. Key Features Demonstrated

**Fuzzy Matching**:
- ✅ "Smth" → "Smith" (1 character typo)
- ✅ "Jonson" → "Johnson" (missing character)
- ✅ "Johhnson" → "Johnson" (extra character)
- ✅ "Andersen" → "Anderson" (substitution)
- ✅ Edit distance calculation with dynamic programming

**Performance**:
- Sub-millisecond response times in mock mode
- Batch processing support for large datasets
- Pagination for result management
- Field selection for optimized payloads

**Security**:
- PII fields (SSN/TaxID) are filterable but not searchable
- Input validation and sanitization
- Error handling with proper status codes
- Field-level access control ready

##### 5. Configuration

Environment variables for Azure AI Search:
```env
AZURE_SEARCH_ENDPOINT=       # Azure Search service endpoint
AZURE_SEARCH_API_KEY=        # API key for authentication
AZURE_SEARCH_INDEX_NAME=bankruptcy-debtors-poc
AZURE_SEARCH_MOCK=true       # Set to false for real Azure service
```

##### Next Steps for Phase 2 Completion

1. **Connect to Real Azure AI Search Service**:
   - Provision Azure AI Search resource
   - Configure authentication
   - Test with real service

2. **Performance Testing**:
   - Load test with larger datasets
   - Measure response times
   - Optimize query patterns

3. **Documentation**:
   - API documentation with OpenAPI spec
   - Developer guide for search queries
   - Deployment instructions

### Phase 2b: Azure AI Search Advanced Features (PENDING)

#### Migration Strategy for 28M Records

```typescript
export class AzureSearchIndexer {
  private readonly PARALLEL_WORKERS = 5;
  private readonly BATCH_SIZE = 10000;
  private readonly RATE_LIMIT_DELAY_MS = 100;

  async performInitialIndexing() {
    // Step 1: Index recent data first (last 5 years)
    await this.indexByYearRange(2019, 2024);

    // Step 2: Index historical data in reverse chronological order
    await this.indexHistoricalData();

    // Step 3: Set up Change Feed for real-time updates
    await this.setupChangeFeed();
  }

  private async indexByYearRange(startYear: number, endYear: number) {
    // Create worker pool for parallel processing
    const workerPool = new WorkerPool(this.PARALLEL_WORKERS);

    // Process years in parallel with rate limiting
    const years = Array.from(
      {length: endYear - startYear + 1},
      (_, i) => endYear - i
    );

    await workerPool.processInParallel(years, async (year) => {
      let continuationToken = null;
      let lastProcessedId = await this.getCheckpoint(year);

      do {
        const batch = await this.rateLimitedQuery({
          query: 'SELECT * FROM c WHERE c.filingYear = @year AND c.id > @lastId',
          parameters: [
            { name: '@year', value: year },
            { name: '@lastId', value: lastProcessedId }
          ]
        }, {
          maxItemCount: this.BATCH_SIZE,
          continuationToken
        });

        if (batch.resources.length > 0) {
          await this.indexBatch(batch.resources);
          await this.saveCheckpoint(year, batch.resources[batch.resources.length - 1].id);
          lastProcessedId = batch.resources[batch.resources.length - 1].id;
        }

        continuationToken = batch.continuationToken;

        // Rate limiting to avoid throttling
        await this.delay(this.RATE_LIMIT_DELAY_MS);
      } while (continuationToken);
    });
  }

  private async indexBatch(documents: DebtorDocument[]) {
    const searchDocuments = documents.map(doc => ({
      id: doc.id,
      name: this.normalizeName(doc.name),
      namePhonetic: this.generatePhonetic(doc.name),
      taxId: doc.taxId?.replace(/\D/g, ''),
      ssn: doc.ssn?.replace(/\D/g, ''),
      filingYear: doc.filingDate ? new Date(doc.filingDate).getFullYear() : null,
      filingDecade: this.getDecade(doc.filingDate),
      caseNumber: doc.caseNumber,
      chapter: doc.chapter,
      address: doc.address?.line1,
      city: doc.address?.city,
      state: doc.address?.state,
      lastModified: new Date().toISOString(),
      dataSource: doc.filingYear < 2000 ? 'legacy' : 'modern'
    }));

    const uploadBatches = this.chunk(searchDocuments, 1000);

    for (const batch of uploadBatches) {
      await this.retryWithBackoff(() =>
        this.searchClient.uploadDocuments(batch)
      );
    }
  }
}
```

#### Cosmos DB Change Feed Integration

```typescript
export class ChangeFeedProcessor {
  async setupChangeFeed() {
    const processor = this.cosmosClient
      .database('bankruptcy')
      .container('debtors')
      .items
      .changeFeed('debtors-search-sync', {
        startFromBeginning: false,
        leaseContainerName: 'search-sync-leases'
      });

    processor.handleChanges(async (changes: DebtorDocument[]) => {
      const operations = changes.map(doc => {
        if (doc._deleted) {
          return {
            type: 'delete' as const,
            document: { id: doc.id }
          };
        }
        return {
          type: 'upload' as const,
          document: this.transformForSearch(doc)
        };
      });

      await this.searchClient.indexDocuments(operations);
    });

    await processor.start();
  }
}
```

### Phase 3: Integration & Production (NEXT PHASE)

#### Remaining Work for Production Deployment

Based on the completed POC, the following tasks remain for production readiness:

##### 1. Cosmos DB Integration
- Connect `DebtorSearchUseCase` to real Cosmos DB data source
- Implement data transformation pipeline for 28M records
- Create batch indexing job for historical data
- Set up incremental indexing for new records

##### 2. Change Feed Implementation
- Implement Cosmos DB Change Feed listener
- Real-time synchronization between Cosmos and Azure Search
- Handle document updates, inserts, and deletes
- Implement retry logic and error handling

##### 3. Advanced Search Features
- Add phonetic search using Metaphone/Soundex
- Implement autocomplete/type-ahead suggestions
- Create custom scoring profiles for relevance
- Add synonym support for common name variations

##### 4. Performance Optimization
- Implement Redis caching layer
- Add query result caching with TTL
- Optimize batch sizes for 28M record indexing
- Load testing with production-scale data

##### 5. Security Enhancements
- Add role-based access control for admin endpoints
- Implement audit logging for PII searches
- Add rate limiting and throttling
- Secure API key management

##### 6. Monitoring & Observability
- Application Insights integration
- Custom metrics for search performance
- Alert rules for slow queries and errors
- Dashboard for search analytics

##### 7. Azure Government Cloud Migration
- Update endpoints for Azure Government
- Compliance validation
- Security hardening for government requirements

##### 8. Documentation & Training
- API documentation with Swagger/OpenAPI
- Developer guide for search implementation
- Operations runbook
- User training materials

### Phase 3b: Production Implementation Details

#### Search Service Architecture

```typescript
export class AzureSearchGateway {
  private searchClient: SearchClient<DebtorSearchDocument>;
  private fallbackAdapter: DocumentCollectionAdapter<Debtor>;

  async search(searchTerm: string, options: SearchOptions): Promise<DebtorSearchResult> {
    try {
      return await this.azureSearch(searchTerm, options);
    } catch (error) {
      console.error('Azure Search failed, falling back to Cosmos DB', error);
      return await this.fallbackSearch(searchTerm, options);
    }
  }

  private async azureSearch(searchTerm: string, options: SearchOptions) {
    // Determine search type and route appropriately
    const searchType = this.detectSearchType(searchTerm);

    if (searchType === 'ssn' || searchType === 'taxId') {
      return await this.exactPIISearch(searchTerm, options);
    }

    if (searchType === 'caseNumber') {
      return await this.exactCaseSearch(searchTerm, options);
    }

    // Name search with fuzzy matching
    const fuzzyLevel = this.determineFuzzyLevel(searchTerm);
    const searchOptions = {
      queryType: 'full' as const,
      searchMode: 'any' as const,

      // Apply fuzzy matching based on term length
      searchText: this.buildFuzzyQuery(searchTerm, fuzzyLevel),

      // Search across name fields with boosting
      searchFields: ['lastName^3', 'firstName^2', 'name^5', 'nameNormalized', 'namePhonetic'],

      // Use scoring profile for relevance
      scoringProfile: 'name-boost-profile',

      // Performance optimizations
      select: ['id', 'name', 'taxId', 'ssn', 'caseNumber', 'filingYear'],

      // Historical data filtering
      filter: this.buildFilter(options),

      // Facets for UI filtering
      facets: ['filingDecade', 'state', 'chapter'],

      // Pagination
      skip: options.offset || 0,
      top: Math.min(options.limit || 25, 100),

      includeTotalCount: true,

      // Result highlighting
      highlightFields: 'name',
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>'
    };

    const results = await this.searchClient.search(searchOptions.searchText, searchOptions);

    const documents: Debtor[] = [];
    for await (const result of results.results) {
      documents.push({
        id: result.document.id,
        name: result.document.name,
        taxId: result.document.taxId,
        ssn: result.document.ssn,
        _searchScore: result.score,
        _highlights: result.highlights
      });
    }

    return {
      data: documents,
      metadata: {
        total: results.count || 0,
        facets: results.facets,
        executionTime: results.executionTime
      }
    };
  }

  private buildFilter(options: SearchOptions): string {
    const filters: string[] = [];

    if (options.yearRange) {
      filters.push(`filingYear ge ${options.yearRange.start} and filingYear le ${options.yearRange.end}`);
    }

    if (options.states?.length) {
      const stateFilter = options.states.map(s => `state eq '${s}'`).join(' or ');
      filters.push(`(${stateFilter})`);
    }

    if (options.chapters?.length) {
      const chapterFilter = options.chapters.map(c => `chapter eq '${c}'`).join(' or ');
      filters.push(`(${chapterFilter})`);
    }

    return filters.join(' and ');
  }

  private detectSearchType(term: string): 'ssn' | 'taxId' | 'caseNumber' | 'name' {
    const cleaned = term.replace(/\D/g, '');

    // SSN pattern: 9 digits
    if (cleaned.length === 9) return 'ssn';

    // Tax ID pattern: 2-9 digits with possible dash
    if (/^\d{2}-?\d{7}$/.test(term)) return 'taxId';

    // Case number pattern
    if (/^\d{2,}-\d{2,}/.test(term)) return 'caseNumber';

    return 'name';
  }

  private determineFuzzyLevel(term: string): number {
    if (term.length <= 3) return 0;  // No fuzzy for short terms
    if (term.length <= 5) return 1;  // Edit distance 1
    if (term.length <= 10) return 1; // Edit distance 1
    return 2; // Edit distance 2 for longer terms
  }

  private buildFuzzyQuery(term: string, fuzzyLevel: number): string {
    // Sanitize special characters to prevent Lucene injection
    const sanitized = term.replace(/[+\-&|!(){}[\]^"~*?:\\]/g, '\\$&');

    if (fuzzyLevel === 0) return sanitized;
    return `${sanitized}~${fuzzyLevel}`;
  }

  private async exactPIISearch(term: string, options: SearchOptions) {
    const cleaned = term.replace(/\D/g, '');
    const field = cleaned.length === 9 ? 'ssn' : 'taxId';

    return await this.searchClient.search('*', {
      filter: `${field} eq '${cleaned}'`,
      select: ['id', 'name', 'caseNumber', 'filingYear'],
      top: options.limit || 25
    });
  }

  // Mask PII in response
  private maskPIIFields(documents: Debtor[]): Debtor[] {
    return documents.map(doc => ({
      ...doc,
      ssn: doc.ssn ? `***-**-${doc.ssn.slice(-4)}` : undefined,
      taxId: doc.taxId ? `**-***${doc.taxId.slice(-4)}` : undefined
    }));
  }
}
```

## Performance Optimizations

### Caching Strategy

```typescript
export class SearchCache {
  private cache: LRUCache<string, CachedSearchResult>;

  constructor() {
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 15, // 15 minute TTL
      updateAgeOnGet: true
    });
  }

  async getOrSearch(
    term: string,
    options: SearchOptions,
    searchFn: () => Promise<SearchResult>
  ): Promise<SearchResult> {
    const key = this.getCacheKey(term, options);

    const cached = this.cache.get(key);
    if (cached && !this.isStale(cached)) {
      return cached.result;
    }

    const result = await searchFn();

    if (result.data.length > 0) {
      this.cache.set(key, {
        result,
        timestamp: Date.now()
      });
    }

    return result;
  }
}
```

### Zero-Downtime Migration

```typescript
export class SearchFeatureFlags {
  private percentageRollout: number = 0;

  shouldUseAzureSearch(userId: string): boolean {
    if (this.percentageRollout === 0) return false;

    const hash = this.hashUserId(userId);
    return (hash % 100) < this.percentageRollout;
  }

  // Gradual rollout schedule:
  // Phase 1: 0% (indexing in background)
  // Phase 2: 5% (early adopters)
  // Phase 3: 25% (broader testing)
  // Phase 4: 50% (half traffic)
  // Phase 5: 100% (full rollout)
}
```

## Infrastructure as Code

```hcl
# terraform/azure-search.tf
resource "azurerm_search_service" "bankruptcy_search" {
  name                = "bankruptcy-debtors-search"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "standard2"
  replica_count       = 3
  partition_count     = 2

  identity {
    type = "SystemAssigned"
  }

  tags = {
    environment = "production"
    data_volume = "28M"
  }
}

resource "azurerm_role_assignment" "search_cosmos_reader" {
  scope                = azurerm_cosmosdb_account.main.id
  role_definition_name = "Cosmos DB Account Reader Role"
  principal_id         = azurerm_search_service.bankruptcy_search.identity[0].principal_id
}

resource "azurerm_monitor_metric_alert" "search_latency" {
  name                = "search-high-latency"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_search_service.bankruptcy_search.id]

  criteria {
    metric_namespace = "Microsoft.Search/searchServices"
    metric_name      = "SearchLatency"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 3000
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops_team.id
  }
}
```

## Monitoring & Analytics

```typescript
export class SearchAnalytics {
  async trackSearch(params: {
    searchTerm: string;
    resultCount: number;
    executionTime: number;
    searchType: 'azure' | 'cosmos' | 'cache';
    userId: string;
    queryType?: 'name' | 'ssn' | 'taxId' | 'caseNumber';
  }) {
    const telemetry = {
      name: 'DebtorSearch',
      properties: {
        searchTerm: this.hashSensitiveData(params.searchTerm),
        resultCount: params.resultCount,
        hasResults: params.resultCount > 0,
        searchType: params.searchType,
        queryType: params.queryType,
        responseTime: params.executionTime,
        isZeroResult: params.resultCount === 0
      },
      measurements: {
        duration: params.executionTime,
        resultCount: params.resultCount
      }
    };

    this.appInsights.trackEvent(telemetry);

    // Track zero-result queries for analysis
    if (params.resultCount === 0) {
      await this.logZeroResultQuery(params.searchTerm, params.queryType);
    }

    // Alert on slow searches
    if (params.executionTime > 3000) {
      await this.alerting.sendAlert({
        severity: 'warning',
        message: `Slow search detected: ${params.executionTime}ms`,
        context: telemetry
      });
    }

    // Alert on PII searches for audit
    if (params.queryType === 'ssn' || params.queryType === 'taxId') {
      await this.auditLog.logPIIAccess({
        userId: params.userId,
        queryType: params.queryType,
        timestamp: new Date(),
        resultCount: params.resultCount
      });
    }
  }

  async monitorIndexHealth() {
    return {
      throttlingAlerts: await this.checkThrottling(),
      changeFeedLag: await this.measureChangeFeedLag(),
      indexSize: await this.getIndexSize(),
      queryPerformance: await this.getQueryPerformanceMetrics()
    };
  }

  private async measureChangeFeedLag(): Promise<number> {
    const lastProcessed = await this.getLastProcessedTimestamp();
    const currentTime = Date.now();
    return currentTime - lastProcessed;
  }

  private async checkThrottling(): Promise<boolean> {
    const metrics = await this.searchClient.getMetrics();
    return metrics.throttledRequests > 0;
  }
}
```

## Capacity Planning

### Index Size Estimation

For 28M records with enhanced fields:

```typescript
class IndexSizeCalculator {
  calculateIndexSize() {
    const avgDocumentSize = {
      baseFields: 500,      // ID, name, SSN, taxId, addresses
      nameVariations: 200,  // firstName, lastName, normalized
      nGrams: 300,         // Edge n-grams increase size
      phonetic: 100,       // Phonetic encodings
      metadata: 100        // Timestamps, categories
    };

    const totalPerDoc = Object.values(avgDocumentSize).reduce((a, b) => a + b, 0);
    const totalSize = (totalPerDoc * 28_000_000) / (1024 * 1024 * 1024); // Convert to GB

    return {
      perDocumentBytes: totalPerDoc,
      totalDocuments: 28_000_000,
      estimatedSizeGB: Math.ceil(totalSize * 1.3), // 30% overhead for indexing
      recommendedTier: totalSize > 50 ? 'S2' : 'S1'
    };
  }
}
```

## Cost Analysis

### Service Costs
- **S1 Tier**: $250/month (50GB, 25 QPS)
- **S2 Tier**: $750/month (100GB, 200 QPS) - Recommended for 28M records
- **Storage**: Included in tier pricing
- **Bandwidth**: ~$0.087/GB for egress

### Cost Optimization Strategies
1. Start with S1 tier and monitor usage
2. Implement aggressive caching (40% cache hit rate target)
3. Use Cosmos DB for exact matches
4. Schedule historical indexing during off-peak
5. Implement query throttling for expensive operations

## Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Search latency (P95) | < 500ms | Application Insights |
| Fuzzy match success rate | > 85% | Custom analytics |
| Cache hit rate | > 40% | Cache metrics |
| User satisfaction | > 90% | Search refinement rate |
| System availability | 99.9% | Azure Monitor |
| Index freshness | < 5 min | Change feed lag |

## Migration Phases

### Foundation Phase
- Deploy optimized regex search
- Set up Azure AI Search service
- Implement caching layer
- Deploy monitoring infrastructure

### Initial Indexing Phase
- Index recent 5 years of data
- Set up Change Feed integration
- Implement feature flags
- Begin validation testing

### Historical Data Phase
- Complete historical data indexing
- Performance testing with full dataset
- Implement fallback mechanisms
- User acceptance testing

### Production Rollout Phase
- 5% traffic migration
- Monitor and optimize
- Gradual increase to 100%
- Documentation and training

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| Index corruption | Cosmos DB remains source of truth; rebuild capability |
| Performance degradation | Multi-tier fallback (Cache → Azure → Cosmos) |
| Cost overrun | Start with S1, monitor, implement throttling |
| Data inconsistency | Change Feed sync, daily validation jobs |
| Historical data quality | Data cleansing during indexing |

## Validation & Testing Strategy

### Golden Query Set Testing

Maintain a curated set of test queries to ensure search quality:

```typescript
export class GoldenSetValidator {
  private readonly goldenQueries = [
    // Common name variations
    { query: 'Johnson', minResults: 100, mustInclude: ['Johnson', 'Johnsen'] },
    { query: 'Jonson', minResults: 50, mustInclude: ['Johnson'] }, // Fuzzy match

    // Corporate entities
    { query: 'ABC Corp', minResults: 10, mustInclude: ['ABC Corporation', 'ABC Corp.'] },
    { query: 'Smith LLC', minResults: 20, mustInclude: ['Smith Limited Liability Company'] },

    // Edge cases
    { query: "O'Brien", minResults: 5, mustInclude: ["O'Brien", "OBrien"] },
    { query: 'McDonald', minResults: 10, mustInclude: ['McDonald', 'MacDonald'] },
    { query: 'John Smith Jr', minResults: 5, mustInclude: ['John Smith Jr.', 'John Smith Junior'] },

    // Hyphenated names
    { query: 'Smith-Jones', minResults: 3, mustInclude: ['Smith-Jones', 'Smith Jones'] },

    // PII exact matches
    { query: '123-45-6789', exactMatch: true, field: 'ssn' },
    { query: '98-1234567', exactMatch: true, field: 'taxId' },

    // Common typos
    { query: 'Willaim', minResults: 5, mustInclude: ['William'] },
    { query: 'Elizebeth', minResults: 5, mustInclude: ['Elizabeth'] }
  ];

  async validateSearchQuality() {
    const results = [];

    for (const test of this.goldenQueries) {
      const searchResults = await this.search(test.query);

      const validation = {
        query: test.query,
        passed: true,
        issues: []
      };

      if (test.minResults && searchResults.count < test.minResults) {
        validation.passed = false;
        validation.issues.push(`Expected min ${test.minResults} results, got ${searchResults.count}`);
      }

      if (test.mustInclude) {
        const foundNames = searchResults.data.map(d => d.name);
        for (const expected of test.mustInclude) {
          if (!foundNames.some(name => name.includes(expected))) {
            validation.passed = false;
            validation.issues.push(`Missing expected result: ${expected}`);
          }
        }
      }

      results.push(validation);
    }

    return results;
  }
}
```

### Migration Validation

```typescript
export class SearchValidation {
  async validateMigration() {
    const validations = [
      this.validateRecordCounts(),
      this.validateHistoricalData(),
      this.validateSearchQuality(),
      this.validatePerformance(),
      this.validateChangeFeedSync()
    ];

    const results = await Promise.all(validations);
    return {
      passed: results.every(r => r.passed),
      details: results
    };
  }

  async validateRecordCounts() {
    const cosmosCount = await this.getCosmosCount();
    const azureCount = await this.getAzureSearchCount();
    const tolerance = 100; // Allow small discrepancy during sync

    return {
      passed: Math.abs(cosmosCount - azureCount) < tolerance,
      cosmosCount,
      azureCount,
      difference: Math.abs(cosmosCount - azureCount)
    };
  }

  async validatePerformance() {
    const testQueries = ['Smith', 'Johnson', 'ABC Corporation'];
    const results = [];

    for (const query of testQueries) {
      const start = Date.now();
      await this.azureSearch(query);
      const duration = Date.now() - start;

      results.push({
        query,
        duration,
        passed: duration < 500 // Sub-500ms target
      });
    }

    return {
      passed: results.every(r => r.passed),
      queries: results
    };
  }
}
```

## User Experience Enhancements

### Search Suggestions & Corrections

```typescript
export class SearchUXEnhancements {
  async enhanceSearchResults(query: string, results: SearchResult) {
    if (results.data.length === 0) {
      return {
        ...results,
        suggestions: await this.getSuggestions(query),
        didYouMean: await this.getSpellingSuggestions(query),
        guidance: this.getEmptyStateGuidance(query)
      };
    }

    return {
      ...results,
      facets: await this.enrichFacets(results.facets),
      relatedSearches: await this.getRelatedSearches(query)
    };
  }

  private async getSpellingSuggestions(query: string): Promise<string[]> {
    // Use Azure AI Search suggestions API
    const suggestions = await this.searchClient.suggest(query, 'debtor-suggester', {
      top: 5,
      fuzzy: true
    });

    return suggestions.results.map(s => s.text);
  }

  private getEmptyStateGuidance(query: string): string[] {
    const guidance = [];

    if (query.includes(' ')) {
      guidance.push('Try searching for just the last name');
    }

    if (/[^a-zA-Z0-9\s-]/.test(query)) {
      guidance.push('Remove special characters from your search');
    }

    if (query.length < 3) {
      guidance.push('Enter at least 3 characters');
    }

    guidance.push('Check the spelling of the name');
    guidance.push('Try removing middle names or initials');

    return guidance;
  }

  async cacheZeroResults(query: string) {
    // Cache zero-result queries briefly to avoid repeated searches
    await this.cache.set(`zero:${query}`, true, { ttl: 60000 }); // 60 seconds
  }
}
```

## Consequences

### Positive
- **Fuzzy search capability**: Handles typos and name variations
- **Sub-second response times**: Even with 28M records
- **Faceted search**: Filter by decade, state, chapter
- **Autocomplete**: Type-ahead suggestions
- **Highlighting**: Shows matched terms in results
- **Scalability**: Can handle growth beyond 28M records

### Negative
- **Additional cost**: $250-750/month for Azure AI Search
- **Complexity**: Another service to manage and monitor
- **Data duplication**: Index separate from source data
- **Sync lag**: Up to 5 minutes for new records

### Neutral
- **Learning curve**: Team needs to learn Azure AI Search
- **Migration effort**: Multi-phase implementation required
- **Monitoring requirements**: New dashboards and alerts needed

## References
- [Azure AI Search Documentation](https://docs.microsoft.com/en-us/azure/search/)
- [Cosmos DB Change Feed](https://docs.microsoft.com/en-us/azure/cosmos-db/change-feed)
- [Search Index Design Best Practices](https://docs.microsoft.com/en-us/azure/search/search-performance-tips)
- [Fuzzy Search in Azure AI Search](https://docs.microsoft.com/en-us/azure/search/query-lucene-syntax#fuzzy-search)
