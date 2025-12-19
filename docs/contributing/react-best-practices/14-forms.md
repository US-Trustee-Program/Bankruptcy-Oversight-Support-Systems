# Form Handling with Client-Side Actions

Use React 19's `useActionState` for declarative form handling with built-in pending states and error handling in your SPA.

**Practice**
- Use `useActionState` for form submission with automatic pending states
- Define **client-side actions** as async functions that receive previous state and FormData
- Actions handle API calls, validation, and state updates
- Return state objects with success/error information
- Use form's `action` prop instead of `onSubmit` with React 19
- Let FormData handle input values (uncontrolled forms when possible)
- Use `useFormStatus` in child components to access form pending state

**Why / Problems it solves**
- Eliminates boilerplate for loading states and error handling
- Declarative form handling is easier to reason about
- Built-in pending state without manual useState
- Reduces bugs from scattered form state management
- Cleaner separation between form UI and submission logic
- Works seamlessly with client-side API calls in SPAs

**Signals to use useActionState**
- Form submission triggers async operations (API calls in SPA)
- Need to track loading state and display errors
- Multiple forms with similar submission patterns
- Want to eliminate manual useState for form states

```tsx
// ❌ BAD: Manual form state management with scattered logic
function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData(e.target);
      await submitForm(formData);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" disabled={isSubmitting} />
      <button disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">Submitted!</p>}
    </form>
  );
}

// ✅ GOOD: Declarative form handling with useActionState and Api2
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';

// Action function uses Api2
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
      <input name="title" placeholder="Note title" required />
      <textarea name="content" placeholder="Note content" required />
      <button disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Note added!</p>}
    </form>
  );
}
```

**Using useFormStatus in Child Components**

The `useFormStatus` hook allows child components to access the parent form's pending state.

```tsx
// ✅ GOOD: useFormStatus for reusable submit buttons with Api2
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';

function SubmitButton({ children }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : children}
    </button>
  );
}

async function submitTrustee(prevState, formData) {
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const email = formData.get('email') as string;

  try {
    await Api2.postTrustee({ firstName, lastName, email });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function TrusteeForm() {
  const [state, formAction] = useActionState(submitTrustee, null);

  return (
    <form action={formAction}>
      <input name="firstName" placeholder="First Name" required />
      <input name="lastName" placeholder="Last Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <SubmitButton>Add Trustee</SubmitButton>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Trustee added!</p>}
    </form>
  );
}
```

**Client-Side Validation with Actions and Api2**

```tsx
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

const subscriptionSpec: ValidationSpec<{ email: string }> = {
  email: [Validators.isEmailAddress],
};

async function submitWithValidation(prevState, formData) {
  const email = formData.get('email') as string;

  // Client-side validation using our validation library
  const validationResult = validateObject(subscriptionSpec, { email });

  if (!validationResult.valid) {
    return {
      success: false,
      error: 'Invalid email address',
      fieldErrors: validationResult.reasonMap,
    };
  }

  // API call with Api2
  try {
    await Api2.post('/subscribe', { email });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function SubscriptionForm() {
  const [state, formAction, isPending] = useActionState(submitWithValidation, null);

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <button disabled={isPending}>Subscribe</button>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Subscribed!</p>}
    </form>
  );
}
```

**Sources**
- https://react.dev/reference/react/useActionState
- https://react.dev/reference/react-dom/hooks/useFormStatus
- https://react.dev/reference/react-dom/components/form



---
**Previous:** [Optimistic Updates](13-optimistic-updates.md)
**Next:** [Error Handling](15-error-handling.md)
**Up:** [Overview](README.md)
