# Branch Resource Isolation

## Context

Every branch (feature/PR) deployment previously provisioned its own dedicated Azure resource group, separate from the resource groups main/production uses. This existed so a branch's resources could be identified and torn down independently without touching anything else.

This had two problems.

First, creating an arbitrarily-named resource group per branch requires an Azure role assignment broad enough to create resource groups anywhere in the subscription — Azure RBAC has no way to scope a role assignment to "resource groups matching a naming pattern that doesn't exist yet." The branch-deploy identity therefore needed subscription-level Contributor access, far broader than the access any single branch deployment actually needs.

Second, an incident occurred in which a shared, fixed-name resource (the application configuration Key Vault, used by main and every branch) was deployed as part of the same Azure Deployment Stack used to manage a single branch's own resources. Deployment Stacks manage every resource their template creates, in any resource group, regardless of scope. Tearing down that one branch's stack deleted the shared Key Vault, breaking main and every other branch that depended on it. The root cause was not a one-off mistake in a single template — it was that nothing structurally prevented a shared, fixed-name resource from ending up inside a per-branch stack's management scope.

### Alternatives considered

- **Keep per-branch resource groups, narrow the RBAC grant.** Rejected: Azure RBAC conditions cannot match on a resource-group-name pattern for resource groups that don't exist yet, so this doesn't actually narrow anything — the identity still needs subscription-wide resource-group-create rights.
- **Keep per-branch resource groups, fix only the specific shared resource that leaked.** Rejected: this addresses the one incident, not the systemic risk. Nothing would prevent a different shared resource from being introduced into a per-branch stack's scope in the future, reproducing the same incident with a different resource.

## Decision

Branch deployments are colocated into the same shared application and network resource groups that main uses, instead of each branch creating its own resource group. Branches are distinguished from each other and from main entirely by branch-unique resource naming, not by a resource-group boundary.

Each branch's own resources are managed as that branch's own Azure Deployment Stack, scoped only to resources named uniquely to that branch. Deleting a branch's stack tears down exactly that branch's resources without deleting the shared resource group or anything else in it.

Resources that are genuinely shared across main and every branch (for example, the application configuration Key Vault and its managed identity) are established through a deployment that is deliberately never wrapped in any branch's Deployment Stack, regardless of what else changes in branch-specific templates over time. This is the structural boundary that makes the isolation hold: a per-branch stack can only ever contain resources named for that branch.

Because deploy and teardown now operate against the same shared resource groups instead of isolated per-branch ones, a branch's deployment and that same branch's teardown are made mutually exclusive, so a teardown can never run while that branch's own deployment is still in progress.

Mechanical safeguards — automated checks run both locally and in CI — independently verify that no shared, fixed-name resource is ever introduced into a per-branch stack's scope, and that resource-level deletion protection is in place on the resources this isolation model depends on staying shared. These exist because the isolation boundary above is a convention that must be actively maintained by every future change to the branch/main infrastructure definitions, not something enforced by the platform itself.

## Status

Accepted

## Consequences

- The branch-deploy identity no longer needs subscription-level Contributor to create resource groups; its Azure RBAC scope can be limited to the fixed, known set of shared resource groups.
- Ephemeral branch deployments no longer leave behind a resource group of their own that must be separately discovered and cleaned up — cleanup operates against the same shared resource groups every branch and main already share.
- The specific incident class — a shared, fixed-name resource captured into a per-branch stack and deleted on that branch's teardown — is closed by structure (shared resources are never stack-managed) and independently checked by mechanical safeguards, not solely by code review discipline.
- The distinction between "genuinely shared, never stack-managed" and "per-branch, stack-managed" is a design invariant every future contributor to this infrastructure must maintain. A resource added to the wrong deployment can reopen the same incident class; mechanical safeguards reduce but cannot eliminate this risk, since they check for known patterns rather than proving the invariant in general.
- Naming formulas that distinguish one branch's copy of a resource from another's must remain consistent everywhere a resource of that kind is referenced. Where those references cross a language boundary (infrastructure-as-code definitions versus the pipeline scripts that operate outside them), the formula cannot be centralized in one place and requires manual upkeep to keep in lockstep.
- A concurrency guarantee between a branch's deploy and its teardown is now a required correctness property rather than an optional safeguard, because both act on the same shared namespace. A gap in that guarantee reopens a race between a live deployment and a teardown of the same branch.
- Branches can no longer be inspected by browsing to a resource group dedicated to that branch in the Azure portal. The shared resource groups contain every branch's and main's resources side by side, distinguishable only by name and by which Deployment Stack, if any, manages them.
