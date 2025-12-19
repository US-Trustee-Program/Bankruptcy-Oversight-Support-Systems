# Refs & Imperative APIs

## Refs Are an Escape Hatch

Refs provide imperative access to DOM elements and mutable values that don't trigger re-renders.

### Practice
- Use refs when you need imperative access to:
  - DOM focus/selection/scroll/measurement
  - Media controls (play, pause)
  - Third-party imperative widgets (maps, charts)
  - Mutable "memory" that should NOT re-render UI (timers, previous values)

### Why / Problems it solves
- Refs persist across renders without causing re-renders
- Bridge React's declarative model to imperative systems safely
- Enable performance optimizations by avoiding unnecessary renders

### Signals to use refs
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

## Avoid Refs for UI State

If a value affects rendering, it belongs in state, not a ref.

### Practice
- Use **state** for values that affect what the user sees
- Use **refs** only for values that don't affect rendering
- Don't use refs as a way to bypass React's rendering model

### Why / Problems it solves
- Mutating refs **doesn't re-render**, leading to UI desync
- Creates hidden data flow that's hard to debug
- Violates React's declarative model

### Signals you're misusing refs
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

## Imperative Handles with forwardRef and useImperativeHandle

Expose small, intentional imperative APIs from components when parents need to trigger actions.

### Practice
- Use `forwardRef` to accept a ref from a parent
- Use `useImperativeHandle` to expose only specific methods
- Keep the exposed API minimal (focus, reset, scrollTo)
- Never expose the full DOM or broad "god handles"

### Why / Problems it solves
- Maintains component encapsulation while enabling necessary imperative control
- Prevents parents from depending on internal implementation details
- Makes the contract between parent and child explicit and minimal

### Signals to use imperative handles
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

## Signals You're Overusing Refs

**Red flags:**
- Many components export large imperative APIs
- Refs are read during render to decide what UI to show
- Bugs feel like "updates only after a second interaction"
- You have more imperative handle methods than props

**What to do:**
- Convert ref-based state to real state
- Reduce imperative handle surface area to 2-3 methods max
- Use declarative props instead of imperative methods where possible

## Sources
- https://react.dev/reference/react/forwardRef
- https://react.dev/reference/react (refs overview)
- https://dev.to/logrocket/how-to-use-forwardref-in-react-2c4p
- https://borstch.com/blog/development/mastering-refs-in-react-18-useref-and-useimperativehandle-explained
- https://www.codeguage.com/v1/courses/react/advanced-forwarding-refs

---
**Previous:** [Effects](07-effects.md)
**Next:** [React Compiler](09-react-compiler.md)
**Up:** [Overview](README.md)
