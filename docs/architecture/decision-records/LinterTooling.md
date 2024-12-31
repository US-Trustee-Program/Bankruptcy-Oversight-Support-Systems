# Linter/Formatter

## Context

ESLint upgrade has spurred us to look for linter/code formatting alternatives. ESLint upgrades have
proven to have breaking changes in major versions. When reworking ESLint for the new version
upgrade, it was decided to explore Biome as another option for code linting/formatting.

## Decision

Upon exploring our options and thoroughly experimenting with Biome, and the updated ESLint config,
we decided to retain ESLint as our tooling.

Biome is a valid option but the following negatives influenced the rejection:

- Immaturty
- Inability to write custom rules
- supports certain plugin rules, but not explicit plugins
- specific to TypeScript/JS

We do want to revisit Biome in the future for use. Biome 2.0 is supposed to have plugin
functionality which may sway our decision

## Status

Retain ESLint and Prettier

## Consequences

Maintaining ESLint and Prettier in our code base
