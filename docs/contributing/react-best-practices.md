# React Best Practices Guide (React 19+)

A comprehensive guide for building React single-page applications following modern patterns and principles. This guide follows a sequential workflow from project foundation through code quality, with detailed examples and clear decision criteria.

**Organization**: This guide flows from project setup → component design → state management → advanced patterns → user experience → code quality → antipatterns & quick reference.

---

## About This Guide

**Living Document**: This guide is a living document that should be updated as necessary based on the prevailing patterns and practices used in this project. As React evolves and as we discover better patterns through experience, this guide should be revised accordingly.

**Current Codebase Status**: As of the writing of this guide, the current codebase does not fully adhere to all best practices laid out here. The codebase should be **progressively updated** to incorporate these best practices over time. When working on new features or refactoring existing code, apply these patterns where appropriate without requiring a full rewrite of the application.

**Project-Specific Principles**:
- **Minimize third-party dependencies**: We prefer lightweight, bespoke solutions when the value of a third-party library doesn't justify its cost
- **"Good Fences" principle**: When we do use third-party libraries, we isolate them behind abstraction layers to prevent tight coupling throughout the codebase
- **Examples in this project**: Our `Api2` fluent API wraps `fetch`, and our lightweight validation library replaces heavier alternatives like zod

---

## React 19 for Single-Page Applications (SPAs)

### Scope of This Guide

This guide is specifically for **React 19 deployed as a client-side single-page application (SPA)**. It does not cover:
- React Server Components (RSC)
- Server-Side Rendering (SSR)
- Server Actions
- Streaming SSR

All patterns, examples, and best practices in this guide are for **client-side React 19 only**.

### What's New in React 19 for SPAs

React 19 brings significant improvements to client-side applications:

1. **React Compiler** - Automatically optimizes re-renders without manual memoization
2. **Actions** - Simplified form handling with `useActionState` and `useFormStatus` (client-side)
3. **`useOptimistic`** - Built-in optimistic UI updates for better perceived performance
4. **Concurrent Features** - `useTransition` and `useDeferredValue` for responsive UIs
5. **Suspense** - Production-ready for code splitting and lazy loading

### Key Mindset Shifts for React 19 SPAs

- **Compiler over manual memoization**: Let React Compiler handle optimization automatically
- **Custom hooks for data fetching**: Encapsulate `useEffect` data fetching patterns in custom hooks
- **Actions for forms**: Use `useActionState` for form submissions instead of manual state management
- **Suspense for code splitting**: Use Suspense with lazy loading for better performance

---

## Part 1: Project Foundation

### 1. Project Architecture & Structure

Organize your React application by **feature/domain** (also called "screaming architecture") rather than by technical layers.

**Practice**
- Group files by feature or domain area
- Colocate components, hooks, tests, and styles within each feature
- Keep a small **shared/common** area only for truly cross-feature primitives (buttons, layout utilities, low-level hooks)

**Why / Problems it solves**
- Feature grouping scales better than type-based folders (`components/`, `hooks/`, `utils/`)
- Keeps related code together, reducing navigation time and cross-feature coupling
- Makes large SPAs more maintainable for growing teams
- The directory structure screams what the app does, not what framework it uses

**Signals to adjust**
- If `shared/` or `common/` becomes a dumping ground, move items back into features until they prove globally reusable
- If you're constantly jumping between distant folders to work on one feature, reorganize by domain

```
// ❌ BAD: Organized by technical type
src/
├── components/
│   ├── UserProfile.tsx
│   ├── CaseList.tsx
│   ├── TrusteeForm.tsx
├── hooks/
│   ├── useUser.ts
│   ├── useCases.ts
│   ├── useTrustees.ts
├── utils/
│   ├── userHelpers.ts
│   ├── caseHelpers.ts
│   ├── trusteeHelpers.ts

// ✅ GOOD: Organized by feature/domain
src/
├── user-profile/
│   ├── UserProfile.tsx
│   ├── useUser.ts
│   ├── userHelpers.ts
│   ├── UserProfile.test.tsx
├── cases/
│   ├── CaseList.tsx
│   ├── CaseDetail.tsx
│   ├── useCases.ts
│   ├── caseHelpers.ts
│   ├── CaseList.test.tsx
├── trustees/
│   ├── TrusteeForm.tsx
│   ├── TrusteeList.tsx
│   ├── useTrustees.ts
│   ├── trusteeHelpers.ts
├── shared/
│   ├── Button.tsx
│   ├── Layout.tsx
│   ├── useDebounce.ts
```

**Sources**
- https://profy.dev/article/react-folder-structure
- https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc
- https://namastedev.com/blog/best-practices-for-folder-structure-in-react-7/

---

## Part 2: Component Design

### 2. Component Composition & Design

Keep components small, focused, and composable. Design for single responsibility.

**Practice**
- Use **function components + hooks** for all new code
- Each component should do one thing well
- Compose UI from smaller pieces rather than building large monolithic components
- Split "god components" into subcomponents + logic hooks

**Why / Problems it solves**
- Function components are the modern default and align with React's hooks-first model
- Small components reduce cognitive load, improve testability, and enable reuse
- Single responsibility makes components easier to understand, test, and maintain
- Composition enables flexibility without inheritance

**Signals to refactor**
- File exceeds ~200–300 lines of code
- Component mixes unrelated concerns (fetching + layout + complex state)
- You can't easily describe what the component does in one sentence

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
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchUser = async () => {
      try {
        const response = await Api2.getUserProfile(userId);
        if (!cancelled) {
          setUser(response.data[0]);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
        if (!cancelled) setLoading(false);
      }
    };
    fetchUser();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return <div>Loading profile...</div>;
  if (!user) return null;

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
    let cancelled = false;
    const fetchPosts = async () => {
      try {
        const response = await Api2.getUserPosts(userId);
        if (!cancelled) setPosts(response.data);
      } catch (err) {
        console.error('Failed to fetch posts:', err);
      }
    };
    fetchPosts();
    return () => { cancelled = true; };
  }, [userId]);

  const handlePostCreate = async (post) => {
    const response = await Api2.post(`/posts`, post);
    // Refresh posts after creation
    const updatedPosts = await Api2.getUserPosts(userId);
    setPosts(updatedPosts.data);
  };

  return (
    <div className="posts">
      <PostForm onSubmit={handlePostCreate} />
      {posts.map(post => <PostCard key={post.id} post={post} />)}
    </div>
  );
}

// Each component has a clear, single purpose and is independently testable
```

#### 2.1 Composition Patterns for Flexibility

Advanced composition patterns enable flexible, reusable components without prop drilling or complex inheritance.

**Render Props Pattern**

Pass a function as a prop to share code and delegate rendering.

```tsx
// ✅ GOOD: Render props for flexible rendering
function MouseTracker({ render }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return render(position);
}

// Usage with different renderers
function App() {
  return (
    <div>
      <MouseTracker
        render={({ x, y }) => (
          <div>Mouse position: {x}, {y}</div>
        )}
      />

      <MouseTracker
        render={({ x, y }) => (
          <div style={{ position: 'absolute', left: x, top: y }}>
            📍
          </div>
        )}
      />
    </div>
  );
}
```

**Children as Function (Render Props via Children)**

```tsx
// ✅ GOOD: Children as function with useEffect
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';

function DataFetcher({ fetchFn, children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetchFn();
        if (!cancelled) {
          setData(response.data[0]);
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

    loadData();

    return () => {
      cancelled = true;
    };
  }, [fetchFn]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;
  return children({ data });
}

// Usage with Api2
function UserProfile() {
  return (
    <DataFetcher fetchFn={() => Api2.getMe()}>
      {({ data }) => <div>Hello, {data?.name}</div>}
    </DataFetcher>
  );
}
```

**Compound Components Pattern**

Components that work together with shared state.

```tsx
// ✅ GOOD: Compound components for flexible composition
import { createContext, useContext, useState } from 'react';

const TabsContext = createContext();

function Tabs({ children, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

function TabList({ children }) {
  return <div className="tab-list">{children}</div>;
}

function Tab({ id, children }) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === id;

  return (
    <button
      className={isActive ? 'tab active' : 'tab'}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
}

function TabPanel({ id, children }) {
  const { activeTab } = useContext(TabsContext);
  return activeTab === id ? <div className="tab-panel">{children}</div> : null;
}

// Attach sub-components
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;

// Usage - flexible and declarative
function App() {
  return (
    <Tabs defaultTab="home">
      <Tabs.List>
        <Tabs.Tab id="home">Home</Tabs.Tab>
        <Tabs.Tab id="profile">Profile</Tabs.Tab>
        <Tabs.Tab id="settings">Settings</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel id="home">
        <h2>Home Content</h2>
      </Tabs.Panel>
      <Tabs.Panel id="profile">
        <h2>Profile Content</h2>
      </Tabs.Panel>
      <Tabs.Panel id="settings">
        <h2>Settings Content</h2>
      </Tabs.Panel>
    </Tabs>
  );
}
```

**Slots Pattern (Named Children)**

```tsx
// ✅ GOOD: Slots for flexible layouts
function Card({ header, footer, children }) {
  return (
    <div className="card">
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

// Usage
function UserCard({ user }) {
  return (
    <Card
      header={<img src={user.avatar} alt={user.name} />}
      footer={
        <div>
          <button>Follow</button>
          <button>Message</button>
        </div>
      }
    >
      <h2>{user.name}</h2>
      <p>{user.bio}</p>
    </Card>
  );
}

// ✅ ALSO GOOD: Children object for named slots
function Layout({ children }) {
  return (
    <div className="layout">
      <aside className="sidebar">{children.sidebar}</aside>
      <main className="content">{children.content}</main>
    </div>
  );
}

// Usage
function App() {
  return (
    <Layout>
      {{
        sidebar: <Navigation />,
        content: <MainContent />,
      }}
    </Layout>
  );
}
```

**Higher-Order Component (HOC) - Use Sparingly**

HOCs are less common in modern React (prefer hooks), but still useful for certain cross-cutting concerns.

```tsx
// ✅ GOOD: HOC for cross-cutting concerns (use hooks when possible instead)
function withLoading(Component) {
  return function WithLoadingComponent({ isLoading, ...props }) {
    if (isLoading) {
      return <div>Loading...</div>;
    }
    return <Component {...props} />;
  };
}

// Usage
function UserList({ users }) {
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

const UserListWithLoading = withLoading(UserList);

function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  return <UserListWithLoading users={users} isLoading={loading} />;
}

// ✅ BETTER: Use custom hook instead (modern approach)
// Note: In React 19 SPAs, prefer use() hook with Api2 - see Section 11.3
function useData(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In practice, use Api2 instead of fetch
    fetch(url).then(r => r.json()).then(data => {
      setData(data);
      setLoading(false);
    });
  }, [url]);

  return { data, loading };
}

function UserList() {
  const { data: users, loading } = useData('/api/users');

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

**When to Use Each Pattern**
- **Render props / Children as function**: Flexible rendering based on shared logic
- **Compound components**: Related components that share state (tabs, accordions, menus)
- **Slots**: Flexible layouts with named regions
- **HOCs**: Cross-cutting concerns (prefer hooks in modern React)
- **Custom hooks**: Reusable stateful logic (preferred modern approach)

**Sources**
- https://react.dev/learn/thinking-in-react
- https://www.patterns.dev/react/render-props-pattern
- https://www.patterns.dev/react/compound-pattern
- https://www.geeksforgeeks.org/reactjs/react-architecture-pattern-and-best-practices/

### 3. Custom Hooks: Share Logic, Not Components

Extract reusable stateful logic into custom hooks to keep components focused on rendering.

**Practice**
- Move complex stateful logic into **custom hooks**
- Hooks should return **authoritative state + derived values** (computed, not stored)
- Hide complexity behind a small, stable hook API
- Name hooks with `use` prefix

**Why / Problems it solves**
- Eliminates copy-paste logic across components
- Keeps components focused on UI rendering
- Centralizes tricky state transitions so the whole app behaves consistently
- Makes logic testable independently from UI

**Signals to introduce hooks**
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

**Sources**
- https://react.dev/learn/reusing-logic-with-custom-hooks
- https://react.dev/learn/thinking-in-react

---

## Part 3: State Management

### 4. State Management Philosophy: Local First, Scale Carefully

Keep state as local as possible and only lift it when necessary.

**Practice**
- Keep state **local** by default using `useState` or `useReducer`
- **Lift state** to the nearest common parent only when two or more siblings need it
- Use Context for **low-frequency, cross-cutting state** (theme, auth, locale) - not everything
- Don't make state global prematurely

**Why / Problems it solves**
- Local state reduces coupling and makes data flow explicit
- Over-globalizing state creates tangled dependencies and unnecessary re-render fan-out
- Lifting state only as needed keeps components reusable and testable
- Context is better than prop drilling but worse than local state for performance

**Signals to consider a state management library**
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

#### 4.1 useSyncExternalStore: Subscribe to External State

Use `useSyncExternalStore` to subscribe to external state sources like browser APIs, third-party stores, or global variables.

**Practice**
- Use `useSyncExternalStore` for subscribing to external state (not managed by React)
- Provide a subscribe function that registers/unregisters listeners
- Provide a getSnapshot function that returns current state
- Optionally provide getServerSnapshot for SSR (not needed for SPAs)

**Why / Problems it solves**
- Safely integrates external state with React's rendering
- Prevents tearing (inconsistent state during concurrent rendering)
- Works correctly with React 19's concurrent features
- Standard way to connect non-React state to React

**Signals to use useSyncExternalStore**
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

**Example: localStorage Sync**

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

**Example: Media Query Matching**

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

**Example: Custom External Store**

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

**Sources**
- https://react.dev/reference/react/useSyncExternalStore
- https://react.dev/learn/thinking-in-react
- https://www.geeksforgeeks.org/reactjs/react-architecture-pattern-and-best-practices/

### 5. Use useReducer for Complex State Logic

When state updates involve multiple sub-values or complex transitions, useReducer provides better organization than multiple useState calls.

**Practice**
- Use `useReducer` for state that involves multiple related values
- Centralize state update logic in a reducer function
- Dispatch actions to describe what happened, not how to update
- Keep reducer functions pure (no side effects)

**Why / Problems it solves**
- Centralizes complex state transitions in one place
- Reduces scattered state update logic and duplication
- Makes state changes more predictable and testable
- Better separation of concerns: components describe intent, reducer handles mechanics

**Signals to use useReducer**
- Multiple `useState` calls that are updated together
- State updates that depend on previous state in complex ways
- Same calculation logic repeated across multiple state updates

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
    const discountAmount = calculateDiscount(code, total);
    setDiscount(discountAmount);
    setTotal(total - discountAmount);
    setTax((total - discountAmount) * 0.08);
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

**Sources**
- https://react.dev/reference/react/useReducer

### 6. Derived State: Rules and Best Practices

Understanding derived state is critical to avoiding bugs and unnecessary complexity.

#### 6.1 Core Rule: Don't Store Derived State

If you can compute a value from props or other state during render, don't store it in state.

**Practice**
- **Don't store derived state** if you can compute it from existing state/props
- Compute inline during render - React Compiler handles optimization automatically (see Section 9 for details)
- Only add `useMemo` after profiling shows a specific performance issue (rare with compiler - see Section 10)
- Never maintain two sources of truth for the same information

**Why / Problems it solves**
- Avoids **two sources of truth** drifting out of sync
- Prevents "stale UI" bugs where updates don't propagate
- Eliminates entire categories of synchronization bugs
- React community treats redundant derived state as a primary anti-pattern

**Signals you're storing derived state**
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
// Only add after profiling shows a specific bottleneck (see Section 10).
```

**Sources**
- https://legacy.reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html
- https://www.freecodecamp.org/news/simplify-react-components-with-derived-state/

#### 6.2 Don't Use Effects for Derivation

Never use `useEffect` to compute values from other state or props. Effects run after paint, causing extra renders.

**Practice**
- **Do not** write: `useEffect(() => setX(deriveY(y)), [y])` for pure derivation
- Instead: `const x = deriveY(y)` - React Compiler handles optimization (see Section 9)
- Only add `useMemo` after profiling shows a specific bottleneck (rare - see Section 10)
- Effects are for side effects (network, subscriptions), not computation

**Why / Problems it solves**
- Effects run **after paint**, causing unnecessary extra renders
- Creates "one step behind" UI where derived values lag
- Dependency mistakes can create infinite loops or stale derivations
- Makes code harder to reason about - derivations should be synchronous

**Signals you're misusing effects**
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

**Sources**
- https://react.dev/learn/you-might-not-need-an-effect
- https://julvo.com/posts/react/derived-state/
- https://stackoverflow.com/questions/73355860/should-useeffect-be-used-to-get-derived-state-from-props

#### 6.3 When Deriving State from Props Is OK (Rare Cases)

There are a few legitimate cases where you need to derive state from props, but they're rare.

**Practice**

**Case 1: One-time initialization from props**
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

**Case 2: Reset internal state when prop identity changes**
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

**Case 3: True caches / previous-value tracking**
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

**Sources**
- https://legacy.reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html
- https://react.dev/learn/you-might-not-need-an-effect

#### 6.4 Signals You're in Derived-State Trouble

**Red flags:**
- State mirrors other state or props (e.g., `items` + `filteredItems` both in state)
- Effects exist solely to keep values in sync with no external side effects
- Bugs sound like "lags one render behind" or "resets unexpectedly"
- You're using `useEffect` to compute values from other values

**What to do:**
1. Remove the derived state variable
2. Compute the value during render
3. Use `useMemo` only if computation is expensive (measure first)

**Sources**
- https://react.dev/learn/you-might-not-need-an-effect
- https://julvo.com/posts/react/derived-state/

#### 6.5 Custom Hooks as the Solution

When derived state logic is complex, extract it into a custom hook.

**Practice**
- Put **authoritative state** in the hook
- Return **derived values computed on demand** (no redundant storage)
- Let React Compiler optimize - only add `useMemo` after profiling shows need (see Sections 9-10 for optimization guidance)

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

**Sources**
- https://react.dev/learn/reusing-logic-with-custom-hooks
- https://react.dev/learn/you-might-not-need-an-effect

### 7. Effects: For Side Effects and Data Fetching

Use `useEffect` to synchronize with external systems and fetch data in your SPA.

**Practice**
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
  - See Section 4.1 for full `useSyncExternalStore` documentation
- **DO NOT use useEffect for**:
  - Computing derived values (compute during render - see Section 6)
  - Responding to prop changes (handle in render or event handlers)
  - Reading external state values (use `useSyncExternalStore` instead)
- Always clean up effects that create subscriptions or register listeners
- Keep effects minimal with explicit dependencies
- Encapsulate data fetching logic in custom hooks when reused across components

**Why / Problems it solves**
- Effects provide a clean way to handle async operations like data fetching
- Custom hooks with effects keep components focused on rendering
- Proper cleanup prevents memory leaks and stale subscriptions
- Separating sync logic from rendering logic makes code clearer

**Signals you misused an effect**
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

**Data Fetching with useEffect and Api2**

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

**When useEffect vs useSyncExternalStore:**
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

**Sources**
- https://react.dev/learn/you-might-not-need-an-effect
- https://react.dev/learn/synchronizing-with-effects

---

## Part 4: Advanced Patterns

### 8. Refs & Imperative APIs

#### 8.1 Refs Are an Escape Hatch

Refs provide imperative access to DOM elements and mutable values that don't trigger re-renders.

**Practice**
- Use refs when you need imperative access to:
  - DOM focus/selection/scroll/measurement
  - Media controls (play, pause)
  - Third-party imperative widgets (maps, charts)
  - Mutable "memory" that should NOT re-render UI (timers, previous values)

**Why / Problems it solves**
- Refs persist across renders without causing re-renders
- Bridge React's declarative model to imperative systems safely
- Enable performance optimizations by avoiding unnecessary renders

**Signals to use refs**
- Need to call imperative DOM methods (focus, scrollIntoView)
- Need to store values that change but shouldn't trigger renders
- Integrating with imperative third-party libraries

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

**Sources**
- https://react.dev/reference/react/forwardRef
- https://react.dev/reference/react (refs overview)
- https://dev.to/logrocket/how-to-use-forwardref-in-react-2c4p

#### 8.2 Avoid Refs for UI State

If a value affects rendering, it belongs in state, not a ref.

**Practice**
- Use **state** for values that affect what the user sees
- Use **refs** only for values that don't affect rendering
- Don't use refs as a way to bypass React's rendering model

**Why / Problems it solves**
- Mutating refs **doesn't re-render**, leading to UI desync
- Creates hidden data flow that's hard to debug
- Violates React's declarative model

**Signals you're misusing refs**
- You're reading refs during render to decide what to show
- You're mutating refs instead of calling setState
- Bugs feel like "updates only after a second interaction"

```tsx
// ❌ BAD: Using ref for UI state causes desync
function Counter() {
  const countRef = useRef(0);

  const increment = () => {
    countRef.current++; // Updates ref but doesn't re-render!
  };

  return (
    <div>
      <p>Count: {countRef.current}</p> {/* Never updates on screen */}
      <button onClick={increment}>Increment</button>
    </div>
  );
}

// ✅ GOOD: Use state for values that affect UI
function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1); // Triggers re-render
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}
```

**Sources**
- https://react.dev/reference/react/forwardRef
- https://borstch.com/blog/development/mastering-refs-in-react-18-useref-and-useimperativehandle-explained

#### 8.3 Imperative Handles with forwardRef and useImperativeHandle

Expose small, intentional imperative APIs from components when parents need to trigger actions.

**Practice**
- Use `forwardRef` to accept a ref from a parent
- Use `useImperativeHandle` to expose only specific methods
- Keep the exposed API minimal (focus, reset, scrollTo)
- Never expose the full DOM or broad "god handles"

**Why / Problems it solves**
- Maintains component encapsulation while enabling necessary imperative control
- Prevents parents from depending on internal implementation details
- Makes the contract between parent and child explicit and minimal

**Signals to use imperative handles**
- Parent needs to trigger actions (focus, play, reset) at specific times
- Third-party libraries require imperative access
- Form reset or validation triggered by parent

```tsx
// ❌ BAD: Exposing entire DOM element breaks encapsulation
const TextInput = forwardRef((props, ref) => {
  return <input ref={ref} {...props} />;
  // Parent can now access the entire DOM element and internal state
});

function Form() {
  const inputRef = useRef();

  const handleSubmit = () => {
    // Parent is tightly coupled to input's internal DOM structure
    inputRef.current.style.border = '1px solid red';
    inputRef.current.value = '';
    inputRef.current.focus();
  };

  return <TextInput ref={inputRef} />;
}

// ✅ GOOD: Minimal imperative API with useImperativeHandle
const TextInput = forwardRef((props, ref) => {
  const inputRef = useRef();

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    reset: () => {
      inputRef.current.value = '';
    },
  }));

  return <input ref={inputRef} {...props} />;
});

function Form() {
  const inputRef = useRef();

  const handleSubmit = () => {
    // Parent uses clean, explicit API
    inputRef.current.focus();
    inputRef.current.reset();
  };

  return <TextInput ref={inputRef} />;
}
```

**Sources**
- https://react.dev/reference/react/forwardRef
- https://dev.to/logrocket/how-to-use-forwardref-in-react-2c4p
- https://www.codeguage.com/v1/courses/react/advanced-forwarding-refs

#### 8.4 Signals You're Overusing Refs

**Red flags:**
- Many components export large imperative APIs
- Refs are read during render to decide what UI to show
- Bugs feel like "updates only after a second interaction"
- You have more imperative handle methods than props

**What to do:**
- Convert ref-based state to real state
- Reduce imperative handle surface area to 2-3 methods max
- Use declarative props instead of imperative methods where possible

**Sources**
- https://react.dev/reference/react/forwardRef

### 9. React Compiler: Automatic Optimization

React 19's compiler automatically optimizes your components by memoizing them at build time, eliminating most manual performance optimization.

> **Note**: This section provides comprehensive React Compiler documentation. The compiler is referenced throughout this guide (Sections 6, 10, and antipatterns) because it fundamentally changes how you approach optimization - you can write simple, clean code and trust the compiler to optimize it. This is why you'll see repeated mentions of "let the compiler handle it" - it's the modern React 19 mindset.

**Practice**
- Enable React Compiler in your build configuration (Babel/SWC plugin)
- Let the compiler handle component and value memoization automatically
- Only opt-out of compiler optimization when necessary using `'use no memo'` directive
- Remove manual `React.memo`, `useMemo`, and `useCallback` in new code (compiler handles these)
- Keep manual memoization only for:
  - Components that need fine-grained control
  - Expensive computations that the compiler can't detect
  - Third-party library integration edge cases

**Why / Problems it solves**
- Eliminates the need for developers to manually identify and fix performance issues
- Prevents over-memoization and under-memoization mistakes
- Reduces cognitive overhead - focus on building features, not performance tuning
- Automatically applies optimal memoization strategies that would be tedious to write manually
- Makes code cleaner by removing boilerplate `memo`, `useMemo`, and `useCallback` calls

**Signals to opt-out of compiler**
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

**React Compiler Setup (SPA)**

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

**When to still use manual memoization (rare cases)**

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

**Sources**
- https://react.dev/learn/react-compiler
- https://react.dev/reference/react-compiler/directives/use-memo

### 10. Performance Optimization: When Compiler Isn't Enough

With React Compiler handling automatic optimization, manual performance tuning is rarely needed. Only optimize when profiling shows a real problem that the compiler can't solve.

**Practice**
- **Trust the React Compiler first** - it handles re-render optimization automatically
- **Profile before optimizing** - use React DevTools Profiler to identify real bottlenecks
- Only add manual optimization when:
  - Profiler shows specific performance issues the compiler didn't solve
  - Working with third-party libraries that need reference stability
  - Dealing with truly expensive computations (heavy math, large dataset transformations)
- Avoid manual `React.memo`, `useMemo`, `useCallback` unless you have profiling data showing they help

**Why / Problems it solves**
- React Compiler eliminates 90%+ of manual optimization needs
- Manual optimization in React 19+ often adds unnecessary complexity
- Profiling reveals actual bottlenecks rather than assumed ones
- Compiler-first approach keeps code simple and maintainable

**Signals you might need manual optimization**
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

**Beyond Memoization: Other Performance Patterns**

When manual memoization isn't the answer, consider:
- **Virtualization** for long lists (react-window, react-virtual)
- **Code splitting** for large bundles (see Section 11)
- **useTransition** for non-urgent updates (see Section 12)
- **Web Workers** for CPU-intensive tasks off main thread

**Sources**
- https://react.dev/learn/react-compiler
- https://react.dev/reference/react/memo
- https://react.dev/reference/react/useMemo
- https://react.dev/reference/react/useCallback

### 11. Code Splitting & Lazy Loading

Split your bundle at route or feature boundaries to reduce initial load time.

**Practice**
- Split at **route/page boundaries** first (using React Router + lazy)
- Lazy-load heavy feature modules or components
- Show predictable fallbacks with Suspense
- Consider prefetching on hover for better perceived performance

**Why / Problems it solves**
- Reduces initial bundle size → faster first paint
- Better UX on slow networks
- Avoids shipping code users won't need on first load
- Pay-as-you-go JavaScript loading

**Signals to use code splitting**
- Initial JS chunk is large (>500KB) or startup time degrades
- You have distinct routes or features users might not visit
- Profiling shows initial parse/compile time is significant

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

**Sources**
- https://react.dev/reference/react/lazy
- https://react.dev/reference/react/Suspense
- https://react.dev/blog/2025/02/14/sunsetting-create-react-app
- https://react.dev/learn/build-a-react-app-from-scratch

---

## Part 5: User Experience Patterns

### 11. React 19 Concurrent Features for Better UX

React 19's concurrent features enable responsive UIs by allowing React to interrupt and deprioritize work, keeping the interface smooth during expensive operations.

#### 11.1 useTransition: Non-Blocking State Updates

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

#### 11.2 useDeferredValue: Defer Expensive Renders

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

#### 11.3 Data Fetching with useEffect

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

### 12. Optimistic Updates for Better UX

Provide instant feedback to users using React 19's `useOptimistic` hook.

**Practice**
- Show optimistic state immediately while async operations are in progress
- Use `useOptimistic` to temporarily update UI before server confirms
- Mark optimistic items visually (opacity, pending indicator)
- Handle failures gracefully by reverting optimistic updates

**Why / Problems it solves**
- Makes the app feel instant and responsive
- Reduces perceived latency for user actions
- Improves user confidence that their action was registered
- Modern apps feel slow without optimistic updates

**Signals to use optimistic updates**
- User performs actions that trigger network requests (create, update, delete)
- Users complain app feels slow or unresponsive
- There's a noticeable delay between action and feedback

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

**Sources**
- https://react.dev/reference/react/useOptimistic

### 13. Form Handling with Client-Side Actions

Use React 19's `useActionState` for declarative form handling with built-in pending states and error handling in your SPA.

**Practice**
- Use `useActionState` for form submission with automatic pending states
- Define **client-side actions** as async functions that receive previous state and FormData
- Actions handle API calls, validation, and state updates
- Return state objects with success/error information
- Use form's `action` prop instead of `onSubmit` with React 19
- Let FormData handle input values (uncontrolled forms when possible)
- Use `useFormStatus` in child components to access form pending state

**Why / Problems it solves**
- Eliminates boilerplate for loading states and error handling
- Declarative form handling is easier to reason about
- Built-in pending state without manual useState
- Reduces bugs from scattered form state management
- Cleaner separation between form UI and submission logic
- Works seamlessly with client-side API calls in SPAs

**Signals to use useActionState**
- Form submission triggers async operations (API calls in SPA)
- Need to track loading state and display errors
- Multiple forms with similar submission patterns
- Want to eliminate manual useState for form states

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

// ✅ GOOD: Declarative form handling with useActionState and Api2
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';

// Action function uses Api2
async function submitCaseNote(prevState, formData) {
  try {
    const caseId = formData.get('caseId') as string;
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;

    await Api2.postCaseNote({ caseId, title, content });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function CaseNoteForm({ caseId }) {
  const [state, formAction, isPending] = useActionState(submitCaseNote, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input name="title" placeholder="Note title" required />
      <textarea name="content" placeholder="Note content" required />
      <button disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Note added!</p>}
    </form>
  );
}
```

**Using useFormStatus in Child Components**

The `useFormStatus` hook allows child components to access the parent form's pending state.

```tsx
// ✅ GOOD: useFormStatus for reusable submit buttons with Api2
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';

function SubmitButton({ children }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : children}
    </button>
  );
}

async function submitTrustee(prevState, formData) {
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const email = formData.get('email') as string;

  try {
    await Api2.postTrustee({ firstName, lastName, email });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function TrusteeForm() {
  const [state, formAction] = useActionState(submitTrustee, null);

  return (
    <form action={formAction}>
      <input name="firstName" placeholder="First Name" required />
      <input name="lastName" placeholder="Last Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <SubmitButton>Add Trustee</SubmitButton>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Trustee added!</p>}
    </form>
  );
}
```

**Client-Side Validation with Actions and Api2**

```tsx
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

const subscriptionSpec: ValidationSpec<{ email: string }> = {
  email: [Validators.isEmailAddress],
};

async function submitWithValidation(prevState, formData) {
  const email = formData.get('email') as string;

  // Client-side validation using our validation library
  const validationResult = validateObject(subscriptionSpec, { email });

  if (!validationResult.valid) {
    return {
      success: false,
      error: 'Invalid email address',
      fieldErrors: validationResult.reasonMap,
    };
  }

  // API call with Api2
  try {
    await Api2.post('/subscribe', { email });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function SubscriptionForm() {
  const [state, formAction, isPending] = useActionState(submitWithValidation, null);

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <button disabled={isPending}>Subscribe</button>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Subscribed!</p>}
    </form>
  );
}
```

**Sources**
- https://react.dev/reference/react/useActionState
- https://react.dev/reference/react-dom/hooks/useFormStatus
- https://react.dev/reference/react-dom/components/form

### 14. Error Handling & Resilience

Create resilient UIs by handling errors and loading states at appropriate boundaries.

**Practice**
- Add **Error Boundaries** around route pages and major feature zones
- Combine Error Boundaries with Suspense for complete loading + error handling
- Log errors to monitoring services in boundary's `onError`
- Provide recovery actions (retry button)
- Show appropriate fallback UI for different error types

**Why / Problems it solves**
- Prevents a localized bug from blanking out the whole SPA
- Enables graceful degradation when features fail
- Gives users recovery options instead of broken UI
- Provides observability into production errors

**Signals to add error boundaries**
- A single component error crashes the entire app
- Need to handle async errors in different parts of the UI differently
- Want to show skeleton loading states while data loads

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
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

function App() {
  const { appInsights } = getAppInsights();

  const logError = (error: Error, errorInfo: { componentStack: string }) => {
    // Log to Application Insights
    appInsights.trackException({
      exception: error,
      properties: {
        componentStack: errorInfo.componentStack,
      },
    });
  };

  return (
    <div>
      <Header />
      <ErrorBoundary
        fallback={<ErrorFallback />}
        onError={logError}
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

**Error Boundary Limitations (Important)**

Error boundaries have limitations you need to handle separately:

```tsx
// ❌ Error boundaries DON'T catch these errors:
function ProblematicComponent() {
  // 1. Event handlers (not caught by Error Boundary)
  const handleClick = () => {
    throw new Error('Event handler error'); // Not caught!
  };

  useEffect(() => {
    // 2. Async errors in effects (not caught by Error Boundary)
    fetch('/api/data')
      .then(res => res.json())
      .catch(err => {
        throw err; // Not caught by Error Boundary!
      });
  }, []);

  // 3. Errors in setTimeout/setInterval (not caught)
  setTimeout(() => {
    throw new Error('Timer error'); // Not caught!
  }, 1000);

  return <button onClick={handleClick}>Click</button>;
}

// ✅ GOOD: Handle these cases explicitly
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

function SafeComponent() {
  const [error, setError] = useState(null);
  const { appInsights } = getAppInsights();

  // Handle event handler errors with try-catch
  const handleClick = () => {
    try {
      riskyOperation();
    } catch (err) {
      setError(err);
      // Log to Application Insights
      appInsights.trackException({ exception: err });
    }
  };

  // Use use() hook for data fetching - errors caught by Error Boundary
  const data = use(fetchData()); // ✅ Caught by Error Boundary

  if (error) return <div>Error: {error.message}</div>;
  return <button onClick={handleClick}>Click</button>;
}
```

**Error Handling with Actions**

Actions in forms automatically catch errors - handle them in the action return value:

```tsx
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';

async function submitAction(prevState, formData) {
  try {
    const caseId = formData.get('caseId') as string;
    const note = formData.get('note') as string;

    // Api2 automatically handles authentication and throws on error
    await Api2.postCaseNote({ caseId, title: 'Note', content: note });

    return { success: true, error: null };
  } catch (error) {
    // Handle errors from Api2
    return {
      success: false,
      error: error.message || 'Submission failed. Please try again.'
    };
  }
}

function Form({ caseId }) {
  const [state, formAction] = useActionState(submitAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <textarea name="note" placeholder="Enter case note" required />
      <button type="submit">Submit</button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
```

**Retry Strategies for SPAs**

```tsx
// ✅ GOOD: Retry with exponential backoff
function ErrorFallbackWithRetry({ error, resetErrorBoundary }) {
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = async () => {
    setRetrying(true);

    // Exponential backoff: wait 1s, 2s, 4s...
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    setRetryCount(retryCount + 1);
    setRetrying(false);
    resetErrorBoundary();
  };

  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={handleRetry} disabled={retrying}>
        {retrying ? 'Retrying...' : 'Try Again'}
      </button>
      {retryCount > 0 && <p>Retry attempt: {retryCount}</p>}
    </div>
  );
}
```

**Error Logging for SPAs**

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

function App() {
  const { appInsights } = getAppInsights();

  const logErrorToApplicationInsights = (error: Error, errorInfo: { componentStack: string }) => {
    // Log error details to console for debugging
    console.error('Error caught:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // Send to Application Insights
    appInsights.trackException({
      exception: error,
      properties: {
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      },
    });
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={logErrorToApplicationInsights}
      onReset={() => {
        // Reset app state if needed
        window.location.href = '/';
      }}
    >
      <Routes />
    </ErrorBoundary>
  );
}
```

**Different Error UI for Different Scenarios**

```tsx
// ✅ GOOD: Context-specific error messages
function ErrorFallback({ error, resetErrorBoundary }) {
  // Network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return (
      <div role="alert">
        <h2>Connection Problem</h2>
        <p>Please check your internet connection and try again.</p>
        <button onClick={resetErrorBoundary}>Retry</button>
      </div>
    );
  }

  // Authentication errors
  if (error.message.includes('401') || error.message.includes('auth')) {
    return (
      <div role="alert">
        <h2>Session Expired</h2>
        <p>Please log in again to continue.</p>
        <button onClick={() => (window.location.href = '/login')}>
          Go to Login
        </button>
      </div>
    );
  }

  // Generic errors
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  );
}
```

**Sources**
- https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- https://github.com/bvaughn/react-error-boundary

---

## Part 6: Code Quality

### 14. TypeScript Best Practices for React 19 SPAs

Make invisible contracts explicit with TypeScript. Use types to catch bugs at compile time and improve developer experience.

**Practice**
- Type all component props, hook inputs/outputs, and public APIs
- Use discriminated unions for complex UI states (loading | error | success)
- Keep types colocated with the code that uses them (feature-based)
- Use `unknown` instead of `any` when type is truly unknown
- Type React 19 features: Actions, FormData, custom hooks
- Use generics for reusable components and hooks
- Leverage type narrowing for safer code
- Avoid `React.FC` - explicit return types are clearer

**Why / Problems it solves**
- Catches interface bugs at compile time
- Improves refactoring confidence and IDE autocomplete
- Documents intent for onboarding and maintenance
- Prevents prop type mismatches and null reference errors
- React 19 features benefit greatly from proper typing

**Signals to improve TypeScript usage**
- Runtime errors for undefined props or wrong types
- Frequent use of `any` or type assertions
- Refactoring breaks things that TypeScript should catch
- No types for Actions or form handlers

```tsx
// ❌ BAD: No types, implicit any, runtime errors likely
function UserCard({ user }) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <p>Joined: {user.createdAt}</p>
    </div>
  );
}

// ✅ GOOD: Explicit types prevent bugs
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO date string from API
}

interface UserCardProps {
  user: User;
  onEdit?: (userId: string) => void;
}

function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <p>Joined: {user.createdAt}</p>
      {onEdit && <button onClick={() => onEdit(user.id)}>Edit</button>}
    </div>
  );
}

// ✅ ALSO GOOD: React 19 with Api2 and useEffect
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';
import { CaseSearchResponse } from '@common/cams/cases';

function CasesList() {
  const [cases, setCases] = useState<CaseSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCases = async () => {
      try {
        setLoading(true);
        const response = await Api2.searchCases({ query: '', filters: {} });
        if (!cancelled) {
          setCases(response);
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

    fetchCases();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div>Loading cases...</div>;
  if (error) return <div>Error loading cases: {error.message}</div>;
  if (!cases) return null;

  return (
    <ul>
      {cases.data.map(caseItem => (
        <li key={caseItem.caseId}>{caseItem.caseId}</li>
      ))}
    </ul>
  );
}
```

**React 19: Typing Actions and Forms with Api2**

```tsx
// ✅ GOOD: Type Actions with FormData and Api2
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';
import { CaseNote } from '@common/cams/cases';
import { ResponseBody } from '@common/api/response';

type ActionState = {
  success: boolean;
  error: string | null;
  data?: CaseNote;
};

// Define validation specification with project's validation library
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

interface CaseNoteFormData {
  caseId: string;
  title: string;
  content: string;
}

const caseNoteSpec: ValidationSpec<CaseNoteFormData> = {
  caseId: [Validators.minLength(1, 'Case ID is required')],
  title: [Validators.minLength(1, 'Title is required')],
  content: [Validators.minLength(1, 'Content is required')],
};

async function submitCaseNoteAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const data: CaseNoteFormData = {
    caseId: formData.get('caseId') as string,
    title: formData.get('title') as string,
    content: formData.get('content') as string,
  };

  // Validate with project's validation library
  const validationResult = validateObject(caseNoteSpec, data);

  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.reasons.join(', '),
    };
  }

  try {
    // Api2 methods are fully typed
    const response: ResponseBody<CaseNote> | void = await Api2.postCaseNote({
      caseId: data.caseId,
      title: data.title,
      content: data.content,
    });

    return { success: true, error: null, data: response?.data[0] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function CaseNoteForm({ caseId }: { caseId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState | null>(
    submitCaseNoteAction,
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input name="title" placeholder="Note title" required />
      <textarea name="content" placeholder="Note content" required />
      <button disabled={isPending}>Submit</button>
      {state?.error && <p>{state.error}</p>}
      {state?.success && <p>Note added: {state.data?.id}</p>}
    </form>
  );
}
```

**Project-Specific: Lightweight Validation Library**

Instead of using heavy validation libraries like zod, this project uses a lightweight, bespoke validation library located at `common/src/cams/validation.ts` and `common/src/cams/validators.ts`.

```tsx
// ✅ GOOD: Using project's validation library
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

// Define validation specification
interface TrusteeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

const trusteeValidationSpec: ValidationSpec<TrusteeInput> = {
  firstName: [Validators.minLength(1, 'First name is required')],
  lastName: [Validators.minLength(1, 'Last name is required')],
  email: [Validators.isEmailAddress],
  phone: [Validators.optional(Validators.isPhoneNumber)],
};

// Use in action
async function submitTrustee(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const data = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string | undefined,
  };

  // Validate with our library
  const validationResult = validateObject(trusteeValidationSpec, data);

  if (!validationResult.valid) {
    // validationResult.reasonMap contains field-specific errors
    const errors = flatten(validationResult.reasonMap);
    return {
      success: false,
      error: errors.join(', '),
      fieldErrors: validationResult.reasonMap,
    };
  }

  // Proceed with validated data using Api2
  try {
    await Api2.postTrustee(data);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Failed to submit' };
  }
}

function TrusteeForm() {
  const [state, formAction, isPending] = useActionState(submitTrustee, null);

  return (
    <form action={formAction}>
      <input name="firstName" placeholder="First Name" required />
      <input name="lastName" placeholder="Last Name" required />
      <input name="email" type="email" required />
      <input name="phone" type="tel" />
      <button disabled={isPending}>Add Trustee</button>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Trustee added!</p>}
    </form>
  );
}
```

**Available Validators**:
- `minLength(min, reason?)` - Minimum length for strings/arrays
- `maxLength(max, reason?)` - Maximum length for strings/arrays
- `exactLength(len, reason?)` - Exact length requirement
- `isEmailAddress` - Email format validation
- `isPhoneNumber` - Phone number format (10 digits)
- `isWebsiteAddress` - Website URL format
- `isInSet(set, reason?)` - Value must be in allowed set
- `matches(regex, reason?)` - Custom regex matching
- `optional(...validators)` - Allows undefined values
- `nullable(...validators)` - Allows null values
- `arrayOf(...validators)` - Validates array elements
- `spec(validationSpec)` - Nested object validation

**Why This Instead of Zod**:
- **Lightweight**: ~200 lines vs 10KB+ minified
- **Good Fences**: No external validation library dependency
- **Type-Safe**: Full TypeScript support with generics
- **Sufficient**: Meets project's validation needs without complexity
- **Customizable**: Easy to extend with project-specific validators

**When to Consider Alternatives**:
- Complex schema transformations needed
- Advanced coercion or parsing logic
- Cross-field validation dependencies become unwieldy
- In these rare cases, consider zod but isolate it behind an abstraction layer

**unknown vs any: Be Specific**

```tsx
// ❌ BAD: any bypasses type checking
function processData(data: any) {
  return data.value.toUpperCase(); // No type safety!
}

// ✅ GOOD: unknown forces type checking
function processData(data: unknown) {
  // Must narrow type before use
  if (typeof data === 'object' && data !== null && 'value' in data) {
    const record = data as Record<string, unknown>;
    if (typeof record.value === 'string') {
      return record.value.toUpperCase(); // Type safe!
    }
  }
  throw new Error('Invalid data format');
}

// ✅ ALSO GOOD: Define expected shape
interface DataShape {
  value: string;
}

function processData(data: unknown): string {
  // Type guard
  if (isDataShape(data)) {
    return data.value.toUpperCase();
  }
  throw new Error('Invalid data format');
}

function isDataShape(data: unknown): data is DataShape {
  return (
    typeof data === 'object' &&
    data !== null &&
    'value' in data &&
    typeof (data as DataShape).value === 'string'
  );
}
```

**Generics for Reusable Components**

```tsx
// ✅ GOOD: Generic list component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
}

function List<T>({ items, renderItem, keyExtractor, emptyMessage }: ListProps<T>) {
  if (items.length === 0) {
    return <div>{emptyMessage || 'No items'}</div>;
  }

  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

// Usage with type inference
interface User {
  id: number;
  name: string;
}

function UserList({ users }: { users: User[] }) {
  return (
    <List
      items={users}
      renderItem={user => <span>{user.name}</span>}
      keyExtractor={user => user.id}
      emptyMessage="No users found"
    />
  );
}
```

**Generic Custom Hooks with React 19 Patterns**

```tsx
// ✅ GOOD: Generic data fetching with useEffect (React 19 SPA, when pattern repeats)
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';
import { ResponseBody } from '@common/api/response';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

// Generic hook that uses useEffect for data fetching
function useApiData<T>(
  fetchFn: () => Promise<ResponseBody<T>>,
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

// Usage with Api2 and proper TypeScript inference
import { CaseDetail } from '@common/cams/cases';

function CaseProfile({ caseId }: { caseId: string }) {
  // TypeScript infers data as CaseDetail | null
  const { data: caseData, loading, error } = useApiData<CaseDetail>(
    () => Api2.getCaseDetail(caseId),
    [caseId]
  );

  if (loading) return <div>Loading case...</div>;
  if (error) return <div>Failed to load case: {error.message}</div>;
  if (!caseData) return null;

  return <div>Case: {caseData.caseId}</div>;
}
```

**Type Narrowing Patterns**

```tsx
// ✅ GOOD: Discriminated union with type narrowing
type ApiResponse<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

function DataDisplay<T>({ response }: { response: ApiResponse<T> }) {
  // TypeScript narrows type in each branch
  if (response.status === 'loading') {
    return <div>Loading...</div>;
  }

  if (response.status === 'error') {
    // TypeScript knows response.error exists here
    return <div>Error: {response.error}</div>;
  }

  // TypeScript knows response.data exists here
  return <div>Data: {JSON.stringify(response.data)}</div>;
}

// ✅ GOOD: Type guards for narrowing
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function processValue(value: unknown) {
  if (isString(value)) {
    // TypeScript knows value is string
    return value.toUpperCase();
  }

  if (isNumber(value)) {
    // TypeScript knows value is number
    return value.toFixed(2);
  }

  throw new Error('Unsupported type');
}
```

**Utility Types for React 19**

```tsx
// ✅ GOOD: Extract prop types from components
function Button({ variant, children }: { variant: 'primary' | 'secondary'; children: React.ReactNode }) {
  return <button className={variant}>{children}</button>;
}

type ButtonProps = React.ComponentProps<typeof Button>;
// { variant: 'primary' | 'secondary'; children: React.ReactNode }

// ✅ GOOD: Pick and Omit for prop variations
interface BaseProps {
  id: string;
  name: string;
  email: string;
  role: string;
}

type CreateUserProps = Omit<BaseProps, 'id'>; // No id when creating
type UserDisplayProps = Pick<BaseProps, 'name' | 'email'>; // Only name/email for display

// ✅ GOOD: Readonly for immutable props
interface ImmutableConfig {
  readonly apiUrl: string;
  readonly timeout: number;
}

function useConfig(config: ImmutableConfig) {
  // config.apiUrl = 'new-url'; // TypeScript error!
  return config;
}
```

**Sources**
- https://react.dev/learn/typescript
- https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- https://www.typescriptlang.org/docs/handbook/utility-types.html

### 15. Testing: Comprehensive Testing Strategy for React 19 SPAs

Test user behavior, not implementation details. Combine unit, integration, and end-to-end tests for confidence.

#### 15.1 Testing Philosophy & ESLint

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

#### 15.2 Testing Custom Hooks

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

#### 15.3 Testing Async Behavior and Suspense

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

#### 15.4 Mocking API Calls with MSW

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

#### 15.5 Testing Forms and Actions

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

#### 15.6 Integration Testing

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

#### 15.7 End-to-End Testing

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
```bash
# Run all E2E tests
cd test/e2e
npm test

# Run specific test file
npx playwright test playwright/cases.test.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug

# Generate report
npx playwright show-report
```

**Testing Strategy Summary**
- **Unit tests**: Individual components, hooks, utilities (fast, many tests)
- **Integration tests**: Component interactions, user flows (moderate, focused tests)
- **E2E tests**: Critical user journeys with Playwright in `test/e2e/` (slow, few tests)

**Sources**
- https://testing-library.com/docs/react-testing-library/intro
- https://mswjs.io/docs/
- https://playwright.dev/
- https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

### 16. Anti-overengineering: Add Tools Only with Clear Signals

Default to React primitives. Add tools when they remove real complexity, not to match trends.

**Practice**
- Start with built-in React patterns (useState, useContext, custom hooks)
- Add external libraries only when you have **concrete signals** they solve a real pain point
- Don't add tools preemptively "in case we need them later"
- Evaluate libraries based on the problem they solve, not popularity

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

#### 16.1 The "Good Fences" Principle: Isolate Third-Party Dependencies

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

const spec: ValidationSpec<MyData> = {
  email: [Validators.isEmailAddress],
  phone: [Validators.optional(Validators.isPhoneNumber)],
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

### 17. Accessibility (a11y) for SPAs

Build inclusive React applications that work for all users, including those using assistive technologies.

**Practice**
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`)
- Provide text alternatives for non-text content
- Ensure keyboard navigation works throughout your SPA
- Use ARIA attributes only when semantic HTML isn't sufficient
- Manage focus properly during route changes and dynamic updates
- Test with screen readers (NVDA, JAWS, VoiceOver)

**Why / Problems it solves**
- 15% of global population has some form of disability
- Semantic HTML provides built-in accessibility
- Screen reader users rely on proper markup and focus management
- Keyboard-only users need accessible navigation
- SPAs require extra attention for route announcements

**Signals you need a11y improvements**
- Can't navigate your app with keyboard only (Tab, Enter, Escape)
- Dynamic content updates aren't announced to screen readers
- Forms don't have proper labels
- Users complain about accessibility barriers

#### 17.1 Semantic HTML & ARIA

```tsx
// ❌ BAD: Divs and spans for everything
function Navigation() {
  return (
    <div className="nav">
      <div onClick={() => navigate('/')}>Home</div>
      <div onClick={() => navigate('/about')}>About</div>
    </div>
  );
}

// ✅ GOOD: Semantic HTML with proper roles
function Navigation() {
  return (
    <nav aria-label="Main navigation">
      <button onClick={() => navigate('/')}>Home</button>
      <button onClick={() => navigate('/about')}>About</button>
    </nav>
  );
}

// ✅ GOOD: Links for navigation, buttons for actions
function Navigation() {
  return (
    <nav aria-label="Main navigation">
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  );
}
```

#### 17.2 Form Accessibility

```tsx
// ❌ BAD: No labels, no error association
function ContactForm() {
  const [error, setError] = useState('');

  return (
    <form>
      <input type="email" placeholder="Email" />
      {error && <div>{error}</div>}
      <button>Submit</button>
    </form>
  );
}

// ✅ GOOD: Proper labels, error association, and validation
import { useActionState, useId } from 'react';
import { Api2 } from '@/lib/models/api2';
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

const contactSpec: ValidationSpec<{ email: string }> = {
  email: [Validators.isEmailAddress],
};

async function submitContact(prevState, formData) {
  const email = formData.get('email') as string;

  // Validate with project's validation library
  const validationResult = validateObject(contactSpec, { email });

  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.reasons.join(', '),
    };
  }

  try {
    await Api2.post('/contact', { email });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Submission failed' };
  }
}

function ContactForm() {
  const [state, formAction] = useActionState(submitContact, null);
  const emailId = useId();
  const errorId = useId();

  return (
    <form action={formAction}>
      <label htmlFor={emailId}>
        Email address
        <input
          id={emailId}
          name="email"
          type="email"
          aria-invalid={!!state?.error}
          aria-describedby={state?.error ? errorId : undefined}
          required
        />
      </label>
      {state?.error && (
        <p id={errorId} role="alert" aria-live="polite">
          {state.error}
        </p>
      )}
      <button type="submit">Submit</button>
    </form>
  );
}
```

#### 17.3 Focus Management in SPAs

```tsx
// ✅ GOOD: Manage focus on route changes
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function Page({ title, children }) {
  const headingRef = useRef(null);
  const location = useLocation();

  // Focus page heading on route change
  useEffect(() => {
    headingRef.current?.focus();
  }, [location.pathname]);

  return (
    <main>
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {children}
    </main>
  );
}

// ✅ GOOD: Focus first error in form
function Form() {
  const [errors, setErrors] = useState({});
  const firstErrorRef = useRef(null);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      firstErrorRef.current?.focus();
    }
  }, [errors]);

  return (
    <form>
      <input
        ref={errors.email ? firstErrorRef : null}
        aria-invalid={!!errors.email}
      />
    </form>
  );
}
```

#### 17.4 Dynamic Content Announcements

```tsx
// ✅ GOOD: Announce loading and updates to screen readers
function SearchResults({ query }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  return (
    <div>
      {/* Screen reader announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {loading ? 'Loading results...' : `Found ${results.length} results`}
      </div>

      {loading ? (
        <div aria-hidden="true">Loading...</div>
      ) : (
        <ul>
          {results.map(result => (
            <li key={result.id}>{result.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Screen-reader-only CSS
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

#### 17.5 Keyboard Navigation

```tsx
// ✅ GOOD: Full keyboard support
function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus trap
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements?.[0];
    const lastElement = focusableElements?.[focusableElements.length - 1];

    firstElement?.focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }

      // Tab trap
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <h2 id="modal-title">Modal Title</h2>
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

#### 17.6 Skip Links for SPAs

```tsx
// ✅ GOOD: Skip link for keyboard users
function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Routes />
      </main>
    </>
  );
}

// CSS for skip link
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

**Common ARIA Patterns for React SPAs**
- `role="alert"` - Urgent messages (errors)
- `aria-live="polite"` - Non-urgent updates (search results)
- `aria-busy="true"` - Loading states
- `aria-expanded` - Disclosure widgets
- `aria-haspopup` - Menus and dialogs
- `aria-label` - When visible label isn't present
- `aria-describedby` - Additional descriptions (error messages)

**Sources**
- https://www.w3.org/WAI/ARIA/apg/
- https://react.dev/learn/accessibility
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA

### 18. Security Best Practices for SPAs

Protect your React SPA from common security vulnerabilities. Focus on client-side security considerations.

**Practice**
- Sanitize user input before rendering
- Use Content Security Policy (CSP) headers
- Secure authentication tokens properly
- Protect against XSS (Cross-Site Scripting)
- Be cautious with `dangerouslySetInnerHTML`
- Validate data on both client and server
- Use HTTPS for all API calls
- Implement CSRF protection for state-changing operations

**Why / Problems it solves**
- XSS is one of the most common web vulnerabilities
- SPAs are particularly vulnerable to token theft
- Client-side validation alone is insufficient but improves UX
- Proper security protects user data and builds trust

**Signals you need security improvements**
- No CSP headers
- Storing sensitive tokens in localStorage without consideration
- Using `dangerouslySetInnerHTML` without sanitization
- No CSRF protection on mutations
- Accepting and rendering unvalidated user input

#### 18.1 XSS Prevention

```tsx
// ❌ BAD: Dangerous - allows script injection
function UserComment({ comment }) {
  return (
    <div dangerouslySetInnerHTML={{ __html: comment.text }} />
  );
}

// User could inject: <img src=x onerror="alert('XSS')">

// ✅ GOOD: React escapes by default
function UserComment({ comment }) {
  return <div>{comment.text}</div>;
  // React automatically escapes HTML, preventing XSS
}

// ✅ ALSO GOOD: If you must render HTML, sanitize first
import DOMPurify from 'dompurify';

function UserComment({ comment }) {
  const sanitizedHTML = DOMPurify.sanitize(comment.text, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
}
```

#### 18.2 Secure Token Storage in SPAs

```tsx
// ❌ BAD: localStorage is vulnerable to XSS
async function login(credentials) {
  const response = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  const { token } = await response.json();
  localStorage.setItem('authToken', token); // Accessible to any script!
}

// ✅ BETTER: Use httpOnly cookies (server-set)
// Let server set cookie with httpOnly flag:
// Set-Cookie: authToken=xyz; HttpOnly; Secure; SameSite=Strict

// Client-side: Api2 automatically includes credentials
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';

function UserProfile() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Api2 handles authentication headers and credentials automatically
    Api2.getMe().then(response => {
      if (!cancelled) setSession(response.data[0]);
    });
    return () => { cancelled = true; };
  }, []);

  return session ? <div>Welcome, {session.user.name}</div> : null;
}

// ✅ GOOD: If you must use localStorage, use useSyncExternalStore (React 19)
import { useSyncExternalStore } from 'react';

function useAuthToken() {
  // Use useSyncExternalStore for reading localStorage (React 19 best practice)
  const token = useSyncExternalStore(
    (callback) => {
      // Listen for storage events from other tabs/windows
      window.addEventListener('storage', callback);
      return () => window.removeEventListener('storage', callback);
    },
    () => {
      // Only in secure contexts
      if (window.isSecureContext) {
        return localStorage.getItem('authToken');
      }
      return null;
    }
  );

  const saveToken = (newToken: string) => {
    if (window.isSecureContext) {
      localStorage.setItem('authToken', newToken);
      // Trigger update in current window
      window.dispatchEvent(new Event('storage'));
    }
  };

  const clearToken = () => {
    if (window.isSecureContext) {
      localStorage.removeItem('authToken');
      window.dispatchEvent(new Event('storage'));
    }
  };

  return { token, saveToken, clearToken };
}
```

#### 18.3 CSRF Protection for State-Changing Operations

```tsx
// ✅ GOOD: CSRF protection with Api2
// Note: Api2 in this project handles authentication via Bearer tokens in headers
// If your project requires CSRF tokens, Api2 can be extended to include them

import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';

// Example: Custom Api2 extension for CSRF
async function submitActionWithCSRF(prevState, formData) {
  const caseId = formData.get('caseId') as string;
  const note = formData.get('note') as string;

  try {
    // Api2 methods handle authentication automatically
    // For additional CSRF protection, extend Api2's headers
    await Api2.postCaseNote({ caseId, title: 'Note', content: note });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function NoteForm({ caseId }) {
  const [state, formAction] = useActionState(submitActionWithCSRF, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <textarea name="note" required />
      <button type="submit">Submit</button>
      {state?.error && <p>{state.error}</p>}
    </form>
  );
}
```

#### 18.4 Input Validation

```tsx
// ❌ BAD: No validation, trusting client-side only
function SearchBar() {
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    // Directly using unvalidated input in URL
    fetch(`/api/search?q=${query}`)
      .then(r => r.json())
      .then(setResults);
  };

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}

// ✅ GOOD: Client-side validation + server validation with Api2
import { useState } from 'react';
import { Api2 } from '@/lib/models/api2';
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

const searchSpec: ValidationSpec<{ query: string }> = {
  query: [
    Validators.minLength(3, 'Query must be at least 3 characters'),
    Validators.maxLength(100, 'Query too long'),
  ],
};

function CaseSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    // Client-side validation (UX improvement)
    const validationResult = validateObject(searchSpec, { query });

    if (!validationResult.valid) {
      setError(validationResult.reasons.join(', '));
      return;
    }

    try {
      // Api2 handles proper encoding and authentication
      const response = await Api2.searchCases({ query, filters: {} });
      setResults(response.data);
      setError('');
    } catch (err) {
      setError('Search failed');
    }
  };

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        maxLength={100}
        placeholder="Search cases..."
      />
      <button onClick={handleSearch}>Search</button>
      {error && <p role="alert">{error}</p>}
      {results.length > 0 && (
        <ul>
          {results.map(c => <li key={c.caseId}>{c.caseId}</li>)}
        </ul>
      )}
    </div>
  );
}
```

#### 18.5 Content Security Policy (CSP)

```tsx
// Not code - configure in your server or meta tag

// ✅ GOOD: Strict CSP for React SPAs
// In your HTML or server headers:
/*
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  font-src 'self';
  connect-src 'self' https://api.yourdomain.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
*/

// For React apps using inline styles (common):
// style-src 'self' 'unsafe-inline'

// If you need external resources:
// script-src 'self' https://cdn.example.com
// connect-src 'self' https://api.example.com
```

#### 18.6 Secure File Uploads

```tsx
// ✅ GOOD: Validate file types and sizes with validation library
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';
import { useGenericApi } from '@/lib/models/api2';

// Custom validator for file type
const isAllowedFileType = (value: unknown) => {
  if (!(value instanceof File)) {
    return { reasons: ['Value must be a file'] };
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  return allowedTypes.includes(value.type)
    ? { valid: true }
    : { reasons: ['Only JPEG, PNG, and GIF files allowed'] };
};

// Custom validator for file size
const isWithinSizeLimit = (value: unknown) => {
  if (!(value instanceof File)) {
    return { reasons: ['Value must be a file'] };
  }
  const maxSize = 5 * 1024 * 1024; // 5MB
  return value.size <= maxSize
    ? { valid: true }
    : { reasons: ['File must be smaller than 5MB'] };
};

const fileSpec: ValidationSpec<{ file: File }> = {
  file: [isAllowedFileType, isWithinSizeLimit],
};

function FileUpload() {
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate with project's validation library (client-side UX only!)
    const validationResult = validateObject(fileSpec, { file });

    if (!validationResult.valid) {
      setError(validationResult.reasons.join(', '));
      e.target.value = ''; // Clear input
      return;
    }

    setError('');
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const api = useGenericApi();
      await api.post('/upload', formData);
      // Server should validate file type, size, and scan for malware
    } catch (err) {
      setError('Upload failed');
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif"
        onChange={handleFileChange}
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

#### 18.7 Dependency Security

```bash
# Regularly audit dependencies for vulnerabilities
npm audit

# Update dependencies
npm update

# Use npm audit fix for automatic fixes
npm audit fix

# Check for outdated packages
npm outdated
```

**Security Checklist for React SPAs**
- ✅ Use React's default escaping (avoid `dangerouslySetInnerHTML`)
- ✅ Store auth tokens in httpOnly cookies when possible
- ✅ Implement CSP headers
- ✅ Add CSRF protection for mutations
- ✅ Validate input on client AND server
- ✅ Use HTTPS for all API communication
- ✅ Sanitize HTML if you must render it (DOMPurify)
- ✅ Keep dependencies updated (`npm audit`)
- ✅ Validate file uploads (type, size, content)
- ✅ Use `SameSite` cookie attribute for CSRF protection

**Sources**
- https://owasp.org/www-project-top-ten/
- https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

---

## Part 7: Antipatterns & Quick Reference

### Top 5 React Antipatterns to Avoid

#### Antipattern 1: Mutating State Directly

Never mutate state objects or arrays directly. Always create new references to trigger re-renders.

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

#### Antipattern 2: Using Indexes as Keys in Dynamic Lists

Array indexes are unstable and cause React to incorrectly reuse component instances.

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

#### Antipattern 3: Missing or Incorrect Dependencies in useEffect

Forgetting dependencies causes stale closures and subtle bugs.

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
```

#### Antipattern 4: Defining Components Inside Components

Creating component functions inside other components causes them to be recreated on every render.

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
```

#### Antipattern 5: Excessive Prop Drilling

Passing props through many intermediate components creates tight coupling.

```tsx
// ❌ BAD: Props passed through many layers
function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');

  return (
    <Layout
      user={user}
      setUser={setUser}
      theme={theme}
      setTheme={setTheme}
    />
  );
}

function Layout({ user, setUser, theme, setTheme }) {
  return (
    <div>
      <Sidebar
        user={user}
        setUser={setUser}
        theme={theme}
        setTheme={setTheme}
      />
    </div>
  );
}

function Sidebar({ user, setUser, theme, setTheme }) {
  return (
    <nav>
      <UserMenu user={user} setUser={setUser} />
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </nav>
  );
}

// ✅ GOOD: Context API for cross-cutting concerns
import { createContext, useContext } from 'react';

const UserContext = createContext();
const ThemeContext = createContext();

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <Layout />
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
```

### React 19 Specific Antipatterns

#### Antipattern 6: Manual Memoization with React Compiler Enabled

When React Compiler is enabled, manual memoization is usually redundant and adds unnecessary complexity.

```tsx
// ❌ BAD: Manual memoization when compiler handles it
import { memo, useMemo, useCallback } from 'react';

const UserList = memo(({ users, onSelect }) => {
  // Compiler already optimizes these
  const sortedUsers = useMemo(() => {
    return users.sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const handleSelect = useCallback((id) => {
    onSelect(id);
  }, [onSelect]);

  return (
    <ul>
      {sortedUsers.map(user => (
        <li key={user.id} onClick={() => handleSelect(user.id)}>
          {user.name}
        </li>
      ))}
    </ul>
  );
});

// ✅ GOOD: Let compiler optimize automatically
function UserList({ users, onSelect }) {
  // Compiler handles optimization
  const sortedUsers = users.sort((a, b) => a.name.localeCompare(b.name));

  const handleSelect = (id) => {
    onSelect(id);
  };

  return (
    <ul>
      {sortedUsers.map(user => (
        <li key={user.id} onClick={() => handleSelect(user.id)}>
          {user.name}
        </li>
      ))}
    </ul>
  );
}
```

#### Antipattern 7: Not Using Actions for Form Mutations

React 19's Actions provide better form handling than manual state management.

```tsx
// ❌ BAD: Manual form state management
function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData(e.target);
      await fetch('/api/contact', {
        method: 'POST',
        body: formData,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" />
      <button disabled={submitting}>Submit</button>
      {error && <p>{error}</p>}
    </form>
  );
}

// ✅ GOOD: Use Actions with Api2 (React 19)
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';

async function submitCaseNote(prevState, formData) {
  try {
    const caseId = formData.get('caseId') as string;
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;

    await Api2.postCaseNote({ caseId, title, content });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function CaseNoteForm({ caseId }) {
  const [state, formAction, isPending] = useActionState(submitCaseNote, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />
      <button disabled={isPending}>Submit</button>
      {state?.error && <p>{state.error}</p>}
    </form>
  );
}
```

---

## Quick Reference Checklists

### Derived State Checklist
- ✅ Can I compute it from props/state now? → Compute inline - React Compiler optimizes
- ❌ Am I about to write an effect to sync it? → Stop; derive in render instead
- ✅ Is it one-time init or reset-on-identity-change? → Use lazy initializer or keyed remount
- ❌ Do I have two sources of truth? → Remove the derived state, compute on demand

**Sources**
- https://react.dev/learn/you-might-not-need-an-effect
- https://legacy.reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html
- https://julvo.com/posts/react/derived-state/

### Refs Checklist
- ✅ Need DOM/external imperative sync? → Ref is appropriate
- ❌ Value affects UI? → Use state, not ref
- ✅ Parent needs a tiny command API? → `forwardRef` + `useImperativeHandle` with minimal surface (2-3 methods max)
- ❌ Reading refs during render? → Convert to state

**Sources**
- https://react.dev/reference/react/forwardRef
- https://dev.to/logrocket/how-to-use-forwardref-in-react-2c4p

### State Management Checklist
- ✅ State only used in one component? → Keep it local with `useState`
- ✅ Two siblings need it? → Lift to nearest common parent
- ✅ Low-frequency cross-cutting concern (theme, auth)? → Use Context
- ❌ High-frequency updates causing performance issues? → Consider state library
- ❌ Prop drilling 5+ levels deep? → Consider Context or state library

**Sources**
- https://react.dev/learn/thinking-in-react
- https://www.geeksforgeeks.org/reactjs/react-architecture-pattern-and-best-practices/

### Performance Optimization Checklist (React 19 with Compiler)
- ✅ Trust React Compiler first → It handles optimization automatically
- ✅ Measured performance issue with React Profiler? → Investigate with profiling
- ❌ Pre-optimizing without measurement? → Don't - compiler already optimizes
- ✅ Profiler shows specific bottleneck after compiler optimization? → Consider manual `useMemo` (rare)
- ✅ Third-party library needs reference stability? → Consider `useCallback` for that specific case
- ✅ Need to opt-out of compiler? → Use `'use no memo'` directive (very rare)

**Sources**
- https://react.dev/reference/react/memo
- https://react.dev/reference/react/useMemo
- https://react.dev/reference/react/useCallback

---

## Summary

Modern React development (React 19+) emphasizes **declarative patterns, intentional optimization, and proper separation of concerns**. This guide follows a sequential workflow:

1. **Project Foundation**: Feature-based architecture ("screaming architecture") for scalable codebases
2. **Component Design**: Small, composable components with custom hooks for reusable logic
3. **State Management**: Local-first state, lift only when needed, Context for cross-cutting concerns
4. **Derived State**: Never store what you can compute; avoid effects for derivation
5. **Effects**: Only for external system synchronization with proper cleanup
6. **Advanced Patterns**: Refs for imperative needs, strategic memoization, lazy loading
7. **User Experience**: Optimistic updates, declarative forms, error boundaries
8. **Code Quality**: TypeScript for type safety, testing user behavior, anti-overengineering

**Key principles:**
- Prefer simplicity over premature optimization
- Compute derived values during render, not in effects
- Keep state local by default
- Use refs for imperative concerns only
- Add tools only when you have concrete signals they solve real problems
- Avoid common antipatterns: state mutation, index keys, missing dependencies, nested components, excessive prop drilling

Following these practices creates maintainable, performant React applications that scale well with team growth and feature complexity.
