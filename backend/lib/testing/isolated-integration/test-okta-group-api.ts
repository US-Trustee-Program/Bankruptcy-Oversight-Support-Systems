import { InvocationContext } from '@azure/functions';
import { LoggerImpl } from '../../adapters/services/logger.service';
import applicationContextCreator from '../../../function-apps/azure/application-context-creator';
import { UserGroupGatewayConfig } from '../../adapters/types/authorization';
import { getUserGroupGatewayConfig } from '../../configs/user-groups-gateway-configuration';
import OktaUserGroupGateway from '../../adapters/gateways/okta/okta-user-group-gateway';
import { OfficesUseCase } from '../../use-cases/offices/offices';

const MODULE_NAME = 'ITEST';

async function testOktaGroupApi() {
  const context = await applicationContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
    logger: new LoggerImpl('integration-test'),
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

  log('Isolated Integration Test: Okta Group Api', '\n');

  const config: UserGroupGatewayConfig = getUserGroupGatewayConfig();
  log(config, '\n');

  try {
    const groups = await OktaUserGroupGateway.getUserGroups(context, config);
    log('groups', groups, '\n');

    for (const group of groups) {
      const users = await OktaUserGroupGateway.getUserGroupUsers(context, config, group);
      log(`${group.name} users`, users, '\n');
    }

    const useCase = new OfficesUseCase();
    const results = await useCase.syncOfficeStaff(context);

    const attorneys = await useCase.getOfficeAttorneys(
      context,
      'USTP_CAMS_Region_2_Office_Manhattan',
    );
    log('attorneys', attorneys, '\n');
    log('syncOfficeStaff', results, '\n');
  } catch (error) {
    context.logger.error(MODULE_NAME, error);
  } finally {
    log('Done.', '\n');
  }
}

if (require.main === module) {
  (async () => {
    await testOktaGroupApi();
  })();
}