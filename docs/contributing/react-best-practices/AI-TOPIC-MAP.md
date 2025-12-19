# AI Topic Mapping for React Best Practices

This file helps AI agents quickly identify which section file to load based on keywords or topics.

## Quick Topic → File Mapping

| Topics/Keywords | File | Title |
|-----------------|------|-------|
| project structure, folder organization, architecture, scalability | `01-project-architecture.md` | Project Architecture & Structure |
| components, composition, props, children, JSX, component design | `02-component-composition.md` | Component Composition & Design |
| hooks, custom hooks, logic reuse, stateful logic | `03-custom-hooks.md` | Custom Hooks |
| state, useState, context, global state, state management | `04-state-management.md` | State Management Philosophy |
| useReducer, complex state, state machines, actions, reducers | `05-use-reducer.md` | useReducer for Complex State |
| derived state, computed values, calculations, memoization | `06-derived-state.md` | Derived State |
| useEffect, side effects, data fetching, cleanup, dependencies | `07-effects.md` | Effects |
| refs, useRef, DOM manipulation, imperative API, forwardRef | `08-refs.md` | Refs & Imperative APIs |
| react compiler, optimization, automatic memoization | `09-react-compiler.md` | React Compiler |
| performance, optimization, rendering, useMemo, useCallback | `10-performance.md` | Performance Optimization |
| code splitting, lazy loading, bundle size, dynamic imports, Suspense | `11-code-splitting.md` | Code Splitting & Lazy Loading |
| concurrent features, useTransition, useDeferredValue, transitions | `12-concurrent-features.md` | Concurrent Features |
| optimistic updates, useOptimistic, instant feedback, UX | `13-optimistic-updates.md` | Optimistic Updates |
| forms, form handling, validation, useActionState, useFormStatus | `14-forms.md` | Form Handling |
| errors, error boundaries, error handling, recovery, resilience | `15-error-handling.md` | Error Handling & Resilience |
| TypeScript, types, type safety, generics, inference | `16-typescript.md` | TypeScript Best Practices |
| testing, Vitest, Playwright, MSW, test strategy, unit tests, e2e | `17-testing.md` | Testing Strategy |
| overengineering, third-party libraries, dependencies, Good Fences, abstractions | `18-anti-overengineering.md` | Anti-overengineering |
| accessibility, a11y, ARIA, screen readers, inclusive design | `19-accessibility.md` | Accessibility |
| security, XSS, CSRF, vulnerabilities, sanitization | `20-security.md` | Security |
| antipatterns, mistakes, bad practices, pitfalls | `21-antipatterns.md` | React Antipatterns |
| checklists, quick reference, decision guides | `22-quick-reference.md` | Quick Reference |

## Section Summaries (Optimized for AI Understanding)

### Part 1: Project Foundation
**01-project-architecture.md** - How to organize React codebases. Covers feature-based directory structures, domain-driven organization, file naming conventions, and scaling strategies. Load for: "How should I structure my React project?"

### Part 2: Component Design
**02-component-composition.md** - Component design patterns. Covers single responsibility principle, composition over inheritance, props API design, and component sizing. Load for: "How should I design React components?"

**03-custom-hooks.md** - Creating reusable stateful logic. Covers when to extract hooks, naming conventions, dependency management, and common patterns. Load for: "How do I share logic between components?"

### Part 3: State Management
**04-state-management.md** - State management philosophy and patterns. Covers local-first state, Context API, useSyncExternalStore, and when to lift state. Load for: "How should I manage state in React?"

**05-use-reducer.md** - Complex state transitions with useReducer. Covers when to use reducers over useState, action patterns, and state machines. Load for: "My useState is getting complicated" or "How do I handle complex state?"

**06-derived-state.md** - Computing values from existing state. Covers avoiding redundant state, synchronization bugs, and proper derivation patterns. Load for: "How do I compute values from state?" or "Should I store this in state?"

**07-effects.md** - Side effects and data fetching. Covers useEffect patterns, cleanup, dependency arrays, and data fetching best practices. Load for: "How do I fetch data?" or "How do I run side effects?"

### Part 4: Advanced Patterns
**08-refs.md** - Working with refs for imperative operations. Covers DOM manipulation, imperative APIs, forwardRef, and useImperativeHandle. Load for: "How do I access the DOM?" or "How do I expose imperative methods?"

**09-react-compiler.md** - Understanding React Compiler automatic optimization. Covers how the compiler works and when manual optimization is unnecessary. Load for: "Do I need useMemo/useCallback in React 19?"

**10-performance.md** - Manual performance optimization techniques. Covers profiling, identifying bottlenecks, and optimization strategies when compiler isn't enough. Load for: "My app is slow" or "How do I optimize performance?"

**11-code-splitting.md** - Reducing bundle size with code splitting. Covers lazy(), Suspense, route-based splitting, and component-based splitting. Load for: "How do I reduce bundle size?" or "How do I lazy load components?"

### Part 5: User Experience Patterns
**12-concurrent-features.md** - Using concurrent features for responsive UIs. Covers useTransition, useDeferredValue, and concurrent data fetching patterns. Load for: "How do I keep UI responsive during updates?"

**13-optimistic-updates.md** - Instant feedback with useOptimistic. Covers optimistic UI patterns, rollback strategies, and when to use optimistic updates. Load for: "How do I show instant feedback?" or "How do I make my app feel faster?"

**14-forms.md** - Modern form handling with Actions. Covers useActionState, useFormStatus, validation patterns, and form submission. Load for: "How do I handle forms in React 19?"

**15-error-handling.md** - Error boundaries and recovery strategies. Covers error boundary implementation, fallback UIs, error reporting, and resilience patterns. Load for: "How do I handle errors?" or "How do I prevent my app from crashing?"

### Part 6: Code Quality
**16-typescript.md** - TypeScript patterns for React 19. Covers typing components, hooks, events, refs, and advanced type patterns. Load for: "How do I type this in TypeScript?" or "TypeScript errors with React"

**17-testing.md** - Comprehensive testing strategy. Covers unit testing with Vitest, e2e testing with Playwright, MSW for API mocking, and testing philosophy. Load for: "How do I test React components?" or "Testing strategy"

**18-anti-overengineering.md** - Avoiding unnecessary complexity. Covers when to add libraries, the Good Fences principle for isolating dependencies, and signals for adopting tools. Load for: "Should I use this library?" or "How do I abstract third-party dependencies?"

**19-accessibility.md** - Building inclusive applications. Covers semantic HTML, ARIA patterns, keyboard navigation, and accessibility testing. Load for: "How do I make my app accessible?" or "Accessibility best practices"

**20-security.md** - Protecting against vulnerabilities. Covers XSS prevention, CSRF protection, secure authentication, and common security pitfalls. Load for: "How do I prevent XSS?" or "Security best practices"

### Part 7: Antipatterns & Quick Reference
**21-antipatterns.md** - Common React mistakes to avoid. Covers top antipatterns and what to do instead. Load for: "What are common React mistakes?" or "React antipatterns"

**22-quick-reference.md** - Checklists and decision guides. Covers quick lookup tables, decision trees, and reference material. Load for: "Quick reference" or "Cheat sheet"

## How to Use This Mapping

### For AI Agents
1. **Keyword search**: Use the table above to find relevant files based on user questions
2. **Multiple matches**: If multiple files match, load the most specific one first
3. **Start with README.md**: For general questions about the guide itself
4. **Context loading**: Load 2-3 related sections when a question spans multiple topics

### Example Queries
- User asks: "How do I optimize my React app?" → Load `10-performance.md` and `09-react-compiler.md`
- User asks: "How should I structure my forms?" → Load `14-forms.md`
- User asks: "Should I use Redux?" → Load `04-state-management.md` and `18-anti-overengineering.md`
- User asks: "How do I handle loading states?" → Load `12-concurrent-features.md` and `13-optimistic-updates.md`
- User asks: "My useEffect runs too many times" → Load `07-effects.md`
- User asks: "How do I organize my project?" → Load `01-project-architecture.md`

## File Organization Pattern
All section files follow the pattern: `{number}-{topic}.md` where number indicates sequence (01-22).
