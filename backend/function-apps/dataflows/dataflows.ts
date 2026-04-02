import * as dotenv from 'dotenv';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';

import CaseAssignmentEvent from './events/case-assignment-event';
import CaseClosedEvent from './events/case-closed-event';
import BackfillPhoneticTokens from './migrations/backfill-phonetic-tokens';
import ImportZoomCsv from './migrations/import-zoom-csv';
import DivisionChangeCleanup from './migrations/division-change-cleanup';
import MigrateAssignees from './migrations/migrate-assignees';
import MigrateCases from './migrations/migrate-cases';
import MigrateChildCasesToMemberCases from './migrations/migrate-childcases-to-membercases';
import MigrateConsolidations from './migrations/migrate-consolidations';
import MigrateTrustees from './migrations/migrate-trustees';
import ResyncRemainingCases from './migrations/resync-remaining-cases';
import ResyncTerminalTransactionCases from './migrations/resync-terminal-transaction-cases';
import SyncCases from './import/sync-cases';
import SyncDeletedCases from './import/sync-deleted-cases';
import SyncOrders from './import/sync-orders';
import SyncOfficeStaff from './import/sync-office-staff';
import SyncTrusteeAppointments from './import/sync-trustee-appointments';
import SyncTrusteeNotesMetrics from './metrics/sync-trustee-notes-metrics';
import SyncTrusteeDueDateMetrics from './metrics/sync-trustee-due-date-metrics';

const MODULE_NAME = 'DATAFLOWS-SETUP';

type DataflowSetup = {
  MODULE_NAME: string;
  setup: () => void;
};

const logger = new LoggerImpl('bootstrap');

function envVarToNames(envVar: string) {
  return envVar
    .toUpperCase()
    .replace(/_/g, '-')
    .split(',')
    .map((name) => name.trim());
}

class DataflowSetupMap {
  private map = new Map<string, () => void>();

  register(...dataflows: DataflowSetup[]) {
    for (const dataflow of dataflows) {
      this.map.set(dataflow.MODULE_NAME, dataflow.setup);
    }
  }

  list() {
    return [...this.map.keys()];
  }

  setup(...names: string[]) {
    const uniqueNames = new Set(names);
    const status: [string, boolean][] = [];

    for (const [name, setupFunc] of this.map.entries()) {
      const enabled = uniqueNames.has(name);
      if (enabled) {
        setupFunc();
      }
      status.push([name, enabled]);
    }

    uniqueNames.forEach((name) => {
      if (!this.map.has(name)) {
        logger.warn(MODULE_NAME, `Dataflow name ${name} not found.`);
      }
    });

    return status;
  }
}
const dataflows = new DataflowSetupMap();

dotenv.config();

dataflows.register(
  BackfillPhoneticTokens,
  CaseAssignmentEvent,
  CaseClosedEvent,
  DivisionChangeCleanup,
  ImportZoomCsv,
  MigrateAssignees,
  MigrateCases,
  MigrateChildCasesToMemberCases,
  MigrateConsolidations,
  MigrateTrustees,
  ResyncRemainingCases,
  ResyncTerminalTransactionCases,
  SyncCases,
  SyncDeletedCases,
  SyncOfficeStaff,
  SyncOrders,
  SyncTrusteeAppointments,
  SyncTrusteeNotesMetrics,
  SyncTrusteeDueDateMetrics,
);

const registeredDataflows = dataflows.list().join(', ').replace(/-/g, '_');
logger.info(MODULE_NAME, 'Registered Dataflows', registeredDataflows);

const names = envVarToNames(process.env.CAMS_ENABLED_DATAFLOWS ?? '');
const status = dataflows.setup(...names);

status.forEach((s) => {
  logger.info(MODULE_NAME, `${s}`);
});
