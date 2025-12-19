# Optimistic Updates with useOptimistic

When optimistic UI is desired, React 19's `useOptimistic` hook provides a built-in way to manage temporary state updates.

**Practice**
- Evaluate whether optimistic updates justify the added complexity
- If implementing optimistic updates, use `useOptimistic` instead of manual state management
- Mark optimistic items visually (opacity, pending indicator) to show they're not confirmed
- Handle failures gracefully by reverting optimistic updates and showing error messages

**Why / When to use optimistic updates**
- **High-frequency user actions** where waiting feels tedious (e.g., liking posts, toggling favorites)
- **Predictable operations** where failures are rare and the optimistic state is likely correct
- **User expects immediacy** based on the interaction pattern (e.g., adding items to a list)

**Tradeoffs**
- **Benefit**: Instant feedback, improved perceived performance
- **Cost**: Added complexity, error handling, potential for confusing states if operation fails
- **Cost**: Must handle edge cases (conflicts, stale data, rollbacks)

**When NOT to use optimistic updates**
- Operations where failure is common or consequences are significant
- Complex forms or multi-step processes
- When loading states are fast enough (< 200ms) that optimistic UI adds unnecessary complexity
- Critical operations where users should wait for confirmation (payments, deletions)

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
