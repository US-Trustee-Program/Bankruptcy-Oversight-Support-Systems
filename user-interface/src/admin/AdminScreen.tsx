import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import AdminScreenNavigation, { AdminNavState } from './AdminScreenNavigation';
import PrivilegedIdentity from './privileged-identity/PrivilegedIdentity';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

export function AdminScreen() {
  if (!LocalStorage.getSession()?.user.roles?.includes(CamsRole.SuperUser)) {
    return (
      <Alert type={UswdsAlertStyle.Info} inline={true} show={true} title="Permission">
        You do not have sufficent permission to use the CAMS administration tools.
      </Alert>
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
