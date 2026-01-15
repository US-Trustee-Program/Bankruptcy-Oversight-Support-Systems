  ---
  1. INFRASTRUCTURE COSTS

  Tier Selection Analysis
  ┌───────┬─────────┬─────┬──────────────┬──────────────────────────────┐
  │ Tier  │ Storage │ QPS │ Monthly Cost │      Fits Requirements?      │
  ├───────┼─────────┼─────┼──────────────┼──────────────────────────────┤
  │ Free  │ 50 MB   │ 3   │ $0           │ ❌ Too small (need 9.41 GiB) │
  ├───────┼─────────┼─────┼──────────────┼──────────────────────────────┤
  │ Basic │ 2 GB    │ 3   │ $75          │ ❌ Storage too small         │
  ├───────┼─────────┼─────┼──────────────┼──────────────────────────────┤
  │ S1    │ 25 GB   │ 50  │ $250         │ ✅ RECOMMENDED               │
  ├───────┼─────────┼─────┼──────────────┼──────────────────────────────┤
  │ S2    │ 100 GB  │ 200 │ $1,000       │ ⚠️ Oversized                 │
  ├───────┼─────────┼─────┼──────────────┼──────────────────────────────┤
  │ S3    │ 200 GB  │ 400 │ $2,000       │ ⚠️ Oversized                 │
  └───────┴─────────┴─────┴──────────────┴──────────────────────────────┘
  Capacity Analysis for Your Data:

  Storage Requirements:
  Actual Index Size: 9.41 GiB = ~9.6 GB
  Growth projection (3 years):
    - 5% annual growth = 11.1 GB by 2027
    - 10% annual growth = 12.5 GB by 2027
    - 15% annual growth = 14.2 GB by 2027

  Basic Tier (2 GB): ❌ Too small
  S1 Tier (25 GB): ✅ Sufficient with room for 2.6x growth
  S2 Tier (100 GB): Overkill (90% unused capacity)

  Query Performance Requirements:
  Your Peak Load: 300 queries/hour = 0.083 QPS
  S1 Capacity: 50 QPS = 180,000 queries/hour

  Headroom: 600x current peak load ✅

  Recommended Tier: Standard S1

  Infrastructure Costs Breakdown (3 Years)

⏺ A. Azure AI Search Service (S1 Tier)

  Production Environment:
  - Monthly: $250
  - Annual: $3,000
  - 3-Year Total: $9,000

  Non-Production Environments:
  - Development: Basic tier $75/month (smaller dataset)
  - Staging: S1 tier $250/month (full dataset testing)
  - Monthly: $325
  - Annual: $3,900
  - 3-Year Total: $11,700

  Total Infrastructure (3 years): $20,700

  ---
  2. OPERATIONAL COSTS

  A. Initial Data Migration (One-Time)

  Cosmos DB to Azure Search Initial Sync:

  21M records × 1.5 KB (raw) = 31.5 GB data read

  Cosmos DB Costs:
  - Request Units: 21M reads × 1 RU = 21M RUs
  - If provisioned throughput: Already covered ✅
  - If serverless: 21M RU × $0.25/million = $5.25
  - Egress (same region): FREE ✅

  Azure Search Indexing:
  - Included in tier pricing ✅
  - Indexing time: ~12-15 hours (batches of 1,000)

  Initial Migration Total: $5-10 (one-time)

  ---
  B. Ongoing Data Synchronization

  Daily Update Volume Estimation:
  Active cases: 720,000
  Daily update rate: 2-5% of active cases
  Daily updates: 14,400 - 36,000 documents/day
  Average: ~25,000 updates/day

  Cosmos DB Change Feed Costs:
  - Change feed RUs: ~1 RU per change notification
  - 25K updates/day × 1 RU = 25K RUs/day
  - Monthly: 750K RUs
  - Cost (if serverless): 0.75M RUs × $0.25 = $0.19/month
  - Cost (if provisioned): Already covered ✅

  Azure Search Incremental Indexing:
  - 25K updates/day = processing time ~25-50 seconds
  - Included in tier pricing ✅

  Data Egress (Cosmos DB → Azure Search):
  - 25K docs/day × 1.5 KB = 37.5 MB/day = 1.1 GB/month
  - Same region egress: FREE ✅

  Monthly Sync Cost: $0-1
  Annual Sync Cost: $0-12
  3-Year Sync Cost: $36

  ---
  C. Query Execution Costs

  Your Query Profile:
  - Average: 3,000 queries/day = 90,000/month = 1.08M/year
  - Peak: 5,000 queries/day = 150,000/month

  Azure Search Query Costs:
  - All queries included in tier pricing ✅
  - No per-query charges
  - S1 tier supports up to 50 QPS sustained

  Egress Costs (Search Results):
  Avg results per query: 25 documents
  Avg result size: 500 bytes/document
  Data returned: 25 × 500 = 12.5 KB per query

  Monthly: 90K queries × 12.5 KB = 1.1 GB
  Azure egress (to Azure Functions): FREE ✅

  Query Cost: $0/month (included)

  ---
  D. Monitoring & Observability

  Application Insights:
  Search API telemetry:
  - 3,000 queries/day = 90K operations/month
  - Average 2 KB telemetry per operation = 180 MB/month
  - Application Insights data ingestion: $2.30/GB
  - Cost: 0.18 GB × $2.30 = $0.41/month

  Azure Monitor Metrics:
  - Built-in metrics: FREE ✅
  - Custom metrics: 10 free, then $0.10/metric/month
  - Estimated: 5 custom metrics = FREE ✅

  Log Analytics:
  - Azure Search diagnostic logs: 2-3 MB/day
  - Monthly: 60-90 MB
  - First 5 GB free per workspace ✅

  Alert Rules:
  - 10 free alert rules included ✅
  - Needed: ~5 rules (latency, errors, index lag, etc.)

  Monthly Monitoring Cost: $1-2
  Annual Monitoring Cost: $12-24
  3-Year Monitoring Cost: $72

  ---
  E. Backup & Disaster Recovery

  Index Backup Strategy:
  Option 1: No dedicated backup (rebuild from Cosmos DB)
  - Cost: $0
  - Risk: 12-15 hour rebuild time

  Option 2: Periodic snapshots via export
  - Export to Blob Storage: $0.018/GB/month
  - 10 GB × $0.018 = $0.18/month
  - 3-year retention: 36 snapshots × 10 GB = 360 GB
  - Cost: 360 GB × $0.018 = $6.48/month

  Recommended: Option 1 (rebuild from Cosmos DB if needed)
  - Cosmos DB is source of truth
  - Index can be recreated in 12-15 hours
  - Save $233/year

  3-Year DR Cost: $0 (using rebuild strategy)

  ---

⏺ 3. PERSONNEL COSTS

  A. Initial Implementation (One-Time)

  Development Work:
  Based on your POC being complete, this is the production deployment work:
  ┌──────────────────────────────────────┬───────┬─────────┬────────┐
  │                 Task                 │ Hours │  Rate   │  Cost  │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Infrastructure Setup                 │       │         │        │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Azure AI Search provisioning         │ 4     │ $100/hr │ $400   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Managed Identity configuration       │ 3     │ $100/hr │ $300   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Network/VNet integration             │ 4     │ $100/hr │ $400   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Cosmos DB Integration                │       │         │        │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Data transformation pipeline         │ 16    │ $100/hr │ $1,600 │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Change Feed implementation           │ 12    │ $100/hr │ $1,200 │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Error handling & retry logic         │ 8     │ $100/hr │ $800   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Production Deployment                │       │         │        │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Environment configuration            │ 8     │ $100/hr │ $800   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Initial data migration (supervision) │ 8     │ $100/hr │ $800   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Performance testing                  │ 12    │ $100/hr │ $1,200 │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Security hardening                   │ 8     │ $100/hr │ $800   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Documentation & Training             │       │         │        │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Operations runbook                   │ 8     │ $100/hr │ $800   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ User training materials              │ 4     │ $80/hr  │ $320   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ API documentation updates            │ 4     │ $80/hr  │ $320   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Testing & QA                         │       │         │        │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Integration testing                  │ 16    │ $85/hr  │ $1,360 │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Load testing                         │ 8     │ $85/hr  │ $680   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Security testing                     │ 8     │ $85/hr  │ $680   │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ Project Management                   │       │         │        │
  ├──────────────────────────────────────┼───────┼─────────┼────────┤
  │ PM oversight (15% of dev hours)      │ 16    │ $120/hr │ $1,920 │
  └──────────────────────────────────────┴───────┴─────────┴────────┘
  Total Implementation Labor: $13,380

  Implementation Timeline: 2-3 weeks

  ---
  B. Ongoing Maintenance & Operations

  Monthly Operations:
  ┌─────────────────────────────┬─────────────┬─────────┬────────────┐
  │          Activity           │ Hours/Month │  Rate   │ Cost/Month │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Monitoring & Alerting       │             │         │            │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Review metrics dashboards   │ 2           │ $100/hr │ $200       │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Investigate alerts          │ 1           │ $100/hr │ $100       │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Performance optimization    │ 0.5         │ $100/hr │ $50        │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Index Management            │             │         │            │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Monitor sync lag            │ 1           │ $100/hr │ $100       │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Review query patterns       │ 1           │ $100/hr │ $100       │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Index optimization          │ 0.5         │ $100/hr │ $50        │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Incident Response           │             │         │            │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ On-call rotation allocation │ 4           │ $75/hr  │ $300       │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Incident resolution (avg)   │ 1           │ $100/hr │ $100       │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Post-mortems                │ 0.5         │ $100/hr │ $50        │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Updates & Patches           │             │         │            │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ SDK updates                 │ 1           │ $100/hr │ $100       │
  ├─────────────────────────────┼─────────────┼─────────┼────────────┤
  │ Configuration updates       │ 0.5         │ $100/hr │ $50        │
  └─────────────────────────────┴─────────────┴─────────┴────────────┘
  Monthly Operational Labor: $1,200
  Annual Operational Labor: $14,400
  3-Year Operational Labor: $43,200

  ---
  C. Enhancement & Feature Development

  Estimated Annual Enhancements:
  ┌───────────────────────────────┬─────────────┬────────┬────────┐
  │             Year              │ Enhancement │ Hours  │  Cost  │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Year 1                        │             │        │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Autocomplete/typeahead        │ 24          │ $2,400 │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Faceted search by state/city  │ 16          │ $1,600 │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Custom scoring profiles       │ 12          │ $1,200 │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Query analytics dashboard     │ 16          │ $1,600 │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Year 1 Subtotal               │             │ 68     │ $6,800 │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Year 2                        │             │        │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Synonym mapping for names     │ 12          │ $1,200 │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Advanced filtering            │ 16          │ $1,600 │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Export search results         │ 8           │ $800   │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Performance optimizations     │ 12          │ $1,200 │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Year 2 Subtotal               │             │ 48     │ $4,800 │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Year 3                        │             │        │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ ML-based relevance tuning     │ 20          │ $2,000 │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Search analytics improvements │ 12          │ $1,200 │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Integration enhancements      │ 8           │ $800   │        │
  ├───────────────────────────────┼─────────────┼────────┼────────┤
  │ Year 3 Subtotal               │             │ 40     │ $4,000 │
  └───────────────────────────────┴─────────────┴────────┴────────┘
  3-Year Enhancement Labor: $15,600

  ---
  4. HIDDEN & INDIRECT COSTS

⏺ A. Azure Functions Compute Costs (Increased)

  Additional Function Executions for Search:

  Your current Azure Functions may see increased usage:

  Baseline assumption: Search adds 3,000 function invocations/day
  Monthly: 90,000 executions
  Execution time: ~200ms average (including Azure Search call)
  Memory: 512 MB

  Consumption Plan Costs:
  - Executions: First 1M free, then $0.20/million
  - GB-seconds: First 400K free, then $0.000016/GB-s

  Monthly additional:
  - Executions: 90K (within free tier) = $0
  - GB-seconds: 90K × 0.2s × 0.5GB = 9,000 GB-s (within free tier) = $0

  Cost: $0/month (within free tiers) ✅

  3-Year Azure Functions Impact: $0

  ---
  B. Cosmos DB Performance Impact

  Additional RU Consumption:

  The Change Feed and initial sync add RU load:

  Change Feed: ~25K RUs/day = 750K RUs/month
  Initial sync: 21M RUs (one-time)

  If Provisioned Throughput (dedicated):
  - Current RU/s allocation likely sufficient for 750K RUs/month
  - Cost: Already covered ✅

  If Serverless:
  - 750K RUs/month × $0.25/million = $0.19/month
  - Annual: $2.28
  - 3-year: $7

  Initial sync (one-time): 21M RUs × $0.25/million = $5.25

  3-Year Cosmos DB Impact: $12 (if serverless)

  ---
  C. Training & Knowledge Transfer

  Staff Training:
  ┌─────────────────────────────┬───────────┬──────────┬─────────┬───────────┐
  │          Activity           │ Personnel │  Hours   │  Rate   │   Cost    │
  ├─────────────────────────────┼───────────┼──────────┼─────────┼───────────┤
  │ Developer training          │ 3 devs    │ 8 ea     │ $100    │ $2,400    │
  ├─────────────────────────────┼───────────┼──────────┼─────────┼───────────┤
  │ Operations training         │ 2 ops     │ 4 ea     │ $100    │ $800      │
  ├─────────────────────────────┼───────────┼──────────┼─────────┼───────────┤
  │ Support staff training      │ 5 staff   │ 2 ea     │ $75     │ $750      │
  ├─────────────────────────────┼───────────┼──────────┼─────────┼───────────┤
  │ Refresher training (annual) │ Team      │ 16 total │ $90 avg │ $1,440/yr │
  └─────────────────────────────┴───────────┴──────────┴─────────┴───────────┘
  Initial Training: $3,950
  Ongoing Training (3 years): $4,320
  Total Training Costs: $8,270

  ---
  D. Opportunity Costs

  Alternative: Continue with Phonetic + Jaro-Winkler

  Your existing implementation costs:
  - Infrastructure: <$1/month
  - Maintenance: ~2 hours/month = $200/month
  - Performance: 100-300ms (acceptable)

  Opportunity cost of NOT using Azure AI Search:
  - Development time freed: 130 hours = $13,000
  - Ongoing maintenance freed: 2 hours/month × 36 months = 72 hours = $7,200
  - Total opportunity cost: $20,200

  However, benefits of Azure AI Search:
  - Better performance: 50-200ms vs 100-300ms
  - Advanced features: autocomplete, faceting, semantic search
  - Better scalability: automatic handling of growth
  - Reduced custom code maintenance

  ---
  E. Risk & Contingency Costs

  Potential Risk Scenarios:
  ┌───────────────────────────┬─────────────┬───────────────┬─────────────────┐
  │           Risk            │ Probability │    Impact     │ Mitigation Cost │
  ├───────────────────────────┼─────────────┼───────────────┼─────────────────┤
  │ Initial migration issues  │ 30%         │ 20 hours      │ $2,000          │
  ├───────────────────────────┼─────────────┼───────────────┼─────────────────┤
  │ Performance tuning needed │ 40%         │ 16 hours      │ $1,600          │
  ├───────────────────────────┼─────────────┼───────────────┼─────────────────┤
  │ Index schema changes      │ 50%         │ 12 hours      │ $1,200          │
  ├───────────────────────────┼─────────────┼───────────────┼─────────────────┤
  │ Scaling beyond S1 tier    │ 20%         │ $750/mo extra │ $18,000 (3yr)   │
  ├───────────────────────────┼─────────────┼───────────────┼─────────────────┤
  │ Integration bugs          │ 25%         │ 24 hours      │ $2,400          │
  ├───────────────────────────┼─────────────┼───────────────┼─────────────────┤
  │ Data sync issues          │ 15%         │ 16 hours      │ $1,600          │
  └───────────────────────────┴─────────────┴───────────────┴─────────────────┘
  Expected Value of Risks:
  Migration issues: 0.30 × $2,000 = $600
  Performance tuning: 0.40 × $1,600 = $640
  Schema changes: 0.50 × $1,200 = $600
  Scaling to S2: 0.20 × $18,000 = $3,600
  Integration bugs: 0.25 × $2,400 = $600
  Sync issues: 0.15 × $1,600 = $240

  Total Expected Risk Cost: $6,280

  Recommended Contingency: 15% of total implementation = $2,000

  ---
  F. Compliance & Security Costs

  PII Protection & Audit:
  ┌───────────────────────────────┬───────────┬───────┬──────┬─────────────┐
  │           Activity            │ Frequency │ Hours │ Rate │ Annual Cost │
  ├───────────────────────────────┼───────────┼───────┼──────┼─────────────┤
  │ Security audit of search logs │ Quarterly │ 4     │ $120 │ $1,920      │
  ├───────────────────────────────┼───────────┼───────┼──────┼─────────────┤
  │ PII exposure assessment       │ Annual    │ 8     │ $120 │ $960        │
  ├───────────────────────────────┼───────────┼───────┼──────┼─────────────┤
  │ Compliance documentation      │ Annual    │ 4     │ $100 │ $400        │
  ├───────────────────────────────┼───────────┼───────┼──────┼─────────────┤
  │ Penetration testing (search)  │ Annual    │ 8     │ $150 │ $1,200      │
  └───────────────────────────────┴───────────┴───────┴──────┴─────────────┘
  Annual Compliance Cost: $4,480
  3-Year Compliance Cost: $13,440

  ---
  5. TOTAL COST OF OWNERSHIP (3 YEARS)

⏺ Summary Table
  ┌───────────────────────────────┬─────────┬─────────┬─────────┬─────────────────┐
  │         Cost Category         │ Year 1  │ Year 2  │ Year 3  │ Total (3 Years) │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ INFRASTRUCTURE                │         │         │         │                 │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Azure AI Search (Prod S1)     │ $3,000  │ $3,000  │ $3,000  │ $9,000          │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Azure AI Search (Non-Prod)    │ $3,900  │ $3,900  │ $3,900  │ $11,700         │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Infrastructure Subtotal       │ $6,900  │ $6,900  │ $6,900  │ $20,700         │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │                               │         │         │         │                 │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ OPERATIONAL                   │         │         │         │                 │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Initial data migration        │ $10     │ -       │ -       │ $10             │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Ongoing data sync             │ $12     │ $12     │ $12     │ $36             │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Query execution               │ $0      │ $0      │ $0      │ $0              │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Monitoring & observability    │ $24     │ $24     │ $24     │ $72             │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Cosmos DB (additional)        │ $7      │ $2      │ $2      │ $12             │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Operational Subtotal          │ $53     │ $38     │ $38     │ $130            │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │                               │         │         │         │                 │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ PERSONNEL                     │         │         │         │                 │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Initial implementation        │ $13,380 │ -       │ -       │ $13,380         │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Ongoing maintenance & ops     │ $14,400 │ $14,400 │ $14,400 │ $43,200         │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Feature enhancements          │ $6,800  │ $4,800  │ $4,000  │ $15,600         │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Training & knowledge transfer │ $3,950  │ $1,440  │ $1,440  │ $6,830          │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Personnel Subtotal            │ $38,530 │ $20,640 │ $19,840 │ $79,010         │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │                               │         │         │         │                 │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ HIDDEN/INDIRECT               │         │         │         │                 │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Compliance & security         │ $4,480  │ $4,480  │ $4,480  │ $13,440         │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Risk contingency              │ $2,000  │ -       │ -       │ $2,000          │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ Hidden Costs Subtotal         │ $6,480  │ $4,480  │ $4,480  │ $15,440         │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │                               │         │         │         │                 │
  ├───────────────────────────────┼─────────┼─────────┼─────────┼─────────────────┤
  │ TOTAL TCO                     │ $51,963 │ $32,058 │ $31,258 │ $115,280        │
  └───────────────────────────────┴─────────┴─────────┴─────────┴─────────────────┘
  ---
  Cost per Query Analysis

  3-year query volume:
  - Daily average: 3,000 queries
  - Annual: 1,095,000 queries
  - 3-year total: 3,285,000 queries

  Total 3-year TCO: $115,280
  Cost per query: $115,280 ÷ 3,285,000 = $0.035/query

  Cost per 1,000 queries: $35.10

  ---
  Monthly Breakdown (Steady State - Years 2-3)
  ┌────────────────────────────┬──────────────┐
  │       Cost Category        │ Monthly Cost │
  ├────────────────────────────┼──────────────┤
  │ Azure AI Search (Prod)     │ $250         │
  ├────────────────────────────┼──────────────┤
  │ Azure AI Search (Non-Prod) │ $325         │
  ├────────────────────────────┼──────────────┤
  │ Data sync & monitoring     │ $3           │
  ├────────────────────────────┼──────────────┤
  │ Maintenance & operations   │ $1,200       │
  ├────────────────────────────┼──────────────┤
  │ Compliance & security      │ $373         │
  ├────────────────────────────┼──────────────┤
  │ Feature development (avg)  │ $370         │
  ├────────────────────────────┼──────────────┤
  │ Training (amortized)       │ $120         │
  ├────────────────────────────┼──────────────┤
  │ Total Monthly              │ $2,641       │
  └────────────────────────────┴──────────────┘
  ---
  6. SCENARIO ANALYSIS

  Scenario A: Conservative (Current Plan - S1 Tier)

  Assumptions:
  - S1 tier sufficient for 3 years
  - Query volume stays 1K-5K/day
  - 10% annual data growth
  - Moderate feature development

  3-Year TCO: $115,280 (baseline from above)

  ---
  Scenario B: Growth (Need to Scale to S2)

  Assumptions:
  - Start S1, upgrade to S2 in Year 2
  - Query volume doubles to 10K/day by Year 3
  - Data grows 20% annually
  - Aggressive feature development

  Additional Costs:
  - S2 upgrade (Year 2-3): ($1,000 - $250) × 24 months = +$18,000
  - Additional operations (higher volume): +$600/year × 2 = +$1,200
  - Extra features: +$3,000/year × 2 = +$6,000

  3-Year TCO: $140,480 (+22% vs baseline)

  ---
  Scenario C: Optimized (Cost Reduction)

  Assumptions:
  - Implement caching (40% hit rate)
  - Hybrid approach (Cosmos DB for exact matches)
  - Reduce non-prod to Basic tier for dev
  - Minimal feature development

  Cost Reductions:
  - Dev environment Basic instead of S1: -$175/month × 36 = -$6,300
  - Reduced operations (caching): -$200/month × 36 = -$7,200
  - Minimal enhancements: -$10,000
  - Redis cache cost: +$15/month × 36 = +$540

  3-Year TCO: $92,320 (-20% vs baseline)

  ---
  Scenario D: Do Nothing (Keep Phonetic Search)

  Costs:
  - Infrastructure: <$1/month × 36 = $36
  - Maintenance: 2 hours/month × $100 × 36 = $7,200
  - Occasional enhancements: $2,000/year × 3 = $6,000
  - Training: $1,000

  3-Year TCO: $14,236

  Savings vs Azure AI Search: $101,044 (87% less)

  Trade-offs:
  - Performance: 100-300ms vs 50-200ms
  - Features: Limited vs extensive
  - Scalability: Manual vs automatic
  - Maintenance: Custom code vs managed service

  ---
  7. COST OPTIMIZATION STRATEGIES

⏺ Strategy 1: Implement Intelligent Query Routing

  Approach:
  Route queries based on type to optimize costs and performance:

  // Pseudo-code for hybrid routing
  async function searchDebtors(query: SearchQuery) {
    // Exact match (SSN, case number) → Cosmos DB (fast + free)
    if (isExactIdentifier(query)) {
      return cosmosDbGateway.findExact(query);
    }

    // Common searches → Redis Cache (15-min TTL)
    const cacheKey = generateCacheKey(query);
    const cached = await redisCache.get(cacheKey);
    if (cached) return cached;

    // Fuzzy name search → Azure AI Search
    const results = await azureSearchGateway.search(query);
    await redisCache.set(cacheKey, results, 900); // 15-min TTL
    return results;
  }

  Expected Results:
  - Exact matches (30% of queries): $0 cost
  - Cache hits (40% of remaining): $0 cost
  - Azure AI Search (30% of queries): Full cost

  Net Impact:
  - Reduce Azure Search queries by 70%
  - Enables staying on S1 longer
  - Redis cost: $15/month
  - Savings: $200-300/month (allows deferring S2 upgrade)
  - 3-year savings: $7,200 - $540 (Redis) = $6,660

  ---
  Strategy 2: Right-Size Non-Production Environments

  Current Plan:
  - Dev: S1 ($250/month)
  - Staging: S1 ($250/month)
  - Total: $500/month

  Optimized:
  - Dev: Basic ($75/month) - smaller dataset, 1 GB index
  - Staging: S1 ($250/month) - full dataset for testing
  - Total: $325/month

  Savings: $175/month × 36 months = $6,300

  ---
  Strategy 3: Reduce Operational Overhead

  Current: 12 hours/month monitoring + operations

  Optimization:
  - Implement automated alerting (reduce reactive monitoring)
  - Dashboard automation (reduce manual review time)
  - Self-healing scripts for common issues

  Time Savings:
  - Monitoring: 2 hrs/month → 1 hr/month (-50%)
  - Manual checks: 2 hrs/month → 0.5 hrs/month (-75%)
  - Total savings: 2.5 hrs/month = $250/month

  3-year savings: $9,000

  ---
  Strategy 4: Defer Optional Features

  Year 1 planned enhancements: $6,800

  Defer to Year 2:
  - Autocomplete/typeahead: $2,400
  - Custom scoring profiles: $1,200
  - Query analytics dashboard: $1,600 (use built-in Azure Monitor instead)

  Year 1 essential only:
  - Faceted search: $1,600

  Savings in Year 1: $5,200
  ROI: Deploy essentials first, add features based on user demand

  ---
  Strategy 5: Leverage Azure Reserved Instances

  Standard S1 Pricing:
  - On-demand: $250/month = $3,000/year
  - 1-year reserved: 15% discount = $2,550/year
  - 3-year reserved: 30% discount = $2,100/year

  Savings with 3-year reserved:
  - Annual savings: $900
  - 3-year savings: $2,700

  Risk: Committed to 3 years, but your data supports this decision

  ---
  Strategy 6: Reduce Compliance Overhead

  Current: $4,480/year for security audits

  Optimization:
  - Integrate search security into existing app security audits (don't audit separately)
  - Reduce quarterly audits to semi-annual: -$960/year
  - Use automated PII scanning tools: -$400/year
  - Combine penetration testing with annual app test: -$600/year

  Annual savings: $1,960
  3-year savings: $5,880

  ---
  Strategy 7: Use Managed Identity (Avoid API Key Rotation)

  Current approach: API keys
  - Quarterly rotation: 4 hrs/year × $100 = $400/year
  - Key Vault storage: $0.03/10K operations

  Managed Identity:
  - No key rotation needed: -$400/year
  - No Key Vault costs: -$10/year
  - One-time setup: 3 hours = $300

  Net 3-year savings: $1,230 - $300 = $930

  ---
  Strategy 8: Implement Data Retention Policy

  Current: Index all 21M cases

  Optimization:
  - Index only active/recent cases: 720K + 1M recent closed = 1.72M
  - Fallback to Cosmos DB for archived cases (rare searches)

  Impact:
  - Index size: 9.41 GB → ~1.5 GB (84% reduction)
  - Could enable Basic tier: $75/month vs $250/month
  - Savings: $175/month × 36 = $6,300

  Trade-off:
  - Archived case searches slightly slower (fallback to Cosmos DB)
  - Acceptable if archived searches <5% of volume

  ---
  Optimization Summary
  ┌───────────────────────────────┬────────────────┬───────────────────────┬──────────┐
  │           Strategy            │ 3-Year Savings │ Implementation Effort │   Risk   │
  ├───────────────────────────────┼────────────────┼───────────────────────┼──────────┤
  │ 1. Intelligent query routing  │ $6,660         │ Moderate (2 weeks)    │ Low      │
  ├───────────────────────────────┼────────────────┼───────────────────────┼──────────┤
  │ 2. Right-size non-prod        │ $6,300         │ Low (1 day)           │ None     │
  ├───────────────────────────────┼────────────────┼───────────────────────┼──────────┤
  │ 3. Reduce ops overhead        │ $9,000         │ Moderate (automation) │ Low      │
  ├───────────────────────────────┼────────────────┼───────────────────────┼──────────┤
  │ 4. Defer optional features    │ $5,200         │ None (planning)       │ None     │
  ├───────────────────────────────┼────────────────┼───────────────────────┼──────────┤
  │ 5. Azure reserved instances   │ $2,700         │ Low (purchasing)      │ Medium*  │
  ├───────────────────────────────┼────────────────┼───────────────────────┼──────────┤
  │ 6. Reduce compliance overhead │ $5,880         │ Low (consolidation)   │ Low      │
  ├───────────────────────────────┼────────────────┼───────────────────────┼──────────┤
  │ 7. Managed Identity           │ $930           │ Low (1 day)           │ None     │
  ├───────────────────────────────┼────────────────┼───────────────────────┼──────────┤
  │ 8. Data retention policy      │ $6,300         │ Moderate (2 weeks)    │ Medium** │
  ├───────────────────────────────┼────────────────┼───────────────────────┼──────────┤
  │ Total Optimizations           │ $42,970        │                       │          │
  └───────────────────────────────┴────────────────┴───────────────────────┴──────────┘
  *Risk: 3-year commitment
  **Risk: Archived search latency

  Optimized 3-Year TCO: $115,280 - $42,970 = $72,310 (37% reduction)

  ---
  8. ROI ANALYSIS

  Benefits of Azure AI Search

  Quantifiable Benefits:

  1. User Productivity Gains
  Performance improvement: 100ms average savings per search
  Daily searches: 3,000
  Time saved: 3,000 × 0.1s = 300 seconds/day = 5 minutes/day

  Annual time saved: 5 min × 250 workdays = 1,250 minutes = 21 hours/year
  Across 100 users: 2,100 hours/year
  Value at $50/hour: $105,000/year

  3-year value: $315,000
  2. Reduced Custom Code Maintenance
  Current phonetic implementation: 2 hours/month maintenance
  Azure AI Search: 1 hour/month (50% reduction)
  Savings: 1 hour/month × 36 months = 36 hours
  Value: 36 × $100 = $3,600
  3. Scalability (Avoiding Future Costs)
  Without Azure AI Search:
  - Custom scaling solution: 80 hours @ $100 = $8,000
  - Performance optimization: 40 hours @ $100 = $4,000
  - Total avoided: $12,000
  4. Reduced Support Tickets
  Better search → fewer "can't find debtor" tickets
  Estimated reduction: 10 tickets/month
  Resolution time: 15 minutes/ticket = 150 min/month
  Annual savings: 30 hours × $75 = $2,250/year
  3-year value: $6,750

  Total Quantifiable Benefits (3 years): $337,350

  ---
  Break-Even Analysis

  Baseline TCO: $115,280
  Optimized TCO: $72,310

  Break-even period:
  Using baseline TCO:
  Benefits per year: $112,450
  TCO per year: $38,427 (average)
  Break-even: 4.1 months ✅

  Using optimized TCO:
  Benefits per year: $112,450
  TCO per year: $24,103 (average)
  Break-even: 2.6 months ✅

  ROI (3 years):
  Baseline: ($337,350 - $115,280) ÷ $115,280 = 193% ROI
  Optimized: ($337,350 - $72,310) ÷ $72,310 = 367% ROI

  ---
  9. RECOMMENDATIONS

⏺ Based on Your Actual Data (21M cases, 9.41 GB, 3K queries/day)

  PRIMARY RECOMMENDATION: Proceed with Azure AI Search (Optimized Approach)

  Phase 1: Pilot (Months 1-3)

  Infrastructure:
  - Production: S1 tier ($250/month)
  - Dev: Basic tier ($75/month)
  - Staging: S1 tier ($250/month)
  - Cost: $575/month

  Actions:
  1. Deploy to production with S1 tier
  2. Implement intelligent query routing (cache + Cosmos DB fallback)
  3. Monitor actual query patterns and performance
  4. Validate user satisfaction and productivity gains

  Investment: $13,380 implementation + $1,725 infrastructure (3 months)

  Phase 2: Optimize (Months 4-12)

  Based on Pilot Results:
  - ✅ If queries <5K/day: Stay on S1, implement all optimizations
  - ⚠️ If queries >10K/day: Evaluate S2 upgrade
  - ✅ Cache hit rate >30%: Continue caching strategy
  - ⚠️ Cache hit rate <20%: Revise caching approach

  Target Optimizations:
  1. Right-size non-prod environments (immediate)
  2. Implement data retention policy (archive old cases)
  3. Deploy automated monitoring and alerting
  4. Consider reserved instance for Year 2-3

  Projected Year 1 Cost: $21,493 (optimized)

  Phase 3: Scale (Year 2-3)

  Strategic Decision Point:
  - Monitor growth: Cases, query volume, feature needs
  - Evaluate S2 upgrade trigger: Sustained >5K queries/day
  - Implement deferred features based on user demand
  - Consider 3-year reserved instances for savings

  Projected Year 2-3 Cost: $25,408/year (optimized)

  ---
  Decision Framework

  Choose Azure AI Search IF:
  - ✅ User productivity is high priority (time savings justify cost)
  - ✅ Need advanced features (autocomplete, faceting, semantic search)
  - ✅ Expect data to grow >30M cases in 3 years
  - ✅ Want to reduce custom code maintenance burden
  - ✅ Budget allows ~$2,000-2,500/month all-in cost

  Stay with Phonetic Search IF:
  - ✅ Current performance (100-300ms) is acceptable
  - ✅ Budget constraints are critical (<$500/month total)
  - ✅ Data growth expected to be minimal
  - ✅ No need for advanced search features
  - ✅ Team has capacity for custom code maintenance

  ---
  Budget-Conscious Alternative

  Hybrid Approach: Minimal Azure AI Search

  1. Index only active cases (720K): Reduces to Basic tier ($75/month)
  2. Cosmos DB for archived cases: Fallback for old cases (rare)
  3. No non-prod environments: Test with mock gateway (your POC supports this)
  4. Minimal features: Core search only

  Estimated 3-Year TCO: $28,500 (75% reduction)

  Trade-offs:
  - Archived case searches slower (acceptable if <5% of queries)
  - No staging environment (higher risk)
  - Limited feature set

  ---
  10. FINANCIAL SUMMARY

  Three TCO Scenarios Compared
  ┌───────────────────────┬─────────┬─────────┬─────────┬──────────────┬────────────┐
  │       Scenario        │ Year 1  │ Year 2  │ Year 3  │ 3-Year Total │ Cost/Query │
  ├───────────────────────┼─────────┼─────────┼─────────┼──────────────┼────────────┤
  │ Full Implementation   │ $51,963 │ $32,058 │ $31,258 │ $115,280     │ $0.035     │
  ├───────────────────────┼─────────┼─────────┼─────────┼──────────────┼────────────┤
  │ Optimized             │ $21,493 │ $25,408 │ $25,408 │ $72,310      │ $0.022     │
  ├───────────────────────┼─────────┼─────────┼─────────┼──────────────┼────────────┤
  │ Minimal (Active Only) │ $10,125 │ $9,188  │ $9,188  │ $28,500      │ $0.009     │
  ├───────────────────────┼─────────┼─────────┼─────────┼──────────────┼────────────┤
  │ Current (Phonetic)    │ $5,246  │ $4,495  │ $4,495  │ $14,236      │ $0.004     │
  └───────────────────────┴─────────┴─────────┴─────────┴──────────────┴────────────┘
  Value Comparison
  ┌─────────────────────┬──────────┬────────────────────┬───────────┬──────┐
  │      Scenario       │   TCO    │ Productivity Value │ Net Value │ ROI  │
  ├─────────────────────┼──────────┼────────────────────┼───────────┼──────┤
  │ Full Implementation │ $115,280 │ $337,350           │ +$222,070 │ 193% │
  ├─────────────────────┼──────────┼────────────────────┼───────────┼──────┤
  │ Optimized           │ $72,310  │ $337,350           │ +$265,040 │ 367% │
  ├─────────────────────┼──────────┼────────────────────┼───────────┼──────┤
  │ Minimal             │ $28,500  │ $200,000*          │ +$171,500 │ 602% │
  ├─────────────────────┼──────────┼────────────────────┼───────────┼──────┤
  │ Current (Phonetic)  │ $14,236  │ $0**               │ -$14,236  │ N/A  │
  └─────────────────────┴──────────┴────────────────────┴───────────┴──────┘
  *Reduced value (no advanced features)
  **Baseline - no incremental value

  ---
  11. FINAL RECOMMENDATION

  Recommended Path: Optimized Azure AI Search Implementation

  Year 1 Budget: $21,493
  - Q1: $7,998 (implementation + 3 months infrastructure)
  - Q2-Q4: $4,498/quarter

  Year 2-3 Budget: $25,408/year

  3-Year Total: $72,310

  Expected ROI: 367%

  Key Success Factors

  1. Start with S1 tier - sufficient for your 9.41 GB index and 3K-5K queries/day
  2. Implement intelligent routing - 40% cache hit rate saves $6,660 over 3 years
  3. Right-size environments - Basic for dev, S1 for staging/prod
  4. Monitor and optimize - quarterly reviews prevent over-provisioning
  5. Phased features - deploy based on user demand, not upfront planning

  Next Steps

  1. Immediate (Week 1):
    - Get budget approval for $21,493 Year 1
    - Provision Azure AI Search S1 (production)
    - Provision Basic tier (dev)
  2. Short-term (Month 1):
    - Complete implementation (2-3 weeks)
    - Initial data migration
    - Deploy to production
  3. Medium-term (Months 2-3):
    - Implement caching layer
    - Monitor actual usage patterns
    - Validate ROI assumptions
  4. Long-term (Quarterly):
    - Review metrics: QPS, cache hit rate, user satisfaction
    - Evaluate tier sizing
    - Implement deferred optimizations