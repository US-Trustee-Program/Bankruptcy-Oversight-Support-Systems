import { setupExportAndLoadCase } from './import/export-and-load-case';
import { setupMigrateCases } from './import/migrate-cases';
import { setupStoreCasesRuntimeState } from './import/store-cases-runtime-state';
import { setupSyncCases } from './import/sync-cases';

setupExportAndLoadCase();
setupStoreCasesRuntimeState();
setupSyncCases();

// This can be disabled/removed once migration is complete.
setupMigrateCases();

// TODO: Re-enable setup so migrations can be executed.
// import { migrationSetup } from './migration/migration';
// migrationSetup();
