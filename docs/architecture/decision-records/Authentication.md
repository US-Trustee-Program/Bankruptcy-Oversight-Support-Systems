# Authentication Provider

## Context

We began authentication with exploring Active Directory Federation System (ADFS) implementation. USTP wanted to use their ADFS first for all authentication but this would have hindered development because we would not have been able to authenticate to the app locally in a simple manner. We decided to implement a Flexion instance of ADFS as an Identity Provider (IDP) and get started mocking out authentication with Azure Active Directory (AD) Business-to-customer (B2C). AD B2C was relatively easy to set up and get running for the app on its own without an IDP. During exploration of this we found that implementing a new ADFS instance would be costly and overly complex. The complexity was in the delivery of the app to USTP. If Flexion set up an ADFS instance, there would be no guarantee that the networking and configuration would match that of USTP, meaning we could not promise the app would function properly when deployed within USTP.

USTP is in the process of implementing Okta across the board for many of their applications, and will eventually be deprecating ADFS. Their transition to Okta started to gain momentum, so it made sense to explore that avenue. The implementation is more cost-effective and easily applicable to multiple environments, both internal and external to USTP. Using Okta also removes the need to manage our own resources for an IDP within Azure. Okta can also be used as an IDP for Azure AD (should that be decided in the future) or store users directly within itself.

## Decision

Okta removes some of the complexity of ADFS, including network integration and managing multiple environments. Given USTP will be implementing Okta across the board, and eventually deprecate ADFS, Okta is the best choice for an authentication provider.

## Status

Accepted

## Consequences

Implementing authentication was always going to be a lot of work. Since USTP is in the early stage of implementing Okta we've experienced some growing pains in the process. Implementing Okta means we can't set up Azure Role-based Access Control (RBAC), which would make authorization easier.
