import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import AdminScreenNavigation, { AdminNavState } from './AdminScreenNavigation';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { PrivilegedIdentity } from './privileged-identity/PrivilegedIdentity';

export function AdminScreen() {
  if (!LocalStorage.getSession()?.user.roles?.includes(CamsRole.SuperUser)) {
    return (
      <MainContent className="admin-screen" data-testid="admin-screen">
        <DocumentTitle name="Administration" />
        <div className="grid-row">
          <div id="left-gutter" className="grid-col-1"></div>
          <div className="grid-col-10">
            <Alert
              type={UswdsAlertStyle.Info}
              inline={true}
              show={true}
              title="Forbidden"
              id="forbidden-alert"
            >
              You do not have sufficient permission to use the CAMS administration tools.
            </Alert>
          </div>
          <div id="right-gutter" className="grid-col-1"></div>
        </div>
      </MainContent>
    );
  }
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
        <div className="grid-col-2">
          <div className={'left-navigation-pane-container'}>
            <AdminScreenNavigation initiallySelectedNavLink={AdminNavState.PRIVILEGED_IDENTITY} />
          </div>
        </div>
        <div className="grid-col-8">
          <PrivilegedIdentity />
        </div>
        <div id="right-gutter" className="grid-col-1"></div>
      </div>
    </MainContent>
  );
}
