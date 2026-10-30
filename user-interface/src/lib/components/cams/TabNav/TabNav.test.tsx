import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TabNav } from './TabNav';

const TABS = [
  { label: 'First', to: '/section', end: true },
  { label: 'Second', to: '/section/second' },
];

describe('TabNav', () => {
  function renderAt(path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <TabNav aria-label="Section views" tabs={TABS} />
      </MemoryRouter>,
    );
  }

  test('should render a labeled navigation with a link per tab', () => {
    renderAt('/section');

    const nav = screen.getByRole('navigation', { name: 'Section views' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'First' })).toHaveAttribute('href', '/section');
    expect(screen.getByRole('link', { name: 'Second' })).toHaveAttribute('href', '/section/second');
  });

  test('should mark only the tab for the current path as selected', () => {
    renderAt('/section/second');

    const second = screen.getByRole('link', { name: 'Second' });
    const first = screen.getByRole('link', { name: 'First' });
    expect(second).toHaveAttribute('aria-current', 'page');
    expect(second).toHaveClass('tab-nav__link--current');
    expect(first).not.toHaveAttribute('aria-current');
    expect(first).not.toHaveClass('tab-nav__link--current');
  });

  test('should move the selection when another tab is clicked', async () => {
    renderAt('/section');

    await userEvent.click(screen.getByRole('link', { name: 'Second' }));

    expect(screen.getByRole('link', { name: 'Second' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'First' })).not.toHaveAttribute('aria-current');
  });
});
