# Frontend Configuration

## Context

While deploying the app, we ran into an issue in Staging where the latest version
of the backend and frontend was properly deployed, but Okta was redirecting the
user to the production frontend rather than the staging. Additionally it seems the frontend
wasn't properly handling the MS parameter (x-ms-routing-name) in the URL, which
instructs the system to use the version of the code in staging.

There was an existing story for a desire to decouple the build from the frontend
deployment. The issues we were seeing highlighted the need to complete the
existing story.

In terms of frontend build, we were relying on Vite's import.meta.env object.

Vite exposes certain constants under the special import.meta.env object. These
constants are defined as global variables during dev and statically replaced at
build time to make tree-shaking effective.

## Decision

The decision was made to remove the reliance on the MS parameter and the build
process utilizing environment variables to provide Vite's import.meta.env.

The solution is to externalize configurations from the build and instead write
configuration parameters to JSON files which are loaded by the React app at run time.

Two configuration files are written: one for normal use, and the other specifically
for staging. This enables us to provide a staging URL to Okta for redirect successful
logins to and allows us better control and use of configuration for the Webapp in general.

## Status

Accepted

## Consequences

* Builds and testing are more reliable.
* Environment-specific configuration is no longer built into user interface javascript bundles.
* Front end configuration can be tailored for specific deployments by distributing a configuration JSON along with the front end assets.
* CI pipelines can be refactored to build the user interface once and deploy multiple times to different environments.
