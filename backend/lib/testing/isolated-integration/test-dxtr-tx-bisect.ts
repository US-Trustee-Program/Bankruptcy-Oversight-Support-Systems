import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import { LoggerImpl } from '../../adapters/services/logger.service';
import ContextCreator from '../../../function-apps/azure/application-context-creator';
import Factory from '../../factory';

dotenv.config({ path: '../../../.env' });

const MODULE_NAME = 'ITEST';

// TODO: do we still need this (comment or even the file itself)?
// NOTE: Disable "type": "module" in the common package.json temporarily to get past the CommonJS/require() issue.

async function testBisect() {
  const context = await ContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
    logger: new LoggerImpl('dxtr-tx-bisect'),
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
    const gateway = Factory.getCasesGateway(context);
    const dates = ['2016-03-16', '2015-03-16', '2016-03-03', '1990-01-01', '2070-01-01'];
    for (const date of dates) {
      const answer = await gateway.findTransactionIdRangeForDate(context, date);
      log(answer);
    }
  } catch (error) {
    context.logger.error(MODULE_NAME, error);
  } finally {
    log('Done.', '\n');
  }
}

if (require.main === module) {
  (async () => {
    await testBisect();
    process.exit(0);
  })();
}
