# Use useReducer for Complex State Logic

When state updates involve multiple sub-values or complex transitions, useReducer provides better organization than multiple useState calls.

## Practice
- Use `useReducer` for state that involves multiple related values
- Centralize state update logic in a reducer function
- Dispatch actions to describe what happened, not how to update
- Keep reducer functions pure (no side effects)

## Why / Problems it solves
- Centralizes complex state transitions in one place
- Reduces scattered state update logic and duplication
- Makes state changes more predictable and testable
- Better separation of concerns: components describe intent, reducer handles mechanics

## Signals to use useReducer
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

## Sources
- https://react.dev/reference/react/useReducer

---
**Previous:** [State Management Philosophy](04-state-management.md)
**Next:** [Derived State](06-derived-state.md)
**Up:** [Overview](README.md)
