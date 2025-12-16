# Error Handling & Resilience

Create resilient UIs by handling errors and loading states at appropriate boundaries.

**Practice**
- Add **Error Boundaries** around route pages and major feature zones
- Combine Error Boundaries with Suspense for complete loading + error handling
- Log errors to monitoring services in boundary's `onError`
- Provide recovery actions (retry button)
- Show appropriate fallback UI for different error types

**Why / Problems it solves**
- Prevents a localized bug from blanking out the whole SPA
- Enables graceful degradation when features fail
- Gives users recovery options instead of broken UI
- Provides observability into production errors

**Signals to add error boundaries**
- A single component error crashes the entire app
- Need to handle async errors in different parts of the UI differently
- Want to show skeleton loading states while data loads

```tsx
// ❌ BAD: No error or loading boundaries, errors crash the app
function App() {
  return (
    <div>
      <Header />
      <UserProfile /> {/* If this throws, whole app crashes */}
      <AsyncDataComponent /> {/* No loading state shown */}
      <Footer />
    </div>
  );
}

function AsyncDataComponent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error!</div>;
  return <div>{data.content}</div>;
}

// ✅ GOOD: Strategic error and suspense boundaries
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

function App() {
  const { appInsights } = getAppInsights();

  const logError = (error: Error, errorInfo: { componentStack: string }) => {
    // Log to Application Insights
    appInsights.trackException({
      exception: error,
      properties: {
        componentStack: errorInfo.componentStack,
      },
    });
  };

  return (
    <div>
      <Header />
      <ErrorBoundary
        fallback={<ErrorFallback />}
        onError={logError}
      >
        <Suspense fallback={<UserProfileSkeleton />}>
          <UserProfile />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={<ErrorFallback />}>
        <Suspense fallback={<LoadingSpinner />}>
          <AsyncDataComponent />
        </Suspense>
      </ErrorBoundary>
      <Footer />
    </div>
  );
}

// Component uses promises that Suspense can handle
function AsyncDataComponent() {
  const data = use(fetchData()); // Suspends automatically
  return <div>{data.content}</div>;
}

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
```

**Error Boundary Limitations (Important)**

Error boundaries have limitations you need to handle separately:

```tsx
// ❌ Error boundaries DON'T catch these errors:
function ProblematicComponent() {
  // 1. Event handlers (not caught by Error Boundary)
  const handleClick = () => {
    throw new Error('Event handler error'); // Not caught!
  };

  useEffect(() => {
    // 2. Async errors in effects (not caught by Error Boundary)
    fetch('/api/data')
      .then(res => res.json())
      .catch(err => {
        throw err; // Not caught by Error Boundary!
      });
  }, []);

  // 3. Errors in setTimeout/setInterval (not caught)
  setTimeout(() => {
    throw new Error('Timer error'); // Not caught!
  }, 1000);

  return <button onClick={handleClick}>Click</button>;
}

// ✅ GOOD: Handle these cases explicitly
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

function SafeComponent() {
  const [error, setError] = useState(null);
  const { appInsights } = getAppInsights();

  // Handle event handler errors with try-catch
  const handleClick = () => {
    try {
      riskyOperation();
    } catch (err) {
      setError(err);
      // Log to Application Insights
      appInsights.trackException({ exception: err });
    }
  };

  // Use use() hook for data fetching - errors caught by Error Boundary
  const data = use(fetchData()); // ✅ Caught by Error Boundary

  if (error) return <div>Error: {error.message}</div>;
  return <button onClick={handleClick}>Click</button>;
}
```

**Error Handling with Actions**

Actions in forms automatically catch errors - handle them in the action return value:

```tsx
import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';

async function submitAction(prevState, formData) {
  try {
    const caseId = formData.get('caseId') as string;
    const note = formData.get('note') as string;

    // Api2 automatically handles authentication and throws on error
    await Api2.postCaseNote({ caseId, title: 'Note', content: note });

    return { success: true, error: null };
  } catch (error) {
    // Handle errors from Api2
    return {
      success: false,
      error: error.message || 'Submission failed. Please try again.'
    };
  }
}

function Form({ caseId }) {
  const [state, formAction] = useActionState(submitAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <textarea name="note" placeholder="Enter case note" required />
      <button type="submit">Submit</button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
```

**Retry Strategies for SPAs**

```tsx
// ✅ GOOD: Retry with exponential backoff
function ErrorFallbackWithRetry({ error, resetErrorBoundary }) {
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = async () => {
    setRetrying(true);

    // Exponential backoff: wait 1s, 2s, 4s...
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    setRetryCount(retryCount + 1);
    setRetrying(false);
    resetErrorBoundary();
  };

  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={handleRetry} disabled={retrying}>
        {retrying ? 'Retrying...' : 'Try Again'}
      </button>
      {retryCount > 0 && <p>Retry attempt: {retryCount}</p>}
    </div>
  );
}
```

**Error Logging for SPAs**

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

function App() {
  const { appInsights } = getAppInsights();

  const logErrorToApplicationInsights = (error: Error, errorInfo: { componentStack: string }) => {
    // Log error details to console for debugging
    console.error('Error caught:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // Send to Application Insights
    appInsights.trackException({
      exception: error,
      properties: {
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      },
    });
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={logErrorToApplicationInsights}
      onReset={() => {
        // Reset app state if needed
        window.location.href = '/';
      }}
    >
      <Routes />
    </ErrorBoundary>
  );
}
```

**Different Error UI for Different Scenarios**

```tsx
// ✅ GOOD: Context-specific error messages
function ErrorFallback({ error, resetErrorBoundary }) {
  // Network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return (
      <div role="alert">
        <h2>Connection Problem</h2>
        <p>Please check your internet connection and try again.</p>
        <button onClick={resetErrorBoundary}>Retry</button>
      </div>
    );
  }

  // Authentication errors
  if (error.message.includes('401') || error.message.includes('auth')) {
    return (
      <div role="alert">
        <h2>Session Expired</h2>
        <p>Please log in again to continue.</p>
        <button onClick={() => (window.location.href = '/login')}>
          Go to Login
        </button>
      </div>
    );
  }

  // Generic errors
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
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
