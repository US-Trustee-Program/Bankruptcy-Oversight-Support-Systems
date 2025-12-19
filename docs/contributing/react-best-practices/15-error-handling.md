# Error Handling & Resilience

Create resilient UIs by handling errors at appropriate boundaries.

**Practice**
- Add **Error Boundaries** around route pages and major feature zones
- Log errors to monitoring services in boundary's `onError`
- Provide recovery actions (retry button)
- Show appropriate fallback UI for different error types
- Use try-catch for errors that Error Boundaries don't catch (event handlers, async code)

**Why / Problems it solves**
- Prevents a localized bug from blanking out the whole SPA
- Enables graceful degradation when features fail
- Gives users recovery options instead of broken UI
- Provides observability into production errors

**Signals to add error boundaries**
- A single component error crashes the entire app
- Need to handle errors in different parts of the UI differently
- Want centralized error logging for specific feature zones

## Error Boundaries: Catching Render Errors

Error Boundaries catch errors during rendering, in lifecycle methods, and in constructors.

```tsx
// ❌ BAD: No error boundaries - one component error crashes entire app
function App() {
  return (
    <div>
      <Header />
      <UserProfile /> {/* If this throws during render, whole app crashes */}
      <Dashboard />
      <Footer />
    </div>
  );
}

// ✅ GOOD: Error boundaries isolate failures
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <div>
      <Header />
      {/* UserProfile errors won't crash the rest of the app */}
      <ErrorBoundary fallback={<ProfileErrorFallback />}>
        <UserProfile />
      </ErrorBoundary>
      <ErrorBoundary fallback={<DashboardErrorFallback />}>
        <Dashboard />
      </ErrorBoundary>
      <Footer />
    </div>
  );
}

function ProfileErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="error-panel">
      <h3>Failed to load profile</h3>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}
```

## What Error Boundaries DON'T Catch

Error Boundaries only catch errors during rendering. You must handle these cases separately:

```tsx
// ❌ These errors are NOT caught by Error Boundaries:
function ProblematicComponent() {
  // 1. Event handlers
  const handleClick = () => {
    throw new Error('Event handler error'); // NOT caught!
  };

  // 2. Async code (promises, setTimeout, async/await in useEffect)
  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .catch(err => {
        throw err; // NOT caught!
      });
  }, []);

  // 3. Timers
  setTimeout(() => {
    throw new Error('Timer error'); // NOT caught!
  }, 1000);

  return <button onClick={handleClick}>Click</button>;
}

// ✅ GOOD: Handle with try-catch and error state
import { useState } from 'react';

function SafeComponent() {
  const [error, setError] = useState(null);

  // 1. Wrap event handlers in try-catch
  const handleClick = () => {
    try {
      riskyOperation();
    } catch (err) {
      setError(err);
    }
  };

  // 2. Handle async errors explicitly
  const handleSubmit = async () => {
    try {
      await someAsyncOperation();
    } catch (err) {
      setError(err);
    }
  };

  if (error) return <div role="alert">Error: {error.message}</div>;
  return (
    <>
      <button onClick={handleClick}>Risky Operation</button>
      <button onClick={handleSubmit}>Submit</button>
    </>
  );
}
```

## Error Handling with Form Actions

Form actions automatically catch errors - return error state in the action result:

```tsx
import { useActionState } from 'react';

async function submitAction(prevState, formData) {
  try {
    await saveData(formData);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Submission failed. Please try again.'
    };
  }
}

function Form() {
  const [state, formAction] = useActionState(submitAction, null);

  return (
    <form action={formAction}>
      <input name="data" required />
      <button type="submit">Submit</button>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      {state?.success && <p className="success">Saved successfully!</p>}
    </form>
  );
}
```

## Error Logging

Log errors to monitoring services using the Error Boundary's `onError` callback:

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

function App() {
  const { appInsights } = getAppInsights();

  const logError = (error: Error, errorInfo: { componentStack: string }) => {
    console.error('Error caught:', error, errorInfo);

    // Send to monitoring service
    appInsights.trackException({
      exception: error,
      properties: {
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      },
    });
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={logError}
    >
      <Routes />
    </ErrorBoundary>
  );
}
```

## Retry Strategies

Provide users with retry actions in error fallbacks:

```tsx
// Simple retry
function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <h3>Something went wrong</h3>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  );
}

// Retry with exponential backoff
function ErrorFallbackWithBackoff({ error, resetErrorBoundary }) {
  const [retryCount, setRetryCount] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    // Wait longer with each retry: 1s, 2s, 4s, 8s, max 10s
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    setRetryCount(retryCount + 1);
    setRetrying(false);
    resetErrorBoundary();
  };

  return (
    <div role="alert">
      <h3>Something went wrong</h3>
      <p>{error.message}</p>
      <button onClick={handleRetry} disabled={retrying}>
        {retrying ? 'Retrying...' : 'Try Again'}
      </button>
      {retryCount > 0 && <p>Attempt {retryCount + 1}</p>}
    </div>
  );
}
```

## Context-Specific Error Messages

Tailor error messages based on the error type:

```tsx
function ErrorFallback({ error, resetErrorBoundary }) {
  // Network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return (
      <div role="alert">
        <h3>Connection Problem</h3>
        <p>Please check your internet connection and try again.</p>
        <button onClick={resetErrorBoundary}>Retry</button>
      </div>
    );
  }

  // Authentication errors
  if (error.message.includes('401') || error.message.includes('auth')) {
    return (
      <div role="alert">
        <h3>Session Expired</h3>
        <p>Please log in again to continue.</p>
        <button onClick={() => window.location.href = '/login'}>
          Go to Login
        </button>
      </div>
    );
  }

  // Generic fallback
  return (
    <div role="alert">
      <h3>Something went wrong</h3>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  );
}
```

**Sources**
- https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- https://github.com/bvaughn/react-error-boundary



---
**Previous:** [Form Handling](14-forms.md)
**Next:** [TypeScript](16-typescript.md)
**Up:** [Overview](README.md)
