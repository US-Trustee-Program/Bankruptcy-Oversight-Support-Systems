import * as dotenv from 'dotenv';

import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { initializeApplicationInsights } from '../azure/app-insights';
import CaseAssignmentEvent from './events/case-assignment-event';
import CaseClosedEvent from './events/case-closed-event';
import SyncCases from './import/sync-cases';
import SyncOfficeStaff from './import/sync-office-staff';
import SyncOrders from './import/sync-orders';
import MigrateAssignees from './migrations/migrate-assignees';
import MigrateCases from './migrations/migrate-cases';
import MigrateConsolidations from './migrations/migrate-consolidations';

/*

dataflows.ts

This module calls setup functions for each "registered" data flow. Each data flow is defined in a module that exports the DataFlowSetup interface. Calling setup configures Azure infrastructure to provision the Azure Function.

A comma-delimited list of the MODULE_NAME values is required to appear in a comma-delimited list in the CAMS_ENABLED_DATAFLOWS environment variable. Due to how hyphens are interpreted in scripts, all hyphens that appear in a given MODULE_NAME must be replaced with underscores.

Any module name not listed is not setup and will not appear in the list of Azure Functions in Azure Portal. This enables data flows to be setup
independently across environments.

The configuration is logged on startup. Example:

[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Registered Dataflows SYNC_CASES, SYNC_OFFICE_STAFF, SYNC_ORDERS, MIGRATE_CASES, MIGRATE_CONSOLIDATIONS
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Dataflow name FOO not found
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC_CASES', true ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC_OFFICE_STAFF', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'SYNC_ORDERS', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'MIGRATE_CASES', false ]
[2025-03-14T22:41:31.717Z] DATAFLOWS_SETUP Enabled [ 'MIGRATE_CONSOLIDATIONS', false ]

*/

const MODULE_NAME = 'DATAFLOWS-SETUP';

type DataflowSetup = {
  MODULE_NAME: string;
  setup: () => void;
};

const logger = new LoggerImpl('bootstrap');

class DataflowSetupMap {
  private map = new Map<string, () => void>();

  list() {
    return [...this.map.keys()];
  }

  register(...dataflows: DataflowSetup[]) {
    for (const dataflow of dataflows) {
      this.map.set(dataflow.MODULE_NAME, dataflow.setup);
    }
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

function envVarToNames(envVar: string) {
  return envVar
    .toUpperCase()
    .replace(/_/g, '-')
    .split(',')
    .map((name) => name.trim());
}
const dataflows = new DataflowSetupMap();

// Setup environment and AppInsights.
dotenv.config();
initializeApplicationInsights();

// Register data flows.
dataflows.register(
  CaseAssignmentEvent,
  CaseClosedEvent,
  SyncCases,
  SyncOfficeStaff,
  SyncOrders,
  MigrateCases,
  MigrateConsolidations,
  MigrateAssignees,
);

// Log the list of registered data flows.
const registeredDataflows = dataflows.list().join(', ').replace(/-/g, '_');
logger.info(MODULE_NAME, 'Registered Dataflows', registeredDataflows);

// Enable the data flows specified in from the configuration env var.
const names = envVarToNames(process.env.CAMS_ENABLED_DATAFLOWS ?? '');
const status = dataflows.setup(...names);

// Log the status of each registered data flow.
status.forEach((s) => {
  logger.info(MODULE_NAME, `${s}`);
});
