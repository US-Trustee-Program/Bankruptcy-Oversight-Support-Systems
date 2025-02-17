import { setupMigrateCases } from './import/migrate-cases';
import { setupMigrateConsolidations } from './import/migrate-consolidations';
import { setupSyncCases } from './import/sync-cases';

setupSyncCases();

// Migrations can be removed once they are complete.

const enableMigrateCases = true;
if (enableMigrateCases) setupMigrateCases();

const enableMigrateConsolidations = false;
if (enableMigrateConsolidations) setupMigrateConsolidations();
