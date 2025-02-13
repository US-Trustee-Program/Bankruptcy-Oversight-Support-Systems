import { setupExportAndLoadCase } from './import/export-and-load-case';
import { setupMigrateCases2 } from './import/migrate-cases-2';
import { setupStoreCasesRuntimeState } from './import/store-cases-runtime-state';
import { setupSyncCases } from './import/sync-cases';

setupExportAndLoadCase();
setupStoreCasesRuntimeState();
setupSyncCases();

// This can be disabled/removed once migration is complete.
// setupMigrateCases();
setupMigrateCases2();

// TODO: Re-enable setup so migrations can be executed.
// import { migrationSetup } from './migration/migration';
// migrationSetup();
