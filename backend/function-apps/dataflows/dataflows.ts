import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../azure/app-insights';

import SyncCases from './import/sync-cases';
import SyncOrders from './import/sync-orders';
import SyncOfficeStaff from './import/sync-office-staff';
import MigrateCases from './import/migrate-cases';
import MigrateConsolidations from './import/migrate-consolidations';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';

const MODULE_NAME = 'DATAFLOWS_SETUP';

type DataflowSetup = {
  MODULE_NAME: string;
  setup: () => void;
};

const logger = new LoggerImpl('bootstrap');

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
    const uniqueNames = new Set<string>(names);
    const status = [];

    for (const name of uniqueNames) {
      if (this.map.has(name)) {
        this.map.get(name)();
        status.push([name, true]);
      } else {
        logger.warn(MODULE_NAME, `Dataflow name ${name} not found.`);
      }
    }
    for (const name of this.list()) {
      if (!uniqueNames.has(name)) {
        status.push([name, false]);
      }
    }
    return status;
  }
}
const dataflows = new DataflowSetupMap();

// Setup environment and AppInsights.
dotenv.config();
initializeApplicationInsights();

// Register data flows.
dataflows.register(SyncCases, SyncOfficeStaff, SyncOrders, MigrateCases, MigrateConsolidations);

// Log the list of registered data flows.
const registeredDataflows = dataflows.list().join(', ');
logger.info(MODULE_NAME, 'Registered Dataflows', registeredDataflows);

// Enable the data flows specified in from the configuration env var.
const envVar = process.env.CAMS_ENABLE_DATAFLOWS ?? '';
const names = envVar.split(',').map((name) => name.trim().toUpperCase());
const status = dataflows.setup(...names);

// Log the status of each registered data flow.
status.forEach((s) => {
  logger.info(MODULE_NAME, s);
});

/*

Sample log output on startup:

[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Registered Dataflows SYNC-CASES, SYNC-OFFICE-STAFF, SYNC-ORDERS, MIGRATE-CASES, MIGRATE-CONSOLIDATIONS
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Dataflow name FOO not found
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC-CASES', true ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC-OFFICE-STAFF', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC-ORDERS', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'MIGRATE-CASES', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'MIGRATE-CONSOLIDATIONS', false ]

*/
