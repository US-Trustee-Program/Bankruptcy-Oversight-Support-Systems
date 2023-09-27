import { fireEvent, render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

describe('App', () => {
  it('should add className of header-scrolled-out to App when screen is scrolled down beyond 100px', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    const app = document.getElementsByClassName('App');
    expect(app[0]).not.toHaveClass('header-scrolled-out');

    fireEvent.scroll(window, { target: { scrollY: 101 } });
    expect(app[0]).toHaveClass('header-scrolled-out');

    fireEvent.scroll(window, { target: { scrollY: 90 } });
    expect(app[0]).not.toHaveClass('header-scrolled-out');
  });
});
