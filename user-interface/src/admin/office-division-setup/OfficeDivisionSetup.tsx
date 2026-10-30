import './OfficeDivisionSetup.scss';
import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { TabNav } from '@/lib/components/cams/TabNav/TabNav';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import LocalStorage from '@/lib/utils/local-storage';
import { OfficeDivisionSetupOffices } from './OfficeDivisionSetupOffices';
import { OfficeDivisionSetupChangeHistory } from './OfficeDivisionSetupChangeHistory';
import {
  DivisionChange,
  applyDivisionChanges,
  toHistoryEntries,
} from './office-division-assignments';
import {
  OfficeSetupRow,
  PROTOTYPE_CHANGE_HISTORY,
  PROTOTYPE_DIVISIONS,
  formatOffice,
} from './office-division-setup-data';

const BASE_PATH = '/admin/office-division-setup';

export function OfficeDivisionSetup() {
  const alert = useGlobalAlert();
  // Prototype state: lives in the page until there is an API to save to.
  const [divisions, setDivisions] = useState(PROTOTYPE_DIVISIONS);
  const [history, setHistory] = useState(PROTOTYPE_CHANGE_HISTORY);

  function handleSaveChanges(office: OfficeSetupRow, changes: DivisionChange[]) {
    const changedBy = LocalStorage.getSession()?.user?.name ?? 'Unknown user';
    setDivisions((current) => applyDivisionChanges(current, changes));
    setHistory((current) => [
      ...toHistoryEntries(changes, changedBy, new Date().toISOString()),
      ...current,
    ]);
    alert?.success(`Divisions updated for ${formatOffice(office)}.`);
  }

  return (
    <div className="office-division-setup-admin-panel" data-testid="office-division-setup-panel">
      <h2>Office &amp; Division Setup</h2>
      <TabNav
        aria-label="Office and division setup views"
        tabs={[
          { label: 'Offices', to: BASE_PATH, end: true, testId: 'offices-tab' },
          {
            label: 'Change History',
            to: `${BASE_PATH}/change-history`,
            testId: 'change-history-tab',
          },
        ]}
      />
      <Routes>
        <Route
          index
          element={
            <OfficeDivisionSetupOffices divisions={divisions} onSaveChanges={handleSaveChanges} />
          }
        />
        <Route
          path="change-history"
          element={<OfficeDivisionSetupChangeHistory history={history} />}
        />
      </Routes>
    </div>
  );
}
