# Performance Optimization: When Compiler Isn't Enough

With React Compiler handling automatic optimization, manual performance tuning is rarely needed. Only optimize when profiling shows a real problem that the compiler can't solve.

## Practice
- **Trust the React Compiler first** - it handles re-render optimization automatically
- **Profile before optimizing** - use React DevTools Profiler to identify real bottlenecks
- Only add manual optimization when:
  - Profiler shows specific performance issues the compiler didn't solve
  - Working with third-party libraries that need reference stability
  - Dealing with truly expensive computations (heavy math, large dataset transformations)
- Avoid manual `React.memo`, `useMemo`, `useCallback` unless you have profiling data showing they help

## Why / Problems it solves
- React Compiler eliminates 90%+ of manual optimization needs
- Manual optimization in React 19+ often adds unnecessary complexity
- Profiling reveals actual bottlenecks rather than assumed ones
- Compiler-first approach keeps code simple and maintainable

## Signals you might need manual optimization
- React Profiler shows component taking >16ms to render even with compiler enabled
- Large data transformations (10k+ items) happening on every keystroke
- Third-party library integration requires stable references
- Known expensive operations (complex calculations, heavy algorithms)

```tsx
// ❌ BAD: Adding manual memoization when compiler handles it
function UserProfile({ user }) {
  // Compiler already optimizes these - manual memoization is redundant
  const fullName = useMemo(() => `${user.firstName} ${user.lastName}`, [user]);
  const age = useMemo(() => user.age, [user.age]);
  const handleClick = useCallback(() => console.log('clicked'), []);

  return (
    <div onClick={handleClick}>
      <h1>{fullName}</h1>
      <p>Age: {age}</p>
    </div>
  );
}

// ✅ GOOD: Let compiler handle normal cases
function UserProfile({ user }) {
  // Clean code - compiler optimizes automatically
  const fullName = `${user.firstName} ${user.lastName}`;
  const handleClick = () => console.log('clicked');

  return (
    <div onClick={handleClick}>
      <h1>{fullName}</h1>
      <p>Age: {user.age}</p>
    </div>
  );
}

// ✅ ALSO GOOD: Manual optimization for proven expensive operations
function DataGrid({ rows }) {
  // Profile showed this specific computation is expensive
  // Manual memoization is justified here
  const aggregatedData = useMemo(() => {
    // Complex aggregation over 50k+ rows
    return rows.reduce((acc, row) => {
      // Heavy computation with nested loops
      const metrics = calculateComplexMetrics(row, acc);
      return mergeWithWeightedAverages(acc, metrics);
    }, {});
  }, [rows]);

  return <Table data={aggregatedData} />;
}

// ✅ ALSO GOOD: Third-party library needs stable references
function MapView({ markers }) {
  // Mapping library checks reference equality
  const onMarkerClick = useCallback((id) => {
    console.log('Clicked marker:', id);
  }, []);

  return <ThirdPartyMap markers={markers} onMarkerClick={onMarkerClick} />;
}
```

## Beyond Memoization: Other Performance Patterns

When manual memoization isn't the answer, consider:
- **Virtualization** for long lists (react-window, react-virtual)
- **Code splitting** for large bundles (see [Code Splitting](11-code-splitting.md))
- **useTransition** for non-urgent updates (see [Concurrent Features](12-concurrent-features.md))
- **Web Workers** for CPU-intensive tasks off main thread

## Sources
- https://react.dev/learn/react-compiler
- https://react.dev/reference/react/memo
- https://react.dev/reference/react/useMemo
- https://react.dev/reference/react/useCallback

---
**Previous:** [React Compiler](09-react-compiler.md)
**Next:** [Code Splitting & Lazy Loading](11-code-splitting.md)
**Up:** [Overview](README.md)
