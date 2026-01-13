# CAMS-376 Portal Attempt - Azure DocumentDB NOT Available

**Date:** January 13, 2026
**Status:** ❌ CONFIRMED BLOCKED - Service NOT available in US Government cloud

---

## Final Determination

Azure DocumentDB (MongoDB vCore) **IS NOT available** in Azure US Government cloud. Both CLI and Portal deployment attempts fail with the same error.

### Root Cause - Resource Type Does Not Exist

**Both CLI and Portal fail with identical error:**

```json
{
  "code": "InvalidResourceType",
  "message": "The resource type could not be found in the namespace 'Microsoft.DocumentDB' for api version '2023-03-01-preview'."
}
```

**Tested API Versions:**
- ❌ CLI: `2024-03-01-preview` - Resource type not found
- ❌ Portal: `2023-03-01-preview` - Resource type not found

**Conclusion:** The `mongoClusters` resource type does not exist in `Microsoft.DocumentDB` namespace in Azure US Government cloud, regardless of API version or deployment method.

### ARM Template Evidence

From Azure Portal automation template:

```json
{
    "name": "[parameters('serverGroupName')]",
    "type": "Microsoft.DocumentDB/mongoClusters",
    "location": "[parameters('location')]",
    "apiVersion": "2023-03-01-preview",
    "properties": {
        "administratorLogin": "[parameters('administratorLogin')]",
        "administratorLoginPassword": "[parameters('administratorLoginPassword')]",
        "serverVersion": "[parameters('serverVersion')]",
        "nodeGroupSpecs": [
            {
                "kind": "Shard",
                "nodeCount": "[parameters('nodeCount')]",
                "sku": "[parameters('sku')]",
                "diskSizeGB": "[parameters('diskSizeGB')]",
                "enableHa": "[parameters('enableHa')]"
            }
        ]
    }
}
```

**Key Points:**
- ✅ `Microsoft.DocumentDB/mongoClusters` resource type exists
- ✅ Available in US Government subscription
- ✅ Supports all required features (sku, nodeCount, diskSizeGB, etc.)
- ✅ Firewall rules supported as child resources

---

## Cluster Configuration

**Provisioning via Azure Portal:**
- **Subscription:** Flexion DOJ USTP (729f9083-9edf-4269-919f-3f05f7a0ab20)
- **Resource Group:** bankruptcy-oversight-support-systems
- **Location:** USGov Virginia (or selected region)
- **Admin Username:** camsadmin
- **Admin Password:** Vcore2026!yFSKJJ7s

---

## Deployment Attempts Summary

### Attempt 1: Azure CLI (2024-03-01-preview)
- ❌ Failed: Resource type not found
- Updated CLI to latest version (2.82.0)
- ❌ Failed again: Same error

### Attempt 2: Azure Portal (2023-03-01-preview)
- ✅ Portal UI showed deployment form
- ✅ Generated ARM template with older API version
- ❌ **Deployment failed:** Same `InvalidResourceType` error

**Conclusion:** The service is not deployed to Azure US Government cloud infrastructure yet.

---

## Timeline Analysis

- **November 18, 2025:** Azure DocumentDB announced GA in commercial Azure
- **January 13, 2026:** Confirmed NOT available in US Government cloud (2 months later)
- **Estimated availability:** Unknown - Microsoft has not published a roadmap

Typical lag for new services in Government cloud: **3-12 months**, but no guarantees.

---

## Recommended Path Forward

Given the confirmed blocker, three viable options:

### Option 1: MongoDB Atlas US Government ⭐ RECOMMENDED
- **Status:** Available NOW
- **Compliance:** FedRAMP Moderate authorized
- **Timeline:** Can test within 1 day
- **Cost:** $0 (M0 free tier) for testing, $60-300/month for production
- **Code changes:** ~2-4 hours (vector search syntax differences)
- **Risk:** Vendor dependency on MongoDB, Inc.

### Option 2: Wait for Azure DocumentDB
- **Status:** Unknown timeline
- **Timeline:** 3-12+ months (estimated)
- **Cost:** $0 (waiting)
- **Code changes:** None (already implemented)
- **Risk:** Feature delivery blocked indefinitely

### Option 3: Azure AI Search
- **Status:** Available in US Government cloud
- **Timeline:** 1-2 weeks for refactoring
- **Cost:** ~$75-250/month
- **Code changes:** Significant (different architecture)
- **Risk:** Major refactoring effort

---

## Updated Status

**Status:** ❌ CONFIRMED BLOCKED - Infrastructure not available
**Blocker:** Azure DocumentDB not deployed to US Government cloud
**Recommendation:** Pivot to MongoDB Atlas US Government for timely delivery

All vector search application code is complete and ready to test once infrastructure is available.
