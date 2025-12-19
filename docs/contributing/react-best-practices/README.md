# React Best Practices Guide (React 19+)

A comprehensive guide for building React single-page applications following modern patterns and principles. This guide is organized into seven parts, progressing from project setup through component design, state management, advanced patterns, user experience, code quality, and common pitfalls.

**Organization**: This guide flows from project foundation → component design → state management → advanced patterns → user experience → code quality → antipatterns & quick reference.

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

### React 19 for SPAs: Key Features & Patterns

React 19 brings significant improvements that change how we build client-side applications:

1. **React Compiler** - Automatically optimizes re-renders, eliminating the need for manual memoization with `useMemo`, `useCallback`, and `React.memo`
2. **Actions** - Use `useActionState` and `useFormStatus` for simplified form handling instead of manual state management
3. **`useOptimistic`** - Built-in optimistic UI updates provide instant feedback for better perceived performance
4. **Concurrent Features** - `useTransition` and `useDeferredValue` keep UIs responsive during heavy updates
5. **Suspense** - Production-ready for code splitting and lazy loading to reduce initial bundle size
6. **Custom hooks for data fetching** - Encapsulate `useEffect` data fetching patterns in reusable hooks

---

## Table of Contents

### Part 1: Project Foundation
Establish scalable project structure and architecture patterns.

1. [Project Architecture & Structure](01-project-architecture.md) - Feature-based organization for maintainable codebases

### Part 2: Component Design
Build composable, reusable components with clear responsibilities.

2. [Component Composition & Design](02-component-composition.md) - Small, focused components with composition patterns
3. [Custom Hooks](03-custom-hooks.md) - Extract and share stateful logic

### Part 3: State Management
Master state management from local state to complex patterns.

4. [State Management Philosophy](04-state-management.md) - Local-first approach with useSyncExternalStore
5. [useReducer for Complex State](05-use-reducer.md) - Centralized state logic for complex transitions
6. [Derived State](06-derived-state.md) - Avoid redundant state and synchronization bugs
7. [Effects](07-effects.md) - Side effects and data fetching patterns

### Part 4: Advanced Patterns
Leverage React 19's advanced features for optimal performance.

8. [Refs & Imperative APIs](08-refs.md) - Escape hatches for imperative DOM manipulation
9. [React Compiler](09-react-compiler.md) - Automatic optimization without manual memoization
10. [Performance Optimization](10-performance.md) - When compiler optimization isn't enough
11. [Code Splitting & Lazy Loading](11-code-splitting.md) - Reduce initial bundle size

### Part 5: User Experience Patterns
Create responsive, resilient user interfaces.

12. [Concurrent Features](12-concurrent-features.md) - useTransition, useDeferredValue, and data fetching
13. [Optimistic Updates](13-optimistic-updates.md) - Instant feedback for better perceived performance
14. [Form Handling](14-forms.md) - Declarative forms with Actions
15. [Error Handling & Resilience](15-error-handling.md) - Error boundaries and recovery strategies

### Part 6: Code Quality
Ensure maintainability, accessibility, and security.

16. [TypeScript Best Practices](16-typescript.md) - Type safety for React 19 patterns
17. [Testing Strategy](17-testing.md) - Comprehensive testing with Vitest, Playwright, and MSW
18. [Anti-overengineering](18-anti-overengineering.md) - Add tools only when needed, Good Fences principle
19. [Accessibility](19-accessibility.md) - Build inclusive applications
20. [Security](20-security.md) - Protect against XSS, CSRF, and common vulnerabilities

### Part 7: Antipatterns & Quick Reference
Avoid common mistakes and find quick answers.

21. [React Antipatterns](21-antipatterns.md) - Top mistakes to avoid
22. [Quick Reference](22-quick-reference.md) - Checklists and decision guides

---

## Key Principles

- **Prefer simplicity over premature optimization** - Let React Compiler handle optimization
- **Compute derived values during render** - Not in effects
- **Keep state local by default** - Lift only when needed
- **Use refs for imperative concerns only** - Not for UI state
- **Add tools only with clear signals** - Avoid resume-driven development
- **Test user behavior** - Not implementation details
