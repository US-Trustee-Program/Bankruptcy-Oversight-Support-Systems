import { NavLink, Outlet } from 'react-router-dom';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import TrusteesList from './TrusteesList';

export default function TrusteesScreen() {
  const flags = useFeatureFlags();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  if (!flags[TRUSTEE_MANAGEMENT] || !canManage) {
    return null;
  }

  return (
    <div className="grid-container">
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
  );
}
