import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../azure/app-insights';

import SyncCases from './import/sync-cases';
import SyncOrders from './import/sync-orders';
import SyncOfficeStaff from './import/sync-office-staff';
import MigrateCases from './import/migrate-cases';
import MigrateConsolidations from './import/migrate-consolidations';
import { LoggerImpl } from '../../lib/adapters/services/logger.service';

/*

dataflows.ts

This module calls setup functions for each "registered" data flow. Each data flow is defined in a module that exports the DataFlowSetup interface.
Calling setup configures Azure infrastructure to provision the Azure Function.

A comma delimited list of the MODULE_NAME values is required to appear in a comma delimited list in the CAMS_ENABLE_DATAFLOWS environment variable.
Any module name not listed is not setup and will not appear in the list of Azure Functions in Azure Portal. This enables data flows to be setup
independenly across environments.

The configuration is logged on startup. Example:

[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Registered Dataflows SYNC-CASES, SYNC-OFFICE-STAFF, SYNC-ORDERS, MIGRATE-CASES, MIGRATE-CONSOLIDATIONS
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Dataflow name FOO not found
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC-CASES', true ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC-OFFICE-STAFF', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC-ORDERS', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'MIGRATE-CASES', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'MIGRATE-CONSOLIDATIONS', false ]

*/

const MODULE_NAME = 'DATAFLOWS-SETUP';

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
    const uniqueNames = new Set(names);
    const status: [string, boolean][] = [];

    // Enable registered data flows based on config.
    for (const [name, setupFunc] of this.map.entries()) {
      const enabled = uniqueNames.has(name);
      if (enabled) {
        setupFunc();
      }
      status.push([name, enabled]);
    }

    // Warn for names in config that are not registered.
    uniqueNames.forEach((name) => {
      if (!this.map.has(name)) {
        logger.warn(MODULE_NAME, `Dataflow name ${name} not found.`);
      }
    });

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
  logger.info(MODULE_NAME, `${s}`);
});
