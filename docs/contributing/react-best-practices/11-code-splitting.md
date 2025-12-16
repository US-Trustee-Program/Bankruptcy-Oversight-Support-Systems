# Code Splitting & Lazy Loading

Split your bundle at route or feature boundaries to reduce initial load time.

## Practice
- Split at **route/page boundaries** first (using React Router + lazy)
- Lazy-load heavy feature modules or components
- Show predictable fallbacks with Suspense
- Consider prefetching on hover for better perceived performance

## Why / Problems it solves
- Reduces initial bundle size → faster first paint
- Better UX on slow networks
- Avoids shipping code users won't need on first load
- Pay-as-you-go JavaScript loading

## Signals to use code splitting
- Initial JS chunk is large (>500KB) or startup time degrades
- You have distinct routes or features users might not visit
- Profiling shows initial parse/compile time is significant

```tsx
// ❌ BAD: Importing everything upfront increases bundle size
import Dashboard from './Dashboard';
import Settings from './Settings';
import Reports from './Reports';
import Analytics from './Analytics';
import AdminPanel from './AdminPanel';

function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div>
      {page === 'dashboard' && <Dashboard />}
      {page === 'settings' && <Settings />}
      {page === 'reports' && <Reports />}
      {page === 'analytics' && <Analytics />}
      {page === 'admin' && <AdminPanel />}
    </div>
  );
}

// ✅ GOOD: Lazy loading with code splitting
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const Settings = lazy(() => import('./Settings'));
const Reports = lazy(() => import('./Reports'));
const Analytics = lazy(() => import('./Analytics'));
const AdminPanel = lazy(() => import('./AdminPanel'));

function App() {
  const [page, setPage] = useState('dashboard');

  return (
    <div>
      <Suspense fallback={<PageSkeleton />}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'settings' && <Settings />}
        {page === 'reports' && <Reports />}
        {page === 'analytics' && <Analytics />}
        {page === 'admin' && <AdminPanel />}
      </Suspense>
    </div>
  );
}

// ✅ ALSO GOOD: Prefetch on hover for better UX
function Navigation() {
  const prefetchPage = (pageName) => {
    // Prefetch on hover to reduce perceived loading time
    if (pageName === 'reports') {
      import('./Reports');
    }
  };

  return (
    <nav>
      <a href="/reports" onMouseEnter={() => prefetchPage('reports')}>
        Reports
      </a>
    </nav>
  );
}
```

## Sources
- https://react.dev/reference/react/lazy
- https://react.dev/reference/react/Suspense
- https://react.dev/blog/2025/02/14/sunsetting-create-react-app
- https://react.dev/learn/build-a-react-app-from-scratch

---
**Previous:** [Performance Optimization](10-performance.md)
**Next:** [Concurrent Features](12-concurrent-features.md)
**Up:** [Overview](README.md)
