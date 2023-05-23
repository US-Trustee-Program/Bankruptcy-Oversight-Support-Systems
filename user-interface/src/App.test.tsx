import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

describe('App', () => {
  it('loads the login prompt', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    const firstNameIp = screen.getByTestId('first-name-input');
    const lastNameIp = screen.getByTestId('last-name-input');

    expect(firstNameIp).toBeInTheDocument();
    expect(lastNameIp).toBeInTheDocument();
  });
});
