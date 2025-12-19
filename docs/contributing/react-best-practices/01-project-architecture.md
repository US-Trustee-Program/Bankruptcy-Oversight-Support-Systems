# Project Architecture & Structure

Organize your React application by **feature/domain** (also called "screaming architecture") rather than by technical layers.

## Practice

- Group files by feature or domain area
- Colocate components, hooks, tests, and styles within each feature
- Keep a small **shared/common** area only for truly cross-feature primitives (buttons, layout utilities, low-level hooks)

## Why / Problems it solves

- Feature grouping scales better than type-based folders (`components/`, `hooks/`, `utils/`)
- Keeps related code together, reducing navigation time and cross-feature coupling
- Makes large SPAs more maintainable for growing teams
- The directory structure screams what the app does, not what framework it uses

## Signals to adjust

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

## Sources

- https://profy.dev/article/react-folder-structure
- https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc
- https://namastedev.com/blog/best-practices-for-folder-structure-in-react-7/

---

**Next:** [Component Composition & Design](02-component-composition.md)
**Up:** [Overview](README.md)
