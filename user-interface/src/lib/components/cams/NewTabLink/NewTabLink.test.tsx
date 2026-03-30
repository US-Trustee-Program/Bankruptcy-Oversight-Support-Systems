import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NewTabLink } from './NewTabLink';

describe('NewTabLink component', () => {
  function renderComponent(to: string, label: string, className?: string) {
    render(
      <BrowserRouter>
        <NewTabLink to={to} label={label} className={className} />
      </BrowserRouter>,
    );
  }

  test('should render a link with the provided label', () => {
    renderComponent('/some/path', 'My Link');

    const link = screen.getByRole('link', { name: /my link/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent('My Link');
  });

  test('should navigate to the provided path', () => {
    renderComponent('/some/path', 'My Link');

    const link = screen.getByRole('link', { name: /my link/i });
    expect(link).toHaveAttribute('href', '/some/path');
  });

  test('should open in a new tab', () => {
    renderComponent('/some/path', 'My Link');

    const link = screen.getByRole('link', { name: /my link/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('should always include the new-tab-link class', () => {
    renderComponent('/some/path', 'My Link');

    const link = screen.getByRole('link', { name: /my link/i });
    expect(link).toHaveClass('new-tab-link');
  });

  test('should append an additional className when provided', () => {
    renderComponent('/some/path', 'My Link', 'extra-class');

    const link = screen.getByRole('link', { name: /my link/i });
    expect(link).toHaveClass('new-tab-link');
    expect(link).toHaveClass('extra-class');
  });

  test('should not add undefined to the class list when no className is provided', () => {
    renderComponent('/some/path', 'My Link');

    const link = screen.getByRole('link', { name: /my link/i });
    expect(link.className).not.toContain('undefined');
  });

  test('should render the launch icon', () => {
    renderComponent('/some/path', 'My Link');

    const link = screen.getByRole('link', { name: /my link/i });
    const icon = link.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});
