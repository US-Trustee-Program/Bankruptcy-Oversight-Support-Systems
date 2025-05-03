import { InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import ContextCreator from '../../../function-apps/azure/application-context-creator';
import { LoggerImpl } from '../../adapters/services/logger.service';
import Factory from '../../factory';

dotenv.config({ path: '../../../.env' });

const MODULE_NAME = 'ITEST';

async function testOfficeNames() {
  const context = await ContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
    logger: new LoggerImpl('office-names-test'),
  });

  function log(...values: unknown[]) {
    values.forEach((value) => {
      if (typeof value === 'object') {
        context.logger.info(MODULE_NAME, JSON.stringify(value, null, 0));
      } else {
        context.logger.info(MODULE_NAME, String(value));
      }
    });
  }

  try {
    const gateway = Factory.getOfficesGateway(context);
    const offices = await gateway.getOffices(context);
    offices.forEach((office) => {
      if (!office.officeName) {
        log('No office name for', office);
      }
    });
  } catch (error) {
    context.logger.error(MODULE_NAME, error);
  } finally {
    log('Done.', '\n');
  }
}

if (require.main === module) {
  (async () => {
    await testOfficeNames();
    process.exit(0);
  })();
}
