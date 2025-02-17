import { setupMigrateCases } from './import/migrate-cases';
import { setupSyncCases } from './import/sync-cases';

// This can be disabled/removed once case migration is complete.
setupMigrateCases();
setupSyncCases();

// TODO: Re-enable setup so consolidation migrations can be executed.
// import { migrationSetup } from './migration/migration';
// migrationSetup();
