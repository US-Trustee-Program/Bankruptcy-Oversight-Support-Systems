# React Compiler: Automatic Optimization

React 19's compiler automatically optimizes your components by memoizing them at build time, eliminating most manual performance optimization.

> **Note**: This section provides comprehensive React Compiler documentation. The compiler is referenced throughout this guide ([Derived State](06-derived-state.md), [Performance](10-performance.md), and [antipatterns](21-antipatterns.md)) because it fundamentally changes how you approach optimization - you can write simple, clean code and trust the compiler to optimize it. This is why you'll see repeated mentions of "let the compiler handle it" - it's the modern React 19 mindset.

## Practice
- Enable React Compiler in your build configuration (Babel/SWC plugin)
- Let the compiler handle component and value memoization automatically
- Only opt-out of compiler optimization when necessary using `'use no memo'` directive
- Remove manual `React.memo`, `useMemo`, and `useCallback` in new code (compiler handles these)
- Keep manual memoization only for:
  - Components that need fine-grained control
  - Expensive computations that the compiler can't detect
  - Third-party library integration edge cases

## Why / Problems it solves
- Eliminates the need for developers to manually identify and fix performance issues
- Prevents over-memoization and under-memoization mistakes
- Reduces cognitive overhead - focus on building features, not performance tuning
- Automatically applies optimal memoization strategies that would be tedious to write manually
- Makes code cleaner by removing boilerplate `memo`, `useMemo`, and `useCallback` calls

## Signals to opt-out of compiler
- Profiling shows compiler-optimized component is still slow due to edge case logic
- Need reference stability guarantees for third-party libraries
- Component has side effects that interfere with compiler optimization

```tsx
// ❌ BAD: Manual memoization in React 19+ with compiler
import { memo, useMemo, useCallback } from 'react';

const ExpensiveList = memo(({ items, onItemClick }) => {
  const sortedItems = useMemo(() => {
    return items.sort((a, b) => a.priority - b.priority);
  }, [items]);

  const handleClick = useCallback((id) => {
    onItemClick(id);
  }, [onItemClick]);

  return (
    <ul>
      {sortedItems.map(item => (
        <ListItem
          key={item.id}
          item={item}
          onClick={handleClick}
        />
      ))}
    </ul>
  );
});

// ✅ GOOD: Let React Compiler handle optimization
function ExpensiveList({ items, onItemClick }) {
  // Compiler automatically memoizes this computation
  const sortedItems = items.sort((a, b) => a.priority - b.priority);

  // Compiler automatically memoizes this function
  const handleClick = (id) => {
    onItemClick(id);
  };

  return (
    <ul>
      {sortedItems.map(item => (
        <ListItem
          key={item.id}
          item={item}
          onClick={handleClick}
        />
      ))}
    </ul>
  );
}

// ✅ ALSO GOOD: Opt-out when you have a specific reason
function SpecialComponent() {
  'use no memo'; // Explicitly opt-out of compiler optimization

  // Component with side effects or special requirements
  // that don't work well with automatic memoization
  return <div>...</div>;
}
```

## React Compiler Setup (SPA)

```javascript
// babel.config.js or next.config.js
module.exports = {
  plugins: [
    ['babel-plugin-react-compiler', {
      target: '19' // React 19 target
    }]
  ]
};

// Or with SWC (faster)
// .swcrc
{
  "jsc": {
    "experimental": {
      "plugins": [
        ["@swc/plugin-react-compiler", {}]
      ]
    }
  }
}
```

## When to still use manual memoization (rare cases)

```tsx
// ✅ Valid: Expensive computation with complex dependencies
function DataVisualization({ rawData, filters, config }) {
  // Explicitly memoize when you know it's expensive and compiler might not detect
  const processedData = useMemo(() => {
    // Multi-step transformation with heavy computation
    return rawData
      .filter(filters.predicate)
      .map(transformWithComplexMath)
      .reduce(aggregateWithStatistics, {});
  }, [rawData, filters, config]);

  return <Chart data={processedData} />;
}

// ✅ Valid: Reference stability required by third-party library
function MapComponent({ markers }) {
  // Some mapping libraries need stable callback references
  const onMarkerClick = useCallback((marker) => {
    console.log(marker);
  }, []);

  return <ThirdPartyMap markers={markers} onMarkerClick={onMarkerClick} />;
}
```

## Sources
- https://react.dev/learn/react-compiler
- https://react.dev/reference/react-compiler/directives/use-memo

---
**Previous:** [Refs & Imperative APIs](08-refs.md)
**Next:** [Performance Optimization](10-performance.md)
**Up:** [Overview](README.md)
