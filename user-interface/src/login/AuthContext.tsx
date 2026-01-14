import OktaAuth from '@okta/okta-auth-js';
import { createContext } from 'react';

type AuthContextValue = {
  oktaAuth?: OktaAuth;
  renewToken: () => Promise<void>;
};

// Default no-op implementation
const defaultAuthContext: AuthContextValue = {
  renewToken: async () => {
    console.warn('renewToken called but no provider configured');
  },
};

export const AuthContext = createContext(defaultAuthContext);
