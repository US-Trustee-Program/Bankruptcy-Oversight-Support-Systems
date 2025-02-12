import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import AdminScreenNavigation, { AdminNavState } from './AdminScreenNavigation';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { PrivilegedIdentity } from './privileged-identity/PrivilegedIdentity';
import { Stop } from '@/lib/components/Stop';
import useFeatureFlags, { PRIVILEGED_IDENTITY_MANAGEMENT } from '../lib/hooks/UseFeatureFlags';

export function AdminScreen() {
  const session = LocalStorage.getSession();
  const hasInvalidPermission = !session?.user?.roles?.includes(CamsRole.SuperUser);
  const flags = useFeatureFlags();

  return (
    <MainContent className="admin-screen" data-testid="admin-screen">
      <DocumentTitle name="Administration" />
      <div className="grid-row">
        <div id="left-gutter" className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Administration</h1>
        </div>
        <div id="right-gutter" className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div id="left-gutter" className="grid-col-1"></div>
        {hasInvalidPermission || flags[PRIVILEGED_IDENTITY_MANAGEMENT] === false ? (
          <div className="grid-col-10">
            <Stop
              id="forbidden-alert"
              title="Forbidden"
              message="You do not have permission to use the administrative tools in CAMS."
              asError
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
        <div id="right-gutter" className="grid-col-1"></div>
      </div>
    </MainContent>
  );
}
