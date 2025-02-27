import { seedCosmosE2eDatabase } from './data-generation-utils';

seedCosmosE2eDatabase().then(() => {
  process.exit();
});
