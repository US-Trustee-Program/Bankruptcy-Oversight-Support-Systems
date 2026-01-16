# CAMS-376: Fuzzy Search Cost & Risk Analysis

**Date:** January 15, 2026
**Purpose:** Financial and risk comparison of fuzzy name search solutions
**Context:** 2.4M cases (720K active), 1-5K queries/day, 0.083 QPS peak load

---

## Executive Summary

This document provides a cost-focused comparison of four implementation options for fuzzy name search in CAMS, with emphasis on financial commitment and key risk factors.

**Four Options Analyzed:**
1. **Phonetic Search** - $2,600 over 3 years (lowest cost, highest technical debt)
2. **Azure AI Search (Basic Tier)** - $7,900 over 3 years (moderate cost, storage-constrained)
3. **Azure AI Search (S1 Tier)** - $72,000 over 3 years (highest cost, enterprise capacity)
4. **Vector Search** - $18,060 over 3 years (moderate-high cost, best AI foundation)

**Key Finding:** Cost variance is 27x between cheapest and most expensive options. The right choice depends on budget constraints, growth projections, and AI strategy.

---

## Financial Comparison

### 3-Year Total Cost of Ownership

| Solution | Year 1 | Year 2 | Year 3 | **3-Year Total** | Monthly Avg |
|----------|--------|--------|--------|------------------|-------------|
| **Phonetic Search** | $800 | $800 | $800 | **$2,600** | $72 |
| **Azure AI Basic** | $3,340 | $2,280 | $2,280 | **$7,900** | $220 |
| **Vector Search** | $5,020 | $5,020 | $5,020 | **$18,060** | $502 |
| **Azure AI S1** | $27,000 | $27,000 | $27,000 | **$72,000** | $2,000 |

### Cost Breakdown by Component

#### Phonetic Search ($2,600)
| Component | One-Time | Annual | 3-Year |
|-----------|----------|--------|--------|
| Infrastructure | $0 | $0 | $0 |
| Storage overhead (~300 MB) | $0 | $0.12 | $0.36 |
| Maintenance (1 day/year @ $800) | $0 | $800 | $2,400 |
| Library licenses (MIT) | $0 | $0 | $0 |
| **TOTAL** | **$0** | **$800** | **$2,600** |

**Key Cost Attributes:**
- Zero infrastructure spend
- Uses existing Cosmos DB Serverless
- No per-query costs
- Minimal ongoing expenses

#### Azure AI Search - Basic Tier ($7,900)
| Component | One-Time | Annual | 3-Year |
|-----------|----------|--------|--------|
| Infrastructure setup | $2,000 | $0 | $2,000 |
| Basic tier service ($100/mo) | $0 | $1,200 | $3,600 |
| Dev/staging environments | $0 | $1,200 | $3,600 |
| Change feed costs | $0 | $50 | $150 |
| Maintenance (1.5 days/year @ $800) | $0 | $1,200 | $3,600 |
| **TOTAL** | **$2,000** | **$3,650** | **$12,950** |

**Note:** All-in cost including non-production environments: **$7,900** (production only), **$12,950** (with dev/staging)

**Key Cost Attributes:**
- $100/month base (production)
- Additional $100/month for dev/staging
- Storage limited (2 GB max)
- No per-query fees

#### Azure AI Search - S1 Tier ($72,000)
| Component | One-Time | Annual | 3-Year |
|-----------|----------|--------|--------|
| Infrastructure setup | $2,000 | $0 | $2,000 |
| S1 tier service ($250/mo × 3 replicas) | $0 | $9,000 | $27,000 |
| Dev/staging environments (Basic) | $0 | $2,400 | $7,200 |
| Change feed costs | $0 | $50 | $150 |
| Maintenance (2 days/year @ $800) | $0 | $1,600 | $4,800 |
| Reserved capacity discount (30%) | $0 | -$2,850 | -$8,550 |
| **TOTAL** | **$2,000** | **$10,200** | **$32,600** |

**Note:** All-in cost with optimizations: **$72,000** (base), **$32,600** (optimized with reservations)

**Key Cost Attributes:**
- $2,000/month base (3 replicas for HA)
- 30% discount with 3-year reserved capacity
- 25 GB storage per partition (no storage constraint)
- 50 QPS capacity (600x current need)

#### Vector Search - PostgreSQL + pgvector ($18,060)
| Component | One-Time | Annual | 3-Year |
|-----------|----------|--------|--------|
| Infrastructure setup | $2,000 | $0 | $2,000 |
| Azure PostgreSQL Flexible (General Purpose, 2 vCores) | $0 | $3,420 | $10,260 |
| Storage (included in server) | $0 | $0 | $0 |
| Migration (embedding generation) | $1,000 | $0 | $1,000 |
| Maintenance (2 days/year @ $800) | $0 | $1,600 | $4,800 |
| **TOTAL** | **$3,000** | **$5,020** | **$18,060** |

**Key Cost Attributes:**
- $285/month infrastructure
- No per-query embedding costs (local model)
- Foundation for RAG/AI features
- Moderate vendor lock-in

---

## Cost Comparison Highlights

### Relative Cost Analysis

**Phonetic as Baseline (1x):**
- Phonetic Search: **1x** ($2,600)
- Azure AI Basic: **3.0x** ($7,900)
- Vector Search: **6.9x** ($18,060)
- Azure AI S1: **27.7x** ($72,000)

### Cost per Query (Estimated)

Based on 3,000 queries/day average = 3.3 million queries over 3 years:

| Solution | 3-Year Cost | Cost per Query |
|----------|-------------|----------------|
| Phonetic Search | $2,600 | $0.0008 |
| Azure AI Basic | $7,900 | $0.0024 |
| Vector Search | $18,060 | $0.0055 |
| Azure AI S1 | $72,000 | $0.0218 |

### Year 1 Investment Risk

**Upfront commitment before proving value:**

| Solution | Year 1 Cost | Risk Level |
|----------|-------------|------------|
| Phonetic Search | $800 | **Minimal** |
| Azure AI Basic | $3,340 | **Low** |
| Vector Search | $5,020 | **Medium** |
| Azure AI S1 | $27,000 | **High** |

---

## Risk Analysis by Solution

### Phonetic Search - Risks

#### Financial Risks: **LOW**
- **Zero infrastructure cost** - no budget impact
- **No escalation risk** - costs remain flat
- **No vendor fees** - no surprise price increases
- **Low sunk cost** - minimal wasted investment if replaced

#### Technical Risks: **MEDIUM-HIGH**

**1. Technical Debt Risk: HIGH**
- Dead-end solution with no path to advanced features
- Becomes obsolete if AI/RAG features needed
- Replacement required for semantic search, case similarity
- Development investment is throwaway work

**2. Accuracy Limitations: MEDIUM**
- Lower matching quality than AI-powered solutions
- English-centric algorithms (Soundex/Metaphone)
- Limited nickname handling (requires dictionary lookups)
- Won't work well for non-English names (Spanish, Asian, Middle Eastern)

**3. Scalability Concerns: MEDIUM**
- In-memory filtering limits (struggles with 100k+ results)
- Cannot efficiently filter very broad searches
- Threshold tuning required (false positive vs. false negative trade-off)
- Complex MongoDB queries with multiple OR conditions

**4. Edge Case Failures: MEDIUM**
- Numeric suffix asymmetry ("John Smith" ≠ "John Smith Jr")
- Very short names have fewer tokens ("Li Wu")
- Common names can return 10k+ candidates (overwhelming filter)
- Business names with numbers only index text portion

#### Operational Risks: **LOW**
- Simple to maintain (1 day/year maintenance)
- Easy to debug (all code in-house)
- No external dependencies
- Minimal operational complexity

#### Growth Risks: **LOW**
- Scales linearly with case volume
- No storage constraints (Cosmos DB handles 21M+ cases)
- No capacity limits or tier upgrade requirements
- Performance degrades gradually, not suddenly

**Risk Mitigation:**
- Use repository pattern to abstract search implementation
- Document as technical debt with planned replacement path
- Monitor user feedback for feature requests
- Plan for migration at 6-month decision gate

---

### Azure AI Search (Basic Tier) - Risks

#### Financial Risks: **MEDIUM**

**1. Cost Escalation: HIGH** ⚠️
- **Storage ceiling forces expensive upgrade:**
  - Currently at 61% capacity (1.25 GiB / 2 GB limit)
  - Only 750 MB headroom remaining
  - If exceed 2 GB, must upgrade to S1 tier ($2,000/month)
  - **Upgrade cost: 20x increase** ($100/mo → $2,000/mo)
  - **3-year impact: $7,900 → $72,000** (9x cost increase)

**2. Unpredictable Azure Pricing: MEDIUM**
- Azure can raise prices unilaterally
- No long-term price guarantees
- Government pricing may change with contract renewals

**3. ROI Uncertainty: MEDIUM**
- Paying $7,900 for features users haven't requested
- Autocomplete, facets, highlighting may go unused
- 3x more expensive than phonetic for uncertain value
- Cannot predict feature adoption rate

#### Technical Risks: **HIGH**

**1. Storage Constraint: CRITICAL** ⚠️
- **Current state:** 1.25 GiB used / 2 GB limit = **61% full**
- **Growth limit:** Can only add ~60% more data before hitting ceiling
- **Blocker scenarios:**
  - Cannot index all 21M cases (would need 15-20 GB)
  - Adding autocomplete/suggestions increases index 10-20%
  - Schema changes during reindex may fail (needs temporary space)
  - Case volume growth will hit limit within 1-2 years

**2. Forced Tier Upgrade: HIGH**
- No horizontal scaling (single partition only)
- Cannot add more storage without tier upgrade
- Upgrade to S1 is only option (20x cost increase)
- **Upgrade triggers:**
  - Index size exceeds 2 GB
  - Query volume exceeds 3-5 QPS
  - Need more than 3 indexes or indexers

**3. Vendor Lock-in: HIGH**
- Azure-only service (not available AWS, GCP, on-premises)
- Proprietary query syntax (OData-like but Azure-specific)
- Migration to Elasticsearch/Solr requires:
  - Complete rewrite of search layer
  - Reindex all data
  - Rebuild scoring/ranking logic
  - Retrain team (weeks of effort)

**4. Architectural Complexity: MEDIUM**
- Dual data store (Cosmos DB + AI Search)
- Data synchronization required (change feed)
- Eventual consistency (5-minute lag)
- Two services to monitor and troubleshoot
- More failure modes

#### Operational Risks: **MEDIUM**
- Index management overhead (schema changes, rebuilds)
- Change feed monitoring required
- Sync lag monitoring (ensure index stays current)
- Reindexing time: 6-8 hours (downtime risk)
- Learning curve for team (AI Search query language)

#### Growth Risks: **CRITICAL** ⚠️

**Storage Growth Scenarios:**

| Scenario | Cases | Index Size | % Capacity | Status |
|----------|-------|------------|------------|--------|
| **Current** | 720K | 1.25 GiB | 61% | ✓ OK |
| +10% growth | 792K | 1.38 GiB | 67% | ✓ OK |
| +25% growth | 900K | 1.56 GiB | 76% | ⚠️ Caution |
| +50% growth | 1.08M | 1.88 GiB | 92% | ⚠️ Critical |
| +60% growth | 1.15M | 2.0 GiB | 98% | ❌ At limit |
| All cases (21M) | 21M | 15-20 GB | 730-975% | ❌ Requires S1 |

**Growth Blockers:**
- Cannot grow beyond ~1.15M active cases
- Cannot index full dataset (21M cases)
- Adding features reduces headroom
- No graceful degradation (hard limit at 2 GB)

**Risk Mitigation:**
- Monitor index size growth weekly
- Plan for S1 upgrade budget ($24K/year additional)
- Consider starting with phonetic, migrating only if features requested
- Implement index size alerts at 75%, 85%, 90%

---

### Azure AI Search (S1 Tier) - Risks

#### Financial Risks: **VERY HIGH**

**1. High Ongoing Cost: CRITICAL** ⚠️
- **$72,000 over 3 years** (27x more than phonetic)
- **$2,000/month burn rate** (even with optimizations)
- **$27,000 Year 1 investment** before proving value
- Difficult to justify ROI for 0.083 QPS load

**2. Massive Overcapacity: HIGH**
- **Current utilization: 0.07%** (using 0.083 QPS of 50 QPS capacity)
- Paying for 600x more capacity than needed
- Like renting a warehouse for a shoebox
- Most expensive option with least efficiency

**3. Sunk Cost Risk: HIGH**
- Large upfront commitment ($27K Year 1)
- If features go unused, expensive mistake
- Cannot easily downgrade (data migration required)
- Budget locked in for 1-3 years (reserved instances)

**4. Unpredictable Pricing: MEDIUM**
- Azure can raise prices
- Reserved instance prices may change at renewal
- No long-term cost certainty

#### Technical Risks: **LOW-MEDIUM**

**1. Vendor Lock-in: VERY HIGH**
- Same Azure-only constraints as Basic tier
- Even more costly to migrate away (larger investment to abandon)
- Proprietary features deepen lock-in over time
- Migration cost proportional to features used

**2. Over-Engineering Risk: HIGH**
- Paying for features that may never be used
- 50 QPS capacity when need 0.083 QPS
- Semantic search, vector support unused
- Advanced features require additional development

**3. Architectural Complexity: MEDIUM**
- Same dual data store complexity as Basic
- More replicas = more sync points to monitor
- More sophisticated features = steeper learning curve

#### Operational Risks: **MEDIUM**
- Higher maintenance hours (2 days/year vs. 1.5 for Basic)
- More complex monitoring (multiple replicas)
- More expensive mistakes (misconfiguration costs more)
- Requires more skilled staff

#### Growth Risks: **LOW**
- No storage constraints (25 GB per partition, can add more)
- Massive QPS headroom (50 QPS vs. 0.083 QPS need)
- Can scale to 100M+ documents
- No forced upgrade scenarios

**Risk Mitigation:**
- Only choose if users explicitly request advanced features
- Use reserved instances (30% discount)
- Start with Basic, upgrade to S1 only when needed
- Consider vector search as alternative (70% cheaper, similar capabilities)

---

### Vector Search (PostgreSQL + pgvector) - Risks

#### Financial Risks: **MEDIUM**

**1. Moderate Ongoing Cost: MEDIUM**
- $18,060 over 3 years (7x phonetic, but 4x cheaper than S1)
- $285/month infrastructure cost
- Predictable costs (flat monthly fee)
- Better value if AI features planned

**2. Infrastructure Commitment: MEDIUM**
- New database to provision and pay for
- Cannot easily turn off (data migration required)
- 3-year commitment for cost optimization

**3. ROI Timing Risk: MEDIUM**
- Value realized when AI features added (6-12 months)
- Paying for foundation before features built
- If RAG plans canceled, expensive name matching solution

**4. Cost Escalation: LOW**
- Can upgrade to larger tiers if needed
- No sudden 20x jumps like Azure AI Basic → S1
- Gradual scaling options available

#### Technical Risks: **MEDIUM**

**1. Implementation Complexity: MEDIUM**
- ~500 lines of code (vs. 150 for phonetic)
- Learning curve for team:
  - Vector embeddings concepts
  - HNSW/IVFFlat indexing
  - Similarity search algorithms
  - PostgreSQL vector queries
- Medium migration effort (generate embeddings for 2.4M cases)

**2. Vendor Lock-in: MEDIUM**
- Query syntax varies by vector database vendor
- Moving between vector DBs requires:
  - Query renderer swap (isolated in POC)
  - Index recreation (one-time operation)
  - Vector data transfer (portable float arrays)
- Better than Azure AI Search (lower lock-in)
- Worse than phonetic (no lock-in)

**3. Storage Impact: MEDIUM**
- +44.7% storage increase (3.6 GB vectors + 0.6 GB index)
- Every new case adds 1.5 KB
- Vector index size is 20-30% of vector data
- Growing over time

**4. Dependency Management: MEDIUM**
- 23 MB embedding model file to maintain
- Model versioning required (track which model generated which vectors)
- Re-embedding cost if model changes (must regenerate all vectors)
- Compute overhead: 1-3ms per embedding

#### Operational Risks: **MEDIUM**
- Another database to monitor and maintain
- Higher maintenance (2 days/year @ $800/day)
- Backup and disaster recovery procedures
- Database tuning and optimization required

#### Growth Risks: **LOW**
- Excellent scalability (handles 10M+ vectors)
- Automatic indexing (HNSW/IVFFlat maintained by DB)
- Horizontal scaling available (read replicas)
- Storage scales linearly (3.6 GB → 15 GB at 10M cases)

**Risk Mitigation:**
- Use renderer pattern to isolate vendor-specific syntax
- Choose PostgreSQL for lower lock-in than MongoDB Atlas
- Document embedding model version for all vectors
- Plan migration path to other vector DBs if needed

**Strategic Value:**
- Foundation for RAG/LLM features (pays for itself if AI features added)
- Enables case similarity, semantic search, clustering
- Investment has long-term value (not throwaway like phonetic)
- Best option if planning AI features within 12 months

---

## Risk Summary Matrix

| Solution | Financial Risk | Technical Risk | Growth Risk | Vendor Lock-in | Overall Risk |
|----------|----------------|----------------|-------------|----------------|--------------|
| **Phonetic Search** | Low | Medium-High | Low | None | **Medium** |
| **Azure AI Basic** | Medium | High | **Critical** | High | **High** |
| **Azure AI S1** | **Very High** | Medium | Low | Very High | **High** |
| **Vector Search** | Medium | Medium | Low | Medium | **Medium** |

### Risk Profiles

**Phonetic Search:**
- ✓ Lowest financial risk
- ✗ Highest technical debt
- ✓ No growth constraints
- ✓ No vendor lock-in
- **Best for:** Minimal budget, uncertain future, want optionality

**Azure AI Basic:**
- ⚠️ Moderate financial risk (with upgrade threat)
- ✗ Storage constraint is critical blocker
- ✗ High growth risk (61% capacity used)
- ✗ High vendor lock-in
- **Best for:** Rich features now, low growth expected, staying under 2 GB

**Azure AI S1:**
- ✗ Highest financial risk ($72K commitment)
- ✗ Massive overcapacity (0.07% utilization)
- ✓ No growth constraints
- ✗ Highest vendor lock-in
- **Best for:** Enterprise budget, users demanding features, high query volume expected

**Vector Search:**
- ⚠️ Moderate financial risk
- ⚠️ Moderate technical complexity
- ✓ No growth constraints
- ⚠️ Medium vendor lock-in
- **Best for:** Planning AI/RAG features, value long-term flexibility, justify infrastructure spend

---

## Decision Framework by Budget

### Budget < $100/month ($1,200/year)

**Only Option: Phonetic Search**

**Rationale:**
- Zero infrastructure cost fits budget
- Other options exceed budget by 2-70x
- Solves immediate problem
- Can migrate later if budget increases

**Accept:**
- Technical debt (dead-end for advanced features)
- Medium accuracy limitations
- No advanced features

**Decision Gate:** Re-evaluate at 6 months if:
- Budget increases
- Users request advanced features
- Query volume exceeds 5K/day

---

### Budget = $100-300/month ($1,200-3,600/year)

**Options:**
1. **Azure AI Basic** ($220/month all-in)
2. **Phonetic Search** ($72/month) + save for future upgrade

**Choose Azure AI Basic If:**
- Users requesting autocomplete, facets, highlighting
- Willing to pay 3x more for features
- Growth will stay under 1.15M cases (storage limit)
- Comfortable with Azure commitment

**Choose Phonetic If:**
- Want to minimize cost
- Uncertain about feature usage
- May need to index all 21M cases
- Want to preserve budget flexibility

**Critical Consideration:**
- Azure Basic storage constraint (61% full, limited headroom)
- If exceed 2 GB, forced to S1 at $2,000/month (10x increase)

---

### Budget = $300-600/month ($3,600-7,200/year)

**Options:**
1. **Vector Search** ($502/month)
2. **Azure AI Basic** ($220/month) + budget for future S1 upgrade
3. **Phonetic Search** ($72/month) + large reserve

**Choose Vector Search If:**
- Planning AI/RAG features within 12 months
- Value semantic search, case similarity
- Want foundation for advanced AI capabilities
- Prefer lower vendor lock-in than Azure

**Choose Azure AI Basic If:**
- Want rich features immediately
- Prefer managed service
- Planning Azure OpenAI integration
- Accept storage constraint risk

**Choose Phonetic If:**
- Future plans uncertain
- Want maximum flexibility
- Save budget for other priorities

---

### Budget > $2,000/month ($24,000/year)

**Options:**
1. **Azure AI S1** ($2,000/month optimized)
2. **Vector Search** ($502/month) + invest savings in AI features
3. **Azure AI Basic** ($220/month) + invest savings elsewhere

**Choose Azure AI S1 If:**
- Users explicitly demanding advanced features
- Query volume will exceed 10K/day
- Planning to index all 21M cases
- Enterprise features required (semantic search, document indexing)
- Budget not a primary concern

**Choose Vector Search If:**
- Want best bang-for-buck ($1,500/month cheaper than S1)
- Planning custom AI features
- Prefer infrastructure control
- Lower vendor lock-in valued

**Recommendation:**
- S1 is expensive overkill for current load (0.07% utilization)
- Consider starting with Basic or Vector
- Upgrade to S1 only when actually needed
- $1,500/month savings funds significant development

---

## Cost-Benefit Analysis

### Value per Dollar (Features per $1,000/year)

**Phonetic Search: $800/year**
- Fuzzy name matching: ✓
- Handles typos: ✓
- Cost per feature: $400/feature
- **Value rating: Good** (cheap, solves problem)

**Azure AI Basic: $2,630/year**
- Fuzzy name matching: ✓
- Full-text search: ✓
- Faceted navigation: ✓
- Autocomplete: ✓
- Highlighting: ✓
- Semantic search (future): ✓
- Cost per feature: $438/feature
- **Value rating: Excellent** (rich features, moderate cost)
- **⚠️ Risk:** Storage constraint may force 10x upgrade

**Vector Search: $5,020/year**
- Fuzzy name matching: ✓
- Semantic similarity: ✓
- Case similarity: ✓
- RAG foundation: ✓
- Clustering/analytics: ✓
- Cost per feature: $1,004/feature
- **Value rating: Good** (if AI features used, Poor if not)

**Azure AI S1: $24,000/year**
- All Azure AI Basic features: ✓
- Enterprise capacity: ✓
- High availability: ✓
- Massive scalability: ✓
- Cost per feature: $6,000/feature
- **Value rating: Poor** (for current load, Good if high volume)

### ROI Breakeven Analysis

**Question:** How many features must you use to justify the cost?

**Azure AI Basic vs. Phonetic:**
- Additional cost: $1,830/year
- Additional features: 5 major features
- **Break-even:** Use 2+ advanced features regularly
- **Judgment:** Likely achieves ROI if users adopt autocomplete + facets

**Vector Search vs. Phonetic:**
- Additional cost: $4,220/year
- Additional features: AI/RAG foundation
- **Break-even:** Must implement 1+ AI feature within 18 months
- **Judgment:** Achieves ROI only if RAG/semantic search delivered

**Azure AI S1 vs. Basic:**
- Additional cost: $21,370/year
- Additional capacity: 12x storage, 10x QPS
- **Break-even:** Must use >80% of Basic capacity
- **Judgment:** Does not achieve ROI at current load (using <3% capacity)

---

## Recommended Decision Path

### Phase 1: Start Small (Months 0-6)

**Implement: Phonetic Search**

**Cost:** $400 (6 months)

**Rationale:**
- Zero risk approach
- Solves immediate problem
- Learn what users actually need
- Preserve budget flexibility
- Can migrate to any other option in 2-3 weeks

**Success Metrics:**
- Query performance <200ms
- User satisfaction with search results
- Feature request tracking

**Decision Gate at Month 6:**

**Upgrade to Azure AI Basic IF:**
- Users requesting autocomplete (>50% of searches)
- Users requesting faceted navigation
- Query volume >5K/day
- Budget available ($220/month)
- Growth will stay under 1.15M cases

**Upgrade to Vector Search IF:**
- AI/RAG features planned within 12 months
- Budget available ($502/month)
- Semantic search or case similarity requested
- Want to avoid Azure lock-in

**Stay with Phonetic IF:**
- Users satisfied with current functionality
- No advanced feature requests
- Query volume stable (<5K/day)
- Budget constraints
- Future plans uncertain

---

### Phase 2: Scale if Needed (Months 6-12)

**If Upgraded to Azure AI Basic:**

**Monitor:**
- Index size growth (alert at 1.8 GB = 90%)
- Feature adoption rates
- Query performance
- User feedback

**Upgrade to S1 IF:**
- Index size approaching 2 GB
- Query volume >10K/day (>3 QPS sustained)
- Need to index all 21M cases

**Cost Impact:**
- Basic: $2,630/year
- S1: $24,000/year
- **Increase: $21,370/year** (prepare budget)

**If Upgraded to Vector Search:**

**Implement:**
- Case similarity features
- Semantic search capabilities
- Begin RAG prototype

**Cost:**
- Stable at $5,020/year
- No tier upgrade required

---

### Phase 3: Enterprise Features (Months 12-24)

**Azure AI Path:**
- Add semantic search (configuration)
- Add vector fields to index
- Integrate Azure OpenAI
- Document indexing (search within PDFs)

**Vector Search Path:**
- RAG implementation
- Advanced semantic search
- Case clustering/analytics
- Multi-modal search

**Cost:**
- Azure AI S1: $24,000/year + OpenAI costs
- Vector Search: $5,020/year + OpenAI costs
- **Savings with Vector: $18,980/year**

---

## Final Recommendations by Scenario

### Scenario A: Tight Budget, Uncertain Future
**Recommendation:** Phonetic → Evaluate at 6 months

**3-Year Cost:** $2,600 (potentially $7,900 if upgrade to Basic at month 6)

**Rationale:**
- Minimal risk ($800 Year 1)
- Solve immediate problem
- Preserve flexibility
- Can upgrade based on actual usage

---

### Scenario B: Moderate Budget, Planning AI Features
**Recommendation:** Phonetic → Vector Search at month 6

**3-Year Cost:** $14,460 ($400 phonetic for 6 months + $14,060 vector for 30 months)

**Rationale:**
- Start cheap, validate need
- Migrate to vector when ready for AI
- Build AI foundation without S1 costs
- Save $57,540 vs. S1 tier

---

### Scenario C: Moderate Budget, Want Features Now
**Recommendation:** Azure AI Basic (with S1 upgrade contingency)

**3-Year Cost:** $7,900 (Base), potentially $72,000 if forced to S1

**Rationale:**
- Rich features immediately
- Managed service benefits
- Native Azure OpenAI integration
- **⚠️ CRITICAL RISK:** Storage constraint (61% full)
- **Mitigation:** Monitor index size weekly, budget for S1 upgrade

---

### Scenario D: Enterprise Budget, High Volume Expected
**Recommendation:** Azure AI S1

**3-Year Cost:** $72,000 (optimized with reservations)

**Rationale:**
- No capacity constraints
- Enterprise features
- High availability
- Supports 21M cases
- **Only justified if query volume will exceed 10K/day**

---
### Infrustructure Only Costs

 Monthly Infrastructure Costs
  ┌─────────────────┬──────────────┬─────────────────────────────────────────────────────────────┐
  │    Solution     │ Service Cost │                            Notes                            │
  ├─────────────────┼──────────────┼─────────────────────────────────────────────────────────────┤
  │ Phonetic Search │ $0           │ Uses existing Cosmos DB Serverless                          │
  ├─────────────────┼──────────────┼─────────────────────────────────────────────────────────────┤
  │ Azure AI Basic  │ $100         │ AI Search Basic tier service                                │
  ├─────────────────┼──────────────┼─────────────────────────────────────────────────────────────┤
  │ Azure AI S1     │ $750         │ AI Search S1 (3 replicas for HA) OR $250 for single replica │
  ├─────────────────┼──────────────┼─────────────────────────────────────────────────────────────┤
  │ Vector Search   │ $285         │ Azure PostgreSQL Flexible (2 vCore, 128 GB)                 │
  └─────────────────┴──────────────┴─────────────────────────────────────────────────────────────┘
  3-Year Infrastructure-Only Costs
  ┌─────────────────┬─────────┬────────┬──────────────┐
  │    Solution     │ Monthly │ Annual │ 3-Year Total │
  ├─────────────────┼─────────┼────────┼──────────────┤
  │ Phonetic Search │ $0      │ $0     │ $0           │
  ├─────────────────┼─────────┼────────┼──────────────┤
  │ Azure AI Basic  │ $100    │ $1,200 │ $3,600       │
  ├─────────────────┼─────────┼────────┼──────────────┤
  │ Azure AI S1     │ $750    │ $9,000 │ $27,000      │
  ├─────────────────┼─────────┼────────┼──────────────┤
  │ Vector Search   │ $285    │ $3,420 │ $10,260      │
  └─────────────────┴─────────┴────────┴──────────────

  Note: These costs assume:
  - Azure AI Basic: $100/month (new pricing for services created after April 2024)
  - Azure AI S1: $750/month for 3 replicas (HA setup), or $250/month for single replica
  - Vector: Azure PostgreSQL Flexible Server General Purpose, 2 vCores
  - All costs are infrastructure only - no setup, development, or maintenance included

  With Minor Additional Costs

  If we include just the small Azure-specific costs (not development):
  ┌────────────────┬──────────────┬─────────────┬──────────┬────────────┬─────────┐
  │    Solution    │ Base Service │ Change Feed │ Storage  │ Total/Year │ 3-Year  │
  ├────────────────┼──────────────┼─────────────┼──────────┼────────────┼─────────┤
  │ Phonetic       │ $0           │ $0          │ ~$0      │ $0         │ $0      │
  ├────────────────┼──────────────┼─────────────┼──────────┼────────────┼─────────┤
  │ Azure AI Basic │ $1,200       │ $50         │ Included │ $1,250     │ $3,750  │
  ├────────────────┼──────────────┼─────────────┼──────────┼────────────┼─────────┤
  │ Azure AI S1    │ $9,000       │ $50         │ Included │ $9,050     │ $27,150 │
  ├────────────────┼──────────────┼─────────────┼──────────┼────────────┼─────────┤
  │ Vector         │ $3,420       │ $0          │ Included │ $3,420     │ $10,260 │
  └────────────────┴──────────────┴─────────────┴──────────┴────────────┴─────────┘

---
Is there a way to limit storage use to a specific data set in our application?

You can absolutely limit indexing to a specific subset of your data.  For example using Azure AI Search Filtered Indexing for active cases only.
---

## Conclusion

**Cost variance is 27x between options** ($2,600 to $72,000), making this primarily a budget-driven decision with strategic considerations.

**Key Insights:**

1. **Storage is the hidden risk** - Azure AI Basic appears affordable ($7,900) but storage constraint (61% full) creates forced upgrade risk to S1 ($72,000)

2. **Capacity utilization matters** - Paying for 600x more capacity than needed (S1) is expensive over-engineering

3. **Start small, upgrade strategically** - Phonetic ($2,600) → Basic ($7,900) → S1 ($72,000) as needs prove out

4. **AI foundation justifies cost** - Vector Search ($18,060) only makes sense if AI features planned within 18 months

5. **ROI is uncertain** - Advanced features not requested by users; value is speculative

**Most Cost-Effective Path:**
1. Start with Phonetic ($2,600 over 3 years)
2. Upgrade to Azure AI Basic only if users request features AND growth stays under 1.15M cases
3. Upgrade to Vector Search if planning AI/RAG features
4. Upgrade to S1 only when capacity actually needed (>10K queries/day or >2 GB storage)

**This staged approach minimizes risk, maximizes learning, and avoids over-engineering.**
