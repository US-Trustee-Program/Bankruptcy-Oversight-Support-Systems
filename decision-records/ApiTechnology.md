# API Technology

## Context

Flexion bid the project with a proposal that a decision would be made in the context of performance of the work about whether to use Java or Node for the API. Early on in the project the team decided to perform a comparison by implementing the API with both. Further, throughout the process of implementing the CI/CD pipeline, we experimented with Azure Functions in addition to the original web-service implementations.

Factors considered when comparing languages included:
- Azure Cloud Support
- Containerization
- Deployment
- Development
- Integration with DB
- Maintenance
- Scalability
- Security
- Storage Solutions
- Team Expertise / Productivity
- Testability & Testing frameworks

Factors considered when comparing Functions to web services included:
- Azure Cloud Support
- Deployment
- Development
- Maintenance
- Scalability
- Team Expertise / Productivity

## Decision

For the primary application API we will utilize Azure Functions developed in Node.js. This decision is not intended to preclude the decision to implement portions of the system as web services, batch job, or any other paradigm which may be appropriate to solve a future problem.

## Status

Accepted

## Consequences

Azure Functions have a default maximum execution time depending upon which hosting plan is chosen. Generally speaking they are not intended for long-running processes so this may affect architectural decisions moving forward.

By default, Azure Functions may also require warm-up time. Care should be taken to ensure that the user experience is not adversely affected by this. If we find that it is negatively affected, there are options available for keeping a number of instances pre-warmed, always on, or potentially providing dedicated compute via a Dedicated hosting plan. Functions may also be deployed in a Kubernetes cluster, or if we deem it necessary, the API could be converted to run in web services or some other paradigm.
