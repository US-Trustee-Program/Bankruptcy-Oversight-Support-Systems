Azure AI Search (Basic Tier): Pros & Cons Summary

Quick Overview

Cost: $4,300 over 3 years (~$120/month)
vs. Phonetic: 33% less expensive than S1, but still ~60% more than phonetic
Performance: 50-200ms (2x faster than phonetic)
Implementation: 2-3 weeks
Storage: 1.25 GiB used / 2 GB limit (61% capacity, limited growth)

---
✅ PROS

Performance & Scale

- Fast queries: 50-200ms average (vs 100-300ms phonetic)
- Adequate headroom: Handles 3-5 QPS (86-143x your peak load of 0.083 QPS)
- Managed indexing: Azure handles indexing optimization
- Right-sized capacity: Not paying for massive unused capacity like S1

Features

- Rich out-of-box: Autocomplete, highlighting, faceted search built-in
- Quick to add features: 3x faster development than custom (8 hrs vs 24 hrs)
- Better search quality: Sophisticated relevance scoring (TF-IDF, BM25)
- Future-proof: Can upgrade to Standard tiers as needs grow

Operations

- Managed service: No infrastructure to maintain
- 99.9% SLA: High availability with up to 3 replicas
- Less maintenance: 4 hours/month vs 2 hours (but more skilled)
- Microsoft support: Enterprise support available

Technical

- Well abstracted: Your POC has low vendor lock-in
- Easy migration: Only 2-3 days to switch to Elasticsearch if needed
- Proven technology: Used by thousands of enterprises
- Standard query syntax: Lucene (portable to Elasticsearch, Solr)

Cost

- More affordable: $4,300 vs $72K for S1 (94% cheaper)
- Lower risk: $1,440 Year 1 investment vs $41K for S1
- Closer to phonetic: Only ~$720 more per year than phonetic solution

---
❌ CONS

Storage Limitations ⚠️ CRITICAL

- Limited capacity: 2 GB storage limit (1.25 GiB used = 61% full)
- Only 750 MB headroom: ~37% remaining capacity
- Growth constrained: Cannot grow much beyond current 720K active cases
- No horizontal scaling: Single partition only (cannot add more partitions)
- Reindexing risk: Schema changes with limited headroom could fail
- Full dataset won't fit: 21M total cases would exceed 2 GB limit

Cost

- Still more expensive: $4,300 vs $2,600 for phonetic over 3 years
- 65% more than phonetic: $1,700 more over 3 years
- Multiple environments: Need separate dev/staging (~$100/mo = $3,600 over 3 yrs)
- All-in cost: ~$7,900 over 3 years (3x phonetic cost)
- Unpredictable: Azure could raise prices

Scalability Constraints

- Cannot scale horizontally: Stuck with 1 partition
- Limited QPS growth: Max 3-5 QPS (vs 50 QPS on S1)
- Must upgrade tier: If you exceed 2 GB or need >5 QPS, forced to S1 ($2K/mo)
- Data growth blocked: Cannot index more cases beyond storage limit
- Migration burden: Moving to S1 later requires tier upgrade process

Complexity

- External dependency: Relies on Azure service availability
- More moving parts: Another service to monitor and manage
- Learning curve: Team must learn Azure AI Search concepts
- Harder debugging: Can't step through Azure's code with debugger
- Index management: Schema changes require reindexing (6-8 hours for Basic)

Technical

- Network latency: Extra hop to Azure service (minimal but real)
- Not needed yet: Features like autocomplete aren't requested by users
- Longer implementation: 2-3 weeks vs 3-5 days for phonetic
- Storage monitoring: Must closely track index size growth

Risk

- Storage ceiling: Already at 61% capacity with limited growth path
- Upgrade tax: If needs exceed Basic, must pay 20x more for S1 tier
- Unknown ROI: Users may not use advanced features
- Vendor dependency: Requires Azure-specific knowledge
- Capacity planning: Must predict growth to avoid sudden tier upgrade

---
Side-by-Side Comparison
┌────────────────┬──────────────────┬─────────────────┬─────────────┐
│     Factor     │ Azure AI Basic   │ Phonetic Search │   Winner    │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ Cost (3 yrs)   │ $7,900 (all-in)  │ $2,600          │ Phonetic 💰 │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ Speed          │ 50-200ms         │ 100-300ms       │ Azure ⚡    │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ Features       │ Rich             │ Basic           │ Azure 🚀    │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ Implementation │ 2-3 weeks        │ 3-5 days        │ Phonetic ⏱️ │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ Maintenance    │ 4 hrs/mo         │ 2 hrs/mo        │ Phonetic 🔧 │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ Storage limit  │ 2 GB (61% used)  │ Unlimited       │ Phonetic 📦 │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ Max QPS        │ 3-5 QPS          │ 2-4 QPS         │ Tie 🤝      │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ Scalability    │ Vertical only    │ Cosmos scales   │ Phonetic 📈 │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ Vendor Lock-in │ Low              │ None            │ Phonetic 🔓 │
├────────────────┼──────────────────┼─────────────────┼─────────────┤
│ For your usage │ Tight fit        │ Right-sized     │ Phonetic 🎯 │
└────────────────┴──────────────────┴─────────────────┴─────────────┘

---
Storage Analysis ⚠️

Current State:
- Index size: 1.25 GiB
- Basic tier limit: 2 GB (2.05 GiB)
- Capacity used: 61%
- Headroom: 750 MB (37% free)

Growth Constraints:
- Can only grow by ~60% before hitting limit
- Adding features (autocomplete, suggestions) increases index size 10-20%
- Cannot index all 21M cases (would need 15-20 GB)
- Schema changes during reindex might fail if temporary space exceeds limit

Upgrade Path:
- S1 tier: 25 GB per partition ($250/mo base = $9K/year)
- Forced upgrade if exceed 2 GB or need >5 QPS

---
When to Choose Azure AI Search Basic Tier

✅ Budget allows ~$220/month (all-in with dev/staging)
✅ Current 720K active cases won't grow significantly
✅ Users request autocomplete/highlighting features
✅ Query volume stays under 5K queries/day
✅ Prefer managed services over custom code
✅ Willing to pay 3x more for advanced features
✅ Comfortable with storage constraints (2 GB limit)

---
When to Choose Phonetic Search

✅ Budget constrained (<$100/month)
✅ Simple use case (name search only)
✅ May need to index all 21M cases in future
✅ Want unlimited growth potential
✅ Current scale sufficient (3K queries/day stable)
✅ Team has Cosmos expertise
✅ Name matching quality more important than speed
✅ Want to avoid storage ceiling constraints

---
My Recommendation: Start with Phonetic, Azure Basic as Plan B

Start with Phonetic Search ($700 implementation, $72/month)

Why:
- Saves $5,300 over 3 years if sufficient (likely is)
- No storage constraints (Cosmos scales to 21M+ cases)
- Your usage is low (0.083 QPS peak, both handle it easily)
- Learn what users actually need before committing $7,900
- Can switch to Azure Basic in 2-3 weeks if needed (POC ready)
- If Azure Basic proves too small, forced to S1 at $72K (27x phonetic cost)

Decision gate at 6 months:
- If users request autocomplete/highlighting → Consider Azure Basic
- If query volume >5K/day OR need to index all 21M cases → Azure S1 or keep phonetic
- If current performance sufficient → Keep phonetic

Risk Assessment:
- Azure Basic has storage ceiling (61% full, limited growth)
- If exceed 2 GB, must upgrade to S1 ($2K/month = massive cost jump)
- Phonetic has no such constraint
- Better to start cheap with growth room than hit ceiling

---
Key Insight: Basic Tier Changes the Math, But Not the Decision

Azure AI Search Basic tier is more affordable ($4,300 vs $72K for S1) but still 3x more expensive than phonetic. More importantly:

**The storage constraint is a blocker:**
- You're at 61% capacity already (1.25 GiB / 2 GB)
- Only 750 MB headroom for growth
- Cannot index all 21M cases if needed
- Forced upgrade to S1 ($72K) if you exceed 2 GB

**The QPS capacity is adequate:**
- Your peak: 0.083 QPS
- Basic capacity: 3-5 QPS
- Utilization: 1.6-2.7% (very low, like phonetic)

**Verdict:**
Basic tier is better priced than S1 but the storage limitation is a significant risk. Phonetic search in Cosmos DB has no such constraint and costs 67% less. Start with phonetic, keep Azure Basic as Plan B only if users explicitly request advanced features.

The math:
- Your current index: 1.25 GiB
- Basic tier limit: 2 GB
- You're at 61% capacity with minimal growth room
- Phonetic: No storage limit (Cosmos scales to 21M+ cases)

Start with growth potential, upgrade only if features prove valuable.
