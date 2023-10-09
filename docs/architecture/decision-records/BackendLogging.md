# Backend Logging

## Context

Without a unified approach to logging, particularly with regard to errors, we were not particularly consistent. Some
errors were logged twice, while any errors that were not propagated up may not have been logged at all.

## Decision

We decided to always create a custom error and log it prior to throwing. The base error is CamsError and will be in a
common directory, but more specific errors can be created that extend this one and are stored nearer their module.
When catching errors that are unexpected we have an UnknownError. This type of error can be used to add helpful
information about where the error was caught so that we can specifically address the error in the future.

## Status

Accepted

## Consequences

Errors will be logged close to where they are discovered, but developers need to be careful to always log errors before
throwing.
