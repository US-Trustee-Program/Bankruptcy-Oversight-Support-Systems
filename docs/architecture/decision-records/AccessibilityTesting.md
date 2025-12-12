# Accessibility Testing

## Context

CAMS requires automated accessibility testing to ensure WCAG 2.1 Level AA compliance. Initially, the project used pa11y-ci for accessibility testing, which provided basic automated checks for accessibility violations.

Over time, several issues emerged with pa11y-ci:

1. **Outdated Browser Engine**: pa11y-ci depends on Puppeteer which uses an outdated Chromium version that lacks support for modern JavaScript features and introduces security vulnerabilities
2. **AppArmor Conflicts**: The outdated browser engine caused issues with AppArmor security policies on GitHub Actions runners

CAMS already uses Playwright for end-to-end testing. Playwright provides robust accessibility testing capabilities through @axe-core/playwright integration. Using Playwright for both E2E and accessibility testing consolidates our testing infrastructure and resolves the technical issues with pa11y-ci.

## Decision

CAMS will use Playwright with @axe-core/playwright for automated accessibility testing, replacing pa11y-ci entirely.

## Status

Accepted
