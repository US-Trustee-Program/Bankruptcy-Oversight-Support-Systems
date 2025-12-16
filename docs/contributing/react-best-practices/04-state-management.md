# State Management Philosophy: Local First, Scale Carefully

Keep state as local as possible and only lift it when necessary.

## Practice

- Keep state **local** by default using `useState` or `useReducer`
- **Lift state** to the nearest common parent only when two or more siblings need it
- Use Context for **low-frequency, cross-cutting state** (theme, auth, locale) - not everything
- Don't make state global prematurely

## Why / Problems it solves

- Local state reduces coupling and makes data flow explicit
- Over-globalizing state creates tangled dependencies and unnecessary re-render fan-out
- Lifting state only as needed keeps components reusable and testable
- Context is better than prop drilling but worse than local state for performance

## Signals to consider a state management library

- Deep prop drilling across 5+ layers with no intermediate component needing the data
- Multiple Context providers with interdependent state that update frequently
- High-frequency global updates causing performance issues (many components re-rendering unnecessarily)
- Need for complex state synchronization across distant parts of the app

```tsx
// ❌ BAD: Premature global state for everything
const GlobalStateContext = createContext();

function App() {
  const [state, setState] = useState({
    theme: 'light',
    user: null,
    currentPage: 'home',
    searchQuery: '',
    modalOpen: false,
    tooltipText: '',
    // Everything in one global state!
  });

  return (
    <GlobalStateContext.Provider value={{ state, setState }}>
      <Layout />
    </GlobalStateContext.Provider>
  );
}

function SearchBar() {
  const { state, setState } = useContext(GlobalStateContext);
  // Component re-renders whenever ANY part of global state changes
  return (
    <input
      value={state.searchQuery}
      onChange={e => setState({ ...state, searchQuery: e.target.value })}
    />
  );
}

// ✅ GOOD: State lives where it's needed
function App() {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);

  // Only truly global state in Context
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <UserContext.Provider value={{ user, setUser }}>
        <Layout />
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}

function SearchPage() {
  // Local state for local concerns
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);

  return (
    <div>
      <SearchBar query={searchQuery} onQueryChange={setSearchQuery} />
      <SearchResults results={results} />
    </div>
  );
}

function SearchBar({ query, onQueryChange }) {
  // No global state needed - just props
  return (
    <input
      value={query}
      onChange={e => onQueryChange(e.target.value)}
    />
  );
}
```

**When to add a state management library:**
- **Redux Toolkit / Zustand / Jotai**: Prop drilling across many layers, or need for complex global state with middleware
- **TanStack Query / SWR**: Repeated fetch/caching logic, need for background refetching and cache management

## useSyncExternalStore: Subscribe to External State

Use `useSyncExternalStore` to subscribe to external state sources like browser APIs, third-party stores, or global variables.

### Practice

- Use `useSyncExternalStore` for subscribing to external state (not managed by React)
- Provide a subscribe function that registers/unregisters listeners
- Provide a getSnapshot function that returns current state
- Optionally provide getServerSnapshot for SSR (not needed for SPAs)

### Why / Problems it solves

- Safely integrates external state with React's rendering
- Prevents tearing (inconsistent state during concurrent rendering)
- Works correctly with React 19's concurrent features
- Standard way to connect non-React state to React

### Signals to use useSyncExternalStore

- Integrating with browser APIs (localStorage, online status, matchMedia)
- Connecting to third-party state management libraries
- Subscribing to global events or external data sources
- Building custom store implementations

```tsx
// ❌ BAD: Manual subscription with useEffect (tearing risk)
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  return isOnline;
}

// ✅ GOOD: useSyncExternalStore prevents tearing
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

// Usage
function App() {
  const isOnline = useOnlineStatus();

  return (
    <div>
      {isOnline ? 'Online' : 'Offline'}
    </div>
  );
}
```

### Example: localStorage Sync

```tsx
// ✅ GOOD: Sync with localStorage
function useLocalStorage(key, initialValue) {
  const subscribe = (callback) => {
    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
  };

  const getSnapshot = () => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  };

  const store = useSyncExternalStore(subscribe, getSnapshot);

  const setValue = (value) => {
    localStorage.setItem(key, JSON.stringify(value));
    // Trigger update in current window
    window.dispatchEvent(new Event('storage'));
  };

  return [store, setValue];
}

// Usage
function PreferencesPanel() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');

  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('light')}>Light</button>
    </div>
  );
}
```

### Example: Media Query Matching

```tsx
// ✅ GOOD: Responsive media query hook
function useMediaQuery(query) {
  const subscribe = (callback) => {
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener('change', callback);
    return () => mediaQuery.removeEventListener('change', callback);
  };

  const getSnapshot = () => {
    return window.matchMedia(query).matches;
  };

  return useSyncExternalStore(subscribe, getSnapshot);
}

// Usage
function ResponsiveComponent() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  return (
    <div>
      <p>Mobile: {isMobile ? 'Yes' : 'No'}</p>
      <p>Dark mode: {isDarkMode ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

### Example: Custom External Store

```tsx
// ✅ GOOD: Custom store with useSyncExternalStore
class CounterStore {
  private count = 0;
  private listeners = new Set<() => void>();

  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  };

  getSnapshot = () => {
    return this.count;
  };

  increment = () => {
    this.count++;
    this.notifyListeners();
  };

  decrement = () => {
    this.count--;
    this.notifyListeners();
  };

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

const counterStore = new CounterStore();

function useCounterStore() {
  return useSyncExternalStore(
    counterStore.subscribe,
    counterStore.getSnapshot
  );
}

// Usage
function Counter() {
  const count = useCounterStore();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => counterStore.increment()}>+</button>
      <button onClick={() => counterStore.decrement()}>-</button>
    </div>
  );
}
```

## Sources

- https://react.dev/reference/react/useSyncExternalStore
- https://react.dev/learn/thinking-in-react
- https://www.geeksforgeeks.org/reactjs/react-architecture-pattern-and-best-practices/

---

**Previous:** [Custom Hooks](03-custom-hooks.md)
**Next:** [useReducer for Complex State](05-use-reducer.md)
**Up:** [Overview](README.md)
