# React Antipatterns

## Antipattern 1: Mutating State Directly

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

## Antipattern 2: Using Indexes as Keys in Dynamic Lists

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

## Antipattern 3: Missing or Incorrect Dependencies in useEffect

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

## Antipattern 4: Defining Components Inside Components

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

## Antipattern 5: Excessive Prop Drilling

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

## React 19 Specific Antipatterns

## Antipattern 6: Manual Memoization with React Compiler Enabled

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

## Antipattern 7: Not Using Actions for Form Mutations

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
**Previous:** [Security](20-security.md)
**Next:** [Quick Reference](22-quick-reference.md)
**Up:** [Overview](README.md)
