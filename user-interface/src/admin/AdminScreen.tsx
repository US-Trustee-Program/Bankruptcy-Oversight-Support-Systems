import './AdminScreen.scss';
import '@/styles/left-navigation-pane.scss';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import AdminScreenNavigation, { AdminNavState } from './AdminScreenNavigation';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { PrivilegedIdentity } from './privileged-identity/PrivilegedIdentity';
import { BankruptcySoftware } from './bankruptcy-software/BankruptcySoftware';
import { BankruptcySoftwareDetail } from './bankruptcy-software/BankruptcySoftwareDetail';
import { CaseReload } from './case-reload/CaseReload';
import { Banks } from './banks/Banks';
import { BankDetail } from './banks/BankDetail';
import { Stop } from '@/lib/components/Stop';
import { Routes, Route, useLocation } from 'react-router-dom';
import useFeatureFlags, { PRIVILEGED_IDENTITY_MANAGEMENT } from '../lib/hooks/UseFeatureFlags';

export function AdminScreen() {
  const session = LocalStorage.getSession();
  const hasInvalidPermission = !session?.user?.roles?.includes(CamsRole.SuperUser);
  const flags = useFeatureFlags();
  const location = useLocation();

  // Determine which nav item should be initially selected based on the current path
  const getInitialNavState = () => {
    if (location.pathname.includes('/admin/bankruptcy-software')) {
      return AdminNavState.BANKRUPTCY_SOFTWARE;
    }
    if (location.pathname.includes('/admin/privileged-identity')) {
      return AdminNavState.PRIVILEGED_IDENTITY;
    }
    if (location.pathname.includes('/admin/case-reload')) {
      return AdminNavState.CASE_RELOAD;
    }
    if (location.pathname.includes('/admin/banks')) {
      return AdminNavState.BANKS;
    }
    return AdminNavState.UNKNOWN;
  };

  return (
    <MainContent className="admin-screen" data-testid="admin-screen">
      <DocumentTitle name="Administration" />
      {hasInvalidPermission || flags[PRIVILEGED_IDENTITY_MANAGEMENT] === false ? (
        <div className="grid-row">
          <div className="grid-col-12">
            <Stop
              id="forbidden-alert"
              title="Forbidden"
              message="You do not have permission to use the administrative tools in CAMS."
              asError
            ></Stop>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="banks/:bankId/*" element={<BankDetail />} />
          <Route path="bankruptcy-software/:softwareId/*" element={<BankruptcySoftwareDetail />} />
          <Route
            path="*"
            element={
              <>
                <h1>Administration</h1>
                <div className="admin-content-container">
                  <div className="left-navigation-pane-container">
                    <AdminScreenNavigation initiallySelectedNavLink={getInitialNavState()} />
                  </div>
                  <div className="main-content-area">
                    <Routes>
                      <Route path="privileged-identity" element={<PrivilegedIdentity />} />
                      <Route path="banks" element={<Banks />} />
                      <Route path="bankruptcy-software" element={<BankruptcySoftware />} />
                      <Route path="case-reload" element={<CaseReload />} />
                      <Route path="*" element={<div data-testid={'no-admin-panel-selected'} />} />
                    </Routes>
                  </div>
                </div>
              </>
            }
          />
        </Routes>
      )}
    </MainContent>
  );
}
