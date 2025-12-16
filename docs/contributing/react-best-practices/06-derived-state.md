# Derived State: Rules and Best Practices

Understanding derived state is critical to avoiding bugs and unnecessary complexity.

## Core Rule: Don't Store Derived State

If you can compute a value from props or other state during render, don't store it in state.

### Practice
- **Don't store derived state** if you can compute it from existing state/props
- Compute inline during render - React Compiler handles optimization automatically (see [React Compiler](09-react-compiler.md) for details)
- Only add `useMemo` after profiling shows a specific performance issue (rare with compiler - see [Performance](10-performance.md))
- Never maintain two sources of truth for the same information

### Why / Problems it solves
- Avoids **two sources of truth** drifting out of sync
- Prevents "stale UI" bugs where updates don't propagate
- Eliminates entire categories of synchronization bugs
- React community treats redundant derived state as a primary anti-pattern

### Signals you're storing derived state
- You have state that mirrors other state/props (e.g., `items` + `filteredItems` both in state)
- You use effects solely to keep values in sync
- Bugs sound like "lags one render behind" or "resets unexpectedly"

```tsx
// ❌ BAD: Storing derived state creates sync issues
function UserList({ users, searchTerm }) {
  const [filteredUsers, setFilteredUsers] = useState([]);

  // This effect is a red flag - you're syncing derived state
  useEffect(() => {
    setFilteredUsers(
      users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [users, searchTerm]);

  return (
    <ul>
      {filteredUsers.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}

// Problem: filteredUsers lags one render behind when props change
// If you forget dependencies, it gets even worse

// ✅ GOOD: Compute derived state during render (React Compiler optimizes)
function UserList({ users, searchTerm }) {
  // Compute on every render - React Compiler handles optimization automatically
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ul>
      {filteredUsers.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}

// Note: With React Compiler, manual useMemo is rarely needed.
// Only add after profiling shows a specific bottleneck (see Performance section).
```

## Don't Use Effects for Derivation

Never use `useEffect` to compute values from other state or props. Effects run after paint, causing extra renders.

### Practice
- **Do not** write: `useEffect(() => setX(deriveY(y)), [y])` for pure derivation
- Instead: `const x = deriveY(y)` - React Compiler handles optimization (see [React Compiler](09-react-compiler.md))
- Only add `useMemo` after profiling shows a specific bottleneck (rare - see [Performance](10-performance.md))
- Effects are for side effects (network, subscriptions), not computation

### Why / Problems it solves
- Effects run **after paint**, causing unnecessary extra renders
- Creates "one step behind" UI where derived values lag
- Dependency mistakes can create infinite loops or stale derivations
- Makes code harder to reason about - derivations should be synchronous

### Signals you're misusing effects
- Effect sets state from other state/props with no external side effect
- Effect has no cleanup function and no external system interaction
- You're debugging "why doesn't this update immediately" issues

```tsx
// ❌ BAD: Using effect for derivation causes extra renders
function ProductList({ products, category }) {
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [productCount, setProductCount] = useState(0);

  // These effects cause extra renders after every prop change
  useEffect(() => {
    const filtered = products.filter(p => p.category === category);
    setFilteredProducts(filtered);
  }, [products, category]);

  useEffect(() => {
    setProductCount(filteredProducts.length);
  }, [filteredProducts]);

  return (
    <div>
      <p>Found {productCount} products</p>
      {filteredProducts.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

// Render sequence:
// 1. Render with stale filteredProducts
// 2. Paint to screen
// 3. Effect runs, updates filteredProducts
// 4. Re-render with new filteredProducts
// 5. Paint again
// 6. Second effect runs, updates productCount
// 7. Re-render again!
// Result: Three renders and two paints for one prop change

// ✅ GOOD: Compute during render - single render, single paint
function ProductList({ products, category }) {
  const filteredProducts = products.filter(p => p.category === category);
  const productCount = filteredProducts.length;

  return (
    <div>
      <p>Found {productCount} products</p>
      {filteredProducts.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

// Render sequence:
// 1. Render with correct values
// 2. Paint to screen
// Result: One render, one paint - instant update
```

## When Deriving State from Props Is OK (Rare Cases)

There are a few legitimate cases where you need to derive state from props, but they're rare.

### Case 1: One-time initialization from props

Props provide a starting value that a user can diverge from later (like a form default).

```tsx
// ✅ GOOD: Lazy initializer runs only on mount
function EditForm({ initialValues }) {
  const [formData, setFormData] = useState(() => initialValues);
  // User can edit formData independently of initialValues changes

  return (
    <form>
      <input
        value={formData.name}
        onChange={e => setFormData({ ...formData, name: e.target.value })}
      />
    </form>
  );
}
```

### Case 2: Reset internal state when prop identity changes

Prefer keyed remount over syncing state.

```tsx
// ✅ GOOD: Key prop causes React to unmount/remount
function Editor({ recordId, record }) {
  const [draft, setDraft] = useState(record.content);

  return <textarea value={draft} onChange={e => setDraft(e.target.value)} />;
}

// Usage: key causes component to reset when recordId changes
<Editor key={recordId} recordId={recordId} record={record} />

// ❌ BAD: Manually syncing state is error-prone
function Editor({ recordId, record }) {
  const [draft, setDraft] = useState(record.content);

  useEffect(() => {
    setDraft(record.content);
  }, [recordId]); // Easy to forget, causes bugs

  return <textarea value={draft} onChange={e => setDraft(e.target.value)} />;
}
```

### Case 3: True caches / previous-value tracking

If you must remember prior props for comparison, use a ref (not state).

```tsx
// ✅ GOOD: Ref for tracking previous value
function List({ items }) {
  const prevItemsRef = useRef(items);

  useEffect(() => {
    if (prevItemsRef.current.length !== items.length) {
      console.log('Item count changed');
    }
    prevItemsRef.current = items;
  }, [items]);

  return <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
}
```

## Signals You're in Derived-State Trouble

**Red flags:**
- State mirrors other state or props (e.g., `items` + `filteredItems` both in state)
- Effects exist solely to keep values in sync with no external side effects
- Bugs sound like "lags one render behind" or "resets unexpectedly"
- You're using `useEffect` to compute values from other values

**What to do:**
1. Remove the derived state variable
2. Compute the value during render
3. Use `useMemo` only if computation is expensive (measure first)

## Custom Hooks as the Solution

When derived state logic is complex, extract it into a custom hook.

### Practice
- Put **authoritative state** in the hook
- Return **derived values computed on demand** (no redundant storage)
- Let React Compiler optimize - only add `useMemo` after profiling shows need (see [React Compiler](09-react-compiler.md) and [Performance](10-performance.md) for optimization guidance)

```tsx
// ✅ GOOD: Custom hook with authoritative + derived state (compiler optimizes)
function useProductFiltering(products, filters) {
  // Authoritative state
  const [sortOrder, setSortOrder] = useState('asc');

  // Derived values - React Compiler handles optimization automatically
  let filteredProducts = products;

  if (filters.category) {
    filteredProducts = filteredProducts.filter(p => p.category === filters.category);
  }

  if (filters.minPrice) {
    filteredProducts = filteredProducts.filter(p => p.price >= filters.minPrice);
  }

  const sortedProducts = [...filteredProducts].sort((a, b) =>
    sortOrder === 'asc' ? a.price - b.price : b.price - a.price
  );

  return {
    products: sortedProducts,
    sortOrder,
    setSortOrder,
    count: sortedProducts.length,
  };
}

// Component just uses the hook
function ProductList({ products, filters }) {
  const { products: displayProducts, count, sortOrder, setSortOrder } =
    useProductFiltering(products, filters);

  return (
    <div>
      <p>Found {count} products</p>
      <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
        Sort {sortOrder === 'asc' ? 'Descending' : 'Ascending'}
      </button>
      {displayProducts.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
```

## Sources
- https://legacy.reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html
- https://www.freecodecamp.org/news/simplify-react-components-with-derived-state/
- https://react.dev/learn/you-might-not-need-an-effect
- https://julvo.com/posts/react/derived-state/
- https://stackoverflow.com/questions/73355860/should-useeffect-be-used-to-get-derived-state-from-props
- https://react.dev/learn/reusing-logic-with-custom-hooks

---
**Previous:** [useReducer for Complex State](05-use-reducer.md)
**Next:** [Effects](07-effects.md)
**Up:** [Overview](README.md)
