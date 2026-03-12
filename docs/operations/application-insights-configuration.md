# Application Insights Configuration

## Overview

This document explains the Application Insights telemetry configuration for CAMS to prevent log duplication issues.

## Problem Background

During investigation (CAMS-709), we discovered that telemetry data (customEvents, traces, requests) was appearing twice in Application Insights with identical timestamps and data but different itemIds. This duplication was caused by Azure platform-level configuration conflicts.

## Root Causes

The duplication was caused by multiple telemetry forwarding paths:

1. **App Insights Diagnostic Settings**: Workspace-based App Insights resources were configured with diagnostic settings that forwarded telemetry back to the same Log Analytics workspace they were already natively linked to.

2. **Webapp Platform Agent**: The `ApplicationInsightsAgent_EXTENSION_VERSION=~2` environment variable enabled a platform-level agent that duplicated browser SDK telemetry.

3. **Function App Auto-Collection**: Azure Functions Host's built-in logging features were capturing and forwarding console output alongside the Application Insights SDK.

## Solution: Single-Pipe Configuration

Our configuration implements the "Single-Pipe" pattern where telemetry flows directly from the application to its specific Application Insights resource, then to the Log Analytics workspace, without duplication.

### For All Applications (webapp, node-api, dataflows)

**Disable App Insights Diagnostic Settings**

App Insights resources must NOT have diagnostic settings configured. Since our App Insights resources are workspace-based, they already natively forward data to Log Analytics. Adding diagnostic settings creates a second forwarding path.

**Implementation:** In `ops/cloud-deployment/lib/app-insights/app-insights.bicep`, the diagnostic settings module is commented out.

### For Webapp Only

**Remove Platform Agent Extension**

The webapp must NOT have the `ApplicationInsightsAgent_EXTENSION_VERSION` environment variable. The browser-based Application Insights SDK (`@microsoft/applicationinsights-web`) is sufficient for telemetry.

**Implementation:** In `ops/cloud-deployment/frontend-webapp-deploy.bicep`, the `ApplicationInsightsAgent_EXTENSION_VERSION` setting is removed from application settings.

### For Function Apps (node-api, dataflows)

**Disable Azure Functions Auto-Collection**

Function apps require two environment variables to prevent the Azure Functions Host from auto-collecting and duplicating telemetry:

- `APPLICATIONINSIGHTS_ENABLE_LOG_AGGREGATION=false` - Disables SDK-level log batching/aggregation
- `AzureFunctionsJobHost__logging__console__isEnabled=false` - Disables console log forwarding by the Functions Host

**Implementation:** In `ops/cloud-deployment/backend-api-deploy.bicep` and `dataflows-resource-deploy.bicep`, these settings are added to application settings.

## Verification

After deployment, verify single telemetry by running this query in Log Analytics:

```kusto
// For webapp customEvents
AppEvents
| where TimeGenerated > ago(10m)
| where Name == "search"  // or other event names
| summarize count() by tostring(Properties.invocationId), TimeGenerated
| where count_ > 1  // Should return 0 results

// For function app traces
AppTraces
| where TimeGenerated > ago(10m)
| where Message contains "HostMonitor"
| summarize count() by Message, TimeGenerated
| where count_ > 1  // Should return 0 results
```

If any results appear, telemetry is still duplicated.

## Reference

- Investigation Document: `CAMS-709-investigation.md`
- Azure Documentation: [Single-Pipe Configuration for Application Insights](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
