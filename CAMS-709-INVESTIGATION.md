# CAMS-709: Double Logging Investigation

**Date**: 2026-03-05 (Updated: 2026-03-06 with Expert Reviews)
**Branch**: `CAMS-709-fix-telemetry-in-prod`
**Status**: In Progress - Root Cause Not Yet Found

---

## 🤖 AGENT QUICK START

**FOR ENGINEERS**: Copy everything between the HTML comment markers (`AGENT PROMPT START` to `AGENT PROMPT END`) into your coding agent to begin work immediately.

<!-- ============================================================ -->
<!-- AGENT PROMPT START - Copy from here to "AGENT PROMPT END"   -->
<!-- ============================================================ -->

### Problem Statement
All telemetry events (customEvents and traces) appear **duplicated** in Application Insights with identical data but different `itemId` values. Issue only occurs in Azure deployed environments.

### What We Know (Facts Only)
- ✅ Two events exist in App Insights per single operation (confirmed by different `itemId` values)
- ✅ Both duplicates have identical timestamps, properties, measurements, and operation IDs
- ✅ Duplication affects both customEvents and traces
- ✅ Bicep deployment configures diagnostic settings that forward logs to Log Analytics → App Insights
- ✅ Application Insights SDK v3.13.0 is built on OpenTelemetry (uses LogRecordProcessors/exporters)

### Your Mission: Test 3 Hypotheses in Priority Order

#### Phase 1: Test Diagnostic Settings Hypothesis (15 minutes - DO THIS FIRST)

**Theory**: Diagnostic settings create a second telemetry pipeline, duplicating events.

**Test**:
```bash
# 1. List diagnostic settings
az monitor diagnostic-settings list \
  --resource /subscriptions/{sub-id}/resourceGroups/rg-cams-app-dev-350de5/providers/Microsoft.Web/sites/ustp-cams-dev-350de5-node-api

# 2. If any exist, temporarily disable by deleting
az monitor diagnostic-settings delete \
  --name <diagnostic-setting-name> \
  --resource <resource-id-from-above>

# 3. Wait 2 minutes, then test application and check App Insights for duplicates
```

**Expected Outcome**:
- If duplicates STOP → Diagnostic settings were the cause (proceed to fix diagnostic settings config)
- If duplicates CONTINUE → Not diagnostic settings (proceed to Phase 2)

---

#### Phase 2: Add SDK Introspection (30 minutes)

**Theory**: Multiple OpenTelemetry processors/exporters in SDK are duplicating events.

**File to modify**: `/Users/jbrooks/Repos/cams/backend/lib/adapters/services/observability.ts`

**Add this code** in `getOrInitializeAppInsightsClient()` function, right after line 35 where it checks `if (appInsights.defaultClient)`:

```typescript
if (appInsights.defaultClient) {
  const client = appInsights.defaultClient as any;

  // Introspect OpenTelemetry configuration
  try {
    const { logs } = require('@opentelemetry/api-logs');
    const loggerProvider = logs.getLoggerProvider();
    const processors = (loggerProvider as any)._logRecordProcessors || [];

    logger?.warn(MODULE_NAME, '🔍 OTEL INTROSPECTION', {
      processorCount: processors.length,
      processorTypes: processors.map((p: any) => p.constructor?.name || 'unknown'),
      exporters: processors.map((p: any) => ({
        processorType: p.constructor?.name,
        hasExporter: !!p._exporter,
        exporterType: p._exporter?.constructor?.name || 'unknown',
      })),
    });
  } catch (error) {
    logger?.warn(MODULE_NAME, '🔍 OTEL introspection failed', { error });
  }

  // ... rest of existing code
}
```

**Deploy and check logs** for the `🔍 OTEL INTROSPECTION` message.

**Expected Outcome**:
- If `processorCount > 1` → Multiple processors are duplicating events (proceed to clear duplicate processors)
- If `processorCount === 1` → Not processor duplication (proceed to Phase 3)

---

#### Phase 3: Add Call Counter Instrumentation (15 minutes)

**Theory**: Application code is calling `completeTrace()` twice per request.

**File to modify**: `/Users/jbrooks/Repos/cams/backend/lib/adapters/services/observability.ts`

**Add this code** to the `AppInsightsObservability` class:

```typescript
export class AppInsightsObservability implements ObservabilityGateway {
  private readonly MODULE_NAME = 'APP-INSIGHTS-OBSERVABILITY';
  private readonly clientFactory: AppInsightsClientFactory;
  private cachedClient: TelemetryClient | null | undefined;
  private readonly instanceId: string;

  // ADD THESE TWO LINES:
  private static _globalCallCounter = 0;
  private _instanceCallCounter = 0;

  // ... rest of class

  completeTrace(
    trace: ObservabilityTrace,
    eventName: string,
    completion: TraceCompletion,
    metrics?: { name: string; value: number }[],
  ): void {
    // ADD THIS BLOCK AT THE VERY START:
    const globalCallId = ++AppInsightsObservability._globalCallCounter;
    const instanceCallId = ++this._instanceCallCounter;
    const callStack = new Error().stack?.split('\n').slice(2, 4).join(' | ') || 'no-stack';

    this.logger?.warn(this.MODULE_NAME, '🟢 completeTrace ENTRY', {
      globalCallId,
      instanceCallId,
      observabilityInstanceId: this.instanceId,
      eventName,
      callStack,
    });

    // ... existing code in completeTrace ...

    client.trackEvent({
      name: eventName,
      properties: {
        ...properties,
        globalCallId: String(globalCallId), // Add to properties for correlation
      },
      measurements,
    });

    // ADD THIS AT THE END:
    this.logger?.warn(this.MODULE_NAME, '🟢 completeTrace EXIT', {
      globalCallId,
      instanceCallId,
    });
  }
}
```

**Deploy and check logs** for `🟢 completeTrace ENTRY` and `🟢 completeTrace EXIT` messages.

**Expected Outcome**:
- If you see ONE ENTRY/EXIT but TWO events in App Insights with SAME `globalCallId` → Duplication happens in SDK/pipeline
- If you see TWO ENTRY/EXIT with SAME `observabilityInstanceId` → Application code calls it twice (investigate call stacks)

---

### Files You'll Need

**Core observability logic**:
- `/Users/jbrooks/Repos/cams/backend/lib/adapters/services/observability.ts` (main file to modify)

**Bicep infrastructure**:
- `/Users/jbrooks/Repos/cams/ops/cloud-deployment/lib/app-insights/diagnostics-settings-func.bicep` (diagnostic settings config)
- `/Users/jbrooks/Repos/cams/ops/cloud-deployment/backend-api-deploy.bicep` (main API deployment)

**Testing**:
- Function App: `ustp-cams-dev-350de5-node-api`
- Resource Group: `rg-cams-app-dev-350de5`
- Branch: `CAMS-709-fix-telemetry-in-prod`

### Success Criteria

You've found the root cause when:
1. You can definitively say which hypothesis is correct (diagnostic settings, processors, or app code)
2. You have direct evidence (logs showing processor count, call counts, or diagnostic settings impact)
3. You can reproduce the issue stopping when the suspected cause is removed

### What NOT to Do

- ❌ Don't make speculative fixes without testing hypotheses first
- ❌ Don't assume "same observabilityInstanceId" means same instance created both (could be property copying)
- ❌ Don't trust "confirmed" findings in this document beyond the 5 direct observations listed above
- ❌ Don't skip phases - test in order (diagnostic settings → SDK → app code)

<!-- ============================================================ -->
<!-- AGENT PROMPT END                                             -->
<!-- ============================================================ -->

---

## ⚠️ CRITICAL: Expert Review Update (2026-03-06)

**Four expert agents reviewed this investigation and identified critical gaps.** Key findings:

1. **🔥 INFRASTRUCTURE HYPOTHESIS (New - High Priority)**: Bicep deployment creates a **second telemetry pipeline** via diagnostic settings that may be duplicating events (see DevOps Expert Review section at end)

2. **⚠️ EVIDENCE GAP**: The "Critical Finding" below is **INFERENCE, NOT PROOF**. We never added logging inside `completeTrace()` to count actual invocations or captured call stacks.

3. **🔍 SDK ARCHITECTURE**: App Insights SDK v3.13.0 uses OpenTelemetry internally. Duplication likely happens in the OpenTelemetry processor/exporter layer, not application code.

4. **📊 NEXT STEPS**: Stop making fixes based on speculation. Add SDK introspection to see processor/exporter count, test diagnostic settings hypothesis, add call counters for proof.

**See "Expert Review Findings" section at end for detailed analysis and action plan.**

---

## Problem Statement

All telemetry (both `traces` and `customEvents`) appears duplicated in Application Insights with:
- Different `itemId` values
- **Identical** timestamps
- **Identical** operation IDs, invocation IDs
- **Identical** measurements and properties
- **Identical** `observabilityInstanceId` (same instance creating both)

## Critical Finding (⚠️ UPDATE: This is INFERENCE, not definitive proof)

**HYPOTHESIS: Same observability instance is involved in creating both duplicate events**

The `observabilityInstanceId` diagnostic shows duplicates have the **same** ID, suggesting they come from the same `AppInsightsObservability` instance. However, **expert review identified this as circumstantial evidence, not proof**:

- ✅ NOT multiple instances being created (based on same `observabilityInstanceId`)
- ✅ NOT automatic SDK collection (both have `telemetrySource: 'CAMS-EXPLICIT'`)
- ✅ NOT Azure Functions runtime logging (both have our watermark)
- ⚠️ **UNPROVEN**: Whether `completeTrace()` is called once or twice
- ⚠️ **UNPROVEN**: Whether `trackEvent()` is called once or twice

**What We Haven't Verified**:
- No logging INSIDE `completeTrace()` to count actual invocations
- No call stack capture to see where `completeTrace()` is invoked from
- No verification that `trackEvent()` is called only once by our code
- No inspection of SDK internals (OpenTelemetry processors/exporters)

**Alternative Explanations Not Ruled Out**:
1. Application code calls `completeTrace()` twice from different code paths
2. OpenTelemetry pipeline has multiple processors/exporters duplicating events
3. Diagnostic settings create a second telemetry pipeline to same App Insights
4. SDK batching/buffering bug in v3.13.0

---

## 🎯 Critical Gaps & Immediate Next Steps

### Evidence Gaps Identified by Expert Review

1. **No Runtime Verification** - Never added logging inside `completeTrace()` to count actual calls
2. **No Call Stack Capture** - Don't know where `completeTrace()` is being invoked from
3. **No SDK Introspection** - Haven't inspected OpenTelemetry processor/exporter configuration
4. **No Infrastructure Check** - Haven't verified if diagnostic settings create second pipeline
5. **No Quantitative Analysis** - Don't know if issue affects 100% or subset of requests

### Top 3 Hypotheses to Test (Ranked by Expert Consensus)

#### 1. 🔥 Diagnostic Settings Second Pipeline (85% confidence - DevOps Expert)
**Test**: Temporarily disable diagnostic settings in Azure Portal
```bash
az monitor diagnostic-settings list \
  --resource /subscriptions/{sub}/resourceGroups/rg-cams-app-dev-350de5/providers/Microsoft.Web/sites/ustp-cams-dev-350de5-node-api

# If found, delete to test:
az monitor diagnostic-settings delete \
  --name <name> \
  --resource <resource-id>
```

#### 2. 🔍 Multiple OpenTelemetry Processors (80% confidence - SDK Expert)
**Test**: Add SDK introspection to `getOrInitializeAppInsightsClient()`:
```typescript
const { logs } = require('@opentelemetry/api-logs');
const loggerProvider = logs.getLoggerProvider();
const processors = (loggerProvider as any)._logRecordProcessors || [];

logger?.warn(MODULE_NAME, 'OpenTelemetry Config', {
  processorCount: processors.length,
  processorTypes: processors.map(p => p.constructor.name),
});
```

#### 3. ⚠️ Application Code Calls Twice (60% confidence - Scientist)
**Test**: Add call counters inside `completeTrace()`:
```typescript
private static _globalCallCounter = 0;
private _instanceCallCounter = 0;

completeTrace(...) {
  const callId = ++AppInsightsObservability._globalCallCounter;
  logger?.warn(this.MODULE_NAME, 'completeTrace ENTRY', {
    globalCallId: callId,
    instanceCallId: ++this._instanceCallCounter,
    eventName,
    stack: new Error().stack?.split('\n').slice(2, 4).join(' | '),
  });

  // ... existing code ...

  client.trackEvent(eventData);

  logger?.warn(this.MODULE_NAME, 'completeTrace EXIT', { callId });
}
```

### Prioritized Action Plan (30-60 minutes each)

**STOP making speculative fixes.** Follow this sequence:

1. ✅ **Phase 1: Infrastructure Test** (15 min)
   - Disable diagnostic settings in Azure Portal
   - Test for 5 minutes
   - Check if duplicates stop

2. ✅ **Phase 2: Add Diagnostics** (30 min)
   - Add call counters to `completeTrace()`
   - Add OpenTelemetry processor introspection
   - Deploy and capture logs

3. ✅ **Phase 3: Analyze Logs** (15 min)
   - Check if `completeTrace()` called once or twice
   - Check processor count (expect 1, likely see 2+)
   - Identify which hypothesis is correct

4. ✅ **Phase 4: Apply Targeted Fix** (1 hour)
   - If diagnostic settings: Reconfigure or disable
   - If multiple processors: Clear duplicates or reinitialize SDK
   - If called twice: Find and fix call sites

See "Expert Review Findings" section at end for complete analysis.

---

## What We Tried

### 1. Environment Variable Configuration ✅ Partially Effective
**Action**: Set `APPLICATIONINSIGHTS_ENABLE_CONSOLE_AUTO_COLLECTION=false` in Bicep templates

**Files Modified**:
- `ops/cloud-deployment/backend-api-deploy.bicep`
- `ops/cloud-deployment/dataflows-resource-deploy.bicep`

**Code Added**:
```bicep
{
  name: 'APPLICATIONINSIGHTS_ENABLE_CONSOLE_AUTO_COLLECTION'
  value: 'false'
}
```

**Result**: Environment variable is set correctly in Azure, but SDK is initialized by runtime before our code runs, so this configuration never gets applied to the active client.

---

### 2. host.json Console Logging Disable ❌ Did Not Fix
**Action**: Disabled Azure Functions runtime console forwarding to App Insights

**Files Modified**:
- `backend/function-apps/api/host.json`
- `backend/function-apps/dataflows/host.json`

**Code Added**:
```json
"logging": {
  "applicationInsights": { ... },
  "console": {
    "isEnabled": false
  },
  ...
}
```

**Rationale**: Stop the Azure Functions runtime from forwarding console logs to Application Insights.

**Result**: Did not eliminate duplicates. Both duplicates still appear with our watermark.

---

### 3. SDK Config Modification ❌ Did Not Fix
**Action**: Disabled console auto-collection on already-initialized SDK client

**File Modified**: `backend/lib/adapters/services/observability.ts`

**Code Added**:
```typescript
if (appInsights.defaultClient) {
  const enableConsoleCollection =
    process.env.APPLICATIONINSIGHTS_ENABLE_CONSOLE_AUTO_COLLECTION !== 'false';

  if (!enableConsoleCollection && appInsights.defaultClient.config) {
    appInsights.defaultClient.config.enableAutoCollectConsole = false;
  }

  return appInsights.defaultClient as TelemetryClient;
}
```

**Rationale**: When the runtime has already initialized the SDK, modify the config to disable console auto-collection.

**Result**: Did not eliminate duplicates.

---

### 4. Logger Provider Change ❌ Did Not Fix
**Action**: Changed logger from `invocationContext.log()` to `console.log` directly

**File Modified**: `backend/function-apps/azure/application-context-creator.ts`

**Code Changed**:
```typescript
// Before
function getLogger(invocationContext: InvocationContext) {
  const logWrapper: Console['log'] = (...args: any[]) => {
    invocationContext.log(args);
  };
  return new LoggerImpl(invocationContext.invocationId, logWrapper);
}

// After
function getLogger(invocationContext: InvocationContext) {
  return new LoggerImpl(invocationContext.invocationId, console.log);
}
```

**Rationale**: Eliminate the Azure Functions runtime logging pipeline (`invocationContext.log()`) that was creating a parallel telemetry stream.

**Result**: Did not eliminate duplicates.

---

### 5. Telemetry Watermarking ✅ Diagnostic Tool Added
**Action**: Added `telemetrySource: 'CAMS-EXPLICIT'` to all our custom telemetry

**File Modified**: `backend/lib/adapters/services/observability.ts`

**Code Added**:
```typescript
const properties: Record<string, string> = {
  instanceId: trace.instanceId,
  invocationId: trace.invocationId,
  success: String(completion.success),
  telemetrySource: 'CAMS-EXPLICIT',  // <-- Added
  ...completion.properties,
};
```

**Result**: **CRITICAL FINDING** - Both duplicates have the watermark, proving they're BOTH from our explicit code, not from automatic SDK collection.

---

### 6. Client Caching ❌ Did Not Fix
**Action**: Cache TelemetryClient instance instead of calling factory every time

**File Modified**: `backend/lib/adapters/services/observability.ts`

**Code Added**:
```typescript
export class AppInsightsObservability implements ObservabilityGateway {
  private readonly MODULE_NAME = 'APP-INSIGHTS-OBSERVABILITY';
  private readonly clientFactory: AppInsightsClientFactory;
  private cachedClient: TelemetryClient | null | undefined;  // <-- Added

  private getClient(): TelemetryClient | null {  // <-- Added
    if (this.cachedClient === undefined) {
      this.cachedClient = this.clientFactory(this.logger);
    }
    return this.cachedClient;
  }

  completeTrace(...) {
    // ...
    const client = this.getClient();  // <-- Changed from this.clientFactory()
    // ...
  }
}
```

**Rationale**: Prevent potential issues from calling the factory function multiple times, which might reconfigure the SDK or create multiple channels.

**Result**: Did not eliminate duplicates.

---

### 7. Instance Tracking ✅ Diagnostic Completed
**Action**: Added `observabilityInstanceId` to telemetry to track which `AppInsightsObservability` instance created each event

**File Modified**: `backend/lib/adapters/services/observability.ts`

**Code Added**:
```typescript
export class AppInsightsObservability implements ObservabilityGateway {
  private readonly instanceId: string;  // <-- Added

  constructor(...) {
    this.instanceId = Math.random().toString(36).substring(2, 15);
    this.logger?.debug(
      this.MODULE_NAME,
      `AppInsightsObservability instance created: ${this.instanceId}`,
    );
  }

  completeTrace(...) {
    const properties: Record<string, string> = {
      // ...
      observabilityInstanceId: this.instanceId,  // <-- Added
      // ...
    };
  }
}
```

**Result**: **CRITICAL FINDING** - Duplicates have the **SAME** `observabilityInstanceId`. This means the same instance is somehow creating two telemetry events from a single `trackEvent()` call.

---

## Key Observations (Distinguishing Facts from Inferences)

### Direct Observations (Confirmed by Primary Evidence)

1. ✅ **CONFIRMED**: Two events appear in Application Insights with different `itemId` values
2. ✅ **CONFIRMED**: Both events have identical property values including all custom properties
3. ✅ **CONFIRMED**: Both events show identical timestamps when viewed in App Insights UI
4. ✅ **CONFIRMED**: Duplication observed for both traces and customEvents telemetry types
5. ✅ **CONFIRMED**: Diagnostic settings bicep config forwards Function App logs to Log Analytics

### Observations Requiring Interpretation (Inferences, Not Facts)

6. ⚠️ **OBSERVED**: Both events have the same `observabilityInstanceId` value
   - **Inference**: Same `AppInsightsObservability` instance created both
   - **Alternative explanations**: ID collision, properties copied by secondary pipeline, ID set before duplication occurs
   - **Not yet verified**: Whether multiple instances actually generate different IDs, ID collision probability

7. ⚠️ **OBSERVED**: Both events contain `telemetrySource: 'CAMS-EXPLICIT'` property
   - **Inference**: Both originated from our explicit `trackEvent()` call
   - **Alternative explanations**: Secondary pipeline copies all properties, diagnostic settings preserve custom dimensions
   - **Not yet verified**: Whether automatic collection or diagnostic settings copy custom properties

8. ⚠️ **OBSERVED**: No duplicates seen in limited local testing (~5-10 requests)
   - **Inference**: Issue is environment-specific to Azure
   - **Alternative explanations**: Issue is probabilistic and small sample didn't trigger it, local config differs in untested ways
   - **Not yet verified**: Comprehensive local testing (100+ requests) with production-identical configuration

9. ⚠️ **OBSERVED**: `appInsights.defaultClient` exists when our factory function runs
   - **Inference**: Azure Functions runtime initialized SDK before our code
   - **Alternative explanations**: Previous request cached the client, SDK auto-initializes on import, our code initialized it earlier
   - **Not yet verified**: When, how, and by whom SDK was initialized (requires initialization sequence logging)

### Completely Unverified (Require Instrumentation to Determine)

10. ❌ **UNKNOWN**: Whether `completeTrace()` is called once or twice per request
11. ❌ **UNKNOWN**: Whether `client.trackEvent()` is called once or twice within `completeTrace()`
12. ❌ **UNKNOWN**: How many OpenTelemetry processors/exporters are configured in the SDK
13. ❌ **UNKNOWN**: Whether diagnostic settings pipeline actually causes the observed duplication
14. ❌ **UNKNOWN**: Exact timestamp precision and whether "identical" means same millisecond or true simultaneity

## Leading Hypotheses (Ranked by Testability, Not Confidence)

### Hypothesis 1: Diagnostic Settings Second Pipeline
**Plausibility**: High - Bicep config confirms this pipeline exists
**Evidence**: Bicep deployment creates diagnostic settings that forward Function App logs to Log Analytics → Application Insights

Bicep deployment creates diagnostic settings that forward Function App logs to Log Analytics, which then forwards to the same Application Insights resource. This creates a **parallel telemetry pipeline**.

**What we know**:
- ✅ `ops/cloud-deployment/lib/app-insights/diagnostics-settings-func.bicep` configures this forwarding
- ✅ Both pipelines would send to same App Insights resource
- ✅ Would explain identical data with different `itemId` (assigned by backend)

**What we don't know**:
- ❌ Whether diagnostic settings actually forward custom events (or just logs/metrics)
- ❌ Whether Log Analytics → App Insights preserves all custom properties
- ❌ If this is the cause or a red herring

**Test**: Temporarily disable diagnostic settings in Azure Portal and observe if duplicates stop

### Hypothesis 2: Multiple OpenTelemetry Processors/Exporters
**Plausibility**: Medium - Reasonable based on SDK architecture, but completely uninspected
**Evidence**: None yet - pure speculation based on SDK internals

SDK v3.13.0 uses OpenTelemetry. Azure Functions runtime may have configured multiple LogRecordProcessors when initializing SDK, causing each `trackEvent()` to be processed multiple times.

**What we know**:
- ✅ SDK is built on OpenTelemetry pipeline architecture (confirmed from SDK source)
- ✅ Runtime initializes SDK (inferred from defaultClient existence)
- ✅ Duplication happens after our code but before backend assigns `itemId`

**What we don't know**:
- ❌ Actual processor count (never inspected)
- ❌ Exporter configuration (never inspected)
- ❌ Whether processors can duplicate events

**Test**: Add OpenTelemetry introspection to log `loggerProvider._logRecordProcessors` count and types

### Hypothesis 3: Application Code Calls `completeTrace()` Twice
**Plausibility**: Unknown - Could be true or false, requires measurement
**Evidence**: None - we never counted actual invocations

Despite same `observabilityInstanceId`, there may be code paths we haven't examined that call `completeTrace()` twice from different locations.

**What we know**:
- ✅ Same `observabilityInstanceId` on both events (observed)
- ❌ Never verified `completeTrace()` is called once (no call counters added)
- ❌ Never captured call stacks to see invocation source

**What we don't know**:
- ❌ Whether `completeTrace()` is called once or twice
- ❌ Whether multiple code paths could trigger duplicate calls
- ❌ Call stack at time of each invocation

**Test**: Add call counters and stack trace logging inside `completeTrace()`

## Investigation Path for Tomorrow

### 1. Check SDK Configuration
Inspect the SDK configuration to see if multiple channels are registered:

```typescript
// In getOrInitializeAppInsightsClient()
if (appInsights.defaultClient) {
  const config = appInsights.defaultClient.config;

  logger?.info(MODULE_NAME, 'SDK Configuration', {
    maxBatchSize: config.maxBatchSize,
    maxBatchIntervalMs: config.maxBatchIntervalMs,
    enableAutoCollectConsole: config.enableAutoCollectConsole,
    // Check for multiple channels
  });

  // Log channel information
  const client = appInsights.defaultClient;
  logger?.info(MODULE_NAME, 'Telemetry Processors', {
    processorCount: client?.['_telemetryProcessors']?.length || 0,
  });
}
```

### 2. Inspect Runtime Initialization
Check how the Azure Functions runtime initializes Application Insights:
- Look for `WEBSITE_ENABLE_SYNC_UPDATE_SITE` or similar environment variables
- Check if there are multiple connection strings configured
- Verify if the runtime sets up duplicate auto-collectors

### 3. Try Manual SDK Initialization with Explicit Channel Control
Instead of using the runtime-initialized client, forcefully reinitialize with a single channel:

```typescript
// Warning: Nuclear option
if (appInsights.defaultClient) {
  // Dispose of runtime-initialized client
  appInsights.defaultClient.flush();
  appInsights.dispose();
}

// Initialize fresh with explicit single channel
appInsights
  .setup(connectionString)
  .setAutoCollectConsole(false)
  .setAutoCollectRequests(false)
  .setAutoCollectPerformance(false)
  .setAutoCollectExceptions(false)
  .setAutoCollectDependencies(false)
  .start();
```

### 4. Check for Duplicate Telemetry Processors
The SDK allows adding custom telemetry processors. Check if the runtime has added processors that duplicate events:

```typescript
if (appInsights.defaultClient) {
  const processors = (appInsights.defaultClient as any)._telemetryProcessors || [];
  logger?.info(MODULE_NAME, `Found ${processors.length} telemetry processors`);

  // Try clearing processors
  (appInsights.defaultClient as any)._telemetryProcessors = [];
}
```

### 5. Compare Local vs Azure SDK State
Run the same diagnostic logging locally and in Azure to see configuration differences:
- Number of channels
- Number of processors
- Auto-collection settings
- Connection string configuration

### 6. Contact Microsoft Support
If all diagnostic approaches fail, open a support ticket with:
- Detailed timeline of the issue
- SDK version (applicationinsights@3.13.0)
- Node.js version (22.17.1)
- Azure Functions runtime version
- All diagnostic findings
- Sample telemetry showing duplicates with identical `observabilityInstanceId`

## Files Modified in This Investigation

### Configuration Files
- `ops/cloud-deployment/backend-api-deploy.bicep`
- `ops/cloud-deployment/dataflows-resource-deploy.bicep`
- `backend/function-apps/api/host.json`
- `backend/function-apps/dataflows/host.json`

### Source Code
- `backend/lib/adapters/services/observability.ts` (multiple changes)
- `backend/function-apps/azure/application-context-creator.ts`

## Environment Details

- **Node.js**: 22.17.1
- **Application Insights SDK**: 3.13.0
- **Azure Functions Runtime**: v4
- **Function App**: ustp-cams-dev-350de5-node-api
- **Resource Group**: rg-cams-app-dev-350de5
- **Branch**: CAMS-709-fix-telemetry-in-prod

## Recommended Next Action

Add SDK introspection logging to understand the runtime's SDK configuration and identify if multiple channels/processors are causing the duplication. This is likely an SDK-level issue where a single `trackEvent()` call is being processed by multiple telemetry sinks.

---

## Expert Review Findings (2026-03-06)

Four expert agents reviewed this investigation and provided critical feedback:

### 1. Scientific Review - Gaps in Evidence

**Critical Assessment**: The claim that "same instance calls trackEvent() twice" is **INFERENCE, NOT PROOF**.

**Evidence Gaps**:
- ❌ Never added logging INSIDE `completeTrace()` to count actual invocations
- ❌ Never captured call stacks to see where it's invoked from
- ❌ Assumed `observabilityInstanceId` uniqueness without testing collision probability
- ❌ No quantitative analysis (is it 100% of requests or intermittent?)

**Recommended Proof**:
```typescript
// Add inside completeTrace() method
private static _callCounter = 0;
private _instanceCallCounter = 0;

completeTrace(...) {
  const globalCallId = ++AppInsightsObservability._callCounter;
  const instanceCallId = ++this._instanceCallCounter;

  logger?.warn(this.MODULE_NAME, `TRACE: completeTrace called`, {
    globalCallId,
    instanceCallId,
    observabilityInstanceId: this.instanceId,
    eventName,
    stackTrace: new Error().stack?.split('\n').slice(1, 4).join(' | '),
  });

  // ... rest of method

  logger?.warn(this.MODULE_NAME, `TRACE: about to call trackEvent`, {
    globalCallId,
    instanceCallId,
  });

  client.trackEvent({ ... });

  logger?.warn(this.MODULE_NAME, `TRACE: trackEvent returned`, {
    globalCallId,
    instanceCallId,
  });
}
```

**Verdict**: We have circumstantial evidence, not definitive proof. Need runtime instrumentation.

---

### 2. DevOps Review - INFRASTRUCTURE-LEVEL DUPLICATION

**CRITICAL FINDING**: Bicep deployment creates a **second telemetry pipeline** via diagnostic settings!

**The Smoking Gun**:
```bicep
// ops/cloud-deployment/lib/app-insights/diagnostics-settings-func.bicep
resource diagnosticLogsToLogAnalyticsWorkspace = {
  properties: {
    workspaceId: workspaceResourceId
    logs: functionAppLogsEnableAll  // ← Forwards FunctionAppLogs
    metrics: metricsEnableAll
  }
}
```

**Dual Pipeline Architecture**:
1. **Pipeline 1**: Your code → App Insights SDK → Application Insights resource
2. **Pipeline 2**: Function logs → Diagnostic Settings → Log Analytics → Application Insights resource

Both pipelines send to the **same Application Insights instance**, creating duplicates with identical data but different `itemId` values (assigned by backend).

**Immediate Test**: Temporarily disable diagnostic settings in Azure Portal:
```bash
az monitor diagnostic-settings delete \
  --name <diagnostic-setting-name> \
  --resource /subscriptions/{sub}/resourceGroups/rg-cams-app-dev-350de5/providers/Microsoft.Web/sites/ustp-cams-dev-350de5-node-api
```

**Check for Legacy Configuration**:
```bash
az functionapp config appsettings list \
  --name ustp-cams-dev-350de5-node-api \
  --resource-group rg-cams-app-dev-350de5 \
  --query "[?name=='APPINSIGHTS_INSTRUMENTATIONKEY']"
```

If both `APPLICATIONINSIGHTS_CONNECTION_STRING` and `APPINSIGHTS_INSTRUMENTATIONKEY` exist, the SDK may initialize twice.

**host.json Conflicts**:
```json
"applicationInsights": {
  "enableDependencyTracking": true,  // ← Runtime tracking ON
  "samplingSettings": {
    "isEnabled": true  // ← Sampling creates multiple processors
  }
}
```

Setting `console.isEnabled: false` only blocks console logs, not custom events. Runtime's `enableDependencyTracking: true` means it's actively collecting telemetry in parallel.

---

### 3. SDK Expert Review - OpenTelemetry Pipeline Architecture

**Critical Insight**: Application Insights SDK v3.13.0 is built on **OpenTelemetry**.

**Telemetry Flow**:
```
Your code: client.trackEvent() [CALLED ONCE]
    ↓
SDK: TelemetryClient.trackEvent() [CALLED ONCE]
    ↓
SDK: LogApi._logger.emit(logRecord) [CALLED ONCE]
    ↓
OpenTelemetry: LoggerProvider
    ↓
[DUPLICATION LIKELY HAPPENS HERE]
Multiple LogRecordProcessors or Exporters
    ↓
Application Insights backend [TWO EVENTS RECEIVED]
```

**Root Cause Hypothesis** (80% confidence): Azure Functions runtime configured **multiple LogRecordProcessors or exporters** when initializing the SDK.

**Required SDK Introspection**:
```typescript
if (appInsights.defaultClient) {
  const client = appInsights.defaultClient as any;

  // Access OpenTelemetry internals
  const { logs } = require('@opentelemetry/api-logs');
  const loggerProvider = logs.getLoggerProvider();
  const processors = (loggerProvider as any)._logRecordProcessors || [];

  logger?.warn(MODULE_NAME, 'OpenTelemetry Configuration', {
    processorCount: processors.length,
    processorTypes: processors.map(p => p.constructor.name),
    exporters: processors.map(p => ({
      type: p.constructor.name,
      hasExporter: !!p._exporter,
      exporterType: p._exporter?.constructor.name,
    })),
  });
}
```

**Expected Finding**: `processorCount: 2` or duplicate exporters.

**SDK Version Concern**: v3.13.0 may have known bugs. Check:
- https://github.com/microsoft/ApplicationInsights-node.js/issues

**Alternative Fix** (if processors confirmed): Clear duplicate processors:
```typescript
const client = appInsights.defaultClient as any;
const processors = (loggerProvider as any)._logRecordProcessors || [];
if (processors.length > 1) {
  logger?.warn(MODULE_NAME, `Found ${processors.length} processors, keeping only first`);
  (loggerProvider as any)._logRecordProcessors = processors.slice(0, 1);
}
```

---

### 4. Architect Review - Debugging Methodology Assessment

**Overall Rating**: B+ (Good systematic approach, but stopped one layer too early)

**What Went Well**:
- ✅ Systematic elimination of hypotheses
- ✅ Excellent diagnostic watermarking (`telemetrySource`, `observabilityInstanceId`)
- ✅ Proper documentation of each attempt

**Critical Gap**: After confirming same instance creates both events (attempt #7), you should have **stopped making fixes** and **switched to direct SDK introspection**.

**The Pattern**:
- Attempts 1-4: Shots in the dark based on speculation
- Attempts 5-7: Excellent diagnostics that revealed the truth
- **Missing**: Use diagnostics to guide next investigation (SDK internals)

**Debugging Approach Error**: You've been debugging at the **application layer** when the problem is in the **SDK/runtime layer**.

**Recommended Systematic Plan**:

**Phase 1: Prove Single Call** (30 minutes)
Add call counters inside `completeTrace()` to definitively prove it's called once.

**Phase 2: SDK Introspection** (30 minutes)
Log OpenTelemetry processor count, exporter types, channel configuration.

**Phase 3: Infrastructure Check** (15 minutes)
Verify diagnostic settings aren't creating second pipeline.

**Phase 4: Apply Fix** (1 hour)
Based on Phase 1-3 findings:
- If multiple processors: Clear duplicates or dispose/reinitialize SDK
- If diagnostic settings: Disable or reconfigure to prevent duplication
- If neither: File Microsoft support ticket with evidence

---

## Updated Root Cause Hypotheses (Ranked by Expert Consensus)

### 1. **Diagnostic Settings Creating Second Pipeline** (85% confidence)
- **Source**: DevOps expert
- **Evidence**: Bicep config shows diagnostic settings forwarding logs to same App Insights
- **Test**: Disable diagnostic settings and check for duplicates

### 2. **Multiple OpenTelemetry Processors/Exporters** (80% confidence)
- **Source**: SDK expert, Architect
- **Evidence**: SDK v3.13.0 uses OpenTelemetry; runtime likely configured multiple processors
- **Test**: Inspect `loggerProvider._logRecordProcessors` count

### 3. **Application Code Calls completeTrace() Twice** (60% confidence)
- **Source**: Scientist
- **Evidence**: No direct proof it's called once; just inference from `observabilityInstanceId`
- **Test**: Add call counters inside `completeTrace()`

### 4. **SDK Batching/Buffer Bug in v3.13.0** (40% confidence)
- **Source**: SDK expert
- **Evidence**: Some SDK versions have had batching bugs
- **Test**: Set `maxBatchSize: 1` to disable batching

### 5. **Legacy Instrumentation Key Causing Dual Init** (30% confidence)
- **Source**: DevOps expert
- **Evidence**: If both connection string and instrumentation key exist, SDK may init twice
- **Test**: Check for `APPINSIGHTS_INSTRUMENTATIONKEY` environment variable

---

## Prioritized Action Plan (Consensus)

### IMMEDIATE (Do First)
1. ✅ **Disable diagnostic settings** in Azure Portal as test
2. ✅ **Add SDK introspection** to log processor/exporter count
3. ✅ **Add call counters** inside `completeTrace()` to prove single invocation

### IF Diagnostic Settings Is Culprit
- Reconfigure to send to different App Insights resource OR
- Disable diagnostic settings entirely OR
- Filter diagnostic settings to exclude custom events

### IF Multiple Processors Is Culprit
- Clear duplicate processors/exporters OR
- Dispose runtime-initialized SDK and reinitialize with single processor OR
- File bug with Microsoft with processor configuration dump

### IF Neither Explains It
- File Microsoft support ticket with:
  - All diagnostic findings
  - SDK version (3.13.0)
  - Node.js version (22.17.1)
  - Azure Functions runtime version
  - Processor count logs
  - Diagnostic settings configuration
