# Anti-overengineering: Add Tools Only with Clear Signals

Default to React primitives. Add tools when they remove real complexity, not to match trends.

**Practice**
- Start with built-in React patterns (useState, useContext, custom hooks)
- Add external libraries only when you have **concrete signals** they solve a real pain point
- Don't add tools preemptively "in case we need them later"
- Evaluate libraries primarily on how well they solve your problem, but consider maintenance/community as risk factors

**Why / Problems it solves**
- Reduces bundle size and dependencies
- Keeps code maintainable without learning library-specific patterns
- Prevents "resume-driven development"
- Makes it easier to onboard new developers to simpler code

**Signals → likely tool**
- **Prop drilling 5+ levels deep** → State library (Redux Toolkit, Zustand, Jotai)
- **Repeated fetch/caching logic** with stale data → Data cache library (TanStack Query, SWR)
- **Large/dynamic forms** with complex validation → Form library (React Hook Form, Formik) or React 19 form hooks
- **Huge lists** (1000+ items) causing slow renders → Virtualization (react-window, react-virtual)
- **Complex animations** beyond CSS → Animation library (Framer Motion, React Spring)

```tsx
// ❌ BAD: Adding Redux for trivial global state
// Installing redux, redux-toolkit, react-redux just for theme
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { Provider, useDispatch, useSelector } from 'react-redux';

const themeSlice = createSlice({
  name: 'theme',
  initialState: { mode: 'light' },
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
    },
  },
});

const store = configureStore({ reducer: { theme: themeSlice.reducer } });

function App() {
  return (
    <Provider store={store}>
      <Layout />
    </Provider>
  );
}

// ✅ GOOD: Using Context for simple global state
import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  return useContext(ThemeContext);
}

function App() {
  return (
    <ThemeProvider>
      <Layout />
    </ThemeProvider>
  );
}

// ✅ GOOD: Adding TanStack Query when you have the signal
// Signal: Repeated fetch logic, need caching, background refetch
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserDashboard />
    </QueryClientProvider>
  );
}

function UserDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <UserList users={data} />;
}
```

#### 18.1 The "Good Fences" Principle: Isolate Third-Party Dependencies

When you do add third-party libraries, **isolate them behind abstraction layers** to prevent tight coupling throughout your codebase. This is the "Good Fences" principle.

**Practice**
- Wrap third-party libraries in your own abstractions
- Limit direct imports of third-party code to a single module/directory
- Export a clean, project-specific API from the wrapper
- Make it easy to swap implementations without changing consuming code

**Why / Problems it solves**
- Prevents library lock-in across the entire codebase
- Makes migrations or replacements feasible (change one wrapper vs. hundreds of files)
- Allows adding project-specific conventions and error handling
- Provides type safety and API consistency
- Makes testing easier with mockable abstractions

**Signals you violated good fences**
- Direct imports of library code throughout the codebase
- Library-specific patterns scattered across components
- Difficult to test because library behavior is embedded everywhere
- Migration would require touching dozens or hundreds of files

**Project Examples**:

**Api2: Wrapping `fetch`**
```tsx
// ✅ GOOD: fetch isolated behind Api2
// user-interface/src/lib/models/api2.ts

// Only Api2 imports fetch directly
export const Api2 = {
  async get<T = object>(path: string, options?: ObjectKeyVal): Promise<ResponseBody<T>> {
    const { uriOrPathSubstring, queryParams } = justThePath(path);
    options = { ...options, ...queryParams };
    const body = await api.get(uriOrPathSubstring, options);
    return body as ResponseBody<T>;
  },
  // ... other methods
};

// Components use Api2, not fetch directly
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';

function MyComponent({ caseId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Api2.getCaseDetail(caseId).then(response => {
      if (!cancelled) setUser(response.data[0]);
    });
    return () => { cancelled = true; };
  }, [caseId]);

  // ✅ No fetch imported, no knowledge of HTTP internals
  return user ? <div>{user.debtor.name}</div> : null;
}
```

**Validation Library: Abstracting Validation Logic**
```tsx
// ✅ GOOD: Validation logic isolated in @common/cams
// common/src/cams/validation.ts & validators.ts

// Only validation modules understand the implementation
export function validateObject(spec: ValidationSpec<unknown>, obj: unknown): ValidatorResult {
  // Implementation details hidden
}

// Components use clean validation API
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';
import { EMAIL_REGEX, PHONE_REGEX } from '@common/cams/regex';
import { FIELD_VALIDATION_MESSAGES } from '@common/cams/validation-messages';

const spec: ValidationSpec<MyData> = {
  email: [Validators.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL)],
  phone: [Validators.optional(Validators.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER))],
};

const result = validateObject(spec, data);
// ✅ No zod, no joi, no class-validator imports anywhere
```

**When to Apply Good Fences**:
- Authentication libraries (Auth0, Okta, etc.) → Wrap behind auth module
- UI libraries (Material-UI, Ant Design, etc.) → Create component wrappers
- Date libraries (date-fns, dayjs, etc.) → Utility module
- State management (Redux, Zustand, etc.) → Store abstractions
- Form libraries (React Hook Form, Formik, etc.) → Form utilities
- Data fetching (TanStack Query, SWR, etc.) → Query wrappers

**Bad Fences Example (What NOT to Do)**:
```tsx
// ❌ BAD: Library imported directly throughout codebase
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { MantineProvider, Button, TextInput } from '@mantine/core';

function MyComponent() {
  const { data } = useQuery({ /* ... */ }); // TanStack Query everywhere
  const schema = z.object({ /* ... */ }); // Zod validation spread across files
  return <Button>Click</Button>; // Mantine components imported directly
}

// Now if you want to change any library, you must update potentially hundreds of files
```

**Good Fences Example**:
```tsx
// ✅ GOOD: Libraries isolated
import { useData } from '@/lib/hooks/useData'; // Wraps TanStack Query
import { validate, Spec } from '@/lib/validation'; // Wraps validation
import { Button, Input } from '@/components/ui'; // Wraps UI library

function MyComponent() {
  const { data } = useData('/api/users'); // Clean API
  const result = validate(mySpec, data); // Project-specific API
  return <Button>Click</Button>; // Abstracted UI component
}

// Now library changes only affect wrapper modules, not consuming code
```

**Trade-offs**:
- **Pro**: Flexibility to change implementations
- **Pro**: Consistent API across the project
- **Pro**: Easier testing with mock implementations
- **Con**: Initial time investment to create wrappers
- **Con**: May not expose all library features (by design)

The goal is not to wrap everything, but to **isolate external dependencies that spread throughout the codebase**. Small, localized uses don't need wrapping.

**Sources**
- https://react.dev/learn/thinking-in-react
- https://react.dev/learn/reusing-logic-with-custom-hooks


---
**Previous:** [Testing](17-testing.md)
**Next:** [Accessibility](19-accessibility.md)
**Up:** [Overview](README.md)
