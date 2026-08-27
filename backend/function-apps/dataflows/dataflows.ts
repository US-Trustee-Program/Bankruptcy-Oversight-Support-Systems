import * as dotenv from 'dotenv';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';

import CaseAssignmentEvent from './events/case-assignment-event';
import CaseClosedEvent from './events/case-closed-event';
import BackfillPhoneticTokens from './migrations/backfill-phonetic-tokens';
import BackfillCaseAppointmentDates from './migrations/backfill-case-appointment-dates';
import BackfillTrusteePhoneticTokens from './migrations/backfill-trustee-phonetic-tokens';
import ImportZoomCsv from './migrations/import-zoom-csv';
import DivisionChangeCleanup from './migrations/division-change-cleanup';
import FixChapter7Appointments from './migrations/fix-chapter-7-appointments';
import HandleMissedDivisionChanges from './migrations/handle-missed-division-changes';
import MigrateAssignees from './migrations/migrate-assignees';
import MigrateCases from './migrations/migrate-cases';
import MigrateChildCasesToMemberCases from './migrations/migrate-childcases-to-membercases';
import MigrateOrderTypeToTaskType from './migrations/migrate-ordertype-to-tasktype';
import MigrateConsolidations from './migrations/migrate-consolidations';
import MigrateCaseAppointments from './migrations/migrate-case-appointments';
import MigrateTrustees from './migrations/migrate-trustees';
import ResyncCasesByDate from './migrations/resync-cases-by-date';
import ResyncRemainingCases from './migrations/resync-remaining-cases';
import ResyncTerminalTransactionCases from './migrations/resync-terminal-transaction-cases';
import SyncCases from './import/sync-cases';
import SyncDeletedCases from './import/sync-deleted-cases';
import SyncOrders from './import/sync-orders';
import SyncOfficeStaff from './import/sync-office-staff';
import SyncTrusteeCaseAppointments from './import/sync-trustee-case-appointments';
import SyncAcmsProfessionalIds from './import/sync-acms-professional-ids';
import SyncTrusteeNotesMetrics from './metrics/sync-trustee-notes-metrics';
import SyncTrusteeDueDateMetrics from './metrics/sync-trustee-due-date-metrics';
import PollNotificationBounces from './metrics/poll-notification-bounces';
import StaffAssignmentDownstream from './downstream/staff-assignment-downstream';
import TrusteeAppointmentDownstream from './downstream/trustee-appointment-downstream';
import TrusteeVerificationRemap from './trustee-verification-remap';
import AcmsDailySync from './downstream/acms-daily-sync';
import BackfillTrusteeAppointmentsDownstreamDataflow from './migrations/backfill-trustee-appointments-downstream';
import BackfillTransferOrderTaskDate from './migrations/backfill-transfer-order-task-date';
import BackfillConsolidationOrderTaskDate from './migrations/backfill-consolidation-order-task-date';
import BackfillTrusteeVerificationTaskDate from './migrations/backfill-trustee-verification-task-date';
import BackfillUnassignedOn from './migrations/backfill-unassigned-on';

const MODULE_NAME = 'DATAFLOWS-SETUP';

type DataflowSetup = {
  MODULE_NAME: string;
  setup: () => void;
};

const logger = new LoggerImpl('bootstrap');

function listDataflowNames(...dataflows: DataflowSetup[]): string[] {
  return dataflows.map((dataflow) => dataflow.MODULE_NAME);
}

function envVarToNames(envVar: string | undefined) {
  if (!envVar) {
    return [];
  }
  return envVar
    .toUpperCase()
    .replaceAll('_', '-')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

class DataflowSetupMap {
  private readonly map = new Map<string, () => void>();

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
  BackfillCaseAppointmentDates,
  BackfillTrusteePhoneticTokens,
  CaseAssignmentEvent,
  CaseClosedEvent,
  DivisionChangeCleanup,
  FixChapter7Appointments,
  HandleMissedDivisionChanges,
  ImportZoomCsv,
  MigrateAssignees,
  MigrateCaseAppointments,
  MigrateCases,
  MigrateChildCasesToMemberCases,
  MigrateOrderTypeToTaskType,
  MigrateConsolidations,
  MigrateTrustees,
  ResyncCasesByDate,
  ResyncRemainingCases,
  ResyncTerminalTransactionCases,
  SyncCases,
  SyncDeletedCases,
  SyncOfficeStaff,
  SyncOrders,
  SyncTrusteeCaseAppointments,
  SyncAcmsProfessionalIds,
  SyncTrusteeNotesMetrics,
  SyncTrusteeDueDateMetrics,
  StaffAssignmentDownstream,
  TrusteeAppointmentDownstream,
  TrusteeVerificationRemap,
  AcmsDailySync,
  BackfillTrusteeAppointmentsDownstreamDataflow,
  BackfillTransferOrderTaskDate,
  BackfillConsolidationOrderTaskDate,
  BackfillTrusteeVerificationTaskDate,
  BackfillUnassignedOn,
  PollNotificationBounces,
);

const registeredDataflows = dataflows.list().join(', ').replaceAll('-', '_');
logger.info(MODULE_NAME, 'Registered Dataflows', registeredDataflows);

const DEFAULT_DATAFLOWS = listDataflowNames(
  AcmsDailySync,
  CaseAssignmentEvent,
  CaseClosedEvent,
  PollNotificationBounces,
  SyncCases,
  SyncDeletedCases,
  SyncOfficeStaff,
  SyncOrders,
  SyncTrusteeCaseAppointments,
  SyncAcmsProfessionalIds,
  SyncTrusteeDueDateMetrics,
  SyncTrusteeNotesMetrics,
  TrusteeVerificationRemap,
);

const additional = envVarToNames(process.env.CAMS_ENABLED_DATAFLOWS);
const names = [...DEFAULT_DATAFLOWS, ...additional];
const status = dataflows.setup(...names);

status.forEach((s) => {
  logger.info(MODULE_NAME, `${s}`);
});
