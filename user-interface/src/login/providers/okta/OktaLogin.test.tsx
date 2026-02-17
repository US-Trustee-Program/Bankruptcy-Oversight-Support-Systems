import { describe } from 'vitest';
import * as oktaReactModule from '@okta/okta-react';
import { render, screen, waitFor } from '@testing-library/react';
import { OktaLogin } from './OktaLogin';

describe('OktaLogin', () => {
  const authState = {
    isAuthenticated: false,
  };
  const signInWithRedirect = vi.fn();
  const useOktaAuth = vi.fn().mockImplementation(() => {
    return {
      oktaAuth: {
        signInWithRedirect,
      },
      authState,
    };
  });

  beforeEach(() => {
    vi.spyOn(oktaReactModule, 'useOktaAuth').mockImplementation(useOktaAuth);
  });

  test('should allow the user to login via Okta', async () => {
    render(<OktaLogin></OktaLogin>);

    await waitFor(() => {
      expect(screen.queryByTestId('interstitial-login')).toBeInTheDocument();
    });
    expect(signInWithRedirect).toHaveBeenCalled();
  });
});
