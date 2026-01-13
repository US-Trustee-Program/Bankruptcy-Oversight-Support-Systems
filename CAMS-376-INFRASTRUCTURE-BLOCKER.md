# CAMS-376 Infrastructure Blocker Report

**Date:** January 13, 2026
**Reporter:** Claude Code
**Status:** BLOCKED - Critical Infrastructure Unavailable

---

## Summary

The vector search implementation for CAMS-376 is **blocked** due to **Azure DocumentDB (formerly "Azure Cosmos DB for MongoDB vCore") not being available in Azure US Government cloud**.

**UPDATE (2026-01-13):** Research reveals this service was only **announced as GA on November 18, 2025** (2 months ago) and was rebranded from "Azure Cosmos DB for MongoDB vCore" to "Azure DocumentDB". US Government cloud availability typically lags commercial Azure by several months for new services.

---

## Technical Details

### Error Encountered

```
ERROR: (InvalidResourceType) The resource type could not be found in the namespace
'Microsoft.DocumentDB' for api version '2024-03-01-preview'.
Code: InvalidResourceType
```

### Root Cause

**Azure DocumentDB** (resource type: `mongoClusters`) is not available in Azure US Government cloud regions. The required resource type does not exist in the `Microsoft.DocumentDB` namespace for the government cloud environment.

#### Service Name Confusion

This service has undergone recent rebranding:
- **Original name:** Azure Cosmos DB for MongoDB (vCore)
- **Current name:** Azure DocumentDB (with MongoDB compatibility)
- **Resource type:** `mongoClusters` in `Microsoft.DocumentDB` namespace
- **GA announcement:** November 18, 2025 (commercial cloud only)
- **Government cloud:** Not yet available (typical lag: 3-12 months)

### Verification Steps Performed

1. ✅ Verified Azure CLI configuration: `AzureUSGovernment` cloud
2. ✅ Verified subscription: `Flexion DOJ USTP` (Active)
3. ✅ Verified resource provider: `Microsoft.DocumentDB` (Registered)
4. ✅ Checked available resource types: `mongocluster` NOT present
5. ✅ Attempted cluster provisioning: Failed with `InvalidResourceType`
6. ✅ **Updated Azure CLI** from 2.75.0 → **2.82.0** (latest)
7. ✅ **Retested provisioning** with updated CLI: Same error
8. ✅ Verified `mongoClusters` resource type does not exist in US Government namespace
9. ✅ Checked Microsoft documentation: No mention of vCore in US Government
10. ✅ **Discovered service rebranding:** "Cosmos DB for MongoDB vCore" → "Azure DocumentDB"
11. ✅ **Confirmed GA timeline:** November 18, 2025 (2 months ago, commercial cloud only)
12. ✅ **FedRAMP status:** Azure Cosmos DB is FedRAMP High authorized, but DocumentDB variant not specifically listed

### Environment

- **Cloud:** Azure US Government (`management.usgovcloudapi.net`)
- **Subscription:** Flexion DOJ USTP
- **Resource Group:** bankruptcy-oversight-support-systems
- **Location:** usgovvirginia
- **Azure CLI:** v2.82.0 (latest as of 2026-01-13)
- **CLI Extension:** cosmosdb-preview v1.6.2 (latest)

---

## Impact

### What's Complete

✅ All application code for vector search is implemented:
- `EmbeddingService` with Xenova/all-MiniLM-L6-v2 model
- Query pipeline extended with `VectorSearch` stage
- Repository methods for hybrid vector search
- Data models updated with `keywords` and `keywordsVector` fields
- Graceful fallback to traditional search

### What's Blocked

❌ Cannot test the implementation
❌ Cannot validate vector search functionality
❌ Cannot measure performance metrics
❌ Cannot deploy to Azure US Government environment
❌ Cannot complete the feature

---

## Alternative Solutions

### Option 1: MongoDB Atlas (US Government) ⭐ RECOMMENDED

**Description:** Use MongoDB Atlas with US Government FedRAMP authorization

**Pros:**
- ✅ Available in US Government regions
- ✅ FedRAMP High authorized
- ✅ Supports vector search (`$vectorSearch` operator)
- ✅ Free tier available for experimentation (M0)
- ✅ Compatible with MongoDB 7.0+
- ✅ Can be used for both development and production

**Cons:**
- ⚠️ External dependency (not Azure-native)
- ⚠️ Requires MongoDB Atlas account and configuration
- ⚠️ Code changes needed: `cosmosSearch` → `$vectorSearch` syntax
- ⚠️ Additional infrastructure to manage
- ⚠️ Connection string differences

**Implementation Impact:**
- **Code changes required:** Vector search renderer in `mongo-aggregate-renderer.ts`
- **Estimated effort:** 2-4 hours to adapt and test
- **Infrastructure setup:** 30 minutes to provision Atlas cluster

**Cost (Production):**
- M10 cluster (shared): ~$60/month
- M30 cluster (dedicated): ~$300/month
- Free M0 tier for experimentation: $0

---

### Option 2: Azure AI Search (Cognitive Search)

**Description:** Use Azure AI Search with vector search capabilities

**Pros:**
- ✅ Available in Azure US Government cloud
- ✅ Native vector search support
- ✅ Microsoft-managed service
- ✅ Integrates with Azure ecosystem

**Cons:**
- ⚠️ Significant architectural changes required
- ⚠️ Requires data synchronization from Cosmos DB → AI Search
- ⚠️ Separate search index to maintain
- ⚠️ Different query patterns and APIs
- ⚠️ Higher complexity

**Implementation Impact:**
- **Code changes required:** Major refactoring of search architecture
- **Estimated effort:** 1-2 weeks
- **Infrastructure setup:** 2-3 days for sync pipeline

**Cost:**
- Basic tier: ~$75/month
- Standard S1: ~$250/month

---

### Option 3: Use Commercial Azure for Experimentation

**Description:** Provision vCore cluster in commercial Azure cloud for testing only

**Pros:**
- ✅ Can test code as written
- ✅ Validates implementation approach
- ✅ Proves vector search functionality

**Cons:**
- ⚠️ Requires commercial Azure subscription
- ⚠️ Cannot use for production (data residency)
- ⚠️ Still need alternative for production deployment
- ⚠️ Wastes development effort if can't deploy

**Implementation Impact:**
- **Code changes required:** None for testing, full rewrite for production
- **Estimated effort:** 1 hour for testing setup

---

### Option 4: Wait for vCore in US Government Cloud

**Description:** Wait for Microsoft to release MongoDB vCore in US Government regions

**Pros:**
- ✅ Eventually use code as written
- ✅ No architectural changes needed

**Cons:**
- ⚠️ Unknown timeline (could be months or years)
- ⚠️ Feature delivery blocked indefinitely
- ⚠️ No visibility into Microsoft's roadmap

---

### Option 5: Local MongoDB with Docker (Development Only)

**Description:** Use local MongoDB 7.0+ with Atlas Search simulation

**Pros:**
- ✅ Can validate code logic locally
- ✅ Fast development iteration
- ✅ No cloud costs

**Cons:**
- ⚠️ Cannot test against real infrastructure
- ⚠️ Vector search syntax differs from Cosmos DB
- ⚠️ Not suitable for production
- ⚠️ Limited value for production readiness

---

## Recommendation

**Recommended Path:** **Option 1 - MongoDB Atlas (US Government)**

### Rationale

1. **Compliance:** FedRAMP High authorized, suitable for government use
2. **Feature parity:** Supports vector search with minimal code changes
3. **Timely delivery:** Can test and deploy within 1-2 days
4. **Cost-effective:** Free tier for testing, reasonable production costs
5. **Proven technology:** Mature product with US Government deployments

### Implementation Plan

#### Phase 1: Experimentation (Free Tier)
1. Create MongoDB Atlas account (US Government portal)
2. Provision M0 free cluster in US Gov region
3. Update vector search renderer for Atlas syntax
4. Test with experimental data
5. Validate performance and functionality

#### Phase 2: Production Deployment (If Approved)
1. Provision dedicated M10/M30 cluster
2. Configure network security (VPC peering or private link)
3. Set up backup and monitoring
4. Migrate data from Cosmos DB
5. Update connection strings in Azure Function Apps
6. Deploy and validate

### Code Changes Required

**File:** `backend/lib/adapters/gateways/mongo/utils/mongo-aggregate-renderer.ts`

```typescript
// Current implementation (Cosmos DB vCore)
function toMongoVectorSearch(stage: VectorSearch) {
  return {
    $search: {
      cosmosSearch: {  // Cosmos DB specific
        vector: stage.vector,
        path: stage.path,
        k: stage.k,
        similarity: stage.similarity,
      },
      returnStoredSource: true,
    },
  };
}

// MongoDB Atlas implementation
function toMongoVectorSearch(stage: VectorSearch) {
  return {
    $vectorSearch: {  // Atlas standard
      queryVector: stage.vector,
      path: stage.path,
      numCandidates: stage.k * 10,  // Atlas recommendation
      limit: stage.k,
      index: 'vector_index',  // Index name
    },
  };
}
```

**Configuration change:**
- Add environment variable to toggle between Cosmos/Atlas syntax
- Or detect based on connection string format

---

## Next Steps

### Immediate Actions

1. **Check Azure Portal (5 minutes):**
   - Navigate to https://portal.azure.us
   - Search for "DocumentDB" or "Cosmos DB"
   - Check if "Azure DocumentDB" or "MongoDB vCore" appears as a deployment option
   - If available, the portal might be ahead of CLI/ARM API

2. **Contact Microsoft Support (Recommended):**
   Given this service went GA just 2 months ago (Nov 2025), Microsoft may have:
   - **Preview access** for government customers
   - **Timeline information** for government cloud deployment
   - **Workarounds** or **alternative approaches**

   **Support ticket:**
   - Subject: "Azure DocumentDB (MongoDB vCore) availability in Azure US Government"
   - Include: Current blocker, subscription ID, urgency level
   - Request: Timeline for government cloud availability or preview access

3. **Team Decision Required:**
   - Approve MongoDB Atlas for experimentation?
   - Budget approval for Atlas account (~$0-60/month)
   - Wait for Microsoft support response (2-5 business days)?

4. **If Atlas Approved:**
   - Create MongoDB Atlas US Government account
   - Provision M0 free cluster for testing
   - Update code for Atlas vector search syntax
   - Run experimental validation
   - Present findings to team

5. **If Waiting for DocumentDB in Gov Cloud:**
   - Document blocker in project backlog
   - Monitor Azure DocumentDB release notes monthly
   - Set reminder to check portal.azure.us for availability
   - Estimated wait: 3-12 months (typical government cloud lag)

### Long-Term Considerations

- **Vendor lock-in:** Atlas ties us to MongoDB, Inc. (not Microsoft)
- **Cost management:** Monitor Atlas usage and costs
- **Migration path:** Plan for eventual Cosmos DB vCore if/when available
- **Documentation:** Update architecture diagrams and runbooks

---

## References

### Azure DocumentDB (Official)
- [Azure DocumentDB Vector Search](https://learn.microsoft.com/en-us/azure/documentdb/vector-search?tabs=diskann)
- [Azure DocumentDB Release Notes](https://learn.microsoft.com/en-us/azure/documentdb/release-notes)
- [Azure DocumentDB GA Announcement](https://devblogs.microsoft.com/cosmosdb/azure-documentdb-is-now-generally-available/) (Nov 18, 2025)
- [Azure Cosmos DB for MongoDB vCore Overview](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/vcore/introduction) (Legacy docs)

### Azure Government
- [Azure Government Database Services](https://learn.microsoft.com/en-us/azure/azure-government/documentation-government-services-database)
- [Azure Government Portal](https://portal.azure.us)

### MongoDB Atlas (Alternative)
- [MongoDB Atlas Government Cloud](https://www.mongodb.com/cloud/atlas/government)
- [MongoDB Vector Search Documentation](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/)

---

## Appendix: Testing Evidence

### Environment Variables Configured

```bash
CLUSTER_NAME: cosmos-vcore-cams-experiment
RESOURCE_GROUP: bankruptcy-oversight-support-systems
LOCATION: usgovvirginia
ADMIN_USER: camsadmin
MY_IP: 142.197.171.39
EXPERIMENTAL_DATABASE_NAME: cams-vector-experiment
```

### Error Log

```
az cosmosdb mongocluster create \
  --cluster-name "cosmos-vcore-cams-experiment" \
  --resource-group "bankruptcy-oversight-support-systems" \
  --location "usgovvirginia" \
  --administrator-login "camsadmin" \
  --administrator-login-password "***" \
  --server-version "7.0" \
  --shard-node-tier "M25" \
  --shard-node-ha false \
  --shard-node-disk-size-gb 32 \
  --shard-node-count 1

WARNING: This command is in preview and under development.
ERROR: (InvalidResourceType) The resource type could not be found in the
namespace 'Microsoft.DocumentDB' for api version '2024-03-01-preview'.
```

### Available Resource Types in Microsoft.DocumentDB

```
databaseAccounts           ✓ Available (RU-based Cosmos DB)
databaseAccountNames       ✓ Available
operations                 ✓ Available
managedResources          ✓ Available
locations                 ✓ Available
restorableDatabaseAccounts ✓ Available
fleets                    ✓ Available
mongocluster              ✗ NOT AVAILABLE  ← BLOCKER
```

---

**Status:** Awaiting team decision on alternative infrastructure approach.

**Contact:** See CAMS-376 feature branch for technical implementation details.
