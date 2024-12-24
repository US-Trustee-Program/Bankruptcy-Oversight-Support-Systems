import * as dotenv from 'dotenv';
import migrateConsolidation from '../../../function-apps/migration/queueTrigger/migrateConsolidation';
import { createMockAzureFunctionContext } from '../../../function-apps/azure/testing-helpers';

dotenv.config({ path: '../../../.env' });

const MODULE_NAME = 'ITEST';

/*
081-99-29871 - primary
081-99-83891
081-99-31281
*/

async function testAcmsMigration() {
  const invocationContext = createMockAzureFunctionContext({ ...process.env });

  try {
    const leadCaseId = '819929871';
    const result = await migrateConsolidation(leadCaseId, invocationContext);
    console.log(result);
  } catch (error) {
    console.error(MODULE_NAME, error);
  } finally {
    console.log('Done.', '\n');
  }
}

if (require.main === module) {
  (async () => {
    await testAcmsMigration();
    process.exit(0);
  })();
}
