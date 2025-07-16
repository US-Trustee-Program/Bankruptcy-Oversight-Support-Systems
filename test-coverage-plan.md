# Test Coverage Increase Plan

## Instructions & Common Fixes for Increasing Branch Coverage

- **Singleton Handling:**
  - Ensure tests cover the `getInstance`, `dropInstance`, and `release` methods for all Mongo
    repository singletons.
  - Always use optional chaining (e.g., `instance?.client.close()`) in `dropInstance` to avoid
    errors when the instance is null.
  - In tests, reset singleton state using the public API (not by directly mutating private fields).

- **Error Branches:**
  - Simulate errors thrown by adapters (e.g., `find`, `replaceOne`, `deleteOne`) to cover `catch`
    blocks and error-wrapping logic.
  - For methods that wrap errors (e.g., with `getCamsError` or `UnknownError`), assert the correct
    error type/message is thrown.

- **Edge Cases:**
  - Test empty arrays, missing arguments, and all branches of ternary/conditional logic.
  - Use spies/mocks to control adapter behavior and simulate edge conditions.

- **Review Coverage Reports:**
  - After adding or updating tests, run the coverage report and review the uncovered lines/branches
    for targeted improvements.

## Best Practices for Running Tests and Coverage

- **Use the Agent's Built-in Commands:**
  - Instead of copying shell snippets, use the agent's built-in buttons or prompts to run tests and
    generate coverage reports. This ensures results are captured in the conversation and keeps the
    workflow interactive.
  - When prompted to run a test or coverage command, click the provided button or follow the agent's
    prompt, rather than switching to a separate terminal.
  - If you want to run a specific test or coverage command, just ask the agent to do it for you
    (e.g., "Run the test suite for this file" or "Check coverage for this module").

- **Iterative, Guided Steps:**
  - Prefer interactive, step-by-step improvements: let the agent suggest the next file, branch, or
    test to address, and use the agent to run and verify each change.
  - This approach keeps the workflow focused, efficient, and context-aware.

- **CI Workflow:**
  - CI should run the full coverage suite and enforce the coverage gate. Use the agent to help
    diagnose and address any failures interactively.

- **General Tips:**
  - Use targeted test runs for fast feedback when working on a single file.
  - Use full coverage runs to identify remaining gaps and confirm overall progress.

## Files

- [x] lib/adapters/gateways/mongo/case-assignment.mongo.repository.ts - 60% branch
- [x] lib/adapters/gateways/mongo/case-notes.mongo.repository.ts - 50% branch
- [x] lib/adapters/gateways/mongo/offices.mongo.repository.ts - 66.66% branch
- [x] lib/adapters/gateways/mongo/orders.mongo.repository.ts - 66.66% branch
- [x] lib/adapters/gateways/mongo/runtime-state.mongo.repository.ts - 50% branch
- [x] lib/adapters/gateways/mongo/user-session-cache.mongo.repository.ts - 62.5% branch
- [x] lib/adapters/gateways/mongo/user.repository.ts - 75% branch
- [x] lib/use-cases/dataflows/migrate-consolidations.ts - 78.57% branch
- [ ] lib/adapters/gateways/mongo/office-assignee.mongo.repository.ts - 78.57% branch
- [ ] lib/adapters/utils/database.ts - 75% branch
- [ ] lib/configs/user-groups-gateway-configuration.ts - 75% branch
- [ ] lib/use-cases/offices/offices.ts - 80% branch
