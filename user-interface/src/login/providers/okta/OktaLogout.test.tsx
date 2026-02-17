import { describe } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OktaLogout } from './OktaLogout';
import * as oktaReactModule from '@okta/okta-react';

describe('OktaLogout', () => {
  const clearStorage = vi.fn();
  const useOktaAuth = vi.fn().mockImplementation(() => {
    return {
      oktaAuth: {
        clearStorage,
      },
    };
  });

  beforeEach(() => {
    vi.spyOn(oktaReactModule, 'useOktaAuth').mockImplementation(useOktaAuth);
  });

  test('should render the SessionEnd component', async () => {
    render(
      <BrowserRouter>
        <OktaLogout></OktaLogout>
      </BrowserRouter>,
    );

    expect(clearStorage).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTestId('alert-container')).toBeInTheDocument();
    });
  });
});
