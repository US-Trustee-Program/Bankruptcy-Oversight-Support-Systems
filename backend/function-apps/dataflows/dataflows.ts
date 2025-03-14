import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../azure/app-insights';

import { setupMigrateCases } from './import/migrate-cases';
import { setupSyncCases } from './import/sync-cases';
import { setupSyncOrders } from './import/sync-orders';
import { setupSyncOfficeStaff } from './import/sync-office-staff';
import { setupMigrateConsolidations } from './import/migrate-consolidations';

// Setup environment and AppInsights.
dotenv.config();
initializeApplicationInsights();

// Setup the recurring synchronization.
setupSyncCases();
setupSyncOfficeStaff();
setupSyncOrders();

// Setup migrations. Migrations can be removed once they are complete.
const enableMigrateCases = false;
if (enableMigrateCases) setupMigrateCases();

const enableMigrateConsolidations = true;
if (enableMigrateConsolidations) setupMigrateConsolidations();
