import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TabNavigation from './TabNavigation';

const tabs = [
  { label: 'CAMS Users', to: '/admin/permissions/cams-users' },
  { label: 'Change History', to: '/admin/permissions/change-history' },
];

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <TabNavigation id="permissions-tabs" ariaLabel="Permissions" tabs={tabs} />
    </MemoryRouter>,
  );
}

describe('TabNavigation', () => {
  test('should render a labelled navigation landmark with a link per tab', () => {
    renderAt('/admin/permissions/cams-users');

    const nav = screen.getByRole('navigation', { name: 'Permissions' });
    const links = screen.getAllByRole('link');
    expect(nav).toContainElement(links[0]);
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['CAMS Users', '/admin/permissions/cams-users'],
      ['Change History', '/admin/permissions/change-history'],
    ]);
  });

  test('should mark only the tab for the current route as current', () => {
    renderAt('/admin/permissions/change-history');

    expect(screen.getByRole('link', { name: 'Change History' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'CAMS Users' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Change History' })).toHaveClass(
      'tab-navigation__link--current',
    );
    expect(screen.getByRole('link', { name: 'CAMS Users' })).not.toHaveClass(
      'tab-navigation__link--current',
    );
  });

  test('should use links rather than the ARIA tab pattern', () => {
    renderAt('/admin/permissions/cams-users');

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
