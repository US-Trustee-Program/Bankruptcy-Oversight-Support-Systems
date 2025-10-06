import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { clearAllCollections } from './db-utils';

describe('should never clear a database that is not an e2e database', () => {
  test('should not clear the database', async () => {
    const context = await createMockApplicationContext();
    context.config.documentDbConfig.databaseName = 'real-database';
    await expect(clearAllCollections(context)).rejects.toThrow();
  });
});
