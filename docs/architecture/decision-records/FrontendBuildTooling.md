# Frontend Build Tooling

## Context

When we created the React app, it was very common to use Create React App—from Facebook, the author of React—which
provided a lot of tooling for building and serving the webapp. We began to see warnings in our build indicating
that a dependency of `create-react-app` had a bug and that the bug-free version of the dependency would not be
added to `create-react-app` because it was no longer being supported by Facebook or any other maintainers.

Create React App utilizes webpack as it's underlying build tool, but uses highly customized build scripts.
It does provide an `eject` script which can be used to remove the dependency on `create-react-app`, but many of the
transitive dependencies are then made direct dependencies and the webpack scripts are added to the project itself.
We found that the webpack scripts and React Testing Library did not work well together, and we had many problems
attempting to get our tests working correctly again.

Webpack is a common build tool which has wide adoption, but there are competitors, one of which is Vite. Vite is much
more lightweight and thus provides significantly improved build performance. Because of Vite's lightweight nature and
the compatibility of Vitest—an accompanying testing library—with our pre-existing tests, migrating to Vite turned out
to be significantly easier than staying with webpack.

## Decision

We removed `create-react-app` and began using Vite as our build tool. We also replaced the use of Jest with Vitest for
our testing framework.

## Status

Accepted

## Consequences

Builds and re-rendering (locally) are much quicker than before.
