import { InvocationContext } from '@azure/functions';
import migrateConsolidation from '../../../migration/activity/migrateConsolidation';

const MODULE_NAME = 'ITEST';

/*
081-99-29871 - primary
081-99-83891
081-99-31281
*/

async function testAcmsMigration() {
  const invocationContext = new InvocationContext();

  try {
    const leadCaseId = '819929871';
    const result = await migrateConsolidation.handler(leadCaseId, invocationContext);
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
  })();
}
