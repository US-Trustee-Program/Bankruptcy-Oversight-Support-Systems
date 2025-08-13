import { NavLink, Outlet } from 'react-router-dom';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';

export default function TrusteesPage() {
  const flags = useFeatureFlags();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  if (!flags[TRUSTEE_MANAGEMENT] || !canManage) {
    return null;
  }

  return (
    <div className="grid-container">
      <div className="grid-row">
        <div className="grid-col-12">
          <h1>Trustees</h1>
          <NavLink to="/trustees/create" data-testid="trustees-add-link" className="usa-button">
            Add New Trustee
          </NavLink>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
