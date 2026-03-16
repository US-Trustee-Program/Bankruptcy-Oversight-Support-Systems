import { render, screen, act } from '@testing-library/react';
import ScrollToTopButton from './ScrollToTopButton';

function renderWithAppDiv() {
  const appDiv = document.createElement('div');
  appDiv.className = 'App';
  document.body.appendChild(appDiv);

  const { unmount } = render(<ScrollToTopButton />);

  return {
    appDiv,
    unmount: () => {
      unmount();
      document.body.removeChild(appDiv);
    },
  };
}

describe('ScrollToTopButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders scroll to top button', () => {
    const { unmount } = renderWithAppDiv();
    expect(screen.getByTitle('Scroll to top')).toBeInTheDocument();
    unmount();
  });

  test('adds "show" class and changes App class when scrollY exceeds 100', () => {
    const { appDiv, unmount } = renderWithAppDiv();
    const scrollButton = screen.getByTitle('Scroll to top');

    Object.defineProperty(window, 'scrollY', { value: 150, writable: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(appDiv.className).toBe('App header-scrolled-out');
    expect(scrollButton.classList.contains('show')).toBe(true);

    unmount();
  });

  test('removes "show" class and restores App class when scrollY is 100 or less', () => {
    const { appDiv, unmount } = renderWithAppDiv();
    const scrollButton = screen.getByTitle('Scroll to top');

    // First scroll down to show the button
    Object.defineProperty(window, 'scrollY', { value: 150, writable: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // Then scroll back up
    Object.defineProperty(window, 'scrollY', { value: 50, writable: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(appDiv.className).toBe('App');
    expect(scrollButton.classList.contains('show')).toBe(false);

    unmount();
  });

  test('handles scroll when scroll button is not in the DOM', () => {
    const appDiv = document.createElement('div');
    appDiv.className = 'App';
    document.body.appendChild(appDiv);

    const { unmount } = render(<ScrollToTopButton />);

    // Rename the class so document.querySelector('.scroll-to-top-button') returns null
    const scrollBtn = document.querySelector('.scroll-to-top-button') as HTMLElement | null;
    if (scrollBtn) scrollBtn.className = '';

    // Scroll down — L13 if(scrollButton) false branch
    Object.defineProperty(window, 'scrollY', { value: 150, writable: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(appDiv.className).toBe('App header-scrolled-out');

    // Scroll up — L16 if(scrollButton) false branch
    Object.defineProperty(window, 'scrollY', { value: 50, writable: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(appDiv.className).toBe('App');

    unmount();
    document.body.removeChild(appDiv);
  });

  test('does nothing when .App element is not found', () => {
    // Render without the .App div wrapper
    render(<ScrollToTopButton />);

    Object.defineProperty(window, 'scrollY', { value: 150, writable: true, configurable: true });
    expect(() => {
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
    }).not.toThrow();
  });
});
