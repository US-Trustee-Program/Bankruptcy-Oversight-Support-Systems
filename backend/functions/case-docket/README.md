

# Layers

(Client) -> (Api Gateway) -> (Azure Function) -> Controller -> Use-Case("Domain") -> Adaptor/Gatwway

## Function/Azure Function

Cloud provider specific glue code. No logic.

## Controller

Entry point into API. Boilerplate code to route to Domain logic.

Also providers non functional cross cutting concerns (AAA and such).

Controller Request Model --> Domain Model --> Controller Response Model

THIS IS WHERE WE WIRE UP DEPENDENCIES. So mocks, etc are injected here.

## Use-Case (or Domain)

Business logic. Depends on adaptors.

## Adaptors

Abstraction for external services, persistence tier, etc. Maps other interfaces to the Domain model.

Have their own models.





# Model

## Domain

* CaseDocketEntry is a record mapped from the DXTR AO_DE table
* CaseDocket => CaseDocketEntry[];

* CaseDocketService contains business logic.
    * getDocket(caseId): CaseDocket

## Controller (HTTP request/response concerns)

* CaseDocketController maps HTTP requests to the CaseDocketService.
    * GET /cases/{caseId}/docket => CaseDocketService.getDocket(caseId)

Controller request/response model?
This is where HTTP response codes are determined.

## Function (Azure Function concerns)

Depends on CaseDocketController.
