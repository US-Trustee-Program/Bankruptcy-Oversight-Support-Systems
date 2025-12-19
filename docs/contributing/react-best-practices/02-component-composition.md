# Component Composition & Design

Keep components small, focused, and composable. Design for single responsibility.

## Practice

- Use **function components + hooks** for all new code
- Each component should do one thing well
- Compose UI from smaller pieces rather than building large monolithic components
- Split "god components" into subcomponents + logic hooks

## Why / Problems it solves

- Function components are the modern default and align with React's hooks-first model
- Small components reduce cognitive load, improve testability, and enable reuse
- Single responsibility makes components easier to understand, test, and maintain
- Composition enables flexibility without inheritance

## Signals to refactor

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

## Composition Patterns for Flexibility

Advanced composition patterns enable flexible, reusable components without prop drilling or complex inheritance.

### Render Props Pattern

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

### Children as Function (Render Props via Children)

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

### Compound Components Pattern

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

### Slots Pattern (Named Children)

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

## When to Use Each Pattern

- **Custom hooks**: Reusable stateful logic (preferred modern approach for most use cases)
- **Render props / Children as function**: Flexible rendering based on shared logic
- **Compound components**: Related components that share state (tabs, accordions, menus)
- **Slots**: Flexible layouts with named regions

## Sources

- https://react.dev/learn/thinking-in-react
- https://www.patterns.dev/react/render-props-pattern
- https://www.patterns.dev/react/compound-pattern
- https://www.geeksforgeeks.org/reactjs/react-architecture-pattern-and-best-practices/

---

**Previous:** [Project Architecture](01-project-architecture.md)
**Next:** [Custom Hooks](03-custom-hooks.md)
**Up:** [Overview](README.md)
