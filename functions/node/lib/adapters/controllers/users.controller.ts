import log from '../services/logger.service';
import useCase from '../../use-cases/index.js';
import { UserPersistenceGateway } from "../types/persistence-gateway.js";
import proxyData from "../data-access.proxy";
import { LogContext } from '../types/basic';

const NAMESPACE = "USERS-CONTROLLER";

export class UsersController {
  private context: LogContext;

  constructor(context: LogContext) {
    this.context = context;
  }

  public async getUser(userName: {firstName: string, lastName: string}) {
    log.info(this.context, NAMESPACE, 'getUser - fetching a user id, given a first and last name.');

    const usersDb: UserPersistenceGateway = (await proxyData(this.context, 'users')) as UserPersistenceGateway;

    return await useCase.login(this.context, usersDb, userName );
  }
}
