import { seedCosmosE2eDatabase } from '../../../backend/function-apps/dataflows/e2e/data-generation-utils';

// Replace this with http request to '{dataflows base url}/import/load-e2e-db'
// Do not remove this though, move it to ../../../backend/function-apps/dataflows/e2e/load-e2e-db.ts
seedCosmosE2eDatabase().then(() => {
  process.exit();
});
