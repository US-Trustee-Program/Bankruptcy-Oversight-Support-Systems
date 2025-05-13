# Frontend Configuration

## Context

While deploying the app, we ran into an issue in Staging where the latest version
of the backend and frontend was properly deployed, but Okta was redirecting the
user to the production frontend rather than the staging. Additionally it seems the frontend
wasn't properly handling the MS parameter (x-ms-routing-name) in the URL which
instructs the system to use the version of the code in staging.

There was an existing story for a desire to decouple the build from the frontend
deployment. The issues we were seeing highlighted the need to complete the
existing story.

In terms of frontend build, we were relying on Vites import.meta.env object.

Vite exposes certain constants under the special import.meta.env object. These
constants are defined as global variables during dev and statically replaced at
build time to make tree-shaking effective.

## Decision

The decision was made to remove the reliance of the MS parameter and the build
process utilizing Environment Variables to provide Vite's import.meta.env.

Instead we made the decision to write configuration data to a JSON file, which
will be accessed by the React app at run time. We create 2 configuration files --
one for normal use, and another specifically for staging. This enables us to
provide a staging URL to Okta for redirect, and allows us better control and
use of configuration for the Webapp in general.

This also seems to have an affect on overall performance of the deployment process.

## Status

Accepted

## Consequences

Builds and testing are more reliable.
