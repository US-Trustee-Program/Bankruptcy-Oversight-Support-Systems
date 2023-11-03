# Application Context

## Context

We had questions about whether it was more appropriate to wrap the Azure Function context and pass it around or to separate out the components that we need from it and leverage an inversion of control (IoC) container of some sort.

Azure Function Context is an [invocation-specific context](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=javascript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v3#invocation-context) with information about the request, the eventual response, and access to the log functionality of Azure (at least).

If wrapped, and in order to achieve cohesion, decisions need to be made in regard to the scope of the implementation.

In general, the Application Context is best used for things which need to be instantiated at the top level of the Azure Function trigger, only once, and passed around throughout the application.

## Decision

We want to wrap the invocation context with an "application context". Wrapping the invocation context with a wrapper is the most option-enabling approach. This provides an abstraction to prevent against vendor and implementation lock-in.

We want to limit the scope of the application context to cross-cutting concerns. These include access to the invocation context, configuration, logging and security concerns.

## Status

Accepted

## Consequences

Developers will need to use wisdom to determine if it makes sense to include some item in the Application Context or if it makes more sense to add the item to the factory or instantiate it only where it is needed.
