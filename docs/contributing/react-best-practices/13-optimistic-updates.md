# Optimistic Updates for Better UX

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



---
**Previous:** [Concurrent Features](12-concurrent-features.md)
**Next:** [Form Handling](14-forms.md)
**Up:** [Overview](README.md)
