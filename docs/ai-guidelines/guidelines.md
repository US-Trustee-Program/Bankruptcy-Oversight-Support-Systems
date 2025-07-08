# CAMS Development Guidelines

This document outlines the development guidelines for the CAMS (CAse Management System) project. These guidelines are designed to ensure consistency and quality across the codebase.

## Flexion Delivery Practices

CAMS follows Flexion Delivery Practices to ensure high-quality software delivery. These practices include:

### Technical Debt Management

- Technical debt arises from past decisions that make the system harder to change
- Address technical debt in a timely manner to prevent compounding costs over time
- Unaddressed technical debt creates fragility in complex systems, making it harder to implement changes

### Vertical Slices

- Work in vertical slices that touch all components of the system rather than treating components as separate deliverables
- Start with a happy path that touches key components in the system
- Add more stories in order of value
- Complete good user stories that incrementally solve the problem represented by the vertical slice

### YAGNI (You Aren't Gonna Need It)

- Build only what's necessary right now—not what you think you might need later
- Prioritize learning over guessing by building the smallest useful vertical slice first
- Avoid speculative features when there's no current requirement
- Keep solutions simple, using the simplest approach that works for today's needs

### Option-Enabling Architecture

CAMS follows the Option-enabling Software Architecture (OeSA) approach, which includes:

#### Screaming Architecture

- The architecture should scream "Bankruptcy Case Management System" rather than the technologies used
- Directory structures and code organization should reflect the domain (bankruptcy case management) rather than technical implementation details
- This applies to both frontend and backend components

#### The Dependency Rule

- More-important (strategic) modules should not depend on less-important (tactical) modules
- Use interfaces to invert dependencies when necessary
    - These interfaces are often defined in common areas
        - For example, backend use cases typically refer to `gateways.types.ts` for their interfaces rather than the interface being defined in the same file or in a sibling file
- Strategic components are abstract, high-level components critical to the product's value
- Tactical components are concrete, detail-oriented components closer to implementation specifics

#### The Good-Fences Rule

- Boundaries between modules, layers, or components should remain clean, simple, and well-defined
- Only simple data types should cross major boundaries
- Clear boundaries limit the impact of changes to specific areas
- Use simple data types at boundaries (e.g., strings, integers, or clearly defined DTOs)

#### The Invasive-Species Rule

- Control third-party dependencies to avoid entangling them with core business logic
- Use humble objects or adapters to ensure the majority of code depends on things under our control
- Isolate third-party components to protect application logic
- Focus on keeping application logic independent of tactical dependencies

## Markdown Guidelines

- All generated markdown should be syntactically correct
- For nested lists, use 4 spaces (not tabs) to increase indent level
    - Like this example
    - And this one
        - With a deeper level
        - Properly indented
- Use proper heading hierarchy (# for main title, ## for sections, etc.)
- Include blank lines between paragraphs and sections for readability

## Test-Driven Development Practices

- Follow test-driven development (TDD) principles
- When making changes:
    - Change only tests or source files in a single commit, not both
    - Allow the developer to provide further prompts for next steps
    - Do not enter long loops of `test -> edit -> modify test -> repeat` unless explicitly requested

## Testing Guidelines

### Vitest/Jest Testing

- Always use the `test` function rather than the `it` function
  ```typescript
  // Good
  test('should do something', () => {
    // test code
  });

  // Avoid
  it('should do something', () => {
    // test code
  });
  ```

- Prefer `restoreAllMocks` over `resetAllMocks` or `clearAllMocks`
  ```typescript
  // Good
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Avoid
  beforeEach(() => {
    vi.resetAllMocks();
    // or
    vi.clearAllMocks();
  });
  ```

### End-to-End Testing

- E2E tests use Playwright
- Configure the appropriate environment variables in the `.env` file
- For local testing:
  - Ensure NodeApi is running against a clean e2e database
  - Set `CAMS_LOGIN_PROVIDER=mock` in both backend and UI environments
- Run tests using:
  - Headless mode: `npm run headless`
  - With UI: `npm run ui`

## ESLint Configuration

- ESLint rules are set up in a modular fashion
- Different rules apply based on which subproject the file is in
- The configuration can be found in `eslint.config.mjs` at the root of the project

## Formatting

- Files should always end in a newline

## Naming Conventions

### Files

- Only use TypeScript Declaration files for typing npm packages with no types
