import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../azure/app-insights';

import SyncCases from './import/sync-cases';
import SyncOrders from './import/sync-orders';
import SyncOfficeStaff from './import/sync-office-staff';
import MigrateCases from './import/migrate-cases';
import MigrateConsolidations from './import/migrate-consolidations';

const MODULE_NAME = 'DATAFLOWS_SETUP';

type DataflowSetup = {
  MODULE_NAME: string;
  setup: () => void;
};

class DataflowSetupMap extends Map<string, () => void> {
  add(...dataflows: DataflowSetup[]) {
    for (const dataflow of dataflows) {
      this.set(dataflow.MODULE_NAME, dataflow.setup);
    }
  }

  list() {
    return [...this.keys()];
  }

  enable(...dataflowNames: string[]) {
    const cleanNames = dataflowNames.map((name) => name.trim().toUpperCase());
    const status = [];

    for (const dataflowName of cleanNames) {
      if (this.has(dataflowName)) {
        this.get(dataflowName)();
        status.push([dataflowName, true]);
      } else {
        console.warn(MODULE_NAME, 'Dataflow name', dataflowName, 'not found');
      }
    }
    for (const dataflowName of this.list()) {
      if (!cleanNames.includes(dataflowName)) {
        status.push([dataflowName, false]);
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
dataflows.add(SyncCases, SyncOfficeStaff, SyncOrders, MigrateCases, MigrateConsolidations);

// Log the list of registered data flows.
const registeredDataflows = dataflows.list().join(', ');
console.log(MODULE_NAME, 'Registered Dataflows', registeredDataflows);

// Enable the data flows specified in from the configuration env var.
const envVar = process.env.CAMS_ENABLE_DATAFLOWS;
const dataflowNames = envVar.split(',');
const status = dataflows.enable(...dataflowNames);

// Log the status of each registered data flow.
status.forEach((s) => {
  console.log(MODULE_NAME, 'Enabled', s);
});

/*

Sample log output on startup:

[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Available Dataflows SYNC-CASES, SYNC-OFFICE-STAFF, SYNC-ORDERS, MIGRATE-CASES, MIGRATE-CONSOLIDATIONS
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Dataflow name FOO not found
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC-CASES', true ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC-OFFICE-STAFF', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC-ORDERS', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'MIGRATE-CASES', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'MIGRATE-CONSOLIDATIONS', false ]

*/
