import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Permissions } from './Permissions';

vi.mock('./CamsUsers', () => ({
  CamsUsers: () => <div data-testid="mocked-cams-users" />,
}));

vi.mock('./ChangeHistory', () => ({
  ChangeHistory: () => <div data-testid="mocked-change-history" />,
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
  test('should offer the CAMS Users and Change History tabs', () => {
    renderAt('/admin/permissions/cams-users');

    const nav = screen.getByRole('navigation', { name: 'Permissions' });
    expect(nav).toHaveTextContent('CAMS Users');
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'CAMS Users' })).toHaveAttribute(
      'href',
      '/admin/permissions/cams-users',
    );
    expect(screen.getByRole('link', { name: 'Change History' })).toHaveAttribute(
      'href',
      '/admin/permissions/change-history',
    );
  });

  test('should show the CAMS Users panel on the CAMS Users tab', () => {
    renderAt('/admin/permissions/cams-users');

    expect(screen.getByTestId('mocked-cams-users')).toBeInTheDocument();
  });

  test('should show the Change History panel on the Change History tab', () => {
    renderAt('/admin/permissions/change-history');

    expect(screen.getByTestId('mocked-change-history')).toBeInTheDocument();
    expect(screen.queryByTestId('mocked-cams-users')).not.toBeInTheDocument();
  });

  test('should redirect /admin/permissions to the CAMS Users tab', () => {
    renderAt('/admin/permissions');

    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/permissions/cams-users');
    expect(screen.getByTestId('mocked-cams-users')).toBeInTheDocument();
  });
});
