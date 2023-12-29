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
    await waitFor(() => {
      expect(app).not.toHaveClass('header-scrolled-out');
    });

    fireEvent.scroll(app as Element, { target: { scrollTop: 101 } });
    await waitFor(() => {
      expect(app).toHaveClass('header-scrolled-out');
    });

    fireEvent.scroll(app as Element, { target: { scrollTop: 90 } });
    await waitFor(() => {
      expect(app).not.toHaveClass('header-scrolled-out');
    });
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

    fireEvent.scroll(app as Element, { target: { scrollTop: 101 } });
    await waitFor(() => {
      expect(scrollToTopBtn).toHaveClass('show');
    });

    fireEvent.scroll(app as Element, { target: { scrollTop: 90 } });
    await waitFor(() => {
      expect(scrollToTopBtn).not.toHaveClass('show');
    });
  });

  /*
  test('should scroll to top when scroll-to-top button is clicked', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    const app = document.querySelector('.App');
    const scrollToTopBtn = document.querySelector('.scroll-to-top-button');

    await waitFor(() => {
      expect((app as Element).scrollTop).toEqual(0);
      expect(scrollToTopBtn).not.toHaveClass('show');
    });

    fireEvent.scroll(app as Element, { target: { scrollTop: 101 } });
    await waitFor(() => {
      expect((app as Element).scrollTop).toEqual(101);
    });

    fireEvent.click(scrollToTopBtn as Element);
    await waitFor(() => {
      expect((app as Element).scrollTop).toEqual(0);
    });

    await waitFor(() => {
      expect(scrollToTopBtn).not.toHaveClass('show');
    });
  });
  */
});
