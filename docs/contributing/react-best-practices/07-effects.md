# Effects: For Side Effects and Data Fetching

Use `useEffect` to synchronize with external systems and fetch data in your SPA.

## Practice
- Use `useEffect` for **side effects and external system interactions**:
  - Data fetching from APIs
  - Subscriptions (WebSocket, EventSource)
  - Timers (setTimeout, setInterval)
  - Browser APIs (document manipulation, imperative APIs)
  - Imperative third-party libraries
  - Manual DOM manipulation (when unavoidable)
- Use `useSyncExternalStore` instead of `useEffect` when **reading external state values**:
  - Browser APIs that provide state (navigator.onLine, matchMedia, localStorage)
  - Third-party state management stores
  - Any external state that could change during rendering
  - See [State Management](04-state-management.md#usesyncexternalstore) for full `useSyncExternalStore` documentation
- **DO NOT use useEffect for**:
  - Computing derived values (compute during render - see [Derived State](06-derived-state.md))
  - Responding to prop changes (handle in render or event handlers)
  - Reading external state values (use `useSyncExternalStore` instead)
- Always clean up effects that create subscriptions or register listeners
- Keep effects minimal with explicit dependencies
- Encapsulate data fetching logic in custom hooks when reused across components

## Why / Problems it solves
- Effects provide a clean way to handle async operations like data fetching
- Custom hooks with effects keep components focused on rendering
- Proper cleanup prevents memory leaks and stale subscriptions
- Separating sync logic from rendering logic makes code clearer

## Signals you misused an effect
- Effect sets state from other state/props with no external side effect (compute during render instead)
- Effect exists with no cleanup and no real external interaction
- You're computing values instead of performing side effects

```tsx
// ❌ BAD: No cleanup causes memory leaks
function ChatRoom({ roomId }) {
  useEffect(() => {
    const socket = createSocket();
    socket.connect(roomId);
    socket.on('message', handleMessage);
    // Missing cleanup! Socket stays connected after unmount
  }, [roomId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchUpdates();
    }, 5000);
    // Interval keeps running after unmount!
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    // Event listener never removed, accumulates on every mount!
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(callback);
    observer.observe(elementRef.current);
    // Observer never disconnected!
  }, []);
}

// ✅ GOOD: Proper cleanup prevents leaks
function ChatRoom({ roomId }) {
  useEffect(() => {
    const socket = createSocket();
    socket.connect(roomId);
    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
      socket.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchUpdates();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      console.log(e.key);
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    const observer = new IntersectionObserver(callback);
    if (element) observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
      observer.disconnect();
    };
  }, []);
}
```

## Data Fetching with useEffect and Api2

```tsx
// ❌ BAD: No cancellation or proper error handling
function CaseDetail({ caseId }) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cases/${caseId}`)
      .then(res => res.json())
      .then(setCaseData)
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) return <div>Loading...</div>;
  return <div>{caseData?.debtor?.name}</div>;
}

// ✅ GOOD: Proper data fetching with Api2 and cleanup
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
  return <div>Case: {caseData.caseId} - {caseData.debtor.name}</div>;
}

// ✅ ALSO GOOD (when pattern repeats): Extract into custom hook
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

// Usage: Clean component focused on rendering
function CaseDetail({ caseId }) {
  const { caseData, loading, error } = useCaseDetail(caseId);

  if (loading) return <div>Loading case...</div>;
  if (error) return <div>Error loading case: {error.message}</div>;
  if (!caseData) return <div>No case found</div>;
  return <div>Case: {caseData.caseId} - {caseData.debtor.name}</div>;
}
```

## When useEffect vs useSyncExternalStore

- **useEffect** for side effects (data fetching, connections, listeners, timers, DOM manipulation):
  - Data fetching from APIs
  - WebSocket connections
  - Third-party widget initialization
  - Timers and intervals
  - Manual DOM measurements
- **useSyncExternalStore** for reading external state:
  - navigator.onLine status
  - matchMedia queries
  - localStorage sync
  - Third-party store subscriptions

## Sources
- https://react.dev/learn/you-might-not-need-an-effect
- https://react.dev/learn/synchronizing-with-effects

---
**Previous:** [Derived State](06-derived-state.md)
**Next:** [Refs & Imperative APIs](08-refs.md)
**Up:** [Overview](README.md)
