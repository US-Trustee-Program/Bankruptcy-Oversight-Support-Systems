# Office Assignees Collection Management

## Context

We had performance issues related to the lookup of attorneys assigned to a list of
cases.  The lookup required a complex query that was taking far too long to
execute.

## Decision

In order to improve performance significantly, the decision was made to create a
new collection in Azure Cosmos that could be optimized for lookup of assignments
and updated whenever a case is closed or assignments are changed.

## Status

Accepted

## Consequences

Greatly improved performance on the Staff Assignment Screen.  Increased complexity
to maintain the state of the assignments.
