import { NavLink, Outlet, useOutlet } from 'react-router-dom';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import TrusteesList from './TrusteesList';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';

export default function TrusteesScreen() {
  const flags = useFeatureFlags();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  const outlet = useOutlet();

  // Check if there's a nested route being rendered
  const hasNestedRoute = !!outlet;

  // If no nested route and unauthorized, return null (for component tests and main view)
  if (!hasNestedRoute && (!flags[TRUSTEE_MANAGEMENT] || !canManage)) {
    return null;
  }

  // If nested route exists, render minimal structure with outlet (for router integration)
  if (hasNestedRoute) {
    return (
      <MainContent data-testid="trustees">
        <Outlet />
      </MainContent>
    );
  }

  // For authorized access to main trustees view, render full interface
  return (
    <MainContent data-testid="trustees">
      <div>
        <div className="display-flex flex-justify flex-align-end">
          <h1 className="display-inline-block margin-bottom-0">Trustees</h1>
          <NavLink
            to="/trustees/create"
            data-testid="trustees-add-link"
            className="usa-button flex-shrink-0 margin-right-0"
          >
            Add New Trustee
          </NavLink>
        </div>
        <div className="grid-row">
          <div className="grid-col-12">
            <TrusteesList />
          </div>
        </div>
        <Outlet />
      </div>
    </MainContent>
  );
}
