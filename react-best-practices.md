# React Best Practices & Antipatterns (React 19+)

## Top 10 Best Practices for Function Components

### 1. Use Optimistic Updates for Better UX

Provide instant feedback to users by showing optimistic state while async operations are in progress using React 19's `useOptimistic` hook.

```tsx
// ❌ BAD: No feedback until server responds
function TodoList({ todos, addTodo }) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData) {
    setIsLoading(true);
    await addTodo({ id: crypto.randomUUID(), text: formData.get('text') });
    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="text" disabled={isLoading} />
      <button disabled={isLoading}>Add</button>
      <ul>
        {todos.map(todo => <li key={todo.id}>{todo.text}</li>)}
      </ul>
    </form>
  );
}

// ✅ GOOD: Optimistic UI with instant feedback
import { useOptimistic } from 'react';

function TodoList({ todos, addTodo }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo) => [...state, { ...newTodo, pending: true }]
  );

  async function handleSubmit(formData) {
    const newTodo = { id: crypto.randomUUID(), text: formData.get('text') };
    addOptimisticTodo(newTodo);
    await addTodo(newTodo);
  }

  return (
    <form action={handleSubmit}>
      <input name="text" />
      <button type="submit">Add</button>
      <ul>
        {optimisticTodos.map(todo => (
          <li key={todo.id} style={{ opacity: todo.pending ? 0.5 : 1 }}>
            {todo.text}
          </li>
        ))}
      </ul>
    </form>
  );
}
```

### 2. Handle Forms with Actions and Proper State Management

Use React 19's `useActionState` for declarative form handling with built-in pending states and error handling.

```tsx
// ❌ BAD: Manual form state management with scattered logic
function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData(e.target);
      await submitForm(formData);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" disabled={isSubmitting} />
      <button disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">Submitted!</p>}
    </form>
  );
}

// ✅ GOOD: Declarative form handling with useActionState
import { useActionState } from 'react';

async function submitForm(prevState, formData) {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to submit');
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitForm, null);

  return (
    <form action={formAction}>
      <input name="email" />
      <button disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Submitted!</p>}
    </form>
  );
}
```

### 3. Optimize Expensive Operations Strategically

Only use `useMemo` and `useCallback` when there's a measurable performance benefit. Don't over-optimize.

```tsx
// ❌ BAD: Over-memoizing everything unnecessarily
function UserProfile({ user }) {
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

// ✅ GOOD: Strategic memoization for expensive operations
function SearchableList({ items, onSelect }) {
  // Memoize only expensive computations
  const sortedAndFilteredItems = useMemo(() => {
    return items
      .filter(item => item.active)
      .sort((a, b) => a.priority - b.priority)
      .map(item => ({
        ...item,
        score: calculateComplexScore(item), // Expensive operation
      }));
  }, [items]);

  // Memoize callbacks only when passed to memoized children
  const handleSelect = useCallback((id) => {
    onSelect(id);
  }, [onSelect]);

  // Simple values don't need memoization
  const count = items.length;
  const hasItems = count > 0;

  return (
    <div>
      <p>Total: {count}</p>
      {hasItems && (
        <MemoizedList items={sortedAndFilteredItems} onSelect={handleSelect} />
      )}
    </div>
  );
}
```

### 4. Implement Proper Error Boundaries and Suspense

Create resilient UIs by handling errors and loading states at appropriate boundaries in your component tree.

```tsx
// ❌ BAD: No error or loading boundaries, errors crash the app
function App() {
  return (
    <div>
      <Header />
      <UserProfile /> {/* If this throws, whole app crashes */}
      <AsyncDataComponent /> {/* No loading state shown */}
      <Footer />
    </div>
  );
}

function AsyncDataComponent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error!</div>;
  return <div>{data.content}</div>;
}

// ✅ GOOD: Strategic error and suspense boundaries
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <div>
      <Header />
      <ErrorBoundary
        fallback={<ErrorFallback />}
        onError={(error) => logErrorToService(error)}
      >
        <Suspense fallback={<UserProfileSkeleton />}>
          <UserProfile />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={<ErrorFallback />}>
        <Suspense fallback={<LoadingSpinner />}>
          <AsyncDataComponent />
        </Suspense>
      </ErrorBoundary>
      <Footer />
    </div>
  );
}

// Component uses promises that Suspense can handle
function AsyncDataComponent() {
  const data = use(fetchData()); // Suspends automatically
  return <div>{data.content}</div>;
}

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
```

### 5. Extract Reusable Logic into Custom Hooks

Keep components focused on rendering by moving complex stateful logic into custom hooks for better reusability and testability.

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

function useSearch(query) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    fetch(`/api/search?q=${query}`)
      .then(res => res.json())
      .then(setResults);
  }, [query]);

  return results;
}

function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);
  const results = useSearch(debouncedQuery);
  const isOnline = useOnlineStatus();

  return (
    <div>
      {!isOnline && <div>Offline</div>}
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>
    </div>
  );
}
```

### 6. Use Refs Properly for DOM Access and Mutable Values

Understanding when to use `useRef` vs `useState` prevents unnecessary re-renders and enables proper DOM manipulation.

```tsx
// ❌ BAD: Using state when ref is more appropriate
function VideoPlayer({ src }) {
  const [player, setPlayer] = useState(null);
  const [timeout, setTimeout] = useState(null);

  useEffect(() => {
    setPlayer(document.getElementById('video')); // Causes unnecessary re-render
  }, []);

  const play = () => {
    if (player) player.play(); // player might be stale
  };

  const schedulePlay = () => {
    const id = window.setTimeout(() => play(), 1000);
    setTimeout(id); // Causes re-render for no reason
  };
}

// ✅ GOOD: Using refs for DOM references and mutable values
function VideoPlayer({ src }) {
  const playerRef = useRef(null);
  const timeoutRef = useRef(null);

  const play = () => {
    playerRef.current?.play();
  };

  const schedulePlay = () => {
    timeoutRef.current = window.setTimeout(() => play(), 1000);
  };

  useEffect(() => {
    return () => {
      // Cleanup using ref value
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return <video ref={playerRef} src={src} />;
}
```

### 7. Use useReducer for Complex State Logic

When state updates involve multiple sub-values or complex logic, useReducer provides better organization than multiple useState calls.

```tsx
// ❌ BAD: Multiple related useState calls with scattered logic
function ShoppingCart() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  const addItem = (item) => {
    const newItems = [...items, item];
    setItems(newItems);
    const newTotal = newItems.reduce((sum, i) => sum + i.price, 0);
    setTotal(newTotal);
    setTax(newTotal * 0.08);
  };

  const removeItem = (id) => {
    const newItems = items.filter(i => i.id !== id);
    setItems(newItems);
    const newTotal = newItems.reduce((sum, i) => sum + i.price, 0);
    setTotal(newTotal);
    setTax(newTotal * 0.08);
  };

  const applyDiscount = (code) => {
    // More duplicated calculation logic...
    setDiscount(/* ... */);
    setTotal(/* ... */);
    setTax(/* ... */);
  };
}

// ✅ GOOD: Centralized state logic with useReducer
function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const items = [...state.items, action.item];
      const subtotal = items.reduce((sum, i) => sum + i.price, 0);
      const total = subtotal - state.discount;
      const tax = total * 0.08;
      return { ...state, items, subtotal, total, tax };
    }
    case 'REMOVE_ITEM': {
      const items = state.items.filter(i => i.id !== action.id);
      const subtotal = items.reduce((sum, i) => sum + i.price, 0);
      const total = subtotal - state.discount;
      const tax = total * 0.08;
      return { ...state, items, subtotal, total, tax };
    }
    case 'APPLY_DISCOUNT': {
      const discount = action.amount;
      const total = state.subtotal - discount;
      const tax = total * 0.08;
      return { ...state, discount, total, tax };
    }
    default:
      return state;
  }
}

function ShoppingCart() {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    tax: 0,
  });

  const addItem = (item) => dispatch({ type: 'ADD_ITEM', item });
  const removeItem = (id) => dispatch({ type: 'REMOVE_ITEM', id });
  const applyDiscount = (amount) => dispatch({ type: 'APPLY_DISCOUNT', amount });

  return (
    <div>
      <p>Total: ${state.total.toFixed(2)}</p>
      <p>Tax: ${state.tax.toFixed(2)}</p>
    </div>
  );
}
```

### 8. Implement Lazy Loading and Code Splitting

Use React.lazy and dynamic imports to reduce initial bundle size and improve load time performance.

```tsx
// ❌ BAD: Importing everything upfront increases bundle size
import Dashboard from './Dashboard';
import Settings from './Settings';
import Reports from './Reports';
import Analytics from './Analytics';
import AdminPanel from './AdminPanel';

function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div>
      {page === 'dashboard' && <Dashboard />}
      {page === 'settings' && <Settings />}
      {page === 'reports' && <Reports />}
      {page === 'analytics' && <Analytics />}
      {page === 'admin' && <AdminPanel />}
    </div>
  );
}

// ✅ GOOD: Lazy loading with code splitting
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const Settings = lazy(() => import('./Settings'));
const Reports = lazy(() => import('./Reports'));
const Analytics = lazy(() => import('./Analytics'));
const AdminPanel = lazy(() => import('./AdminPanel'));

function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div>
      <Suspense fallback={<PageSkeleton />}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'settings' && <Settings />}
        {page === 'reports' && <Reports />}
        {page === 'analytics' && <Analytics />}
        {page === 'admin' && <AdminPanel />}
      </Suspense>
    </div>
  );
}

// ✅ ALSO GOOD: Prefetch on hover for better UX
function Navigation() {
  const prefetchPage = (pageName) => {
    // Prefetch on hover to reduce perceived loading time
    if (pageName === 'reports') {
      import('./Reports');
    }
  };

  return (
    <nav>
      <a href="/reports" onMouseEnter={() => prefetchPage('reports')}>
        Reports
      </a>
    </nav>
  );
}
```

### 9. Always Clean Up Effects to Prevent Memory Leaks

Return cleanup functions from useEffect to cancel subscriptions, timers, and event listeners when components unmount.

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

### 10. Keep Components Focused with Single Responsibility

Break down large components into smaller, focused units that do one thing well, making them easier to test and maintain.

```tsx
// ❌ BAD: Large component doing too much
function UserDashboard({ userId }) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser);
    fetch(`/api/users/${userId}/posts`).then(r => r.json()).then(setPosts);
    fetch(`/api/users/${userId}/friends`).then(r => r.json()).then(setFriends);
    fetch(`/api/notifications`).then(r => r.json()).then(setNotifications);
    fetch(`/api/settings`).then(r => r.json()).then(setSettings);
  }, [userId]);

  const handlePostCreate = (post) => {
    fetch(`/api/posts`, { method: 'POST', body: JSON.stringify(post) })
      .then(r => r.json())
      .then(newPost => setPosts([newPost, ...posts]));
  };

  const handleFriendRequest = (friendId) => {
    fetch(`/api/friends/${friendId}`, { method: 'POST' })
      .then(() => fetch(`/api/users/${userId}/friends`))
      .then(r => r.json())
      .then(setFriends);
  };

  const handleNotificationRead = (notifId) => {
    fetch(`/api/notifications/${notifId}`, { method: 'PATCH' })
      .then(() => setNotifications(notifications.filter(n => n.id !== notifId)));
  };

  const handleSettingsUpdate = (newSettings) => {
    fetch(`/api/settings`, { method: 'PUT', body: JSON.stringify(newSettings) })
      .then(r => r.json())
      .then(setSettings);
  };

  return (
    <div>
      <div className="profile">
        <img src={user?.avatar} alt={user?.name} />
        <h1>{user?.name}</h1>
        <p>{user?.bio}</p>
      </div>
      <div className="posts">
        <form onSubmit={e => {
          e.preventDefault();
          handlePostCreate({ text: e.target.text.value });
        }}>
          <input name="text" />
          <button>Post</button>
        </form>
        {posts.map(post => (
          <div key={post.id}>
            <p>{post.text}</p>
            <span>{post.createdAt}</span>
          </div>
        ))}
      </div>
      <div className="friends">
        {friends.map(friend => (
          <div key={friend.id}>
            <img src={friend.avatar} alt={friend.name} />
            <span>{friend.name}</span>
          </div>
        ))}
      </div>
      <div className="notifications">
        {notifications.map(notif => (
          <div key={notif.id} onClick={() => handleNotificationRead(notif.id)}>
            {notif.message}
          </div>
        ))}
      </div>
      <div className="settings">
        <label>
          Email notifications
          <input
            type="checkbox"
            checked={settings.emailNotifications}
            onChange={e => handleSettingsUpdate({
              ...settings,
              emailNotifications: e.target.checked
            })}
          />
        </label>
      </div>
    </div>
  );
}

// ✅ GOOD: Focused components with single responsibility
function UserDashboard({ userId }) {
  return (
    <div>
      <UserProfile userId={userId} />
      <UserPosts userId={userId} />
      <FriendsList userId={userId} />
      <NotificationCenter />
      <UserSettings />
    </div>
  );
}

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser);
  }, [userId]);

  if (!user) return <ProfileSkeleton />;

  return (
    <div className="profile">
      <img src={user.avatar} alt={user.name} />
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  );
}

function UserPosts({ userId }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetch(`/api/users/${userId}/posts`).then(r => r.json()).then(setPosts);
  }, [userId]);

  const handlePostCreate = async (post) => {
    const response = await fetch(`/api/posts`, {
      method: 'POST',
      body: JSON.stringify(post)
    });
    const newPost = await response.json();
    setPosts([newPost, ...posts]);
  };

  return (
    <div className="posts">
      <PostForm onSubmit={handlePostCreate} />
      {posts.map(post => <PostCard key={post.id} post={post} />)}
    </div>
  );
}

function FriendsList({ userId }) {
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    fetch(`/api/users/${userId}/friends`).then(r => r.json()).then(setFriends);
  }, [userId]);

  return (
    <div className="friends">
      {friends.map(friend => <FriendCard key={friend.id} friend={friend} />)}
    </div>
  );
}

function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetch(`/api/notifications`).then(r => r.json()).then(setNotifications);
  }, []);

  const handleRead = (notifId) => {
    fetch(`/api/notifications/${notifId}`, { method: 'PATCH' })
      .then(() => setNotifications(notifications.filter(n => n.id !== notifId)));
  };

  return (
    <div className="notifications">
      {notifications.map(notif => (
        <Notification key={notif.id} notification={notif} onRead={handleRead} />
      ))}
    </div>
  );
}

function UserSettings() {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    fetch(`/api/settings`).then(r => r.json()).then(setSettings);
  }, []);

  const handleUpdate = async (newSettings) => {
    const response = await fetch(`/api/settings`, {
      method: 'PUT',
      body: JSON.stringify(newSettings)
    });
    const updated = await response.json();
    setSettings(updated);
  };

  return <SettingsForm settings={settings} onUpdate={handleUpdate} />;
}

// Each component has a clear, single purpose and is independently testable
```

---

## Top 5 React Antipatterns to Avoid

### 1. Mutating State Directly

Never mutate state objects or arrays directly. Always create new references to trigger re-renders properly.

```tsx
// ❌ BAD: Direct mutation doesn't trigger re-renders
function TodoList() {
  const [todos, setTodos] = useState([]);

  const addTodo = (text) => {
    todos.push({ id: Date.now(), text }); // Mutation!
    setTodos(todos); // Same reference, no re-render
  };

  const toggleTodo = (id) => {
    const todo = todos.find(t => t.id === id);
    todo.completed = !todo.completed; // Mutation!
    setTodos(todos); // Same reference, no re-render
  };

  const updateUser = () => {
    setUser(prevUser => {
      prevUser.name = 'New Name'; // Mutation!
      return prevUser; // Same reference, no re-render
    });
  };
}

// ✅ GOOD: Immutable updates with new references
function TodoList() {
  const [todos, setTodos] = useState([]);

  const addTodo = (text) => {
    setTodos([...todos, { id: Date.now(), text }]);
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const updateUser = () => {
    setUser(prevUser => ({
      ...prevUser,
      name: 'New Name',
    }));
  };
}
```

### 2. Using Indexes as Keys in Dynamic Lists

Array indexes are unstable and cause React to incorrectly reuse component instances, leading to bugs with state and performance.

```tsx
// ❌ BAD: Index keys cause bugs when list changes
function TaskList({ tasks }) {
  return (
    <ul>
      {tasks.map((task, index) => (
        <TaskItem
          key={index}  // If tasks reorder, React reuses wrong components
          task={task}
        />
      ))}
    </ul>
  );
}

function TaskItem({ task }) {
  const [isEditing, setIsEditing] = useState(false);
  // When list reorders, this state stays with the index position,
  // not the actual task, causing wrong items to be in edit mode
  return (
    <li>
      {isEditing ? (
        <input defaultValue={task.name} />
      ) : (
        <span onClick={() => setIsEditing(true)}>{task.name}</span>
      )}
    </li>
  );
}

// ✅ GOOD: Stable unique identifiers maintain component identity
function TaskList({ tasks }) {
  return (
    <ul>
      {tasks.map((task) => (
        <TaskItem
          key={task.id}  // Unique, stable ID follows the data
          task={task}
        />
      ))}
    </ul>
  );
}

function TaskItem({ task }) {
  const [isEditing, setIsEditing] = useState(false);
  // State now correctly follows the actual task data
  return (
    <li>
      {isEditing ? (
        <input defaultValue={task.name} />
      ) : (
        <span onClick={() => setIsEditing(true)}>{task.name}</span>
      )}
    </li>
  );
}
```

### 3. Missing or Incorrect Dependencies in useEffect

Forgetting dependencies causes stale closures and subtle bugs. Include all values from the component scope that change over time.

```tsx
// ❌ BAD: Missing dependencies cause stale closures
function Counter({ step }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // Always uses initial values of count and step
      setCount(count + step); // Stale closure!
    }, 1000);
    return () => clearInterval(interval);
  }, []); // Missing count and step dependencies

  // count will only increment once from 0 to step, then stop
}

function SearchResults({ query, filters }) {
  useEffect(() => {
    // Uses stale filters value
    fetchResults(query, filters);
  }, [query]); // Missing filters dependency
}

// ✅ GOOD: Complete dependencies or functional updates
function Counter({ step }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // Functional update - no dependencies needed
      setCount(c => c + step);
    }, 1000);
    return () => clearInterval(interval);
  }, [step]); // Only step needed now
}

function SearchResults({ query, filters }) {
  useEffect(() => {
    fetchResults(query, filters);
  }, [query, filters]); // All dependencies included
}

// ✅ ALSO GOOD: Extract stable references when needed
function SearchResults({ query, filters }) {
  const filterRef = useRef(filters);
  filterRef.current = filters;

  useEffect(() => {
    fetchResults(query, filterRef.current);
  }, [query]); // filterRef doesn't change
}
```

### 4. Defining Components Inside Components

Creating component functions inside other components causes them to be recreated on every render, losing state and causing performance issues.

```tsx
// ❌ BAD: Component recreated on every render
function Parent() {
  const [count, setCount] = useState(0);

  // New function created every render - React sees it as a new component type
  function Child({ text }) {
    const [childState, setChildState] = useState('');
    // This state resets on every Parent render!
    return (
      <div>
        <p>{text}</p>
        <input value={childState} onChange={e => setChildState(e.target.value)} />
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <Child text="Hello" /> {/* Child unmounts and remounts on every count change */}
    </div>
  );
}

// ❌ ALSO BAD: JSX factory functions have same problem
function Parent() {
  const [count, setCount] = useState(0);

  const renderChild = (text) => {
    return <div>{text}</div>; // Not as bad but still creates unnecessary work
  };

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      {renderChild('Hello')}
    </div>
  );
}

// ✅ GOOD: Components defined at module level
function Child({ text }) {
  const [childState, setChildState] = useState('');
  // State persists correctly across Parent re-renders
  return (
    <div>
      <p>{text}</p>
      <input value={childState} onChange={e => setChildState(e.target.value)} />
    </div>
  );
}

function Parent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <Child text="Hello" /> {/* Child maintains identity and state */}
    </div>
  );
}

// ✅ ALSO GOOD: Use children prop for dynamic content
function Parent({ children }) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      {children} {/* Passed from outside, maintains identity */}
    </div>
  );
}
```

### 5. Excessive Prop Drilling

Passing props through many intermediate components creates tight coupling and makes refactoring difficult.

```tsx
// ❌ BAD: Props passed through many layers
function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('en');

  return (
    <Layout
      user={user}
      setUser={setUser}
      theme={theme}
      setTheme={setTheme}
      language={language}
      setLanguage={setLanguage}
    />
  );
}

function Layout({ user, setUser, theme, setTheme, language, setLanguage }) {
  return (
    <div>
      <Sidebar
        user={user}
        setUser={setUser}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
      />
    </div>
  );
}

function Sidebar({ user, setUser, theme, setTheme, language, setLanguage }) {
  return (
    <nav>
      <UserMenu user={user} setUser={setUser} />
      <ThemeToggle theme={theme} setTheme={setTheme} />
      <LanguageSelector language={language} setLanguage={setLanguage} />
    </nav>
  );
}

// ✅ GOOD: Context API for global state
import { createContext, useContext } from 'react';

const UserContext = createContext();
const ThemeContext = createContext();
const LanguageContext = createContext();

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('en');

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <LanguageContext.Provider value={{ language, setLanguage }}>
          <Layout />
        </LanguageContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}

function Layout() {
  return (
    <div>
      <Sidebar />  {/* No props needed */}
    </div>
  );
}

function Sidebar() {
  return (
    <nav>
      <UserMenu />
      <ThemeToggle />
      <LanguageSelector />
    </nav>
  );
}

function UserMenu() {
  const { user, setUser } = useContext(UserContext);
  return <div>{user?.name}</div>;
}

function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      {theme}
    </button>
  );
}

function LanguageSelector() {
  const { language, setLanguage } = useContext(LanguageContext);
  return (
    <select value={language} onChange={e => setLanguage(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  );
}

// ✅ ALSO GOOD: Component composition to avoid drilling
function App() {
  const [user, setUser] = useState(null);

  return (
    <Layout
      sidebar={
        <Sidebar
          userMenu={<UserMenu user={user} setUser={setUser} />}
        />
      }
    />
  );
}

function Layout({ sidebar }) {
  return <div>{sidebar}</div>;
}

function Sidebar({ userMenu }) {
  return <nav>{userMenu}</nav>;
}
```

---

## Summary

Modern React development with function components emphasizes declarative patterns, strategic optimization, and proper separation of concerns. By following these best practices—showing optimistic UI updates, using built-in hooks effectively, managing complex state properly, implementing lazy loading, cleaning up effects, extracting reusable logic, and keeping components focused—you can build maintainable and performant applications. Always prefer simplicity over premature optimization, and avoid common pitfalls like state mutation, poor key choices, missing dependencies, nested component definitions, and excessive prop drilling.
