# Application Context

## Context

We had questions about whether it was more appropriate to wrap the Azure Function context and pass it around or to extract the components that we need from it and leverage an inversion of control (IoC) container of some sort.

Azure Function Context is an [invocation-specific context](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=javascript%2Cwindows%2Cazure-cli&pivots=nodejs-model-v3#invocation-context) with information about the request, the eventual response, and access to the logging functionality of Azure (at least).

If wrapped, to achieve cohesion, decisions need to be made regarding the scope of the implementation.

In general, the Application Context is best used for things that need to be instantiated at the top level of the Azure Function trigger, only once and passed around throughout the application.

## Decision

The invocation context will be wrapped in an "application context". Wrapping the invocation context is the most option-enabling approach. It provides an abstraction to prevent against vendor and implementation lock-in.

The scope of the application context will be limited to cross-cutting concerns. These include access to the invocation context, configuration, logging, and security concerns.

## Status

Accepted

## Consequences

Developers will need to use wisdom to determine if it makes sense to include some item in the Application Context or if it makes more sense to add the item to the factory or instantiate it only where it is needed.
