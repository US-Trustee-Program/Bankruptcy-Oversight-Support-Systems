# Accessibility (a11y) for SPAs

Build inclusive React applications that work for all users, including those using assistive technologies.

**Practice**
- Use semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`)
- Provide text alternatives for non-text content
- Ensure keyboard navigation works throughout your SPA
- Use ARIA attributes only when semantic HTML isn't sufficient
- Manage focus properly during route changes and dynamic updates
- Test with screen readers (NVDA, JAWS, VoiceOver)

**Why / Problems it solves**
- 15% of global population has some form of disability
- Semantic HTML provides built-in accessibility
- Screen reader users rely on proper markup and focus management
- Keyboard-only users need accessible navigation
- SPAs require extra attention for route announcements

**Signals you need a11y improvements**
- Can't navigate your app with keyboard only (Tab, Enter, Escape)
- Dynamic content updates aren't announced to screen readers
- Forms don't have proper labels
- Users complain about accessibility barriers

##1 Semantic HTML & ARIA

```tsx
// ❌ BAD: Divs and spans for everything
function Navigation() {
  return (
    <div className="nav">
      <div onClick={() => navigate('/')}>Home</div>
      <div onClick={() => navigate('/about')}>About</div>
    </div>
  );
}

// ✅ GOOD: Semantic HTML with proper roles
function Navigation() {
  return (
    <nav aria-label="Main navigation">
      <button onClick={() => navigate('/')}>Home</button>
      <button onClick={() => navigate('/about')}>About</button>
    </nav>
  );
}

// ✅ GOOD: Links for navigation, buttons for actions
function Navigation() {
  return (
    <nav aria-label="Main navigation">
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  );
}
```

##2 Form Accessibility

```tsx
// ❌ BAD: No labels, no error association
function ContactForm() {
  const [error, setError] = useState('');

  return (
    <form>
      <input type="email" placeholder="Email" />
      {error && <div>{error}</div>}
      <button>Submit</button>
    </form>
  );
}

// ✅ GOOD: Proper labels, error association, and validation
import { useActionState, useId } from 'react';
import { Api2 } from '@/lib/models/api2';
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

const contactSpec: ValidationSpec<{ email: string }> = {
  email: [Validators.isEmailAddress],
};

async function submitContact(prevState, formData) {
  const email = formData.get('email') as string;

  // Validate with project's validation library
  const validationResult = validateObject(contactSpec, { email });

  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.reasons.join(', '),
    };
  }

  try {
    await Api2.post('/contact', { email });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: 'Submission failed' };
  }
}

function ContactForm() {
  const [state, formAction] = useActionState(submitContact, null);
  const emailId = useId();
  const errorId = useId();

  return (
    <form action={formAction}>
      <label htmlFor={emailId}>
        Email address
        <input
          id={emailId}
          name="email"
          type="email"
          aria-invalid={!!state?.error}
          aria-describedby={state?.error ? errorId : undefined}
          required
        />
      </label>
      {state?.error && (
        <p id={errorId} role="alert" aria-live="polite">
          {state.error}
        </p>
      )}
      <button type="submit">Submit</button>
    </form>
  );
}
```

##3 Focus Management in SPAs

```tsx
// ✅ GOOD: Manage focus on route changes
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function Page({ title, children }) {
  const headingRef = useRef(null);
  const location = useLocation();

  // Focus page heading on route change
  useEffect(() => {
    headingRef.current?.focus();
  }, [location.pathname]);

  return (
    <main>
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {children}
    </main>
  );
}

// ✅ GOOD: Focus first error in form
function Form() {
  const [errors, setErrors] = useState({});
  const firstErrorRef = useRef(null);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      firstErrorRef.current?.focus();
    }
  }, [errors]);

  return (
    <form>
      <input
        ref={errors.email ? firstErrorRef : null}
        aria-invalid={!!errors.email}
      />
    </form>
  );
}
```

##4 Dynamic Content Announcements

```tsx
// ✅ GOOD: Announce loading and updates to screen readers
function SearchResults({ query }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  return (
    <div>
      {/* Screen reader announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {loading ? 'Loading results...' : `Found ${results.length} results`}
      </div>

      {loading ? (
        <div aria-hidden="true">Loading...</div>
      ) : (
        <ul>
          {results.map(result => (
            <li key={result.id}>{result.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Screen-reader-only CSS
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

##5 Keyboard Navigation

```tsx
// ✅ GOOD: Full keyboard support
function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus trap
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements?.[0];
    const lastElement = focusableElements?.[focusableElements.length - 1];

    firstElement?.focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }

      // Tab trap
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <h2 id="modal-title">Modal Title</h2>
      {children}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

##6 Skip Links for SPAs

```tsx
// ✅ GOOD: Skip link for keyboard users
function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Routes />
      </main>
    </>
  );
}

// CSS for skip link
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

**Common ARIA Patterns for React SPAs**
- `role="alert"` - Urgent messages (errors)
- `aria-live="polite"` - Non-urgent updates (search results)
- `aria-busy="true"` - Loading states
- `aria-expanded` - Disclosure widgets
- `aria-haspopup` - Menus and dialogs
- `aria-label` - When visible label isn't present
- `aria-describedby` - Additional descriptions (error messages)

**Sources**
- https://www.w3.org/WAI/ARIA/apg/
- https://react.dev/learn/accessibility
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA



---
**Previous:** [Anti-overengineering](18-anti-overengineering.md)
**Next:** [Security](20-security.md)
**Up:** [Overview](README.md)
