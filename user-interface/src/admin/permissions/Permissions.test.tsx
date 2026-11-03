import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Permissions } from './Permissions';

vi.mock('./CamsUsers', () => ({
  CamsUsers: () => <div data-testid="mocked-cams-users" />,
}));

function CurrentPath() {
  return <div data-testid="current-path">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/permissions/*"
          element={
            <>
              <Permissions />
              <CurrentPath />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Permissions', () => {
  test('should offer a single CAMS Users tab', () => {
    renderAt('/admin/permissions/cams-users');

    const nav = screen.getByRole('navigation', { name: 'Permissions' });
    expect(nav).toHaveTextContent('CAMS Users');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'CAMS Users' })).toHaveAttribute(
      'href',
      '/admin/permissions/cams-users',
    );
  });

  test('should show the CAMS Users panel on the CAMS Users tab', () => {
    renderAt('/admin/permissions/cams-users');

    expect(screen.getByTestId('mocked-cams-users')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CAMS Users' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('should redirect /admin/permissions to the CAMS Users tab', () => {
    renderAt('/admin/permissions');

    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/permissions/cams-users');
    expect(screen.getByTestId('mocked-cams-users')).toBeInTheDocument();
  });
});
