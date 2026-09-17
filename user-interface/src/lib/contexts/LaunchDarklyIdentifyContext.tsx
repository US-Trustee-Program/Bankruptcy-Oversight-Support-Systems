import { createContext } from 'react';

/**
 * True once `ldClient.identify()` has resolved for the current session's user, or immediately if
 * there is no session to identify. LaunchDarkly's own client initialization (tracked by
 * `useFeatureFlagReadiness`'s `isReady`/`hasTimedOut`) reflects the client's initial, anonymous
 * context -- not this app's later `identify()` call for the logged-in user. A consumer that makes
 * a one-time, hard-to-reverse decision based on a flag value (e.g. redirecting away from a route)
 * should also wait for this to be true, to avoid acting on the anonymous context's value.
 */
export const LaunchDarklyIdentifyContext = createContext<boolean>(false);
