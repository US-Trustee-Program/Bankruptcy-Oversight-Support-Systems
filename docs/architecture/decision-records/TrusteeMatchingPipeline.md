# Trustee Matching Pipeline

## Context

ACMS-to-CAMS trustee identity matching (deciding which CAMS trustee record, if any, corresponds to a legacy ACMS trustee record) started as a small set of sequential checks and grew, improvement by improvement, into a deeply nested branching function. Each new matching signal — a stricter candidate filter, a data-quality normalization, a new fallback tier — was added as another conditional branch, another argument threaded through existing calls, or another layer of nesting.

This growth pattern has two costs. First, testing a single branch in isolation requires mocking most of the surrounding call graph, since a branch's behavior is only reachable by first satisfying every branch that precedes it. Second, reasoning about the function as a whole requires holding the entire branch tree in mind, since a new signal's correct placement depends on which existing branches it must run before, after, or in place of.

No alternative to changing the architecture was seriously considered: continuing to add branches to the existing structure was rejected because branching complexity was the problem motivating this decision, not a symptom to route around.

## Decision

Trustee matching is modeled as a pipeline: an ordered sequence of independent stages, each operating on one shared, uniform state shape rather than each other's function signatures.

The shared state carries the ACMS record being matched, a growing collection of CAMS candidates under consideration, and a terminal outcome slot. A stage may add a new candidate to the collection or add new evaluative information to an existing one, but never removes a candidate — so a candidate's presence in the collection depends only on whether some stage ever proposed it, never on the order stages ran in. Every evaluative contribution a stage makes to a candidate is recorded incrementally alongside what already exists, preserving the full sequence of evaluations a candidate accumulated, not just the most recent one.

A stage's decision to act is governed by a single, uniform rule: once any stage has committed the pipeline to a terminal outcome (a confirmed match, or a decision that no real identity is present to match at all), every subsequent stage — regardless of what kind of work it would otherwise do — treats that outcome as final and takes no further action. Before that point, the state is genuinely open: multiple candidates and evaluations can coexist without conflict. This single rule is what allows stages to be added, removed, or reordered without reasoning about the rest of the pipeline, since a stage's only precondition is the shared state's current terminal-outcome status, never another stage's internal logic.

## Status

Accepted

## Consequences

A stage can be tested against the shared state shape alone, without constructing or mocking the rest of the pipeline, since a stage's inputs and outputs are fully described by that shape.

Stage order is only a performance and prioritization concern, not a correctness concern, since no stage can undo another stage's contribution to the candidate collection. Cheaper or more decisive stages can be sequenced earlier purely to reach a terminal outcome sooner, without changing what outcome the pipeline can ultimately reach.

The candidate collection and its accumulated evaluations are retained in full even after a terminal outcome is reached, which is a deliberate trade-off: memory and reporting surface area grow with the number of stages and candidates evaluated, in exchange for a complete, inspectable record of why a given outcome was reached.

Introducing a new matching signal becomes an additive change — a new stage — rather than a modification to existing conditional logic, which was the primary motivation for this decision.
