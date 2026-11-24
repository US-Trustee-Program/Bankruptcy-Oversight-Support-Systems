import { Navigate, Route, Routes } from 'react-router-dom';
import TabNavigation from '@/lib/components/cams/TabNavigation/TabNavigation';
import { CamsUsers } from './CamsUsers';

const CAMS_USERS_PATH = '/admin/permissions/cams-users';

const PERMISSIONS_TABS = [{ label: 'CAMS Users', to: CAMS_USERS_PATH }];

export function Permissions() {
  return (
    <div>
      <TabNavigation id="permissions-tabs" ariaLabel="Permissions" tabs={PERMISSIONS_TABS} />
      <Routes>
        <Route path="cams-users" element={<CamsUsers />} />
        <Route path="*" element={<Navigate to={CAMS_USERS_PATH} replace />} />
      </Routes>
    </div>
  );
}
