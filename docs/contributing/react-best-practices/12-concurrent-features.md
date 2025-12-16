# React 19 Concurrent Features for Better UX

React 19's concurrent features enable responsive UIs by allowing React to interrupt and deprioritize work, keeping the interface smooth during expensive operations.

##1 useTransition: Non-Blocking State Updates

Keep your UI responsive during expensive state updates by marking them as transitions.

**Practice**
- Use `useTransition` to mark state updates as **non-urgent** (low priority)
- UI remains interactive during transition - React can interrupt the work
- Show pending state to user while transition is in progress
- Use for: search filtering, tab switching, route changes, heavy list rendering

**Why / Problems it solves**
- Prevents UI from freezing during expensive updates
- Keeps inputs responsive even when rendering is slow
- User can continue interacting while React processes updates in background
- Better UX than loading spinners for many scenarios

**Signals to use useTransition**
- User typing in search box causes lag or dropped keystrokes
- Tab switching or navigation feels sluggish
- Large list filtering makes the UI unresponsive
- Any state update that causes >16ms render time

```tsx
// ❌ BAD: Expensive update blocks the UI
function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = (text) => {
    setQuery(text); // Blocks UI
    // Expensive filtering of 10k+ items
    const filtered = allItems.filter(item =>
      item.name.toLowerCase().includes(text.toLowerCase())
    );
    setResults(filtered); // UI freezes during this
  };

  return (
    <div>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
        // Input becomes unresponsive during filtering
      />
      <ResultsList results={results} />
    </div>
  );
}

// ✅ GOOD: Transition keeps UI responsive
import { useTransition, useState } from 'react';

function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (text) => {
    setQuery(text); // Urgent: update immediately

    // Non-urgent: can be interrupted
    startTransition(() => {
      const filtered = allItems.filter(item =>
        item.name.toLowerCase().includes(text.toLowerCase())
      );
      setResults(filtered);
    });
  };

  return (
    <div>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
        // Stays responsive even during heavy filtering!
      />
      {isPending && <div>Searching...</div>}
      <ResultsList results={results} />
    </div>
  );
}
```

**Sources**
- https://react.dev/reference/react/useTransition
- https://react.dev/reference/react/startTransition

##2 useDeferredValue: Defer Expensive Renders

Keep UI responsive by deferring updates to expensive components.

**Practice**
- Use `useDeferredValue` to defer a value update until more urgent updates complete
- Similar to debouncing but integrated with React's scheduling
- Useful when you can't modify the component causing expensive renders
- React will render twice: once with old value (fast), once with new value (when idle)

**Why / Problems it solves**
- Alternative to `useTransition` when you don't control the state update
- Keeps UI responsive without manual debouncing
- Integrated with React's prioritization system
- Cleaner than custom debounce hooks in many cases

**Signals to use useDeferredValue**
- Expensive component you can't modify (third-party, legacy)
- Parent component needs to stay responsive while child renders
- Alternative to manual debouncing for search/filter scenarios

```tsx
// ❌ BAD: Expensive component blocks input
function App() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div>
      <input
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        // Typing feels laggy
      />
      <ExpensiveChart searchTerm={searchTerm} />
    </div>
  );
}

// ✅ GOOD: Defer chart updates
import { useDeferredValue, useState } from 'react';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  return (
    <div>
      <input
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        // Input stays responsive!
      />
      <ExpensiveChart searchTerm={deferredSearchTerm} />
    </div>
  );
}

// ✅ ALSO GOOD: Show pending state during deferred update
function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const isStale = searchTerm !== deferredSearchTerm;

  return (
    <div>
      <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      <div style={{ opacity: isStale ? 0.5 : 1 }}>
        <ExpensiveChart searchTerm={deferredSearchTerm} />
      </div>
    </div>
  );
}
```

**Sources**
- https://react.dev/reference/react/useDeferredValue

##3 Data Fetching with useEffect

Fetch data directly in components using `useEffect`. Only extract into custom hooks when you have a clear need for reuse.

**Practice**
- Fetch data in components using `useEffect` with proper cleanup
- Handle loading, error, and data states with `useState`
- Use cancellation flags to prevent state updates after unmount
- Import and use `Api2` directly for all API calls
- **Only create custom hooks when**:
  - The same data fetching pattern is repeated across 3+ components
  - Complex fetching logic is obscuring component rendering
  - You need to share and maintain data fetching logic centrally

**Why / Problems it solves**
- Direct `useEffect` keeps code simple and colocated
- No premature abstraction - you can refactor to a hook later if needed
- Easier to understand data flow when it's in the component
- Custom hooks add value only when there's genuine reuse

**When to extract into a custom hook**
- Same fetching pattern repeated in multiple places
- Complex data fetching logic that obscures component purpose
- Need centralized control over data fetching behavior

```tsx
// ❌ BAD: No cancellation or error handling
function CaseDetail({ caseId }) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Api2.getCaseDetail(caseId)
      .then(response => setCaseData(response.data[0]))
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) return <div>Loading...</div>;
  return <div>Case: {caseData?.caseId}</div>;
}

// ✅ GOOD: Proper data fetching with cleanup
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';

function CaseDetail({ caseId }) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCase = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await Api2.getCaseDetail(caseId);
        if (!cancelled) {
          setCaseData(response.data[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCase();

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (loading) return <div>Loading case...</div>;
  if (error) return <div>Error loading case: {error.message}</div>;
  if (!caseData) return <div>No case found</div>;

  return (
    <div>
      <h1>Case: {caseData.caseId}</h1>
      <p>Debtor: {caseData.debtor.name}</p>
    </div>
  );
}

// ✅ ALSO GOOD (when needed): Extract into custom hook for reuse
function useCaseDetail(caseId) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCase = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await Api2.getCaseDetail(caseId);
        if (!cancelled) {
          setCaseData(response.data[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCase();

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return { caseData, loading, error };
}

// Usage: Extract hook only when pattern is reused across multiple components
function CaseDetail({ caseId }) {
  const { caseData, loading, error } = useCaseDetail(caseId);

  if (loading) return <div>Loading case...</div>;
  if (error) return <div>Error loading case: {error.message}</div>;
  if (!caseData) return <div>No case found</div>;

  return (
    <div>
      <h1>Case: {caseData.caseId}</h1>
      <p>Debtor: {caseData.debtor.name}</p>
    </div>
  );
}
```

**Advanced Pattern: Reusable Generic Data Fetching Hook (When Needed)**

Only create this abstraction when the pattern repeats across multiple components.

```tsx
// ✅ GOOD: Generic data fetching hook with TypeScript (when pattern repeats 3+ times)
import { useState, useEffect } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

function useApiData<T>(
  fetchFn: () => Promise<{ data: T[] }>,
  deps: React.DependencyList = []
): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchFn();
        if (!cancelled) {
          setData(response.data[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, deps);

  return { data, loading, error };
}

// Usage with Api2
function CaseDetail({ caseId }) {
  const { data: caseData, loading, error } = useApiData(
    () => Api2.getCaseDetail(caseId),
    [caseId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!caseData) return <div>No case found</div>;

  return <div>Case: {caseData.caseId}</div>;
}
```

**Project-Specific: Api2 Integration**

This project provides a fluent API wrapper (`Api2`) around `fetch` with built-in caching support. The `Api2` module is located at `user-interface/src/lib/models/api2.ts`.

```tsx
// ✅ GOOD: Using Api2 directly with built-in caching
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';

function CourtsSelector() {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchCourts = async () => {
      try {
        setLoading(true);
        // Api2.getCourts() is cached for 1 day
        const response = await Api2.getCourts();
        if (!cancelled) {
          setCourts(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch courts:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCourts();

    return () => {
      cancelled = true;
    };
  }, []);

  return { courts, loading };
}

// Api2 methods with built-in caching:
// - getCourts() - cached for 1 day
// - getOffices() - cached for 1 day
// - getOfficeAttorneys() - cached (default TTL)
// - getRoleAndOfficeGroupNames() - cached for 15 minutes
// - getPrivilegedIdentityUsers() - cached for 15 minutes
```

**Why Api2 Instead of Third-Party Libraries**:
- Lightweight: No external dependencies for basic caching needs
- Good Fences: Isolates `fetch` API behind our own abstraction
- Project-Specific: Tailored to our authentication, error handling, and caching requirements
- Type-Safe: Full TypeScript support with typed response bodies

**When to Consider Alternatives**:
- Complex cache invalidation strategies needed
- Background refetching, optimistic updates, or mutations
- Advanced features like infinite queries or prefetching
- In these cases, consider TanStack Query, but wrap it in a similar abstraction layer

**Sources**
- https://react.dev/learn/reusing-logic-with-custom-hooks
- https://react.dev/learn/synchronizing-with-effects



---
**Previous:** [Code Splitting & Lazy Loading](11-code-splitting.md)
**Next:** [Optimistic Updates](13-optimistic-updates.md)
**Up:** [Overview](README.md)
