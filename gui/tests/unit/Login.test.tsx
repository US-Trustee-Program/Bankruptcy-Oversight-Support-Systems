import { act, render, screen, waitFor } from '@testing-library/react';
import Login from '../../src/components/Login';
import { Provider } from 'react-redux';
import { store } from '../../src/store/store';
import { BrowserRouter } from 'react-router-dom';
import * as router from 'react-router';
import userEvent from '@testing-library/user-event';

describe('Login', () => {
  it('loads the login prompt', () => {
    render(
      <BrowserRouter>
        <Provider store={store}>
          <Login />
        </Provider>
      </BrowserRouter>,
    );

    const firstNameIp = screen.getByTestId('first-name-input');
    const lastNameIp = screen.getByTestId('last-name-input');

    expect(firstNameIp).toBeInTheDocument();
    expect(lastNameIp).toBeInTheDocument();
  });

  it('gets an id back from the api when submitted, and stores the id in the app store', async () => {
    const navigate = jest.fn();
    jest.spyOn(router, 'useNavigate').mockImplementation(() => navigate);

    render(
      <BrowserRouter>
        <Provider store={store}>
          <Login />
        </Provider>
      </BrowserRouter>,
    );

    const firstNameIp = screen.getByTestId('first-name-input');
    const lastNameIp = screen.getByTestId('last-name-input');
    const submitBtn = screen.getByTestId('login-button');

    userEvent.type(firstNameIp, 'Roger');
    userEvent.type(lastNameIp, 'Moore');
    await userEvent.click(submitBtn);

    // gets id back
    // stored id in store

    // navigates to correct url
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/cases');
    });
  });
});
