import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLandingPageAnalytics } from '@/lib/hooks/UseLandingPageAnalytics';
import { CASE_SEARCH_PATH, LOGIN_SUCCESS_PATH } from '@/login/login-library';

/**
 * NavigationTracker
 *
 * Tracks navigation between routes to capture analytics about user behavior
 * on landing pages (case-search or my-cases).
 *
 * This component:
 * - Observes location changes at the app level
 * - Tracks the destination page when users navigate away from landing pages
 * - Only tracks first navigation away from each landing page
 *
 * Must be rendered inside React Router.
 */
export function NavigationTracker() {
  const location = useLocation();
  const previousPathRef = useRef<string | null>(null);
  const hasTrackedFromSearchRef = useRef(false);
  const hasTrackedFromMyCasesRef = useRef(false);

  const searchAnalytics = useLandingPageAnalytics('case-search');
  const myCasesAnalytics = useLandingPageAnalytics('my-cases');

  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;

    // Track navigation if:
    // 1. We have a previous path (not the first render)
    // 2. The path actually changed
    // 3. We haven't tracked navigation from this landing page yet
    // 4. Previous path was one of the landing pages
    if (previousPath && previousPath !== currentPath) {
      if (previousPath === CASE_SEARCH_PATH && !hasTrackedFromSearchRef.current) {
        searchAnalytics.trackNavigation(currentPath);
        hasTrackedFromSearchRef.current = true;
      } else if (previousPath === LOGIN_SUCCESS_PATH && !hasTrackedFromMyCasesRef.current) {
        myCasesAnalytics.trackNavigation(currentPath);
        hasTrackedFromMyCasesRef.current = true;
      }
    }

    // Update previous path for next change
    previousPathRef.current = currentPath;
  }, [location.pathname, searchAnalytics, myCasesAnalytics]);

  // This component renders nothing
  return null;
}
