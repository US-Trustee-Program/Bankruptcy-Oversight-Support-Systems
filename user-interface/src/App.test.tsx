import { fireEvent, render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

describe('App', () => {
  test('should add className of header-scrolled-out to App when screen is scrolled down beyond 100px', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    const app = document.querySelector('.App');
    expect(app).not.toHaveClass('header-scrolled-out');

    fireEvent.scroll(app as Element, { target: { scrollTop: 101 } });
    expect(app).toHaveClass('header-scrolled-out');

    fireEvent.scroll(app as Element, { target: { scrollTop: 90 } });
    expect(app).not.toHaveClass('header-scrolled-out');
  });

  test('should display scroll button when screen is scrolled beyond 100px', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    const app = document.querySelector('.App');
    const scrollToTopBtn = document.querySelector('.scroll-to-top-button');

    expect(scrollToTopBtn).not.toHaveClass('show');

    await fireEvent.scroll(app as Element, { target: { scrollTop: 101 } });
    expect(scrollToTopBtn).toHaveClass('show');

    await fireEvent.scroll(app as Element, { target: { scrollTop: 90 } });
    expect(scrollToTopBtn).not.toHaveClass('show');
  });

  test('should scroll to top when scroll-to-top button is clicked', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    const app = document.querySelector('.App');
    const scrollToTopBtn = document.querySelector('.scroll-to-top-button');

    expect((app as Element).scrollTop).toEqual(0);
    expect(scrollToTopBtn).not.toHaveClass('show');

    await fireEvent.scroll(app as Element, { target: { scrollTop: 101 } });
    expect((app as Element).scrollTop).toEqual(101);

    await fireEvent.click(scrollToTopBtn as Element);
    expect((app as Element).scrollTop).toEqual(0);

    waitFor(() => {
      expect(scrollToTopBtn).not.toHaveClass('show');
    });
  });
});
