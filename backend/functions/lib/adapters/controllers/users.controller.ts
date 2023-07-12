import { ApplicationContext } from '../types/basic';
import { applicationContextCreator } from '../utils/application-context-creator';
import { Context } from '@azure/functions';
import log from '../services/logger.service';
import proxyData from '../data-access.proxy';
import useCase from '../../use-cases/index';
import { UserPersistenceGateway } from '../types/persistence.gateway';

const NAMESPACE = 'USERS-CONTROLLER';

export class UsersController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
  }

  public async getUser(userName: { firstName: string; lastName: string }) {
    log.info(
      this.applicationContext,
      NAMESPACE,
      'getUser - fetching a user id, given a first and last name.',
    );

    const usersDb: UserPersistenceGateway = (await proxyData(
      this.applicationContext,
      'users',
    )) as UserPersistenceGateway;

    return await useCase.login(this.applicationContext, usersDb, userName);
  }
}
