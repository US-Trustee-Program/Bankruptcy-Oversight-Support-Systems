# Security Best Practices for SPAs

Protect your React SPA from common security vulnerabilities. Focus on client-side security considerations.

**Practice**
- Sanitize user input before rendering
- Use Content Security Policy (CSP) headers
- Secure authentication tokens properly
- Be cautious with `dangerouslySetInnerHTML` - sanitize with DOMPurify if needed
- Validate data on both client and server
- Use HTTPS for all API calls
- Implement CSRF protection for state-changing operations

**Why / Problems it solves**
- XSS is one of the most common web vulnerabilities
- SPAs are particularly vulnerable to token theft
- Client-side validation alone is insufficient but improves UX
- Proper security protects user data and builds trust

**Signals you need security improvements**
- No CSP headers
- Storing sensitive tokens in localStorage without consideration
- Using `dangerouslySetInnerHTML` without sanitization
- No CSRF protection on mutations
- Accepting and rendering unvalidated user input

##1 XSS Prevention

```tsx
// ❌ BAD: Dangerous - allows script injection
function UserComment({ comment }) {
  return (
    <div dangerouslySetInnerHTML={{ __html: comment.text }} />
  );
}

// User could inject: <img src=x onerror="alert('XSS')">

// ✅ GOOD: React escapes by default
function UserComment({ comment }) {
  return <div>{comment.text}</div>;
  // React automatically escapes HTML, preventing XSS
}

// ✅ ALSO GOOD: If you must render HTML, sanitize first
import DOMPurify from 'dompurify';

function UserComment({ comment }) {
  const sanitizedHTML = DOMPurify.sanitize(comment.text, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
}
```

##2 Secure Token Storage in SPAs

```tsx
// ❌ BAD: localStorage is vulnerable to XSS
async function login(credentials) {
  const response = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  const { token } = await response.json();
  localStorage.setItem('authToken', token); // Accessible to any script!
}

// ✅ BETTER: Use httpOnly cookies (server-set)
// Let server set cookie with httpOnly flag:
// Set-Cookie: authToken=xyz; HttpOnly; Secure; SameSite=Strict

// Client-side: Api2 automatically includes credentials
import { useState, useEffect } from 'react';
import { Api2 } from '@/lib/models/api2';

function UserProfile() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Api2 handles authentication headers and credentials automatically
    Api2.getMe().then(response => {
      if (!cancelled) setSession(response.data[0]);
    });
    return () => { cancelled = true; };
  }, []);

  return session ? <div>Welcome, {session.user.name}</div> : null;
}

// ✅ GOOD: If you must use localStorage, use useSyncExternalStore (React 19)
import { useSyncExternalStore } from 'react';

function useAuthToken() {
  // Use useSyncExternalStore for reading localStorage (React 19 best practice)
  const token = useSyncExternalStore(
    (callback) => {
      // Listen for storage events from other tabs/windows
      window.addEventListener('storage', callback);
      return () => window.removeEventListener('storage', callback);
    },
    () => {
      // Only in secure contexts
      if (window.isSecureContext) {
        return localStorage.getItem('authToken');
      }
      return null;
    }
  );

  const saveToken = (newToken: string) => {
    if (window.isSecureContext) {
      localStorage.setItem('authToken', newToken);
      // Trigger update in current window
      window.dispatchEvent(new Event('storage'));
    }
  };

  const clearToken = () => {
    if (window.isSecureContext) {
      localStorage.removeItem('authToken');
      window.dispatchEvent(new Event('storage'));
    }
  };

  return { token, saveToken, clearToken };
}
```

##3 CSRF Protection for State-Changing Operations

```tsx
// ✅ GOOD: CSRF protection with Api2
// Note: Api2 in this project handles authentication via Bearer tokens in headers
// If your project requires CSRF tokens, Api2 can be extended to include them

import { useActionState } from 'react';
import { Api2 } from '@/lib/models/api2';

// Example: Custom Api2 extension for CSRF
async function submitActionWithCSRF(prevState, formData) {
  const caseId = formData.get('caseId') as string;
  const note = formData.get('note') as string;

  try {
    // Api2 methods handle authentication automatically
    // For additional CSRF protection, extend Api2's headers
    await Api2.postCaseNote({ caseId, title: 'Note', content: note });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function NoteForm({ caseId }) {
  const [state, formAction] = useActionState(submitActionWithCSRF, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <textarea name="note" required />
      <button type="submit">Submit</button>
      {state?.error && <p>{state.error}</p>}
    </form>
  );
}
```

##4 Input Validation

```tsx
// ❌ BAD: No validation, trusting client-side only
function SearchBar() {
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    // Directly using unvalidated input in URL
    fetch(`/api/search?q=${query}`)
      .then(r => r.json())
      .then(setResults);
  };

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}

// ✅ GOOD: Client-side validation + server validation with Api2
import { useState } from 'react';
import { Api2 } from '@/lib/models/api2';
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';

const searchSpec: ValidationSpec<{ query: string }> = {
  query: [
    Validators.minLength(3, 'Query must be at least 3 characters'),
    Validators.maxLength(100, 'Query too long'),
  ],
};

function CaseSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    // Client-side validation (UX improvement)
    const validationResult = validateObject(searchSpec, { query });

    if (!validationResult.valid) {
      setError(validationResult.reasons.join(', '));
      return;
    }

    try {
      // Api2 handles proper encoding and authentication
      const response = await Api2.searchCases({ query, filters: {} });
      setResults(response.data);
      setError('');
    } catch (err) {
      setError('Search failed');
    }
  };

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        maxLength={100}
        placeholder="Search cases..."
      />
      <button onClick={handleSearch}>Search</button>
      {error && <p role="alert">{error}</p>}
      {results.length > 0 && (
        <ul>
          {results.map(c => <li key={c.caseId}>{c.caseId}</li>)}
        </ul>
      )}
    </div>
  );
}
```

##5 Content Security Policy (CSP)

```tsx
// Not code - configure in your server or meta tag

// ✅ GOOD: Strict CSP for React SPAs
// In your HTML or server headers:
/*
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  font-src 'self';
  connect-src 'self' https://api.yourdomain.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
*/

// For React apps using inline styles (common):
// style-src 'self' 'unsafe-inline'

// If you need external resources:
// script-src 'self' https://cdn.example.com
// connect-src 'self' https://api.example.com
```

##6 Secure File Uploads

```tsx
// ✅ GOOD: Validate file types and sizes with validation library
import Validators from '@common/cams/validators';
import { validateObject, ValidationSpec } from '@common/cams/validation';
import { useGenericApi } from '@/lib/models/api2';

// Custom validator for file type
const isAllowedFileType = (value: unknown) => {
  if (!(value instanceof File)) {
    return { reasons: ['Value must be a file'] };
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  return allowedTypes.includes(value.type)
    ? { valid: true }
    : { reasons: ['Only JPEG, PNG, and GIF files allowed'] };
};

// Custom validator for file size
const isWithinSizeLimit = (value: unknown) => {
  if (!(value instanceof File)) {
    return { reasons: ['Value must be a file'] };
  }
  const maxSize = 5 * 1024 * 1024; // 5MB
  return value.size <= maxSize
    ? { valid: true }
    : { reasons: ['File must be smaller than 5MB'] };
};

const fileSpec: ValidationSpec<{ file: File }> = {
  file: [isAllowedFileType, isWithinSizeLimit],
};

function FileUpload() {
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate with project's validation library (client-side UX only!)
    const validationResult = validateObject(fileSpec, { file });

    if (!validationResult.valid) {
      setError(validationResult.reasons.join(', '));
      e.target.value = ''; // Clear input
      return;
    }

    setError('');
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const api = useGenericApi();
      await api.post('/upload', formData);
      // Server should validate file type, size, and scan for malware
    } catch (err) {
      setError('Upload failed');
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif"
        onChange={handleFileChange}
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

##7 Dependency Security

```bash
# Regularly audit dependencies for vulnerabilities
npm audit

# Update dependencies
npm update

# Use npm audit fix for automatic fixes
npm audit fix

# Check for outdated packages
npm outdated
```

**Security Checklist for React SPAs**
- ✅ Use React's default escaping (avoid `dangerouslySetInnerHTML`)
- ✅ Store auth tokens in httpOnly cookies when possible
- ✅ Implement CSP headers
- ✅ Add CSRF protection for mutations
- ✅ Validate input on client AND server
- ✅ Use HTTPS for all API communication
- ✅ Sanitize HTML if you must render it (DOMPurify)
- ✅ Keep dependencies updated (`npm audit`)
- ✅ Validate file uploads (type, size, content)
- ✅ Use `SameSite` cookie attribute for CSRF protection

**Sources**
- https://owasp.org/www-project-top-ten/
- https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html



---
**Previous:** [Accessibility](19-accessibility.md)
**Next:** [Antipatterns](21-antipatterns.md)
**Up:** [Overview](README.md)
