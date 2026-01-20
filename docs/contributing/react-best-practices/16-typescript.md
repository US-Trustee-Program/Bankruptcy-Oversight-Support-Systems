# TypeScript Best Practices for React 19 SPAs

Make invisible contracts explicit with TypeScript. Use types to catch bugs at compile time and improve developer experience.

**Practice**
- Type all component props, hook inputs/outputs, and public APIs
- Use discriminated unions for complex UI states (loading | error | success)
- Keep types colocated with the code that uses them (feature-based)
- Use `unknown` instead of `any` when type is truly unknown
- Type React 19 features: Actions, FormData, custom hooks
- Use generics for reusable components and hooks
- Leverage type narrowing for safer code
- Avoid `React.FC` - explicit return types are clearer

**Why / Problems it solves**
- Catches interface bugs at compile time
- Improves refactoring confidence and IDE autocomplete
- Documents intent for onboarding and maintenance
- Prevents prop type mismatches and null reference errors
- React 19 features benefit greatly from proper typing

**Signals to improve TypeScript usage**
- Runtime errors for undefined props or wrong types
- Frequent use of `any` or type assertions
- Refactoring breaks things that TypeScript should catch
- No types for Actions or form handlers

```tsx
// ❌ BAD: No types, implicit any, runtime errors likely
function UserCard({ user }) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <p>Joined: {user.createdAt}</p>
    </div>
  );
}

// ✅ GOOD: Explicit types prevent bugs
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO date string from API
}

interface UserCardProps {
  user: User;
  onEdit?: (userId: string) => void;
}

function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <p>Joined: {user.createdAt}</p>
      {onEdit && <button onClick={() => onEdit(user.id)}>Edit</button>}
    </div>
  );
}

// ✅ ALSO GOOD: React 19 with Api2 and useEffect
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';
import { CaseSearchResponse } from '@common/cams/cases';

function CasesList() {
  const [cases, setCases] = useState<CaseSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCases = async () => {
      try {
        setLoading(true);
        const response = await Api2.searchCases({ query: '', filters: {} });
        if (!cancelled) {
          setCases(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCases();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div>Loading cases...</div>;
  if (error) return <div>Error loading cases: {error.message}</div>;
  if (!cases) return null;

  return (
    <ul>
      {cases.data.map(caseItem => (
        <li key={caseItem.caseId}>{caseItem.caseId}</li>
      ))}
    </ul>
  );
}
```

**React 19: Typing Actions and Forms with Api2**

```tsx
// ✅ GOOD: Type Actions with FormData and Api2
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';
import { CaseNote } from '@common/cams/cases';
import { ResponseBody } from '@common/api/response';

type ActionState = {
  success: boolean;
  error: string | null;
  data?: CaseNote;
};

// Define validation specification with project's validation library
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

interface CaseNoteFormData {
  caseId: string;
  title: string;
  content: string;
}

const caseNoteSpec: ValidationSpec<CaseNoteFormData> = {
  caseId: [Validators.minLength(1, 'Case ID is required')],
  title: [Validators.minLength(1, 'Title is required')],
  content: [Validators.minLength(1, 'Content is required')],
};

async function submitCaseNoteAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const data: CaseNoteFormData = {
    caseId: formData.get('caseId') as string,
    title: formData.get('title') as string,
    content: formData.get('content') as string,
  };

  // Validate with project's validation library
  const validationResult = validateObject(caseNoteSpec, data);

  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.reasons.join(', '),
    };
  }

  try {
    // Api2 methods are fully typed
    const response: ResponseBody<CaseNote> | void = await Api2.postCaseNote({
      caseId: data.caseId,
      title: data.title,
      content: data.content,
    });

    return { success: true, error: null, data: response?.data[0] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function CaseNoteForm({ caseId }: { caseId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState | null>(
    submitCaseNoteAction,
    null
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input name="title" placeholder="Note title" required />
      <textarea name="content" placeholder="Note content" required />
      <button disabled={isPending}>Submit</button>
      {state?.error && <p>{state.error}</p>}
      {state?.success && <p>Note added: {state.data?.id}</p>}
    </form>
  );
}
```

**Project-Specific: Lightweight Validation Library**

Instead of using heavy validation libraries like zod, this project uses a lightweight, bespoke validation library located at `common/src/cams/validation.ts` and `common/src/cams/validators.ts`.

```tsx
// ✅ GOOD: Using project's validation library
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

// Define validation specification
interface TrusteeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

const trusteeValidationSpec: ValidationSpec<TrusteeInput> = {
  firstName: [Validators.minLength(1, 'First name is required')],
  lastName: [Validators.minLength(1, 'Last name is required')],
  email: [Validators.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL)],
  phone: [Validators.optional(Validators.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER))],
};

// Use in action
async function submitTrustee(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const data = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string | undefined,
  };

  // Validate with our library
  const validationResult = validateObject(trusteeValidationSpec, data);

  if (!validationResult.valid) {
    // validationResult.reasonMap contains field-specific errors
    const errors = flatten(validationResult.reasonMap);
    return {
      success: false,
      error: errors.join(', '),
      fieldErrors: validationResult.reasonMap,
    };
  }

  // Proceed with validated data using Api2
  try {
    await Api2.postTrustee(data);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Failed to submit' };
  }
}

function TrusteeForm() {
  const [state, formAction, isPending] = useActionState(submitTrustee, null);

  return (
    <form action={formAction}>
      <input name="firstName" placeholder="First Name" required />
      <input name="lastName" placeholder="Last Name" required />
      <input name="email" type="email" required />
      <input name="phone" type="tel" />
      <button disabled={isPending}>Add Trustee</button>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Trustee added!</p>}
    </form>
  );
}
```

**Available Validators**:
- `minLength(min, reason?)` - Minimum length for strings/arrays
- `maxLength(max, reason?)` - Maximum length for strings/arrays
- `exactLength(len, reason?)` - Exact length requirement
- `isInSet(set, reason?)` - Value must be in allowed set
- `matches(regex, reason?)` - Custom regex matching (use with `EMAIL_REGEX`, `PHONE_REGEX`, etc. and `FIELD_VALIDATION_MESSAGES`)
- `optional(...validators)` - Allows undefined values
- `nullable(...validators)` - Allows null values
- `arrayOf(...validators)` - Validates array elements
- `spec(validationSpec)` - Nested object validation

**Why This Instead of Zod**:
- **Lightweight**: ~200 lines vs 10KB+ minified
- **Good Fences**: No external validation library dependency
- **Type-Safe**: Full TypeScript support with generics
- **Sufficient**: Meets project's validation needs without complexity
- **Customizable**: Easy to extend with project-specific validators

**When to Consider Alternatives**:
- Complex schema transformations needed
- Advanced coercion or parsing logic
- Cross-field validation dependencies become unwieldy
- In these rare cases, consider zod but isolate it behind an abstraction layer

**unknown vs any: Be Specific**

```tsx
// ❌ BAD: any bypasses type checking
function processData(data: any) {
  return data.value.toUpperCase(); // No type safety!
}

// ✅ GOOD: unknown forces type checking
function processData(data: unknown) {
  // Must narrow type before use
  if (typeof data === 'object' && data !== null && 'value' in data) {
    const record = data as Record<string, unknown>;
    if (typeof record.value === 'string') {
      return record.value.toUpperCase(); // Type safe!
    }
  }
  throw new Error('Invalid data format');
}

// ✅ ALSO GOOD: Define expected shape
interface DataShape {
  value: string;
}

function processData(data: unknown): string {
  // Type guard
  if (isDataShape(data)) {
    return data.value.toUpperCase();
  }
  throw new Error('Invalid data format');
}

function isDataShape(data: unknown): data is DataShape {
  return (
    typeof data === 'object' &&
    data !== null &&
    'value' in data &&
    typeof (data as DataShape).value === 'string'
  );
}
```

**Generics for Reusable Components**

```tsx
// ✅ GOOD: Generic list component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
}

function List<T>({ items, renderItem, keyExtractor, emptyMessage }: ListProps<T>) {
  if (items.length === 0) {
    return <div>{emptyMessage || 'No items'}</div>;
  }

  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

// Usage with type inference
interface User {
  id: number;
  name: string;
}

function UserList({ users }: { users: User[] }) {
  return (
    <List
      items={users}
      renderItem={user => <span>{user.name}</span>}
      keyExtractor={user => user.id}
      emptyMessage="No users found"
    />
  );
}
```

**Generic Custom Hooks with React 19 Patterns**

```tsx
// ✅ GOOD: Generic data fetching with useEffect (React 19 SPA, when pattern repeats)
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';
import { ResponseBody } from '@common/api/response';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

// Generic hook that uses useEffect for data fetching
function useApiData<T>(
  fetchFn: () => Promise<ResponseBody<T>>,
  deps: React.DependencyList = []
): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchFn();
        if (!cancelled) {
          setData(response.data[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, deps);

  return { data, loading, error };
}

// Usage with Api2 and proper TypeScript inference
import { CaseDetail } from '@common/cams/cases';

function CaseProfile({ caseId }: { caseId: string }) {
  // TypeScript infers data as CaseDetail | null
  const { data: caseData, loading, error } = useApiData<CaseDetail>(
    () => Api2.getCaseDetail(caseId),
    [caseId]
  );

  if (loading) return <div>Loading case...</div>;
  if (error) return <div>Failed to load case: {error.message}</div>;
  if (!caseData) return null;

  return <div>Case: {caseData.caseId}</div>;
}
```

**Type Narrowing Patterns**

```tsx
// ✅ GOOD: Discriminated union with type narrowing
type ApiResponse<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

function DataDisplay<T>({ response }: { response: ApiResponse<T> }) {
  // TypeScript narrows type in each branch
  if (response.status === 'loading') {
    return <div>Loading...</div>;
  }

  if (response.status === 'error') {
    // TypeScript knows response.error exists here
    return <div>Error: {response.error}</div>;
  }

  // TypeScript knows response.data exists here
  return <div>Data: {JSON.stringify(response.data)}</div>;
}

// ✅ GOOD: Type guards for narrowing
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function processValue(value: unknown) {
  if (isString(value)) {
    // TypeScript knows value is string
    return value.toUpperCase();
  }

  if (isNumber(value)) {
    // TypeScript knows value is number
    return value.toFixed(2);
  }

  throw new Error('Unsupported type');
}
```

**Utility Types for React 19**

```tsx
// ✅ GOOD: Extract prop types from components
function Button({ variant, children }: { variant: 'primary' | 'secondary'; children: React.ReactNode }) {
  return <button className={variant}>{children}</button>;
}

type ButtonProps = React.ComponentProps<typeof Button>;
// { variant: 'primary' | 'secondary'; children: React.ReactNode }

// ✅ GOOD: Pick and Omit for prop variations
interface BaseProps {
  id: string;
  name: string;
  email: string;
  role: string;
}

type CreateUserProps = Omit<BaseProps, 'id'>; // No id when creating
type UserDisplayProps = Pick<BaseProps, 'name' | 'email'>; // Only name/email for display

// ✅ GOOD: Readonly for immutable props
interface ImmutableConfig {
  readonly apiUrl: string;
  readonly timeout: number;
}

function useConfig(config: ImmutableConfig) {
  // config.apiUrl = 'new-url'; // TypeScript error!
  return config;
}
```

**Sources**
- https://react.dev/learn/typescript
- https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- https://www.typescriptlang.org/docs/handbook/utility-types.html


---
**Previous:** [Error Handling](15-error-handling.md)
**Next:** [Testing](17-testing.md)
**Up:** [Overview](README.md)
