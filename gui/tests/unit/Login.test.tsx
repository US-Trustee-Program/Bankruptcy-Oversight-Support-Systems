import { render, screen, waitFor } from '@testing-library/react';
import Login from '../../src/components/Login';
import { Provider } from 'react-redux';
import { store } from '../../src/store/store';
import { UserSlice } from '../../src/store/features/UserSlice';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import * as router from 'react-router';
import userEvent from '@testing-library/user-event';

const mockLoginResponse = {
  success: true,
  message: 'user record',
  count: 1,
  body: [
    {
      first_name: 'Roger',
      middle_initial: ' ',
      last_name: 'Moore',
      professional_id: 123,
    },
  ],
};

const mockLogin = () => {
  console.log('mocking fetch...');
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockLoginResponse),
  } as Response);
};

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
    // first we'll need to initialize a new store
    const store = configureStore({
      reducer: {
        user: UserSlice.reducer,
      },
    });

    //----------------------
    // MOCKS
    //----------------------

    const firstName = 'Roger';
    const lastName = 'Moore';

    const dispatchObject = {
      id: 123,
      firstName,
      lastName,
    };

    // mock the fetch call
    jest.spyOn(global, 'fetch').mockImplementation(mockLogin);

    // mock the browser navigation
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

    //----------------------
    // SCREEN INTERACTION
    //----------------------

    userEvent.type(firstNameIp, firstName);
    userEvent.type(lastNameIp, lastName);
    await userEvent.click(submitBtn);

    //----------------------
    // ASSERTIONS
    //----------------------

    await waitFor(() => {
      // verify that store contains id, first_name, last_name
      expect(store.getState().user.user).toEqual(expect.objectContaining(dispatchObject));

      // navigates to correct url
      expect(navigate).toHaveBeenCalledWith('/cases');
    });
  });
});
