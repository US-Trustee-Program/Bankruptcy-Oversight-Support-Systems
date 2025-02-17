import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../azure/app-insights';

import { setupMigrateCases } from './import/migrate-cases';
import { setupMigrateConsolidations } from './import/migrate-consolidations';
import { setupSyncCases } from './import/sync-cases';
import { setupSyncOrders } from './import/sync-orders';
import { setupSyncOfficeStaff } from './import/sync-office-staff';

// Setup environment and AppInsights.
dotenv.config();
initializeApplicationInsights();

// Setup the recurring syncronization.
setupSyncCases();
setupSyncOfficeStaff();
setupSyncOrders();

// Setup migrations. Migrations can be removed once they are complete.
const enableMigrateCases = true;
if (enableMigrateCases) setupMigrateCases();

const enableMigrateConsolidations = false;
if (enableMigrateConsolidations) setupMigrateConsolidations();
