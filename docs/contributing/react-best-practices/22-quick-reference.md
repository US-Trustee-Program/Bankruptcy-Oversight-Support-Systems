# Quick Reference Checklists

## Derived State Checklist
- ✅ Can I compute it from props/state now? → Compute inline - React Compiler optimizes
- ❌ Am I about to write an effect to sync it? → Stop; derive in render instead
- ✅ Is it one-time init or reset-on-identity-change? → Use lazy initializer or keyed remount
- ❌ Do I have two sources of truth? → Remove the derived state, compute on demand

**Sources**
- https://react.dev/learn/you-might-not-need-an-effect
- https://legacy.reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html
- https://julvo.com/posts/react/derived-state/

## Refs Checklist
- ✅ Need DOM/external imperative sync? → Ref is appropriate
- ❌ Value affects UI? → Use state, not ref
- ✅ Parent needs a tiny command API? → `forwardRef` + `useImperativeHandle` with minimal surface (2-3 methods max)
- ❌ Reading refs during render? → Convert to state

**Sources**
- https://react.dev/reference/react/forwardRef
- https://dev.to/logrocket/how-to-use-forwardref-in-react-2c4p

## State Management Checklist
- ✅ State only used in one component? → Keep it local with `useState`
- ✅ Two siblings need it? → Lift to nearest common parent
- ✅ Low-frequency cross-cutting concern (theme, auth)? → Use Context
- ❌ High-frequency updates causing performance issues? → Consider state library
- ❌ Prop drilling 5+ levels deep? → Consider Context or state library

**Sources**
- https://react.dev/learn/thinking-in-react
- https://www.geeksforgeeks.org/reactjs/react-architecture-pattern-and-best-practices/

## Performance Optimization Checklist (React 19 with Compiler)
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

---
**Previous:** [Antipatterns](21-antipatterns.md)
**Next:** [Overview](README.md)
**Up:** [Overview](README.md)
