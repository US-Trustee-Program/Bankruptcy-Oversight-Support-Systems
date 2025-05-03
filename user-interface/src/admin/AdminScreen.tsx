import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import { Stop } from '@/lib/components/Stop';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';

import useFeatureFlags, { PRIVILEGED_IDENTITY_MANAGEMENT } from '../lib/hooks/UseFeatureFlags';
import AdminScreenNavigation, { AdminNavState } from './AdminScreenNavigation';
import { PrivilegedIdentity } from './privileged-identity/PrivilegedIdentity';

export function AdminScreen() {
  const session = LocalStorage.getSession();
  const hasInvalidPermission = !session?.user?.roles?.includes(CamsRole.SuperUser);
  const flags = useFeatureFlags();

  return (
    <MainContent className="admin-screen" data-testid="admin-screen">
      <DocumentTitle name="Administration" />
      <div className="grid-row">
        <div className="grid-col-1" id="left-gutter"></div>
        <div className="grid-col-10">
          <h1>Administration</h1>
        </div>
        <div className="grid-col-1" id="right-gutter"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1" id="left-gutter"></div>
        {hasInvalidPermission || flags[PRIVILEGED_IDENTITY_MANAGEMENT] === false ? (
          <div className="grid-col-10">
            <Stop
              asError
              id="forbidden-alert"
              message="You do not have permission to use the administrative tools in CAMS."
              title="Forbidden"
            ></Stop>
          </div>
        ) : (
          <>
            <div className="grid-col-2">
              <div className={'left-navigation-pane-container'}>
                <AdminScreenNavigation
                  initiallySelectedNavLink={AdminNavState.PRIVILEGED_IDENTITY}
                />
              </div>
            </div>
            <div className="grid-col-8">
              <PrivilegedIdentity />
            </div>
          </>
        )}
        <div className="grid-col-1" id="right-gutter"></div>
      </div>
    </MainContent>
  );
}
