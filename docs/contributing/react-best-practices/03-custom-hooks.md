# Custom Hooks: Share Logic, Not Components

Extract reusable stateful logic into custom hooks to keep components focused on rendering.

## Practice

- Move complex stateful logic into **custom hooks**
- Hooks should return **authoritative state + derived values** (computed, not stored)
- Hide complexity behind a small, stable hook API
- Name hooks with `use` prefix

## Why / Problems it solves

- Eliminates copy-paste logic across components
- Keeps components focused on UI rendering
- Centralizes tricky state transitions so the whole app behaves consistently
- Makes logic testable independently from UI

## Signals to introduce hooks

- Same `useEffect/useState/useReducer` pattern appears in 2+ places
- Multiple components need the same "view-model" derivation
- Component logic is complex enough to obscure the rendering purpose

```tsx
// ❌ BAD: Complex logic scattered throughout component
function SearchInput() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(handler);
  }, [query]);

  // Search logic
  useEffect(() => {
    if (!debouncedQuery) return;
    fetch(`/api/search?q=${debouncedQuery}`)
      .then(res => res.json())
      .then(setResults);
  }, [debouncedQuery]);

  // Online status logic
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div>
      {!isOnline && <div>Offline</div>}
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>
    </div>
  );
}

// ✅ GOOD: Logic extracted into reusable custom hooks
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Use useSyncExternalStore for external state (prevents tearing in React 19)
import { useSyncExternalStore } from 'react';

function useOnlineStatus() {
  const isOnline = useSyncExternalStore(
    // subscribe: Register listener
    (callback) => {
      window.addEventListener('online', callback);
      window.addEventListener('offline', callback);
      return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
      };
    },
    // getSnapshot: Return current value
    () => navigator.onLine
  );

  return isOnline;
}

// ✅ GOOD: Custom hook with Api2 and useEffect (when pattern repeats)
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';

function useSearch(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    let cancelled = false;

    const search = async () => {
      try {
        setLoading(true);
        const response = await Api2.searchCases({ query });
        if (!cancelled) {
          setResults(response.data);
        }
      } catch (err) {
        console.error('Search failed:', err);
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    search();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return { results, loading };
}

function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);
  const isOnline = useOnlineStatus();
  const { results, loading } = useSearch(debouncedQuery);

  return (
    <div>
      {!isOnline && <div>Offline</div>}
      <input value={query} onChange={e => setQuery(e.target.value)} />
      {loading && <div>Searching...</div>}
      {!loading && results.length > 0 && (
        <ul>
          {results.map(r => <li key={r.id}>{r.name}</li>)}
        </ul>
      )}
    </div>
  );
}
```

## Sources

- https://react.dev/learn/reusing-logic-with-custom-hooks
- https://react.dev/learn/thinking-in-react

---

**Previous:** [Component Composition & Design](02-component-composition.md)
**Next:** [State Management Philosophy](04-state-management.md)
**Up:** [Overview](README.md)
