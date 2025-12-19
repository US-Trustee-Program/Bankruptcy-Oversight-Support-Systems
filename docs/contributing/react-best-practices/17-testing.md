# Testing: Comprehensive Testing Strategy for React 19 SPAs

Test user behavior, not implementation details. Combine unit, integration, and end-to-end tests for confidence.

## 1 Testing Philosophy & ESLint

**Practice**
- **Test user behavior** (React Testing Library philosophy) - what users see and do
- Don't test implementation details (internal state, private methods)
- Enable React hooks ESLint rules to catch bugs at development time
- Use ESLint plugins for React 19 patterns
- Focus on testing contracts, not implementations

**Why / Problems it solves**
- Behavior tests survive refactoring - implementation tests don't
- ESLint catches hooks and derivation mistakes before runtime
- Testing from user perspective ensures actual UX works
- Prevents brittle tests that break on every code change

```tsx
// ❌ BAD: Testing implementation details
test('Counter component internals', () => {
  const { container } = render(<Counter />);
  // Testing internal state - breaks on refactoring
  expect(component.state.count).toBe(0);
  // Testing private methods - breaks on refactoring
  component.instance().increment();
});

// ✅ GOOD: Testing user behavior
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('user can increment counter', async () => {
  const user = userEvent.setup();
  render(<Counter />);

  // Test what user sees
  expect(screen.getByText('Count: 0')).toBeInTheDocument();

  // Test what user does
  await user.click(screen.getByRole('button', { name: /increment/i }));

  // Verify outcome user observes
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

**ESLint Configuration for React 19**

```javascript
// eslint.config.mjs
export default [
  {
    plugins: {
      'react': react,
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react/jsx-no-leaked-render': 'warn',
    },
  },
];
```

## 2 Testing Custom Hooks

Use `renderHook` to test custom hooks in isolation.

**Practice**
- Test custom hooks with `renderHook` from Testing Library
- Test hook return values and side effects
- Use `act()` when hook causes state updates
- Test hook behavior across re-renders with `rerender`

```tsx
// Custom hook to test
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  return { count, increment, decrement };
}

// ✅ GOOD: Testing custom hook
import { renderHook, act } from '@testing-library/react';

test('useCounter hook increments and decrements', () => {
  const { result } = renderHook(() => useCounter(5));

  // Check initial value
  expect(result.current.count).toBe(5);

  // Test increment
  act(() => {
    result.current.increment();
  });
  expect(result.current.count).toBe(6);

  // Test decrement
  act(() => {
    result.current.decrement();
  });
  expect(result.current.count).toBe(5);
});

// Test hook with changing props
test('useCounter respects initial value changes', () => {
  const { result, rerender } = renderHook(
    ({ initial }) => useCounter(initial),
    { initialProps: { initial: 0 } }
  );

  expect(result.current.count).toBe(0);

  rerender({ initial: 10 });
  // Note: Hook doesn't reset on prop change - this tests that behavior
  expect(result.current.count).toBe(0); // Still 0, not 10
});
```

## 3 Testing Async Behavior and Suspense

React 19's `use()` hook and Suspense require specific testing patterns.

**Practice**
- Use `waitFor` for async assertions
- Test Suspense fallbacks appear and disappear
- Mock API calls with MSW (Mock Service Worker)
- Test error boundaries with async failures

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { use, Suspense } from 'react';

// Component using use() hook
function UserProfile({ userId }) {
  const user = use(fetchUser(userId));
  return <div>User: {user.name}</div>;
}

// ✅ GOOD: Testing Suspense and async data
test('displays user profile after loading', async () => {
  // Mock fetch will be covered in Section 15.4
  render(
    <Suspense fallback={<div>Loading...</div>}>
      <UserProfile userId={123} />
    </Suspense>
  );

  // Check loading state appears
  expect(screen.getByText('Loading...')).toBeInTheDocument();

  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByText('User: John Doe')).toBeInTheDocument();
  });

  // Loading state should be gone
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});

// Test error handling
test('displays error when fetch fails', async () => {
  const ErrorFallback = ({ error }) => <div>Error: {error.message}</div>;

  render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<div>Loading...</div>}>
        <UserProfile userId={999} /> {/* Invalid ID triggers error */}
      </Suspense>
    </ErrorBoundary>
  );

  await waitFor(() => {
    expect(screen.getByText(/Error:/)).toBeInTheDocument();
  });
});
```

## 4 Mocking API Calls with MSW

Mock Service Worker (MSW) provides reliable API mocking for SPAs.

**Practice**
- Use MSW to mock HTTP requests in tests
- Define handlers for different API endpoints
- Set up MSW server in test setup
- Override responses per-test when needed

```typescript
// test/mocks/server.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id,
      name: 'John Doe',
      email: 'john@example.com',
    });
  }),

  http.post('/api/contact', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ success: true });
  }),
];

export const server = setupServer(...handlers);
```

```typescript
// test/setup.ts
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```tsx
// Component test using MSW
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';

test('handles API error gracefully', async () => {
  // Override handler for this test
  server.use(
    http.get('/api/users/:id', () => {
      return HttpResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    })
  );

  render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<div>Loading...</div>}>
        <UserProfile userId={999} />
      </Suspense>
    </ErrorBoundary>
  );

  await waitFor(() => {
    expect(screen.getByText(/User not found/)).toBeInTheDocument();
  });
});
```

## 5 Testing Forms and Actions

Test React 19's `useActionState` and form submission patterns.

**Practice**
- Test form submission with user interactions
- Test pending states during form submission
- Test error and success states
- Use MSW to mock form submission endpoints

```tsx
function ContactForm() {
  const [state, formAction] = useActionState(submitForm, null);

  return (
    <form action={formAction}>
      <input name="email" />
      <button type="submit">Submit</button>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.success && <p>Success!</p>}
    </form>
  );
}

// ✅ GOOD: Testing form with actions
test('submits form and shows success', async () => {
  const user = userEvent.setup();

  render(<ContactForm />);

  // Fill form
  await user.type(screen.getByRole('textbox'), 'test@example.com');

  // Submit
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Check success message appears
  await waitFor(() => {
    expect(screen.getByText('Success!')).toBeInTheDocument();
  });
});

test('shows error on failed submission', async () => {
  const user = userEvent.setup();

  // Mock API failure
  server.use(
    http.post('/api/contact', () => {
      return HttpResponse.json(
        { error: 'Server error' },
        { status: 500 }
      );
    })
  );

  render(<ContactForm />);

  await user.type(screen.getByRole('textbox'), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Check error message appears
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Server error');
  });
});
```

## 6 Integration Testing

Test multiple components working together.

**Practice**
- Test user flows across multiple components
- Test component interactions and data flow
- Test context providers and consumers together
- Keep integration tests focused on critical paths

```tsx
// ✅ GOOD: Integration test for user flow
test('user can search and view results', async () => {
  const user = userEvent.setup();

  render(
    <SearchProvider>
      <SearchPage />
    </SearchProvider>
  );

  // Type search query
  const searchInput = screen.getByRole('searchbox');
  await user.type(searchInput, 'react');

  // Wait for results
  await waitFor(() => {
    expect(screen.getByText('React Documentation')).toBeInTheDocument();
  });

  // Click result
  await user.click(screen.getByText('React Documentation'));

  // Verify detail view
  expect(screen.getByRole('article')).toBeInTheDocument();
});
```

## 7 End-to-End Testing

Test critical user journeys with Playwright to ensure the full application works correctly in a real browser environment.

**Practice**
- **This project uses Playwright** for E2E tests (located in `test/e2e/`)
- Test critical user journeys (authentication, case management workflows, etc.)
- Run E2E tests in CI for production confidence
- Keep E2E test count small - they're slow and expensive
- Focus on happy paths and critical error scenarios
- Use Playwright's built-in features: auto-waiting, retry-ability, parallel execution

**Project-Specific: E2E Test Location**
- All E2E tests are located in: `test/e2e/`
- Configuration: `test/e2e/playwright.config.ts`
- Scripts directory: `test/e2e/scripts/`
- Reports: `test/e2e/playwright-report/`

```typescript
// test/e2e/playwright/example.test.ts
import { test, expect } from '@playwright/test';

test('user can view case details', async ({ page }) => {
  // Navigate to the application
  await page.goto('/');

  // Authenticate (example)
  await page.fill('[name="username"]', 'testuser');
  await page.fill('[name="password"]', 'testpass');
  await page.click('button[type="submit"]');

  // Navigate to cases
  await page.click('text=Cases');

  // Wait for case list to load
  await expect(page.locator('[data-testid="case-list"]')).toBeVisible();

  // Click first case
  await page.click('[data-testid="case-item"]:first-child');

  // Verify case details page loaded
  await expect(page.locator('h1')).toContainText('Case Details');
  await expect(page.locator('[data-testid="case-number"]')).toBeVisible();
});

test('user can assign staff to a case', async ({ page }) => {
  await page.goto('/cases/123');

  // Open assignment modal
  await page.click('button:has-text("Assign Staff")');

  // Select staff member
  await page.selectOption('select[name="staffId"]', { label: 'John Doe' });

  // Submit assignment
  await page.click('button:has-text("Confirm")');

  // Verify success message
  await expect(page.locator('[role="alert"]')).toContainText('Staff assigned successfully');
});
```

**Playwright Best Practices for This Project**:

```typescript
// Use data-testid attributes for stable selectors
<button data-testid="submit-case-note">Submit</button>

// In test:
await page.click('[data-testid="submit-case-note"]');

// Use page object pattern for reusable test logic
class CasePage {
  constructor(private page: Page) {}

  async goto(caseId: string) {
    await this.page.goto(`/cases/${caseId}`);
  }

  async addNote(title: string, content: string) {
    await this.page.click('[data-testid="add-note-button"]');
    await this.page.fill('[name="title"]', title);
    await this.page.fill('[name="content"]', content);
    await this.page.click('[data-testid="submit-note"]');
  }

  async expectNoteVisible(title: string) {
    await expect(
      this.page.locator(`[data-testid="note-title"]:has-text("${title}")`)
    ).toBeVisible();
  }
}

// Use in tests:
test('user can add case note', async ({ page }) => {
  const casePage = new CasePage(page);
  await casePage.goto('123');
  await casePage.addNote('Review Completed', 'All documents verified');
  await casePage.expectNoteVisible('Review Completed');
});
```

**Running E2E Tests**:

See `test/e2e/package.json` for available test scripts. Tests are run from the `test/e2e/` directory.

**Testing Strategy Summary**
- **Unit tests**: Individual components, hooks, utilities (fast, many tests)
- **Integration tests**: Component interactions, user flows (moderate, focused tests)
- **E2E tests**: Critical user journeys with Playwright in `test/e2e/` (slow, few tests)

**Sources**
- https://testing-library.com/docs/react-testing-library/intro
- https://mswjs.io/docs/
- https://playwright.dev/
- https://kentcdodds.com/blog/common-mistakes-with-react-testing-library


---
**Previous:** [TypeScript](16-typescript.md)
**Next:** [Anti-overengineering](18-anti-overengineering.md)
**Up:** [Overview](README.md)
